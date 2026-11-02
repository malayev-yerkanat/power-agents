import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Member, Run, TeamTask } from '../shared/types';
import { CombatEffects } from './CombatEffects';
import { attackSample, memberMode, providerFor, useCombatClock } from './combat';
import type { CombatMode, Point } from './combat';
import { t } from './i18n';

export const rangerAsset = (connectionId: string) => providerFor(connectionId) === 'neutral' ? undefined : `/art/${providerFor(connectionId)}.png`;
const taskLabels: Record<TeamTask['status'], string> = { pending: 'В очереди', running: 'В работе', waiting: 'Ожидает ответа', completed: 'Готово', failed: 'Ошибка' };
const modeLabels: Record<CombatMode, string> = { idle: 'На связи', working: 'В работе', waiting: 'Ожидает ответа', planning: 'Готовит план', synthesizing: 'Собирает результат', reviewing: 'Проверяет результат', communicating: 'Отвечает коллеге', victory: 'Работа завершена', paused: 'На паузе', failed: 'Требует внимания' };
const formations: Record<number, Point[]> = {
  2: [{ x: 125, y: 205 }, { x: 240, y: 290 }],
  3: [{ x: 100, y: 185 }, { x: 245, y: 245 }, { x: 130, y: 310 }],
  4: [{ x: 85, y: 160 }, { x: 220, y: 190 }, { x: 130, y: 280 }, { x: 275, y: 315 }],
  5: [{ x: 85, y: 155 }, { x: 220, y: 175 }, { x: 145, y: 245 }, { x: 285, y: 280 }, { x: 80, y: 330 }],
};
const monsterPositions: Point[] = [{ x: 510, y: 245 }, { x: 630, y: 320 }, { x: 665, y: 180 }];
const monsterAssets = ['villain-foot-soldier', 'villain-monster', 'villain-boss'];
const atChest = (point: Point): Point => ({ x: point.x, y: point.y - 54 });
const actorStyle = (point: Point): CSSProperties => ({ left: Math.round(point.x) - 80, top: Math.round(point.y) - 144, zIndex: Math.round(point.y) });
const runTasks = (run: Run): TeamTask[] => run.tasks.length ? run.tasks : (run.plan?.tasks || []).map(task => ({ ...task, status: 'pending', turns: 0 }));
function visibleTasks(run: Run): TeamTask[] {
  return runTasks(run).filter(task => task.status !== 'completed').sort((a, b) => Number(b.status === 'running') - Number(a.status === 'running')).slice(0, 3);
}
function label(run: Run, member: Member): string {
  if (run.status === 'cancelled') return t('Остановлено');
  if (run.status === 'awaiting_approval') return t('Ждёт согласования');
  return t(modeLabels[memberMode(run, member)]);
}

type Moment = { id: string; kind: 'defeat' | 'message' | 'victory'; from: Point; to?: Point; asset?: string; started: number };

/** Transitions are only observed after mount: reopening history never replays a battle. */
function useMoments(run: Run, frame: number) {
  const previous = useRef(run);
  const [moments, setMoments] = useState<Moment[]>([]);
  useEffect(() => {
    const before = previous.current;
    previous.current = run;
    if (before.id !== run.id || !['running', 'completed'].includes(run.status)) { setMoments([]); return; }
    if (before.version === run.version) return;
    const points = formations[run.members.length] || formations[2];
    const additions: Moment[] = [];
    visibleTasks(before).forEach((task, index) => {
      if (run.tasks.find(current => current.id === task.id)?.status !== 'completed') return;
      const taskIndex = runTasks(before).findIndex(current => current.id === task.id);
      additions.push({ id: `defeat-${task.id}-${run.version}`, kind: 'defeat', from: monsterPositions[index], asset: monsterAssets[taskIndex % 3], started: frame });
    });
    const knownMessages = new Set(before.messages.map(message => message.id));
    run.messages.filter(message => !knownMessages.has(message.id)).slice(-3).forEach(message => {
      const source = run.members.findIndex(member => member.id === message.fromId);
      const target = run.members.findIndex(member => member.id === message.toId);
      if (source < 0) return;
      const recipients = target >= 0 ? [target] : message.toId === 'team' || message.toId === 'all' ? run.members.map((_, index) => index).filter(index => index !== source) : [];
      recipients.forEach(recipient => additions.push({ id: `message-${message.id}-${recipient}`, kind: 'message', from: atChest(points[source]), to: atChest(points[recipient]), started: frame }));
    });
    if (before.status !== 'completed' && run.status === 'completed') additions.push({ id: `victory-${run.id}`, kind: 'victory', from: { x: 225, y: 170 }, started: frame });
    if (additions.length) setMoments(current => [...current, ...additions].slice(-12));
  }, [run]); // frame is sampled when a server snapshot arrives, not on animation ticks.
  useEffect(() => {
    if (!moments.length) return;
    const timer = window.setTimeout(() => setMoments([]), 2200);
    return () => window.clearTimeout(timer);
  }, [moments]);
  return moments;
}

