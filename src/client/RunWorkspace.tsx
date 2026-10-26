import { useRef, useState } from 'react';
import { ArrowDown, ArrowRight, ChatCircleDots, Check, Checks, Crown, FileText, Flag, ListChecks, Pause, Play, Stop, Terminal, UsersThree } from '@phosphor-icons/react';
import type { Run, RunDetail, TeamTask } from '../shared/types';
import { EncounterPanel, RunContext } from './RunContext';
import { ArtifactView } from './ArtifactView';
import { steeringDraftSchema } from './draftStorage';
import type { WorkspaceTab } from './navigation';
import { useBrowserDraft } from './useBrowserDraft';
import { useRunAnnouncement } from './useRunAnnouncement';
import { Avatar, Empty, ErrorNote, Status, timeLabel } from './ui';

type Props = { detail: RunDetail; mutate: (path: string, body: unknown) => Promise<Run>; loadOlderEvents?: () => Promise<void>;
  tabOverride?: WorkspaceTab; onTabChange?: (tab: WorkspaceTab) => void };
const tabs = [{ id: 'tasks', label: 'Задачи', icon: ListChecks }, { id: 'messages', label: 'Обсуждение', icon: ChatCircleDots }, { id: 'artifacts', label: 'Результаты', icon: FileText }, { id: 'events', label: 'Журнал', icon: Terminal }] as const;
const phaseLabels: Record<Run['phase'], string> = { plan: 'Планирование', tasks: 'Выполнение задач', synthesize: 'Сборка результата', review: 'Проверка результата', done: 'Работа завершена' };
export function RunWorkspace({ detail, mutate, loadOlderEvents, tabOverride, onTabChange }: Props) {
  const { run, events } = detail;
  const [localTab, setLocalTab] = useState<WorkspaceTab>(run.status === 'completed' ? 'artifacts' : 'tasks');
  const [initialTab] = useState(localTab);
  const tab = tabOverride ?? (onTabChange ? initialTab : localTab);
  const setTab = (next: WorkspaceTab) => { setLocalTab(next); onTabChange?.(next); };
  const steeringDraft = useBrowserDraft(`power-agents:steering:${run.id}:v1`, steeringDraftSchema, () => '');
  const body = steeringDraft.value;
  const setBody = steeringDraft.update;
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [loadingEvents, setLoadingEvents] = useState(false);
  const announcement = useRunAnnouncement(run);
  const focusResults = useRef(false);
  const [startedActive] = useState(!['completed', 'cancelled'].includes(run.status));
  const memberName = (id: string) => id === 'user' ? 'Вы' : id === 'team' || id === 'all' ? 'Вся команда' : run.members.find(member => member.id === id)?.name || id;
  const isActive = ['planning', 'awaiting_approval', 'running', 'paused', 'failed'].includes(run.status);
  const displayedTasks: TeamTask[] = run.tasks.length ? run.tasks : (run.plan?.tasks || []).map(task => ({ ...task, status: 'pending', turns: 0 }));
  const finished = displayedTasks.filter(task => task.status === 'completed').length;
  const sortedArtifacts = [...run.artifacts].sort((a, b) => Number(b.kind === 'final') - Number(a.kind === 'final') || b.createdAt.localeCompare(a.createdAt));
  const latestFinalId = sortedArtifacts.find(artifact => artifact.kind === 'final')?.id;
  const hasReview = run.artifacts.some(artifact => artifact.kind === 'review');
  async function action(name: string, path: string, payload: unknown) {
    const submittedBody = body;
    setBusy(name); setError('');
    try { await mutate(`/api/runs/${run.id}/${path}`, payload); if (name === 'message') setBody(current => current === submittedBody ? '' : current); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось выполнить действие.'); }
    finally { setBusy(''); }
  }
  /** Calls a restart cut off may have finished at the provider, so repeating them needs the user's confirmation. */
  function resume() {
    const confirmRepeat = !!run.interrupted?.length;
    if (confirmRepeat && !window.confirm(`${run.error ?? ''}\n\nПовторить эти вызовы?`)) return;
    void action('resume', 'control', { action: 'resume', ...(confirmRepeat ? { confirmRepeat } : {}) });
  }
  return <div className="workspace-grid">
    <main className="main-content run-content">
      <div className="sr-only" role="status" aria-atomic="true"><span key={announcement.sequence}>{announcement.text}</span></div>
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="eyebrow">КОМАНДНАЯ ЗАДАЧА</span><span className={`mode-tag ${run.mode === 'demo' ? 'demo-tag' : ''}`}>{run.mode === 'demo' ? 'Демо' : 'Live'}</span></div><div className="flex items-center gap-4"><Status status={run.status} />
        {(run.status === 'running' || run.status === 'planning') && <button className="secondary-button" disabled={!!busy} onClick={() => action('pause', 'control', { action: 'pause' })}><Pause size={16} />Пауза</button>}
        {(run.status === 'paused' || run.status === 'failed') && <button className={hasReview ? 'secondary-button' : 'primary-button'} disabled={!!busy} onClick={resume}><Play size={16} />{run.status === 'failed' ? 'Повторить шаг' : 'Продолжить'}</button>}
      </div></div>
      <h1 className="run-title" id="workspace-heading" tabIndex={-1}>{run.title}</h1>
      <details className="goal-details"><summary>Исходная цель<ArrowDown size={13} /></summary><p>{run.goal}</p></details>
      {run.mode === 'demo' && <div className="demo-banner">Демонстрационный сценарий. Ответы и документы — образцы, без запросов к моделям.</div>}
      <ErrorNote>{run.error}</ErrorNote>
      <ErrorNote>{error}</ErrorNote>
      <RunContext run={run} onClarify={() => document.getElementById('steering')?.focus()} />
      {run.status === 'planning' && <section className="planning-state"><div className="planning-symbol"><ListChecks size={27} /></div><div><h2>Лидер готовит план</h2><p>Распределяет роли и формулирует задачи. План появится здесь для вашего согласования.</p><span className="text-xs text-muted">{memberName(run.leaderId)} · {phaseLabels[run.phase]}</span></div></section>}
      {run.status === 'awaiting_approval' && run.plan && <section className="approval-card"><div className="flex items-center gap-2 text-accent"><Flag size={18} /><span className="eyebrow">ПЛАН ГОТОВ К СОГЛАСОВАНИЮ</span></div><h2>Проверьте направление</h2><p className="plan-summary">{run.plan.summary}</p><h3 className="section-label mt-6">Критерии успеха</h3><ul className="criteria-list">{run.plan.successCriteria.map((criterion, index) => <li key={index}><Check size={15} />{criterion}</li>)}</ul><div className="approval-footer"><p>Роли — в разделе команды, задачи — ниже.<br />Изменения можно отправить команде сообщением.</p><button className="primary-button" disabled={!!busy} onClick={() => action('approve', 'approve', { version: run.version })}>{busy === 'approve' ? 'Запускаем…' : 'Согласовать и запустить'}<ArrowRight size={17} /></button></div></section>}
      {run.status === 'completed' && tab !== 'artifacts' && <div className="completion-notice"><p>Задача завершена. Результаты готовы.</p><button type="button" className="secondary-button" onClick={() => { focusResults.current = true; setTab('artifacts'); }}>Посмотреть результаты<ArrowRight size={17} aria-hidden="true" /></button></div>}
      {run.status !== 'completed' && <EncounterPanel run={run} />}
      <div className="run-progress"><div className="flex items-center gap-2"><span className="phase-dot" /><span>{phaseLabels[run.phase]}</span></div><span className="text-muted">{finished} / {displayedTasks.length} задач</span></div>
      <div className="progress-track" role="progressbar" aria-label="Выполненные задачи" aria-valuenow={finished} aria-valuemin={0} aria-valuemax={Math.max(displayedTasks.length, 1)}><div style={{ width: `${displayedTasks.length ? finished / displayedTasks.length * 100 : 0}%` }} /></div>
      <div className="workspace-tabs" role="tablist" aria-label="Разделы задачи">{tabs.map(({ id, label, icon: Icon }) => <button type="button" key={id} role="tab" aria-selected={tab === id} id={`tab-${id}`} aria-controls={`panel-${id}`} tabIndex={tab === id ? 0 : -1} onKeyDown={event => {
          const index = tabs.findIndex(item => item.id === id);
          const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
          if (next >= 0) { event.preventDefault(); setTab(tabs[next].id); document.getElementById(`tab-${tabs[next].id}`)?.focus(); }
        }} onClick={() => setTab(id)}><Icon size={17} />{label}{id === 'messages' && run.messages.length > 0 && <span>{run.messages.length}</span>}{id === 'artifacts' && run.artifacts.length > 0 && <span>{run.artifacts.length}</span>}</button>)}</div>
      <section key={tab} ref={element => { if (element && focusResults.current && tab === 'artifacts') { focusResults.current = false; element.focus(); } }} role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} tabIndex={0} className="tab-panel">
        {tab === 'tasks' && <>{displayedTasks.length === 0 ? <Empty icon={<ListChecks size={27} />} title="Задачи появятся в плане">Лидер определит этапы работы и назначит ответственных.</Empty> : <div className="task-list">{displayedTasks.map((task, index) => <article className="task-row" key={task.id}><div className="task-index">{String(index + 1).padStart(2, '0')}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap justify-between gap-2"><h3>{task.title}</h3>{run.tasks.length ? <Status status={task.status} /> : <span className="status">В плане</span>}</div><p className="task-description">{task.description}</p><div className="task-meta"><span><Avatar member={run.members.find(m => m.id === task.assigneeId)} index={run.members.findIndex(m => m.id === task.assigneeId)} small />{memberName(task.assigneeId)}</span>{task.dependsOn.length > 0 && <span>После: {task.dependsOn.map(id => displayedTasks.find(t => t.id === id)?.title || id).join(', ')}</span>}</div>{task.error && <ErrorNote>{task.error}</ErrorNote>}{task.output && <details className="output-details"><summary>Ответ агента<ArrowDown size={12} /></summary><pre>{task.output}</pre></details>}</div></article>)}</div>}</>}
        {tab === 'messages' && <>{run.messages.length === 0 ? <Empty icon={<ChatCircleDots size={28} />} title="Команда ещё не начала обсуждение">Здесь появятся вопросы, ответы и ваши уточнения.</Empty> : <div className="message-list">{run.messages.map(message => <article className={`message-item ${message.fromId === 'user' ? 'user-message' : ''}`} key={message.id}><div className="message-head"><strong>{memberName(message.fromId)}</strong><ArrowRight size={12} /><span>{memberName(message.toId)}</span><time>{timeLabel(message.createdAt)}</time></div>{message.request && <span className="request-label">Запрос ответа</span>}<p>{message.body}</p><div className="message-status"><Checks size={13} />{({ queued: 'Отправлено · ожидает доставки', delivered: 'Доставлено', answered: 'Ответ получен' })[message.status]}</div></article>)}</div>}</>}
        {tab === 'artifacts' && <>{run.artifacts.length === 0 ? <Empty icon={<FileText size={28} />} title="Здесь будут результаты">Документы участников, итоговый результат и независимое ревью сохранятся в этом разделе.</Empty> : <div className="artifact-list">{sortedArtifacts.map(artifact => <ArtifactView key={artifact.id} artifact={artifact} runId={run.id} author={memberName(artifact.authorId)} expanded={artifact.id === latestFinalId} label={artifact.kind === 'final' ? artifact.id === latestFinalId ? run.status === 'completed' ? 'ПРИНЯТЫЙ ИТОГОВЫЙ РЕЗУЛЬТАТ' : 'ПОСЛЕДНИЙ ПРОЕКТ РЕЗУЛЬТАТА' : 'ПРЕДЫДУЩИЙ ПРОЕКТ РЕЗУЛЬТАТА' : artifact.kind === 'review' ? 'ОТЧЁТ РЕВЬЮ' : 'ДОКУМЕНТ УЧАСТНИКА'} />)}</div>}</>}
        {tab === 'events' && <>{events.length === 0 ? <Empty icon={<Terminal size={27} />} title="Пока нет событий">Журнал отразит ход выполнения и действия команды.</Empty> : <ol className="event-log">{[...events].reverse().map(event => <li key={event.id}><time>{timeLabel(event.createdAt)}</time><span className="event-dot" /><div><p>{event.message}</p>{event.actorId && <span>{memberName(event.actorId)}</span>}</div></li>)}</ol>}{detail.eventsBefore && loadOlderEvents && <button className="text-button" disabled={loadingEvents} onClick={async () => { setLoadingEvents(true); setError(''); try { await loadOlderEvents(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось загрузить журнал.'); } finally { setLoadingEvents(false); } }}>{loadingEvents ? 'Загружаем…' : 'Показать более ранние события'}</button>}</>}
      </section>
      {run.status === 'completed' && <EncounterPanel run={run} />}
      <ErrorNote>{steeringDraft.storageError}</ErrorNote>
      {(isActive || startedActive || !!body) && <form className="steering-form" onSubmit={event => { event.preventDefault(); if (isActive && body.trim()) void action('message', 'messages', { body: body.trim() }); }}><label htmlFor="steering">{run.status === 'awaiting_approval' ? 'Что изменить в плане?' : 'Направьте команду'}</label><div className="steering-input"><textarea id="steering" aria-describedby="steering-hint" readOnly={!isActive} rows={2} maxLength={8000} value={body} onChange={event => setBody(event.target.value)} placeholder={run.status === 'awaiting_approval' ? 'Уточните роли, ограничения или ожидаемый результат…' : 'Добавьте контекст или скорректируйте направление…'} required /><button className="send-button" disabled={!isActive || !body.trim() || !!busy} aria-label="Отправить команде"><ArrowRight size={19} /></button></div><p id="steering-hint">{!isActive ? 'Работа завершена. Черновик остаётся сохранённым в этой вкладке: его можно выделить и скопировать, но отправка недоступна.' : busy === 'message' ? 'Отправляем сообщение…' : run.status === 'awaiting_approval' ? 'Лидер переработает план с учётом вашего сообщения.' : 'Сообщение будет доставлено агентам на следующем шаге.'}</p></form>}
    </main>
    <details className="context-rail workspace-details" open={run.status === 'awaiting_approval'}><summary>Команда и управление</summary><div className="rail-heading"><UsersThree size={18} /><span>Команда</span><span className="count-badge ml-auto">{run.members.length}</span></div><div className="rail-members">{run.members.map((member, index) => <div key={member.id} className="rail-member"><div className="flex items-center gap-3"><Avatar member={member} index={index} /><div className="min-w-0"><h3 className="flex items-center gap-2">{member.name}{run.leaderId === member.id && <span className="leader-label"><Crown size={13} weight="fill" className="text-accent" aria-hidden="true" />Лидер</span>}</h3><p className="text-xs text-muted">{member.model || 'Модель по умолчанию'}</p></div></div><p className="member-role">{run.plan?.roles.find(role => role.memberId === member.id)?.role || member.role || 'Роль определит лидер'}</p></div>)}</div><div className="rail-note"><div className="eyebrow">УПРАВЛЕНИЕ</div><p>Можно приостановить работу и продолжить её позже.</p><div className="run-controls">{(run.status === 'running' || run.status === 'planning') && <button className="secondary-button" disabled={!!busy} onClick={() => action('pause', 'control', { action: 'pause' })}><Pause size={16} />Приостановить</button>}{(run.status === 'paused' || run.status === 'failed') && <button className={hasReview ? 'secondary-button' : 'primary-button'} disabled={!!busy} onClick={resume}><Play size={16} />{run.status === 'failed' ? 'Повторить шаг' : 'Продолжить'}</button>}{isActive && <button className="text-button" disabled={!!busy} onClick={() => action('cancel', 'control', { action: 'cancel' })}><Stop size={14} />Остановить задачу</button>}{!isActive && <Status status={run.status} />}</div></div><dl className="run-facts"><div><dt>Обращения к агентам</dt><dd>{run.turnCount}</dd></div><div><dt>Раунд ревью</dt><dd>{run.reviewRound}</dd></div><div><dt>Режим</dt><dd>{run.mode === 'demo' ? 'Демонстрация' : 'Реальные модели'}</dd></div></dl></details>
  </div>;
}
