import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { setImmediate as yieldLoop } from 'node:timers/promises';
import { Engine } from '../src/server/engine.ts';
import { Store } from '../src/server/store.ts';
import { parseEnvelope, parsePlan, validateInput } from '../src/server/core/protocol.ts';
import type { Context } from '../src/server/core/prompts.ts';
import type { AgentEnvelope, CreateRunInput, Run, TaskSpec, TurnInput, TurnRunner } from '../src/shared/types.ts';

const members = ['a', 'b', 'c', 'd', 'e'].map(id => ({
  id, name: `Agent ${id}`, connectionId: 'demo', model: '', role: '',
}));
const input: CreateRunInput = {
  goal: 'Prepare a useful technical project report', mode: 'demo', leaderId: 'a', members: members.slice(0, 2),
};
const defaultTasks: TaskSpec[] = [
  { id: 'task-a', title: 'Prepare report', description: 'Write a report', assigneeId: 'a', dependsOn: [] },
];
const contextOf = (value: TurnInput): Context => JSON.parse(value.prompt.split('\nCONTEXT:\n')[1]) as Context;
const envelope = (fields: Partial<AgentEnvelope> = {}) => ({ text: JSON.stringify({
  summary: 'Completed scripted work', status: 'done', messages: [], ...fields,
}) });
function plan(run: Run, tasks = defaultTasks, summary = 'Scripted plan') {
  return { text: JSON.stringify({
    summary, successCriteria: ['Report includes findings'],
    roles: run.members.map(member => ({ memberId: member.id, role: member.id === run.leaderId ? 'Lead' : 'Review' })),
    tasks,
  }) };
}
const successfulRunner: TurnRunner = async value => {
  const { run } = contextOf(value);
  if (value.purpose === 'plan') return plan(run);
  if (value.purpose === 'review') return envelope({ verdict: 'pass', artifact: { title: 'Review', body: 'Report meets criteria' } });
  return envelope({ artifact: { title: value.purpose, body: 'Scripted report content' } });
};
async function until(predicate: () => boolean, describe = 'expected state'): Promise<void> {
  const deadline = Date.now() + 2500;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 2));
  }
  assert.fail(`Timed out waiting for ${describe}`);
}
function seedRun(fields: Partial<Run> = {}): Run {
  const now = '2026-10-07T00:00:00.000Z';
  return {
    ...input, id: 'recovered-run', title: 'Recovered work', status: 'running', phase: 'tasks',
    tasks: defaultTasks.map(task => ({ ...task, status: 'running', turns: 1 })),
    messages: [], artifacts: [], sessions: { a: 'prior-session' }, turnCount: 2, reviewRound: 0,
    createdAt: now, updatedAt: now, version: 3, ...fields,
  };
}
function setup(runner: TurnRunner = successfulRunner, seed?: Run) {
  const workspaceRoot = mkdtempSync(join(tmpdir(), 'power-engine-extra-'));
  const store = new Store(':memory:');
  if (seed) store.createRun(seed, { type: 'seed', message: 'Previously running work' });
  const engine = new Engine({ store, connections: [], workspaceRoot, demoRunner: runner });
  return {
    store, engine,
    async clean() {
      engine.shutdown();
      await yieldLoop(); await yieldLoop();
      store.close(); rmSync(workspaceRoot, { recursive: true, force: true });
    },
  };
}