export function Encounter({ run }: { run: Run }) {
  const [settling, setSettling] = useState(false);
  const active = run.status === 'running' || run.status === 'planning';
  const clock = useCombatClock(active || settling);
  const moments = useMoments(run, clock.frame);
  useEffect(() => { setSettling(moments.length > 0); }, [moments.length]);
  const animate = clock.motionEnabled && !clock.reducedMotion;
  const members = run.members.slice(0, 5);
  const positions = formations[members.length] || formations[2];
  const tasks = runTasks(run);
  const visible = visibleTasks(run);
  const outstanding = tasks.filter(task => task.status !== 'completed').length;
  const fighters = members.map((member, index) => {
    const mode = memberMode(run, member);
    const provider = providerFor(member.connectionId);
    const targetIndex = visible.findIndex(task => task.assigneeId === member.id && task.status === 'running');
    const target = targetIndex < 0 ? undefined : monsterPositions[targetIndex];
    const sample = attackSample(clock.frame, index);
    const attacking = animate && active && mode === 'working' && !!target && provider !== 'neutral';
    const base = positions[index];
    const melee = provider === 'codex' || provider === 'claude';
    const stride = !attacking || !melee ? 0 : sample.phase === 'strike' ? 1 : sample.phase === 'windup' ? sample.progress : sample.phase === 'recover' ? 1 - sample.progress : 0;
    const approach = stride && target ? { x: Math.round(base.x + (target.x - 92 - base.x) * stride), y: Math.round(base.y + (target.y - base.y) * stride) } : base;
    const contact = sample.phase === 'strike' && (provider === 'gemini' ? sample.progress === 1 : sample.hit);
    const counterHit = attacking && sample.phase === 'recover' && sample.progress === 1;
    const point = {
      x: (counterHit ? -3 : 0) + approach.x + (attacking && provider === 'gemini' && sample.phase === 'strike' && sample.progress < .5 ? -3 : attacking && provider === 'claude' && contact ? 6 : 0),
      y: approach.y - (attacking && provider === 'codex' && sample.phase === 'windup' ? Math.round(Math.sin(sample.progress * Math.PI) * 4) : 0),
    };
    const bob = animate && active && !attacking && mode !== 'waiting' && mode !== 'failed' ? Math.floor(clock.frame / 6 + index) % 2 : 0;
    return { member, mode, provider, target, sample, contact, counterHit, attacking, point: { ...point, y: point.y - bob }, base, index };
  });
  return <section className="encounter" aria-label={t('Визуальное рабочее пространство команды')}>
    <div className="encounter-scroll" tabIndex={0} role="region" aria-label={t('Городская сцена. На узком экране прокрутите по горизонтали.')}>
      <div className="encounter-stage">
        {fighters.map(({ member, index, mode, point, attacking, sample, provider, counterHit }) => {
          const asset = rangerAsset(member.connectionId);
          const badge = mode === 'waiting' ? '…' : mode === 'reviewing' ? '✓' : mode === 'communicating' ? '↔' : mode === 'planning' ? '?' : mode === 'synthesizing' ? '+' : mode === 'failed' ? '!' : mode === 'victory' ? '✓' : undefined;
          return <div key={member.id} className={`encounter-actor encounter-${mode} ${counterHit ? 'combat-hit' : ''}`} style={actorStyle(point)}>
            <span className="combat-ground" aria-hidden="true" />
            {asset ? <img src={asset} alt={`${member.name}: ${label(run, member)}`} width="160" height="160" draggable={false} /> : <div className="encounter-neutral" role="img" aria-label={`${member.name}: ${label(run, member)}`}><span>{member.name.slice(0, 1).toUpperCase()}</span></div>}
            {attacking && sample.phase === 'windup' && provider !== 'gemini' && <span className="combat-dust" aria-hidden="true" />}
            {badge && <span className={`combat-badge combat-badge-${mode}`} aria-hidden="true">{badge}</span>}
            <span className="encounter-marker" aria-hidden="true">{index + 1}</span>
          </div>;
        })}
        {visible.map((task, index) => {
          const base = monsterPositions[index];
          const hit = fighters.some(fighter => fighter.attacking && fighter.target === base && fighter.contact);
          const point = { x: base.x + (hit ? (clock.frame % 2 ? 4 : 2) : 0), y: base.y };
          const taskIndex = tasks.findIndex(item => item.id === task.id);
          return <div key={task.id} className={`encounter-actor encounter-monster ${task.status === 'failed' ? 'encounter-failed' : ''} ${hit ? 'combat-hit' : ''}`} style={actorStyle(point)}><span className="combat-ground" aria-hidden="true" /><img src={`/art/${monsterAssets[taskIndex % 3]}.png`} alt={t('Задача {n}: {title}. {status}', { n: taskIndex + 1, title: task.title, status: t(taskLabels[task.status]) })} width="160" height="160" draggable={false} /><span className="encounter-marker" aria-hidden="true">T{taskIndex + 1}</span></div>;
        })}
        {animate && fighters.map(fighter => {
          const { member, target, provider, sample, point, index, mode } = fighter;
          if (fighter.attacking && target && sample.phase === 'strike') return <CombatEffects key={member.id} kind={provider === 'gemini' ? 'blaster' : provider === 'claude' ? 'staff' : 'saber'} frame={Math.floor(sample.progress * 8)} from={atChest(point)} to={atChest(target)} />;
          if (fighter.attacking && target && sample.phase === 'recover') return <CombatEffects key={member.id} kind="blaster" frame={Math.floor(sample.progress * 8)} from={atChest(target)} to={atChest(fighter.base)} />;
          if (!active) return null;
          if (mode === 'reviewing') return <CombatEffects key={member.id} kind="review" frame={(clock.frame + index * 3) % 36} from={atChest(point)} />;
          if (mode === 'planning' || mode === 'synthesizing' || mode === 'communicating' || mode === 'working' && !target) return <CombatEffects key={member.id} kind="charge" frame={(clock.frame + index * 3) % 36} from={atChest(point)} />;
          return null;
        })}
        {animate && fighters.filter(fighter => fighter.attacking && fighter.contact && fighter.target).map(fighter => <CombatEffects key={`impact-${fighter.member.id}`} kind="impact" frame={clock.frame % 4} from={atChest(fighter.target!)} />)}
        {animate && fighters.filter(fighter => fighter.counterHit).map(fighter => <CombatEffects key={`counter-${fighter.member.id}`} kind="impact" frame={0} from={atChest(fighter.base)} />)}
        {animate && moments.map(moment => {
          const age = clock.frame - moment.started;
          return <div key={moment.id} aria-hidden="true">{moment.kind === 'defeat' && age < 5 && !visible.some((_, index) => monsterPositions[index] === moment.from) && <div className="encounter-actor combat-defeated" style={actorStyle({ x: moment.from.x + age * 2, y: moment.from.y + age })}><img src={`/art/${moment.asset}.png`} alt="" width="160" height="160" /></div>}<CombatEffects kind={moment.kind} frame={age} from={moment.kind === 'defeat' ? atChest(moment.from) : moment.from} to={moment.to} /></div>;
        })}
      </div>
    </div>
    <p className="encounter-scroll-hint">{t('← Прокрутите сцену →')}</p>
    <ul className="encounter-roster">{members.map((member, index) => <li key={member.id}><span className="encounter-roster-number">{index + 1}</span><div><strong>{member.name}</strong><span>{label(run, member)}</span></div></li>)}</ul>
    <div className="combat-controls"><span>{t('Бой показывает активность, а не процент готовности.')}</span><button type="button" aria-pressed={clock.motionEnabled} disabled={clock.reducedMotion} onClick={() => clock.setMotionEnabled(!clock.motionEnabled)}>{clock.reducedMotion ? t('Движение уменьшено') : clock.motionEnabled ? t('Анимация: вкл.') : t('Анимация: выкл.')}</button></div>
    {visible.length > 0 && <details className="encounter-mapping"><summary>{t('Монстры — задачи команды')}{outstanding > 3 ? ` · ${t('ещё {count} вне сцены', { count: outstanding - 3 })}` : ''}</summary><ul>{visible.map(task => <li key={task.id}><span>T{tasks.findIndex(item => item.id === task.id) + 1}</span><span>{task.title}</span><small>{run.tasks.length ? t(taskLabels[task.status]) : t('В плане')}</small></li>)}</ul></details>}
  </section>;
}
