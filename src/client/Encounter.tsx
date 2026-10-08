import type { Member, Run, TeamTask } from '../shared/types';

const providers: Record<string, string> = {
  codex: 'codex', 'codex-cli': 'codex', 'openai-api': 'codex',
  claude: 'claude', 'claude-cli': 'claude', 'anthropic-api': 'claude',
  gemini: 'gemini', 'gemini-cli': 'gemini',
};
export const rangerAsset = (connectionId: string) => providers[connectionId] ? `/art/${providers[connectionId]}.png` : undefined;

const taskLabels: Record<TeamTask['status'], string> = {
  pending: 'В очереди', running: 'В работе', waiting: 'Ожидает ответа', completed: 'Готово', failed: 'Ошибка',
};
const phaseLabels: Record<Run['phase'], string> = {
  plan: 'Планирование', tasks: 'Работа команды', synthesize: 'Сборка результата', review: 'Проверка результата', done: 'Работа завершена',
};

function memberState(run: Run, member: Member): string {
  if (run.status === 'paused') return 'На паузе';
  if (run.status === 'awaiting_approval') return 'Ждёт согласования';
  if (run.status === 'completed') return 'Работа завершена';
  if (run.status === 'cancelled') return 'Остановлено';
  if (run.status === 'failed') return 'Запуск остановлен';
  if (run.phase === 'plan') return member.id === run.leaderId ? 'Готовит план' : 'Ждёт план';
  if (run.phase === 'synthesize') return member.id === run.leaderId ? 'Собирает результат' : 'На связи';
  if (run.phase === 'review') return 'Этап ревью';
  const assigned = run.tasks.filter(task => task.assigneeId === member.id);
  const current = assigned.find(task => task.status === 'running') || assigned.find(task => task.status === 'waiting') || assigned.find(task => task.status === 'failed');
  if (current) return taskLabels[current.status];
  if (assigned.length && assigned.every(task => task.status === 'completed')) return 'Задачи выполнены';
  return 'На связи';
}

const formations: Record<number, number[][]> = {
  2: [[125, 205], [240, 290]],
  3: [[100, 185], [245, 245], [130, 310]],
  4: [[85, 160], [220, 190], [130, 280], [275, 315]],
  5: [[85, 155], [220, 175], [145, 245], [285, 280], [80, 330]],
};
const monsterPositions = [[510, 245], [630, 320], [665, 180]];
const monsterAssets = ['villain-foot-soldier', 'villain-monster', 'villain-boss'];

export function Encounter({ run }: { run: Run }) {
  const members = run.members.slice(0, 5);
  const positions = formations[members.length] || formations[2];
  const tasks: TeamTask[] = run.tasks.length ? run.tasks : (run.plan?.tasks || []).map(task => ({ ...task, status: 'pending', turns: 0 }));
  const outstanding = tasks.filter(task => task.status !== 'completed');
  const visible = outstanding.slice(0, 3);
  const active = run.status === 'running' || run.status === 'planning';
  const heading = run.status === 'awaiting_approval' ? 'Команда ждёт вашего решения' : run.status === 'paused' ? 'Команда на паузе' : run.status === 'failed' ? 'Запуск требует внимания' : run.status === 'cancelled' ? 'Работа остановлена' : phaseLabels[run.phase];
  return <section className="encounter" aria-label="Визуальное рабочее пространство команды">
    <span className="sr-only">{heading}</span>
    <div className="encounter-scroll" tabIndex={0} role="region" aria-label="Городская сцена. На узком экране прокрутите по горизонтали.">
      <div className="encounter-stage">
        {members.map((member, index) => {
          const asset = rangerAsset(member.connectionId);
          const [x, y] = positions[index];
          const working = active && (run.tasks.some(task => task.assigneeId === member.id && task.status === 'running') || run.phase === 'plan' && member.id === run.leaderId || run.phase === 'synthesize' && member.id === run.leaderId);
          return <div key={member.id} className={`encounter-actor ${working ? 'encounter-active' : ''}`} style={{ left: x - 80, top: y - 144, zIndex: y }}>
            {asset ? <img src={asset} alt={`${member.name}: ${memberState(run, member)}`} width="160" height="160" draggable={false} /> : <div className="encounter-neutral" role="img" aria-label={`${member.name}: ${memberState(run, member)}`}><span>{member.name.slice(0, 1).toUpperCase()}</span></div>}
            <span className="encounter-marker" aria-hidden="true">{index + 1}</span>
          </div>;
        })}
        {visible.map((task, index) => {
          const [x, y] = monsterPositions[index];
          const taskIndex = tasks.findIndex(item => item.id === task.id);
          return <div key={task.id} className={`encounter-actor encounter-monster ${task.status === 'failed' ? 'encounter-failed' : ''}`} style={{ left: x - 80, top: y - 144, zIndex: y }}><img src={`/art/${monsterAssets[taskIndex % monsterAssets.length]}.png`} alt={`Задача ${taskIndex + 1}: ${task.title}. ${taskLabels[task.status]}`} width="160" height="160" draggable={false} /><span className="encounter-marker" aria-hidden="true">T{taskIndex + 1}</span></div>;
        })}
      </div>
    </div>
    <p className="encounter-scroll-hint">← Прокрутите сцену →</p>
    <ul className="encounter-roster">{members.map((member, index) => <li key={member.id}><span className="encounter-roster-number">{index + 1}</span><div><strong>{member.name}</strong><span>{memberState(run, member)}</span></div></li>)}</ul>
    {visible.length > 0 && <details className="encounter-mapping"><summary>Монстры — задачи команды{outstanding.length > 3 ? ` · ещё ${outstanding.length - 3} вне сцены` : ''}</summary><ul>{visible.map(task => <li key={task.id}><span>T{tasks.findIndex(item => item.id === task.id) + 1}</span><span>{task.title}</span><small>{run.tasks.length ? taskLabels[task.status] : 'В плане'}</small></li>)}</ul></details>}
  </section>;
}