test('restart recovery pauses interrupted work, requeues questions, and resumes with saved sessions', async () => {
  const calls: TurnInput[] = [];
  const runner: TurnRunner = async value => {
    calls.push(value);
    const result = await successfulRunner(value);
    return { ...result, sessionId: `renewed-${value.member.id}` };
  };
  const seed = seedRun({ messages: [{
    id: 'question', fromId: 'a', toId: 'b', body: 'Check the report requirements',
    request: true, taskId: 'task-a', status: 'delivered', createdAt: '2026-10-07T00:00:00.000Z',
  }] });
  const app = setup(runner, seed);
  try {
    const recovered = app.engine.get(seed.id);
    assert.equal(recovered.status, 'paused');
    assert.equal(recovered.tasks[0].status, 'pending');
    assert.equal(recovered.messages[0].status, 'queued');
    assert.match(recovered.error!, /перезапущен/);
    assert.equal(calls.length, 0);
    const resumed = app.engine.control(seed.id, 'resume');
    assert.equal(resumed.status, 'running');
    assert.equal(resumed.error, undefined);
    await until(() => app.engine.get(seed.id).status === 'completed');
    const complete = app.engine.get(seed.id);
    assert.equal(complete.messages.find(message => message.id === 'question')?.status, 'answered');
    assert.ok(complete.messages.some(message => message.replyTo === 'question'));
    assert.equal(calls.find(call => call.member.id === 'a')?.sessionId, 'prior-session');
    assert.equal(complete.sessions.a, 'renewed-a');
    assert.ok(app.store.events(seed.id).some(event => event.type === 'recovered'));
  } finally { await app.clean(); }
});

test('recovering an interrupted planning turn requires resume and returns to the approval barrier', async () => {
  const seed = seedRun({ status: 'planning', phase: 'plan', tasks: [] });
  const app = setup(successfulRunner, seed);
  try {
    assert.equal(app.engine.get(seed.id).status, 'paused');
    assert.equal(app.engine.control(seed.id, 'resume').status, 'planning');
    await until(() => app.engine.get(seed.id).status === 'awaiting_approval');
    assert.equal(app.engine.get(seed.id).tasks.length, 0);
  } finally { await app.clean(); }
});

test('a failed runner pauses the run and failed task can be retried successfully', async () => {
  let taskAttempts = 0;
  const runner: TurnRunner = async value => {
    if (value.purpose === 'task' && ++taskAttempts === 1) throw new Error('Scripted provider unavailable');
    return successfulRunner(value);
  };
  const app = setup(runner);
  try {
    const run = app.engine.create(input);
    await until(() => app.engine.get(run.id).status === 'awaiting_approval');
    app.engine.approve(run.id, app.engine.get(run.id).version);
    await until(() => app.engine.get(run.id).status === 'paused');
    const paused = app.engine.get(run.id);
    assert.match(paused.error!, /Scripted provider unavailable/);
    assert.equal(paused.tasks[0].status, 'failed');
    assert.ok(app.store.events(run.id).some(event => event.type === 'error'));
    const retry = app.engine.control(run.id, 'resume');
    assert.equal(retry.tasks[0].status, 'pending');
    assert.equal(retry.tasks[0].error, undefined);
    await until(() => app.engine.get(run.id).status === 'completed');
    assert.equal(taskAttempts, 2);
    assert.equal(app.engine.get(run.id).tasks[0].turns, 2);
  } finally { await app.clean(); }
});

test('user feedback on a proposed plan triggers replanning and invalidates stale approval', async () => {
  const seenFeedback: string[] = [];
  const runner: TurnRunner = async value => {
    if (value.purpose !== 'plan') return successfulRunner(value);
    const { run } = contextOf(value);
    const feedback = run.messages.filter(message => message.fromId === 'user').map(message => message.body).join('\n');
    seenFeedback.push(feedback);
    return plan(run, defaultTasks, feedback ? `Revised plan: ${feedback}` : 'First plan');
  };
  const app = setup(runner);
  try {
    const run = app.engine.create(input);
    await until(() => app.engine.get(run.id).status === 'awaiting_approval');
    const proposed = app.engine.get(run.id);
    const replanning = app.engine.message(run.id, '  Include rollback instructions  ');
    assert.equal(replanning.status, 'planning');
    assert.equal(replanning.plan, undefined);
    assert.equal(replanning.messages[0].body, 'Include rollback instructions');
    await until(() => app.engine.get(run.id).status === 'awaiting_approval');
    const revised = app.engine.get(run.id);
    assert.deepEqual(seenFeedback, ['', 'Include rollback instructions']);
    assert.match(revised.plan!.summary, /Include rollback/);
    assert.equal(revised.messages[0].status, 'delivered');
    assert.equal(revised.tasks.length, 0);
    assert.throws(() => app.engine.approve(run.id, proposed.version), /обновлён/);
    app.engine.approve(run.id, revised.version);
    await until(() => app.engine.get(run.id).status === 'completed');
  } finally { await app.clean(); }
});

