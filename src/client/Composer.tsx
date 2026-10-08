import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, Crown, Flask, Lightbulb, Plus, SlidersHorizontal, Trash, UsersThree } from '@phosphor-icons/react';
import type { Connection, CreateRunInput, Member, ModelCatalog } from '../shared/types';
import { ModelPicker } from './ModelPicker';
import { Avatar, ErrorNote } from './ui';

type Props = { connections: Connection[]; onCreate: (input: CreateRunInput) => Promise<void>; openSettings: () => void; loadModels: (connectionId: string) => Promise<ModelCatalog> };
const examples = [
  { label: 'Исследовать идею', goal: 'Исследуйте идею сервиса для совместной работы небольших команд с AI. Определите аудиторию, ключевые сценарии, риски и составьте план проверки спроса. Разделяйте проверенные факты и предположения.' },
  { label: 'Продумать продукт', goal: 'Разработайте концепцию приложения для личных заметок: сценарии использования, структуру экранов и план первой версии. Один участник должен независимо проверить предложения и найти слабые места.' },
  { label: 'Подготовить документ', goal: 'Подготовьте руководство по внедрению AI в небольшую продуктовую команду. Опишите процесс, распределение ответственности, критерии качества и ограничения. Проведите независимое ревью итогового документа.' },
];
function newMember(connection: Connection | undefined, index: number): Member {
  return { id: `member-${crypto.randomUUID().slice(0, 8)}`, name: `${connection?.name || 'Агент'}${index > 2 ? ` ${index + 1}` : ''}`, connectionId: connection?.id || '', model: '', role: ['Координация и итоговый результат', 'Исследование и проработка', 'Независимое ревью'][index] || '' };
}
export function Composer({ connections, onCreate, openSettings, loadModels }: Props) {
  const [goal, setGoal] = useState('');
  const [mode, setMode] = useState<'live' | 'demo'>('live');
  const [members, setMembers] = useState<Member[]>(() => {
    const sorted = [...connections].sort((a, b) => Number(b.available) - Number(a.available));
    return Array.from({ length: Math.min(3, Math.max(2, sorted.length)) }, (_, i) => newMember(sorted[i] || sorted[0], i));
  });
  const [leaderId, setLeaderId] = useState(members[0]?.id || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [catalogs, setCatalogs] = useState<Record<string, ModelCatalog>>({});
  const requested = useRef(new Set<string>());
  const fetchCatalog = useCallback((connectionId: string) => {
    if (requested.current.has(connectionId)) return;
    requested.current.add(connectionId);
    void loadModels(connectionId).then(catalog => {
      setCatalogs(current => ({ ...current, [connectionId]: catalog }));
    }).catch(() => {
      setCatalogs(current => ({ ...current, [connectionId]: { connectionId, models: [], status: 'error', note: 'Не удалось загрузить список моделей.' } }));
    });
  }, [loadModels]);
  useEffect(() => {
    for (const connectionId of new Set(members.map(member => member.connectionId).filter(Boolean))) fetchCatalog(connectionId);
  }, [members, fetchCatalog]);
  const retryCatalog = (connectionId: string) => {
    requested.current.delete(connectionId);
    setCatalogs(current => {
      const next = { ...current };
      delete next[connectionId];
      return next;
    });
    fetchCatalog(connectionId);
  };
  const unavailable = members.filter(member => !connections.find(c => c.id === member.connectionId)?.available);
  const updateMember = (id: string, patch: Partial<Member>) => setMembers(current => current.map(member => member.id === id ? { ...member, ...patch } : member));
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError('');
    if (goal.trim().length < 10) { setError('Опишите цель подробнее: минимум 10 символов.'); return; }
    if (members.some(member => !member.name.trim() || !member.connectionId)) { setError('Укажите имя и подключение для каждого участника.'); return; }
    if (mode === 'live' && unavailable.length) { setError('Выберите доступные подключения или включите демо.'); return; }
    if (mode === 'live' && members.some(member => member.connectionId.endsWith('-api') && !member.model.trim())) { setError('Укажите модель для каждого API-подключения.'); return; }
    setBusy(true);
    try { await onCreate({ goal: goal.trim(), members: members.map(member => ({ ...member, name: member.name.trim(), role: member.role.trim(), model: member.model.trim() })), leaderId, mode }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось создать задачу.'); }
    finally { setBusy(false); }
  }
  return <div className="workspace-grid">
    <main className="main-content composer-content">
      <div className="eyebrow"><span className="tiny-square" /> ОДНА ЦЕЛЬ. ОБЩАЯ РАБОТА.</div>
      <h1>Соберите команду.<br /><span className="text-muted">Дайте ей задачу.</span></h1>
      <p className="intro-copy">Агенты составят план, распределят работу и проверят результат. Вы задаёте направление и остаётесь в курсе.</p>
      <form onSubmit={submit}>
        <section className="goal-card">
          <div className="flex items-center justify-between gap-3"><label htmlFor="goal" className="section-label">Что нужно сделать?</label><span className="text-xs text-muted">01 / Цель</span></div>
          <textarea id="goal" value={goal} onChange={e => setGoal(e.target.value)} maxLength={12000} rows={5} placeholder="Опишите задачу, нужный результат и ограничения…" required aria-describedby="goal-help" />
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3"><span id="goal-help" className="text-xs text-muted">Чем точнее цель, тем полезнее результат.</span><span className="font-mono text-[11px] text-muted">{goal.length.toLocaleString('ru')} / 12 000</span></div>
        </section>
        <div className="example-row"><Lightbulb size={15} /><span>Попробуйте:</span>{examples.map(example => <button type="button" key={example.label} onClick={() => setGoal(example.goal)}>{example.label}<ArrowUpRight size={11} /></button>)}</div>
        <section className="mt-10">
          <div className="section-heading"><div><div className="flex items-center gap-2"><h2>Ваша команда</h2><span className="count-badge">{members.length}</span></div><p>Выберите подключения и назначьте лидера.</p></div><button className="text-button" type="button" onClick={openSettings}><SlidersHorizontal size={16} />Подключения</button></div>
          <div className="team-editor">
            {members.map((member, index) => <div className="member-editor" key={member.id}>
              <div className="flex items-center gap-3"><Avatar member={member} index={index} /><div className="min-w-0 flex-1"><label className="sr-only" htmlFor={`name-${member.id}`}>Имя участника {index + 1}</label><input className="name-input" id={`name-${member.id}`} value={member.name} maxLength={80} onChange={e => updateMember(member.id, { name: e.target.value })} required /></div>
                <button type="button" onClick={() => setLeaderId(member.id)} className={`leader-button ${leaderId === member.id ? 'is-leader' : ''}`} aria-pressed={leaderId === member.id} aria-label={`Назначить ${member.name} лидером`}><Crown size={14} weight={leaderId === member.id ? 'fill' : 'regular'} /><span>{leaderId === member.id ? 'Лидер' : 'Назначить'}</span></button>
                <button className="icon-button subtle" type="button" disabled={members.length <= 2} aria-label={`Удалить ${member.name}`} onClick={() => { const next = members.filter(m => m.id !== member.id); setMembers(next); if (leaderId === member.id) setLeaderId(next[0].id); }}><Trash size={16} /></button>
              </div>
              <div className="member-fields"><div className="field"><label htmlFor={`connection-${member.id}`}>Подключение</label><select id={`connection-${member.id}`} value={member.connectionId} onChange={e => updateMember(member.id, { connectionId: e.target.value, model: '' })}>{connections.map(connection => <option key={connection.id} value={connection.id}>{connection.name}{!connection.available ? ' · не настроено' : ''}</option>)}</select></div><div className="field"><label htmlFor={`role-${member.id}`}>Роль <span>необязательно</span></label><input id={`role-${member.id}`} value={member.role} maxLength={300} placeholder="Лидер распределит" onChange={e => updateMember(member.id, { role: e.target.value })} /></div><div className="field"><label htmlFor={`model-${member.id}`}>Модель <span>{member.connectionId.endsWith('-api') ? 'для API' : 'необязательно'}</span></label><ModelPicker id={`model-${member.id}`} connection={connections.find(connection => connection.id === member.connectionId) || { id: '', name: '', kind: 'demo', available: false, detail: '' }} value={member.model} catalog={catalogs[member.connectionId]} onChange={model => updateMember(member.id, { model })} onRetry={() => retryCatalog(member.connectionId)} /></div></div>
            </div>)}
            {members.length < 5 && <button className="add-member" type="button" onClick={() => setMembers(current => [...current, newMember(connections.find(c => c.available) || connections[0], current.length)])}><Plus size={16} />Добавить участника<span>до 5 агентов</span></button>}
          </div>
        </section>
        <div className="launch-panel"><div className="flex items-start gap-3"><Flask size={18} className="mt-0.5 shrink-0 text-muted" /><label className="demo-option"><span className="flex items-center gap-2"><input type="checkbox" checked={mode === 'demo'} onChange={e => setMode(e.target.checked ? 'demo' : 'live')} />Демо без запросов к моделям</span><span className="block text-xs text-muted mt-1.5">{mode === 'demo' ? 'Сценарий с образцами ответов. Результаты не созданы моделями.' : 'Реальный запуск использует ваши CLI-подписки или API.'}</span></label></div>
          {mode === 'live' && unavailable.length > 0 && <p className="connection-warning">{unavailable.length} {unavailable.length === 1 ? 'подключение не настроено' : 'подключения не настроены'}. Настройте их или выберите доступные.</p>}
          <ErrorNote>{error}</ErrorNote>
          <div className="launch-bottom"><p><Check size={14} /> План потребует вашего согласования</p><button type="submit" className="primary-button" disabled={busy || !connections.length}>{busy ? 'Создаём задачу…' : mode === 'demo' ? 'Составить демо-план' : 'Составить план'}<ArrowRight size={17} /></button></div>
        </div>
      </form>
    </main>
    <details className="context-rail workspace-details"><summary>Как работает команда</summary><div className="rail-heading"><UsersThree size={18} /><span>Как работает команда</span></div><div className="workflow-steps">{[{ title: 'Сначала — план', body: 'Лидер уточняет роли, разбивает цель на задачи и определяет критерии успеха.' }, { title: 'Вы согласовываете', body: 'Изучите план и предложите изменения перед началом работы.' }, { title: 'Агенты работают вместе', body: 'Участники обмениваются сообщениями и передают результаты друг другу.' }, { title: 'Проверенный результат', body: 'Команда собирает итоговый документ и проводит независимое ревью.' }].map((step, index) => <div className="workflow-step" key={step.title}><span className="step-number">0{index + 1}</span><div><h3>{step.title}</h3><p>{step.body}</p></div></div>)}</div><div className="rail-note"><span className="eyebrow">РАБОЧЕЕ ПРОСТРАНСТВО V0.1</span><p>Совместная работа с текстами и документами. Подключённые агенты не редактируют внешние репозитории.</p></div></details>
  </div>;
}
