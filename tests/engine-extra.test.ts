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
    assert.equal(recovered.tasks[0].status, 'waiting');
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
    assert.ok(app.store.eventBatch(seed.id, 0).some(event => event.type === 'recovered'));
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
    assert.equal(paused.tasks[0].status, 'failed');
    const failure = app.store.eventBatch(run.id, 0).find(event => event.type === 'error')!;
    const failed = paused.members.find(member => member.id === failure.actorId)!;
    assert.equal(failure.message, `${failed.name}: Scripted provider unavailable`);
    assert.equal(paused.tasks[0].error, failure.message);
    assert.ok(paused.error!.includes(failure.message));
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
      assert.ok(app.store.eventBatch(run.id, 0).some(event => event.type === 'superseded'));
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

test('a failed task does not stop or discard the work of other participants', async () => {
  let failTask = true;
  let releaseSlow!: () => void;
  const slow = new Promise<void>(resolve => { releaseSlow = resolve; });
  const tasks: TaskSpec[] = [
    { id: 'task-fail', title: 'Fragile part', description: 'Fails once', assigneeId: 'a', dependsOn: [] },
    { id: 'task-slow', title: 'Slow part', description: 'Finishes later', assigneeId: 'b', dependsOn: [] },
    { id: 'task-quick', title: 'Quick part', description: 'Finishes now', assigneeId: 'c', dependsOn: [] },
    { id: 'task-after', title: 'Needs fragile part', description: 'Waits', assigneeId: 'b', dependsOn: ['task-fail'] },
  ];
  const runner: TurnRunner = async value => {
    const { run, taskId } = contextOf(value);
    if (value.purpose === 'plan') return plan(run, tasks);
    if (taskId === 'task-fail' && failTask) throw new Error('Not logged in.');
    if (taskId === 'task-slow') await slow;
    return successfulRunner(value);
  };
  const app = setup(runner);
  try {
    const run = app.engine.create({ ...input, members: members.slice(0, 3) });
    await until(() => app.engine.get(run.id).status === 'awaiting_approval');
    app.engine.approve(run.id, app.engine.get(run.id).version);
    const task = (id: string) => app.engine.get(run.id).tasks.find(t => t.id === id)!;
    await until(() => task('task-fail').status === 'failed' && task('task-quick').status === 'completed', 'isolated failure');
    assert.equal(app.engine.get(run.id).status, 'running');
    assert.equal(task('task-fail').error, 'Agent a: Not logged in.');
    assert.equal(task('task-slow').status, 'running');
    releaseSlow();
    await until(() => app.engine.get(run.id).status === 'paused', 'pause once nothing can progress');
    const paused = app.engine.get(run.id);
    assert.equal(task('task-slow').status, 'completed');
    assert.equal(task('task-slow').output, 'Scripted report content');
    assert.equal(task('task-after').status, 'pending');
    assert.match(paused.error!, /Fragile part/);
    assert.match(paused.error!, /Agent a: Not logged in\. Готовые результаты/);
    assert.doesNotMatch(paused.error!, /\.\./);
    failTask = false;
    app.engine.control(run.id, 'resume');
    await until(() => app.engine.get(run.id).status === 'completed', 'completion after retry');
    assert.equal(task('task-fail').turns, 2);
    assert.equal(task('task-slow').turns, 1);
    assert.equal(task('task-quick').turns, 1);
  } finally { await app.clean(); }
});

test('a failed reply marks the asking task and resume retries only the reply', async () => {
  let failReply = true;
  const runner: TurnRunner = async value => {
    const { run, taskId } = contextOf(value);
    if (value.purpose === 'plan') return plan(run);
    if (value.purpose === 'reply') {
      if (failReply) throw new Error('Quota exceeded');
      return envelope({ summary: 'Use three sections' });
    }
    if (value.purpose === 'task' && !run.messages.some(m => m.taskId === taskId && m.request)) {
      return envelope({ status: 'waiting', messages: [{ toId: 'b', body: 'Which sections?', request: true }] });
    }
    return successfulRunner(value);
  };
  const app = setup(runner);
  try {
    const run = app.engine.create(input);
    await until(() => app.engine.get(run.id).status === 'awaiting_approval');
    app.engine.approve(run.id, app.engine.get(run.id).version);
    await until(() => app.engine.get(run.id).status === 'paused', 'pause after failed reply');
    const paused = app.engine.get(run.id);
    assert.equal(paused.tasks[0].status, 'failed');
    assert.match(paused.tasks[0].error!, /Agent b: Quota exceeded/);
    assert.equal(paused.tasks[0].turns, 1);
    failReply = false;
    const resumed = app.engine.control(run.id, 'resume');
    assert.equal(resumed.tasks[0].status, 'waiting');
    await until(() => app.engine.get(run.id).status === 'completed', 'completion after reply retry');
    assert.equal(app.engine.get(run.id).tasks[0].turns, 2);
  } finally { await app.clean(); }
});