test('review feedback produces a revised final artifact before independent approval', async () => {
  const purposes: string[] = [];
  const runner: TurnRunner = async value => {
    purposes.push(value.purpose);
    const { run } = contextOf(value);
    if (value.purpose === 'synthesize') {
      const review = run.artifacts.filter(artifact => artifact.kind === 'review').at(-1);
      return envelope({ artifact: { title: 'Final report', body: review ? `Corrected report: ${review.body}` : 'Initial report' } });
    }
    if (value.purpose === 'review') return envelope({
      verdict: run.reviewRound === 0 ? 'changes_requested' : 'pass',
      artifact: { title: 'Review', body: run.reviewRound === 0 ? 'Add failure recovery' : 'Recovery now addressed' },
    });
    return successfulRunner(value);
  };
  const app = setup(runner);
  try {
    const run = app.engine.create(input);
    await until(() => app.engine.get(run.id).status === 'awaiting_approval');
    app.engine.approve(run.id, app.engine.get(run.id).version);
    await until(() => app.engine.get(run.id).status === 'completed');
    const complete = app.engine.get(run.id);
    assert.equal(complete.reviewRound, 2);
    assert.deepEqual(purposes, ['plan', 'task', 'synthesize', 'review', 'synthesize', 'review']);
    const finals = complete.artifacts.filter(artifact => artifact.kind === 'final');
    assert.equal(finals.length, 2);
    assert.match(finals[1].body, /Corrected report: Add failure recovery/);
    assert.ok(complete.artifacts.filter(artifact => artifact.kind === 'review').every(artifact => artifact.authorId !== complete.leaderId));
  } finally { await app.clean(); }
});

test('scheduler caps concurrency at three, serializes each member, and waits for dependencies', async () => {
  const tasks: TaskSpec[] = [
    ...['a', 'a', 'b', 'c', 'd', 'e'].map((id, index) => ({
      id: `task-${index}`, title: `Work ${index}`, description: 'Prepare material', assigneeId: id, dependsOn: [],
    })),
    { id: 'dependent', title: 'Combine', description: 'Combine completed material', assigneeId: 'e', dependsOn: ['task-1', 'task-2'] },
  ];
  const active = new Set<string>();
  const releases: (() => void)[] = [];
  const started: string[] = [];
  const violations: string[] = [];
  let maximum = 0;
  const runner: TurnRunner = async value => {
    const { run, taskId } = contextOf(value);
    if (value.purpose === 'plan') return plan(run, tasks);
    if (value.purpose !== 'task') return successfulRunner(value);
    if (active.has(value.member.id)) violations.push(`Concurrent turns for ${value.member.id}`);
    const task = run.tasks.find(candidate => candidate.id === taskId)!;
    if (task.dependsOn.some(id => run.tasks.find(candidate => candidate.id === id)?.status !== 'completed')) {
      violations.push(`Premature dependency ${taskId}`);
    }
    active.add(value.member.id); started.push(taskId!); maximum = Math.max(maximum, active.size);
    return new Promise((resolve, reject) => {
      const abort = () => { active.delete(value.member.id); reject(new Error('Test runner aborted')); };
      value.signal.addEventListener('abort', abort, { once: true });
      releases.push(() => {
        value.signal.removeEventListener('abort', abort); active.delete(value.member.id);
        resolve(envelope({ artifact: { title: task.title, body: `Output ${taskId}` } }));
      });
    });
  };
  const app = setup(runner);
  try {
    const run = app.engine.create({ ...input, members });
    await until(() => app.engine.get(run.id).status === 'awaiting_approval');
    app.engine.approve(run.id, app.engine.get(run.id).version);
    await until(() => active.size === 3);
    assert.deepEqual(started, ['task-0', 'task-2', 'task-3']);
    assert.ok(!started.includes('task-1'));
    for (let finished = 0; finished < tasks.length; finished++) {
      await until(() => releases.length > 0, 'a releasable task');
      releases.shift()!();
      await yieldLoop(); await yieldLoop();
    }
    await until(() => app.engine.get(run.id).status === 'completed');
    assert.equal(maximum, 3);
    assert.deepEqual(violations, []);
    assert.equal(new Set(started).size, tasks.length);
    assert.ok(started.indexOf('task-1') > started.indexOf('task-0'));
    assert.ok(app.engine.get(run.id).tasks.every(task => task.status === 'completed'));
  } finally { await app.clean(); }
});

test('three unsuccessful reviews pause the run with actionable feedback', async () => {
  const runner: TurnRunner = async value => value.purpose === 'review'
    ? envelope({ verdict: 'changes_requested', artifact: { title: 'Review', body: 'Still missing acceptance criteria' } })
    : successfulRunner(value);
  const app = setup(runner);
  try {
    const run = app.engine.create(input);
    await until(() => app.engine.get(run.id).status === 'awaiting_approval');
    app.engine.approve(run.id, app.engine.get(run.id).version);
    await until(() => app.engine.get(run.id).status === 'paused');
    const paused = app.engine.get(run.id);
    assert.equal(paused.reviewRound, 3);
    assert.equal(paused.phase, 'synthesize');
    assert.match(paused.error!, /трёх проверок/);
    assert.equal(paused.artifacts.filter(artifact => artifact.kind === 'review').length, 3);
  } finally { await app.clean(); }
});

test('invalid waiting response pauses instead of leaving an unresolvable task', async () => {
  const runner: TurnRunner = async value => value.purpose === 'task'
    ? envelope({ status: 'waiting', messages: [] }) : successfulRunner(value);
  const app = setup(runner);
  try {
    const run = app.engine.create(input);
    await until(() => app.engine.get(run.id).status === 'awaiting_approval');
    app.engine.approve(run.id, app.engine.get(run.id).version);
    await until(() => app.engine.get(run.id).status === 'paused');
    assert.match(app.engine.get(run.id).error!, /не задал вопрос/);
    assert.equal(app.engine.get(run.id).tasks[0].status, 'failed');
  } finally { await app.clean(); }
});

test('public controls reject invalid state transitions and conflicting active runs', async () => {
  const app = setup(successfulRunner, seedRun({ status: 'paused' }));
  try {
    assert.throws(() => app.engine.get('missing'), /не найдена/);
    assert.throws(() => app.engine.approve('recovered-run', 3), /Нет плана/);
    assert.throws(() => app.engine.message('recovered-run', '   '), /Сообщение должно/);
    assert.throws(() => app.engine.message('recovered-run', 'x'.repeat(12001)), /Сообщение должно/);
    assert.throws(() => app.engine.control('recovered-run', 'invalid' as 'pause'), /Неизвестное действие/);
    assert.throws(() => app.engine.create({ ...input, mode: 'live' }), /недоступно/);
    const note = app.engine.message('recovered-run', 'Retain this during pause');
    assert.equal(note.status, 'paused');
    assert.equal(note.messages[0].status, 'queued');
    app.store.createRun(seedRun({ id: 'other', status: 'running' }), { type: 'seed', message: 'Other work' });
    assert.throws(() => app.engine.control('recovered-run', 'resume'), /Другая команда/);
    assert.throws(() => app.engine.create(input), /приостановите текущую/);
    app.engine.control('other', 'cancel');
    assert.throws(() => app.engine.control('other', 'resume'), /уже завершена/);
    assert.throws(() => app.engine.message('other', 'A new instruction'), /уже завершена/);
  } finally { await app.clean(); }
});