test('agent answers tolerate null optional fields and format errors read clearly', () => {
  const answer = parseEnvelope(JSON.stringify({ summary: 'Done', status: 'done', messages: [{ toId: 'b', body: 'Note', request: false, replyTo: null }], artifact: null, verdict: null }), ['a', 'b'], 'a');
  assert.equal(answer.artifact, undefined);
  assert.equal(answer.verdict, undefined);
  assert.equal(answer.messages[0].replyTo, undefined);
  assert.throws(() => parseEnvelope(JSON.stringify({ summary: 'Done', status: 'done', messages: [], artifact: 'text' }), ['a', 'b'], 'a'),
    (error: Error) => /Ответ агента не соответствует формату: artifact/.test(error.message) && !error.message.includes('"code"'));
  assert.throws(() => parseEnvelope('Here is the result: {"summary"', ['a', 'b'], 'a'), /Начало ответа: «Here is the result: \{"summary"»/);
});

test('an owner waiting on its own inputs answers questions only after it has them', async () => {
  const calls: string[] = [];
  const tasks: TaskSpec[] = [
    { id: 'recipe', title: 'Recipe', description: 'Owns grams', assigneeId: 'a', dependsOn: [] },
    { id: 'price', title: 'Price', description: 'Owns price, needs grams', assigneeId: 'b', dependsOn: [] },
    { id: 'promo', title: 'Promo', description: 'Needs price', assigneeId: 'c', dependsOn: [] },
  ];
  const asks: Record<string, string> = { price: 'a', promo: 'b' };
  let ownerSawInput: boolean | undefined;
  const runner: TurnRunner = async value => {
    const { run, taskId } = contextOf(value);
    if (value.purpose === 'plan') return plan(run, tasks);
    calls.push(`${value.purpose}:${value.member.id}`);
    if (value.purpose === 'reply') {
      if (value.member.id === 'b') ownerSawInput = run.messages.some(m => m.fromId === 'a' && m.toId === 'b' && m.body === 'Answer from a');
      return envelope({ summary: `Answer from ${value.member.id}` });
    }
    if (value.purpose === 'task' && taskId && asks[taskId] && !run.messages.some(m => m.taskId === taskId && m.request)) {
      return envelope({ status: 'waiting', messages: [{ toId: asks[taskId], body: 'Your fact?', request: true }] });
    }
    return successfulRunner(value);
  };
  const app = setup(runner);
  try {
    const run = app.engine.create({ ...input, members: members.slice(0, 3) });
    await until(() => app.engine.get(run.id).status === 'awaiting_approval');
    app.engine.approve(run.id, app.engine.get(run.id).version);
    await until(() => app.engine.get(run.id).status === 'completed', 'completion');
    assert.ok(calls.indexOf('reply:b') > calls.indexOf('reply:a'), `b answered before getting its own input: ${calls.join(', ')}`);
    assert.equal(ownerSawInput, true);
  } finally { await app.clean(); }
});

test('two owners asking each other still get answers instead of blocking', async () => {
  const tasks: TaskSpec[] = [
    { id: 'left', title: 'Left', description: 'Needs right', assigneeId: 'a', dependsOn: [] },
    { id: 'right', title: 'Right', description: 'Needs left', assigneeId: 'b', dependsOn: [] },
  ];
  const runner: TurnRunner = async value => {
    const { run, taskId } = contextOf(value);
    if (value.purpose === 'plan') return plan(run, tasks);
    if (value.purpose === 'reply') return envelope({ summary: 'Provisional answer' });
    if (value.purpose === 'task' && !run.messages.some(m => m.taskId === taskId && m.request)) {
      return envelope({ status: 'waiting', messages: [{ toId: value.member.id === 'a' ? 'b' : 'a', body: 'Your fact?', request: true }] });
    }
    return successfulRunner(value);
  };
  const app = setup(runner);
  try {
    const run = app.engine.create(input);
    await until(() => app.engine.get(run.id).status === 'awaiting_approval');
    app.engine.approve(run.id, app.engine.get(run.id).version);
    await until(() => ['completed', 'paused'].includes(app.engine.get(run.id).status), 'finish');
    assert.equal(app.engine.get(run.id).error, undefined);
    assert.equal(app.engine.get(run.id).status, 'completed');
  } finally { await app.clean(); }
});

test('a reply that also asks something keeps its answer and sends the question as a note', async () => {
  const runner: TurnRunner = async value => {
    const { run, taskId } = contextOf(value);
    if (value.purpose === 'plan') return plan(run);
    if (value.purpose === 'reply') return envelope({ summary: 'Use three sections', messages: [{ toId: 'a', body: 'Which audience?', request: true }] });
    if (value.purpose === 'task' && !run.messages.some(m => m.taskId === taskId && m.request)) {
      return envelope({ status: 'waiting', messages: [{ toId: 'b', body: 'Which sections?', request: true }] });
    }
    return successfulRunner(value);
  };
  const app = setup(runner);
  try {
    const run = app.engine.create(input);
    await until(() => app.engine.get(run.id).status === 'awaiting_approval');
    app.engine.approve(run.id, app.engine.get(run.id).version);
    await until(() => ['completed', 'paused'].includes(app.engine.get(run.id).status), 'finish');
    const done = app.engine.get(run.id);
    assert.equal(done.error, undefined);
    assert.ok(done.messages.some(m => m.fromId === 'b' && m.body === 'Use three sections'));
    assert.ok(done.messages.some(m => m.fromId === 'b' && m.body === 'Which audience?' && !m.request));
  } finally { await app.clean(); }
});

test('an owner whose own question failed does not answer others with a guess', async () => {
  const calls: string[] = [];
  const tasks: TaskSpec[] = [
    { id: 'price', title: 'Price', description: 'Needs grams from b', assigneeId: 'a', dependsOn: [] },
    { id: 'recipe', title: 'Recipe', description: 'Owns grams', assigneeId: 'b', dependsOn: [] },
    { id: 'promo', title: 'Promo', description: 'Needs price from a', assigneeId: 'c', dependsOn: [] },
  ];
  const asks: Record<string, string> = { price: 'b', promo: 'a' };
  const runner: TurnRunner = async value => {
    const { run, taskId } = contextOf(value);
    if (value.purpose === 'plan') return plan(run, tasks);
    calls.push(`${value.purpose}:${value.member.id}`);
    if (value.purpose === 'reply' && value.member.id === 'b') throw new Error('Quota exceeded');
    if (value.purpose === 'reply') return envelope({ summary: 'Guess' });
    if (value.purpose === 'task' && taskId && asks[taskId] && !run.messages.some(m => m.taskId === taskId && m.request)) {
      return envelope({ status: 'waiting', messages: [{ toId: asks[taskId], body: 'Your fact?', request: true }] });
    }
    return successfulRunner(value);
  };
  const app = setup(runner);
  try {
    const run = app.engine.create({ ...input, members: members.slice(0, 3) });
    await until(() => app.engine.get(run.id).status === 'awaiting_approval');
    app.engine.approve(run.id, app.engine.get(run.id).version);
    await until(() => app.engine.get(run.id).status === 'paused', 'pause');
    assert.ok(!calls.includes('reply:a'), `a answered while its own question was unanswered: ${calls.join(', ')}`);
    assert.match(app.engine.get(run.id).error!, /Price/);
  } finally { await app.clean(); }
});

test('an answer with text after its JSON keeps that text instead of failing', () => {
  const raw = '{"summary":"Prices fixed.","status":"done","messages":[],"artifact":null,"verdict":null}\n\nPrice 1 200 ₸; second drink 960 ₸.';
  const answer = parseEnvelope(raw, ['a', 'b'], 'a');
  assert.equal(answer.summary, 'Prices fixed.\n\nPrice 1 200 ₸; second drink 960 ₸.');
  assert.throws(() => parseEnvelope('{"summary":"x","status":"done","messages":[]} {"summary":"y"}', ['a', 'b'], 'a'), /некорректный JSON/);
  assert.throws(() => parseEnvelope('Intro {"summary":"x","status":"done","messages":[]}', ['a', 'b'], 'a'), /некорректный JSON/);
});

test('a badly formatted answer is retried once with the reason, then accepted', async () => {
  const prompts: string[] = [];
  let taskCalls = 0;
  const runner: TurnRunner = async value => {
    const { run } = contextOf(value);
    if (value.purpose === 'plan') return plan(run);
    if (value.purpose === 'task') {
      prompts.push(value.prompt);
      if (++taskCalls === 1) return { text: 'Sure! Here is my work: not json', sessionId: 'first-try' };
    }
    return successfulRunner(value);
  };
  const app = setup(runner);
  try {
    const run = app.engine.create(input);
    await until(() => app.engine.get(run.id).status === 'awaiting_approval');
    app.engine.approve(run.id, app.engine.get(run.id).version);
    await until(() => app.engine.get(run.id).status === 'completed', 'completion after retry');
    assert.equal(taskCalls, 2);
    assert.match(prompts[1], /Твой предыдущий ответ не принят: Провайдер вернул некорректный JSON-объект/);
    const retry = app.store.eventBatch(run.id, 0).find(event => event.type === 'format_retry');
    assert.ok(retry && retry.actorId === 'a');
    assert.equal(app.engine.get(run.id).tasks[0].turns, 1);
  } finally { await app.clean(); }
});

test('a second badly formatted answer fails the task without a third call', async () => {
  let taskCalls = 0;
  const runner: TurnRunner = async value => {
    const { run } = contextOf(value);
    if (value.purpose === 'plan') return plan(run);
    if (value.purpose === 'task') { taskCalls++; return { text: '{"summary":"x","status":"maybe","messages":[]}' }; }
    return successfulRunner(value);
  };
  const app = setup(runner);
  try {
    const run = app.engine.create(input);
    await until(() => app.engine.get(run.id).status === 'awaiting_approval');
    app.engine.approve(run.id, app.engine.get(run.id).version);
    await until(() => app.engine.get(run.id).status === 'paused', 'pause after second bad answer');
    assert.equal(taskCalls, 2);
    assert.match(app.engine.get(run.id).tasks[0].error!, /Agent a: Ответ агента не соответствует формату: status/);
  } finally { await app.clean(); }
});

test('an invalid plan is retried once before asking the user', async () => {
  let planCalls = 0;
  const runner: TurnRunner = async value => {
    const { run } = contextOf(value);
    if (value.purpose === 'plan' && ++planCalls === 1) return plan(run, [{ ...defaultTasks[0], dependsOn: ['task-a'] }]);
    return successfulRunner(value);
  };
  const app = setup(runner);
  try {
    const run = app.engine.create(input);
    await until(() => app.engine.get(run.id).status === 'awaiting_approval', 'plan after retry');
    assert.equal(planCalls, 2);
  } finally { await app.clean(); }
});

test('review remarks go to the task owner, who revises before the leader re-synthesizes', async () => {
  const calls: string[] = [];
  const seen: { revisionPrompt?: string; resynthesis?: string[] } = {};
  const tasks: TaskSpec[] = [
    { id: 'task-a', title: 'Prices', description: 'Price table', assigneeId: 'b', dependsOn: [] },
    { id: 'task-b', title: 'Recipe', description: 'Recipe', assigneeId: 'a', dependsOn: [] },
  ];
  const runner: TurnRunner = async value => {
    const { run, taskId } = contextOf(value);
    if (value.purpose === 'plan') return plan(run, tasks);
    calls.push(`${value.purpose}:${taskId ?? value.member.id}`);
    if (value.purpose === 'task') {
      const revising = run.reviewRound > 0;
      if (revising && taskId === 'task-a') seen.revisionPrompt = value.prompt;
      return envelope({ artifact: { title: taskId!, body: `${taskId} v${revising ? 2 : 1}` } });
    }
    if (value.purpose === 'synthesize') {
      if (run.reviewRound > 0) seen.resynthesis = run.artifacts.filter(a => a.kind === 'work').map(a => a.body);
      return envelope({ artifact: { title: 'Final', body: 'Final document' } });
    }
    if (value.purpose === 'review') return run.reviewRound === 0
      ? envelope({ verdict: 'changes_requested', artifact: { title: 'Review', body: 'Prices are wrong' }, revisions: [{ taskId: 'task-a', remark: 'Use the 50% minimum markup' }] } as never)
      : envelope({ verdict: 'pass', artifact: { title: 'Review', body: 'Fixed' } });
    return successfulRunner(value);
  };
  const app = setup(runner);
  try {
    const run = app.engine.create(input);
    await until(() => app.engine.get(run.id).status === 'awaiting_approval');
    app.engine.approve(run.id, app.engine.get(run.id).version);
    await until(() => ['completed', 'paused'].includes(app.engine.get(run.id).status), 'finish');
    const done = app.engine.get(run.id);
    assert.equal(done.status, 'completed', done.error);
    assert.deepEqual(calls.filter(call => call.startsWith('task:')).sort(), ['task:task-a', 'task:task-a', 'task:task-b']);
    assert.ok(calls.indexOf('synthesize:a') < calls.lastIndexOf('task:task-a') && calls.lastIndexOf('task:task-a') < calls.lastIndexOf('synthesize:a'), calls.join(', '));
    assert.match(seen.revisionPrompt!, /Use the 50% minimum markup/);
    assert.deepEqual(seen.resynthesis, ['task-a v2', 'task-b v1']);
    const note = done.messages.find(m => m.taskId === 'task-a' && m.toId === 'b' && m.fromId === 'b');
    assert.ok(note && !note.request && /Use the 50% minimum markup/.test(note.body));
  } finally { await app.clean(); }
});

test('review remarks for an unknown task are rejected and retried', async () => {
  let reviews = 0;
  const runner: TurnRunner = async value => {
    const { run } = contextOf(value);
    if (value.purpose === 'plan') return plan(run);
    if (value.purpose === 'review' && ++reviews === 1) {
      return envelope({ verdict: 'changes_requested', artifact: { title: 'Review', body: 'Fix' }, revisions: [{ taskId: 'missing-task', remark: 'Fix it' }] } as never);
    }
    return successfulRunner(value);
  };
  const app = setup(runner);
  try {
    const run = app.engine.create(input);
    await until(() => app.engine.get(run.id).status === 'awaiting_approval');
    app.engine.approve(run.id, app.engine.get(run.id).version);
    await until(() => app.engine.get(run.id).status === 'completed', 'completion after review retry');
    assert.equal(reviews, 2);
  } finally { await app.clean(); }
});

test('owners publish shared facts that every later turn can read', async () => {
  const contexts: Record<string, Run> = {};
  const tasks: TaskSpec[] = [
    { id: 'price', title: 'Price', description: 'Owns the price', assigneeId: 'a', dependsOn: [] },
    { id: 'promo', title: 'Promo', description: 'Uses the price', assigneeId: 'b', dependsOn: ['price'] },
  ];
  const runner: TurnRunner = async value => {
    const { run, taskId } = contextOf(value);
    if (value.purpose === 'plan') return plan(run, tasks);
    if (taskId) contexts[taskId] = run;
    if (taskId === 'price') return envelope({ artifact: { title: 'Price', body: 'Price table' }, facts: [{ key: 'Цена', value: '1 200 ₸' }] } as never);
    return successfulRunner(value);
  };
  const app = setup(runner);
  try {
    const run = app.engine.create(input);
    await until(() => app.engine.get(run.id).status === 'awaiting_approval');
    app.engine.approve(run.id, app.engine.get(run.id).version);
    await until(() => app.engine.get(run.id).status === 'completed', 'completion');
    const fact = { key: 'Цена', value: '1 200 ₸', ownerId: 'a', version: 1 };
    assert.deepEqual(contexts.promo.facts?.map(({ updatedAt: _, ...f }) => f), [fact]);
    assert.deepEqual(app.engine.get(run.id).facts?.map(({ updatedAt: _, ...f }) => f), [fact]);
  } finally { await app.clean(); }
});

test('only a fact owner can change it; the owner update raises the version', async () => {
  let promoCalls = 0;
  const tasks: TaskSpec[] = [
    { id: 'price', title: 'Price', description: 'Owns the price', assigneeId: 'a', dependsOn: [] },
    { id: 'promo', title: 'Promo', description: 'Uses the price', assigneeId: 'b', dependsOn: ['price'] },
    { id: 'reprice', title: 'Reprice', description: 'Owner updates', assigneeId: 'a', dependsOn: ['promo'] },
  ];
  const prompts: string[] = [];
  const runner: TurnRunner = async value => {
    const { run, taskId } = contextOf(value);
    if (value.purpose === 'plan') return plan(run, tasks);
    if (taskId === 'price') return envelope({ facts: [{ key: 'Цена', value: '1 200 ₸' }], artifact: { title: 'P', body: 'P' } } as never);
    if (taskId === 'promo') {
      prompts.push(value.prompt);
      return ++promoCalls === 1 ? envelope({ facts: [{ key: ' цена ', value: '999 ₸' }] } as never) : envelope({ artifact: { title: 'Promo', body: 'Promo' } });
    }
    if (taskId === 'reprice') return envelope({ facts: [{ key: 'Цена', value: '1 250 ₸' }], artifact: { title: 'R', body: 'R' } } as never);
    return successfulRunner(value);
  };
  const app = setup(runner);
  try {
    const run = app.engine.create(input);
    await until(() => app.engine.get(run.id).status === 'awaiting_approval');
    app.engine.approve(run.id, app.engine.get(run.id).version);
    await until(() => app.engine.get(run.id).status === 'completed', 'completion');
    assert.equal(promoCalls, 2);
    assert.match(prompts[1], /Факт «цена» принадлежит Agent a/);
    const facts = app.engine.get(run.id).facts!;
    assert.equal(facts.length, 1);
    assert.deepEqual([facts[0].value, facts[0].ownerId, facts[0].version], ['1 250 ₸', 'a', 2]);
  } finally { await app.clean(); }
});

test('a task may wait for a colleague who is still working, and their note wakes it', async () => {
  let promoCalls = 0;
  const tasks: TaskSpec[] = [
    { id: 'price', title: 'Price', description: 'Owns the price', assigneeId: 'a', dependsOn: [] },
    { id: 'promo', title: 'Promo', description: 'Needs the price', assigneeId: 'b', dependsOn: [] },
  ];
  let promoPrompt = '';
  const runner: TurnRunner = async value => {
    const { run, taskId } = contextOf(value);
    if (value.purpose === 'plan') return plan(run, tasks);
    if (taskId === 'promo') {
      promoPrompt = value.prompt;
      return ++promoCalls === 1 ? envelope({ status: 'waiting', messages: [] }) : envelope({ artifact: { title: 'Promo', body: 'Promo at 1 200 ₸' } });
    }
    if (taskId === 'price') {
      await until(() => promoCalls === 1, 'promo waits first');
      return envelope({ messages: [{ toId: 'b', body: 'Final price: 1 200 ₸', request: false }], artifact: { title: 'Price', body: '1 200 ₸' } });
    }
    return successfulRunner(value);
  };
  const app = setup(runner);
  try {
    const run = app.engine.create(input);
    await until(() => app.engine.get(run.id).status === 'awaiting_approval');
    app.engine.approve(run.id, app.engine.get(run.id).version);
    await until(() => ['completed', 'paused'].includes(app.engine.get(run.id).status), 'finish');
    assert.equal(app.engine.get(run.id).status, 'completed', app.engine.get(run.id).error);
    assert.equal(promoCalls, 2);
    assert.match(promoPrompt, /Final price: 1 200 ₸/);
  } finally { await app.clean(); }
});

test('restart lists calls with an unknown outcome and repeats them only after confirmation', async () => {
  const calls: TurnInput[] = [];
  const runner: TurnRunner = async value => { calls.push(value); return successfulRunner(value); };
  const seed = seedRun({
    tasks: defaultTasks.map((task, index) => ({ ...task, status: index === 0 ? 'running' : 'completed', turns: 1 })),
    inFlight: [{ id: 'call-1', memberId: defaultTasks[0].assigneeId, purpose: 'task', taskId: defaultTasks[0].id, startedAt: '2026-10-07T00:00:00.000Z' }],
  } as Partial<Run>);
  const app = setup(runner, seed);
  try {
    const recovered = app.engine.get(seed.id) as Run & { interrupted?: unknown[]; inFlight?: unknown[] };
    assert.equal(recovered.status, 'paused');
    assert.equal(recovered.interrupted?.length, 1);
    assert.deepEqual(recovered.inFlight, []);
    assert.equal(recovered.tasks[0].status, 'failed');
    assert.match(recovered.tasks[0].error!, /исход неизвестен/);
    assert.match(recovered.error!, /Исход неизвестен.*Agent a — задача «/);
    assert.throws(() => app.engine.control(seed.id, 'resume'), /Подтвердите повтор/);
    assert.equal(calls.length, 0);
    const resumed = app.engine.control(seed.id, 'resume', true) as Run & { interrupted?: unknown[] };
    assert.equal(resumed.interrupted, undefined);
    await until(() => app.engine.get(seed.id).status === 'completed', 'completion after confirmed repeat');
    assert.equal(calls.filter(call => call.purpose === 'task').length, 1);
  } finally { await app.clean(); }
});

test('finished and paused calls leave nothing marked as in flight', async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let hold = true;
  const runner: TurnRunner = async value => {
    if (value.purpose === 'task' && hold) { await new Promise<void>((resolve, reject) => { value.signal?.addEventListener('abort', () => reject(new Error('aborted'))); void gate.then(resolve); }); }
    return successfulRunner(value);
  };
  const app = setup(runner);
  try {
    const run = app.engine.create(input);
    await until(() => app.engine.get(run.id).status === 'awaiting_approval');
    app.engine.approve(run.id, app.engine.get(run.id).version);
    await until(() => ((app.engine.get(run.id) as Run & { inFlight?: unknown[] }).inFlight?.length ?? 0) > 0, 'a call in flight');
    app.engine.control(run.id, 'pause');
    assert.deepEqual((app.engine.get(run.id) as Run & { inFlight?: unknown[] }).inFlight, []);
    hold = false; release();
    await until(() => { try { app.engine.control(run.id, 'resume'); return true; } catch { return false; } }, 'resume after the abort settles');
    await until(() => app.engine.get(run.id).status === 'completed', 'completion');
    assert.deepEqual((app.engine.get(run.id) as Run & { inFlight?: unknown[] }).inFlight, []);
  } finally { await app.clean(); }
});