test('a paused provider turn must finish stopping before resume is allowed', async () => {
  let release: (() => void) | undefined;
  let calls = 0;
  const runner: TurnRunner = async value => {
    calls += 1;
    await new Promise<void>(resolve => { release = resolve; });
    return successfulRunner(value);
  };
  const app = setup(runner);
  try {
    const run = app.engine.create(input);
    await until(() => calls === 1);
    assert.throws(() => app.engine.control(run.id, 'resume'), /не приостановлена/);
    app.engine.control(run.id, 'pause');
    assert.throws(() => app.engine.control(run.id, 'resume'), /остановка предыдущих/);
    release!();
    await yieldLoop(); await yieldLoop();
    assert.equal(app.engine.get(run.id).status, 'paused');
    assert.equal(app.engine.get(run.id).plan, undefined);
  } finally { release?.(); await app.clean(); }
});

test('turn budgets stop repeated work without invoking another provider turn', async () => {
  let calls = 0;
  const runner: TurnRunner = async value => { calls += 1; return successfulRunner(value); };
  const run = seedRun({ status: 'paused', tasks: defaultTasks.map(task => ({ ...task, status: 'pending', turns: 20 })) });
  const app = setup(runner, run);
  try {
    app.engine.control(run.id, 'resume');
    await until(() => app.engine.get(run.id).status === 'paused');
    assert.match(app.engine.get(run.id).error!, /лимит 20/);
    assert.equal(calls, 0);
    app.store.updateRun(run.id, value => ({ ...value, turnCount: 100 }), { type: 'seed', message: 'Total turn budget exhausted' });
    assert.throws(() => app.engine.control(run.id, 'resume'), /лимит 100/);
    assert.equal(calls, 0);
  } finally { await app.clean(); }
});

for (const purpose of ['synthesize', 'review'] as const) {
  test(`${purpose} requires a substantive artifact before advancing`, async () => {
    const runner: TurnRunner = async value => value.purpose === purpose
      ? envelope({ ...(purpose === 'review' ? { verdict: 'pass' as const } : {}) })
      : successfulRunner(value);
    const app = setup(runner);
    try {
      const run = app.engine.create(input);
      await until(() => app.engine.get(run.id).status === 'awaiting_approval');
      app.engine.approve(run.id, app.engine.get(run.id).version);
      await until(() => app.engine.get(run.id).status === 'paused');
      assert.match(app.engine.get(run.id).error!, purpose === 'synthesize' ? /итоговый материал/ : /заключение и аргументы/);
      assert.equal(app.engine.get(run.id).phase, purpose);
    } finally { await app.clean(); }
  });
}

test('protocol rejects unknown recipients, invalid membership, and inconsistent plans', () => {
  assert.throws(() => validateInput({ ...input, leaderId: 'outsider' }), /руководителя/);
  const validPlan = JSON.parse(plan(seedRun()).text);
  assert.throws(() => parsePlan(JSON.stringify({ ...validPlan, tasks: [...defaultTasks, ...defaultTasks] }), ['a', 'b']), /повторяющиеся/);
  assert.throws(() => parsePlan(JSON.stringify({ ...validPlan, roles: [validPlan.roles[0], validPlan.roles[0]] }), ['a', 'b']), /роль каждому/);
  assert.throws(() => parsePlan(JSON.stringify({ ...validPlan, tasks: [{ ...defaultTasks[0], assigneeId: 'outsider' }] }), ['a', 'b']), /неизвестного/);
  assert.throws(() => parsePlan(JSON.stringify({ ...validPlan, tasks: [{ ...defaultTasks[0], dependsOn: ['missing'] }] }), ['a', 'b']), /неизвестного/);
  for (const toId of ['outsider', 'a']) {
    assert.throws(() => parseEnvelope(envelope({ messages: [{ toId, body: 'Question', request: true }] }).text, ['a', 'b'], 'a'), /неизвестному|самому себе/);
  }
});