test('a changed fact reopens finished tasks that used it, with the old and new value', async () => {
  const promoPrompts: string[] = [];
  const tasks: TaskSpec[] = [
    { id: 'price', title: 'Price', description: 'Owns the price', assigneeId: 'a', dependsOn: [] },
    { id: 'promo', title: 'Promo', description: 'Uses the price', assigneeId: 'b', dependsOn: ['price'] },
    { id: 'notes', title: 'Notes', description: 'Ignores the price', assigneeId: 'b', dependsOn: ['price'] },
    { id: 'reprice', title: 'Reprice', description: 'Owner changes the price', assigneeId: 'a', dependsOn: ['promo', 'notes'] },
  ];
  const runner: TurnRunner = async value => {
    const { run, taskId } = contextOf(value);
    if (value.purpose === 'plan') return plan(run, tasks);
    if (taskId === 'price') return envelope({ facts: [{ key: 'Цена', value: '1 200 ₸' }], artifact: { title: 'P', body: 'P' } } as never);
    if (taskId === 'promo') { promoPrompts.push(value.prompt); return envelope({ usesFacts: ['цена'], artifact: { title: 'Promo', body: `Promo v${promoPrompts.length}` } } as never); }
    if (taskId === 'reprice') return envelope({ facts: [{ key: 'Цена', value: '1 250 ₸' }], artifact: { title: 'R', body: 'R' } } as never);
    return successfulRunner(value);
  };
  const app = setup(runner);
  try {
    const run = app.engine.create(input);
    await until(() => app.engine.get(run.id).status === 'awaiting_approval');
    app.engine.approve(run.id, app.engine.get(run.id).version);
    await until(() => ['completed', 'paused'].includes(app.engine.get(run.id).status), 'finish');
    const done = app.engine.get(run.id);
    assert.equal(done.status, 'completed', done.error);
    assert.equal(promoPrompts.length, 2);
    assert.match(promoPrompts[1], /Факт «Цена» изменён: «1 200 ₸» → «1 250 ₸»/);
    assert.equal(done.tasks.find(t => t.id === 'notes')!.turns, 1);
    assert.deepEqual(done.tasks.find(t => t.id === 'promo')!.usedFacts, { Цена: 2 });
  } finally { await app.clean(); }
});