for (const purpose of ['plan', 'synthesize', 'review'] as const) {
  test(`new user steering during ${purpose} invalidates that snapshot before approval/completion`, async () => {
    let release: (() => void) | undefined;
    let blocked = false;
    let held = false;
    const contexts: Context[] = [];
    const runner: TurnRunner = async value => {
      contexts.push(contextOf(value));
      if (value.purpose === purpose && !held) {
        held = true; blocked = true;
        await new Promise<void>(resolve => { release = resolve; });
      }
      return successfulRunner(value);
    };
    const app = setup(runner);
    try {
      const run = app.engine.create(input);
      if (purpose !== 'plan') {
        await until(() => app.engine.get(run.id).status === 'awaiting_approval');
        app.engine.approve(run.id, app.engine.get(run.id).version);
      }
      await until(() => blocked);
      app.engine.message(run.id, 'Include the newly supplied requirement');
      release!();
      await until(() => app.engine.get(run.id).status === (purpose === 'plan' ? 'awaiting_approval' : 'completed'));
      const repeated = contexts.filter(ctx => ctx.purpose === purpose);
      assert.equal(repeated.length, 2);
      assert.ok(repeated[1].run.messages.some(message => message.body === 'Include the newly supplied requirement'));
      assert.ok(app.store.events(run.id).some(event => event.type === 'superseded'));
    } finally { release?.(); await app.clean(); }
  });
}

test('reserving turns never exceeds the global 100-turn limit during parallel dispatch', async () => {
  let calls = 0;
  const runner: TurnRunner = async value => { calls++; return successfulRunner(value); };
  const seed = seedRun({ status: 'paused', turnCount: 99, members: members.slice(0, 3), tasks: members.slice(0, 3).map(member => ({ id: `task-${member.id}`, title: 'Work', description: 'Independent work', assigneeId: member.id, dependsOn: [], status: 'pending', turns: 0 })) });
  const app = setup(runner, seed);
  try {
    app.engine.control(seed.id, 'resume');
    await until(() => app.engine.get(seed.id).status === 'paused');
    assert.equal(calls, 1);
    assert.equal(app.engine.get(seed.id).turnCount, 100);
    assert.equal(app.engine.get(seed.id).tasks.filter(task => task.status === 'completed').length, 1);
  } finally { await app.clean(); }
});

test('protocol rejects reserved participant identities', () => {
  for (const reserved of ['user', 'team', '__proto__', 'constructor']) {
    assert.throws(() => validateInput({ ...input, leaderId: reserved, members: [{ ...input.members[0], id: reserved }, input.members[1]] }), /зарезервирован/);
  }
});

test('repeated dependencies cannot expand plan validation exponentially', () => {
  const raw = JSON.parse(plan(seedRun()).text);
  raw.tasks = Array.from({ length: 12 }, (_, index) => ({ id: `task-${index}`, title: 'Task', description: 'Work', assigneeId: 'a', dependsOn: index ? Array(12).fill(`task-${index - 1}`) : [] }));
  assert.throws(() => parsePlan(JSON.stringify(raw), ['a', 'b']), /повторяющиеся зависимости/);
});

test('participant names matching Object prototype fields do not create fake sessions', async () => {
  let received: string | undefined = 'not-called';
  const runner: TurnRunner = async value => { received = value.sessionId; return plan(contextOf(value).run, [{ ...defaultTasks[0], assigneeId: 'toString' }]); };
  const app = setup(runner);
  try {
    const run = app.engine.create({ ...input, leaderId: 'toString', members: [{ ...input.members[0], id: 'toString' }, input.members[1]] });
    await until(() => app.engine.get(run.id).status === 'awaiting_approval');
    assert.equal(received, undefined);
  } finally { await app.clean(); }
});
