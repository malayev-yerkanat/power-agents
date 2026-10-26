import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, Crown, Flask, Lightbulb, Plus, SlidersHorizontal, Trash, UsersThree } from '@phosphor-icons/react';
import type { Connection, CreateRunInput, Member, ModelCatalog } from '../shared/types';
import { validateComposer, type ComposerIssue } from './composerValidation';
import { composerDraftSchema, type ComposerDraft } from './draftStorage';
import { ModelPicker } from './ModelPicker';
import { SquadPreview } from './SquadPreview';
import { useBrowserDraft } from './useBrowserDraft';
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
  const createDefaultDraft = (): ComposerDraft => {
    const sorted = [...connections].sort((a, b) => Number(b.available) - Number(a.available));
    const members = Array.from({ length: Math.min(3, Math.max(2, sorted.length)) },
      (_, index) => newMember(sorted[index] || sorted[0], index));
    return { goal: '', mode: 'live', members, leaderId: members[0]?.id || '' };
  };
  const draft = useBrowserDraft('power-agents:composer:v1', composerDraftSchema, createDefaultDraft);
  const { goal, mode, members, leaderId, repoPath = '', checkCommand = '' } = draft.value;
  const setRepo = (fields: { repoPath?: string; checkCommand?: string }) => draft.update(value => ({ ...value, ...fields }));
  const setGoal = (goal: string) => draft.update(value => ({ ...value, goal }));
  const setMode = (mode: 'live' | 'demo') => draft.update(value => ({ ...value, mode }));
  const setLeaderId = (leaderId: string) => draft.update(value => ({ ...value, leaderId }));
  const setMembers = (next: Member[] | ((value: Member[]) => Member[])) => draft.update(value => {
    const members = typeof next === 'function' ? next(value.members) : next;
    return { ...value, members,
      leaderId: members.some(member => member.id === value.leaderId) ? value.leaderId : members[0]?.id || '' };
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [issues, setIssues] = useState<ComposerIssue[]>([]);
  const issueFor = (id: string) => issues.find(issue => issue.fieldId === id);
  const issueProps = (id: string, help?: string) => ({
    'aria-invalid': issueFor(id) ? true : undefined,
    'aria-describedby': [help, issueFor(id) ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined,
  });
  const fieldError = (id: string) => issueFor(id)
    ? <p id={`${id}-error`} className="field-error">{issueFor(id)!.message}</p> : null;
  const clearIssues = (...ids: string[]) => setIssues(current => current.filter(issue => !ids.includes(issue.fieldId)));
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
    const nextIssues = validateComposer({ goal, mode, members, leaderId, repoPath: repoPath.trim() || undefined }, connections);
    setIssues(nextIssues);
    if (nextIssues.length) {
      const field = document.getElementById(nextIssues[0].fieldId);
      const disclosure = field?.closest('details');
      if (disclosure) disclosure.open = true;
      requestAnimationFrame(() => {
        const target = field instanceof HTMLSelectElement && field.disabled
          ? field.closest<HTMLElement>('.model-picker') : field;
        target?.focus();
      });
      return;
    }
    setBusy(true);
    try { await onCreate({ goal: goal.trim(), members: members.map(member => ({ ...member, name: member.name.trim(), role: member.role.trim(), model: member.model.trim() })), leaderId, mode, ...(repoPath.trim() ? { repoPath: repoPath.trim(), ...(checkCommand.trim() ? { checkCommand: checkCommand.trim() } : {}) } : {}) }); draft.reset(createDefaultDraft()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось создать задачу.'); }
    finally { setBusy(false); }
  }
  return <div className="workspace-grid">
    <main className="main-content composer-content">
      <div className="composer-intro">
        <div className="composer-intro-copy">
          <div className="eyebrow"><span className="tiny-square" /> ОДНА ЦЕЛЬ. ОБЩАЯ РАБОТА.</div>
          <h1 id="workspace-heading" tabIndex={-1}>Соберите команду.<br /><span className="text-muted">Дайте ей задачу.</span></h1>
          <p className="intro-copy">Вы согласовываете план. Агенты распределяют работу, обмениваются результатами и проверяют друг друга.</p>
        </div>
      </div>
      <form noValidate onSubmit={submit}>
        <fieldset disabled={busy}>
        <section className="goal-card">
          <div className="flex items-center justify-between gap-3"><label htmlFor="goal" className="section-label">Что нужно сделать?</label><span className="section-index">01 / Задача</span></div>
          <textarea id="goal" value={goal} onChange={e => { clearIssues('goal'); setGoal(e.target.value); }} maxLength={12000} rows={5} placeholder="Опишите задачу, нужный результат и ограничения…" required {...issueProps('goal', 'goal-help')} />
          {fieldError('goal')}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3"><span id="goal-help" className="text-xs text-muted">Чем точнее цель, тем полезнее результат.</span><span className="font-mono text-[11px] text-muted">{goal.length.toLocaleString('ru')} / 12 000</span></div>
        </section>
        <div className="example-row"><Lightbulb size={15} /><span>Попробуйте:</span>{examples.map(example => <button type="button" key={example.label} onClick={() => { clearIssues('goal'); setGoal(example.goal); }}>{example.label}<ArrowUpRight size={11} /></button>)}</div>
        <details className="repo-card" open={!!repoPath}>
          <summary>Изменить код в git-проекте <span className="text-muted">(необязательно)</span></summary>
          <label htmlFor="repoPath" className="section-label">Папка проекта</label>
          <input id="repoPath" value={repoPath} onChange={e => { clearIssues('repoPath'); setRepo({ repoPath: e.target.value }); }} maxLength={1000} placeholder="/Users/you/projects/app" aria-invalid={!!issueFor('repoPath')} aria-describedby="repo-help" />
          {fieldError('repoPath')}
          <label htmlFor="checkCommand" className="section-label">Команда проверки</label>
          <input id="checkCommand" value={checkCommand} onChange={e => setRepo({ checkCommand: e.target.value })} maxLength={1000} placeholder="npm test" disabled={!repoPath.trim()} aria-describedby="repo-help" />
          <p id="repo-help" className="text-xs text-muted">Каждая задача работает в отдельной копии на своей ветке; итог собирается в ветке power-agents/…/result. Ваша ветка и незакоммиченные изменения не затрагиваются и в работу не попадают. Команду проверки платформа запускает после слияния.</p>
        </details>
        <section className="team-section" aria-labelledby="team-heading">
          <div className="section-heading"><div><span className="section-index">02 / Команда</span><div className="flex items-center gap-2"><h2 id="team-heading">Кто возьмётся за задачу</h2><span className="count-badge">{members.length}</span></div><p>Выберите агентов и лидера. Роли можно уточнить в плане.</p></div><button className="text-button" type="button" onClick={openSettings}><SlidersHorizontal size={16} />Подключения</button></div>
          <p className="team-summary">{members.map(member =>
            `${member.name}${member.id === leaderId ? ' — лидер' : ''}`).join(' · ')}</p>
          <details className="team-settings" id="team-settings">
            <summary>Настроить команду · {members.length} {members.length < 5 ? 'участника' : 'участников'}</summary>
            <div className="team-editor">
            {members.map((member, index) => <div className="member-editor" key={member.id}>
              <div className="member-heading flex items-center gap-3"><Avatar member={member} index={index} /><div className="min-w-0 flex-1"><label className="sr-only" htmlFor={`name-${member.id}`}>Имя участника {index + 1}</label><input className="name-input" id={`name-${member.id}`} value={member.name} maxLength={80} onChange={e => { clearIssues(`name-${member.id}`); updateMember(member.id, { name: e.target.value }); }} required {...issueProps(`name-${member.id}`)} />{fieldError(`name-${member.id}`)}</div>
                <button type="button" onClick={() => setLeaderId(member.id)} className={`leader-button ${leaderId === member.id ? 'is-leader' : ''}`} aria-pressed={leaderId === member.id} aria-label={`Назначить ${member.name} лидером`}><Crown size={14} weight={leaderId === member.id ? 'fill' : 'regular'} /><span>{leaderId === member.id ? 'Лидер' : 'Назначить'}</span></button>
                <button className="icon-button subtle" type="button" disabled={members.length <= 2} aria-label={`Удалить ${member.name}`} onClick={() => setMembers(members.filter(m => m.id !== member.id))}><Trash size={16} /></button>
              </div>
              <div className="member-fields"><div className="field"><label htmlFor={`connection-${member.id}`}>Подключение</label><select id={`connection-${member.id}`} value={member.connectionId} onChange={e => { clearIssues(`connection-${member.id}`, `model-${member.id}`); updateMember(member.id, { connectionId: e.target.value, model: '' }); }} {...issueProps(`connection-${member.id}`)}>{!connections.some(connection => connection.id === member.connectionId) && <option value={member.connectionId}>Недоступное подключение: {member.connectionId || 'не выбрано'}</option>}{connections.map(connection => <option key={connection.id} value={connection.id}>{connection.name}{!connection.available ? ' · не настроено' : ''}</option>)}</select>{fieldError(`connection-${member.id}`)}</div><div className="field"><label htmlFor={`role-${member.id}`}>Роль <span>необязательно</span></label><input id={`role-${member.id}`} value={member.role} maxLength={300} placeholder="Лидер распределит" onChange={e => updateMember(member.id, { role: e.target.value })} /></div><div className="field"><label htmlFor={`model-${member.id}`}>Модель <span>{member.connectionId.endsWith('-api') ? 'для API' : 'необязательно'}</span></label><ModelPicker id={`model-${member.id}`} connection={connections.find(connection => connection.id === member.connectionId) || { id: '', name: '', kind: 'demo', available: false, detail: '' }} value={member.model} catalog={catalogs[member.connectionId]} error={issueFor(`model-${member.id}`)?.message} onChange={model => { clearIssues(`model-${member.id}`); updateMember(member.id, { model }); }} onRetry={() => retryCatalog(member.connectionId)} /></div></div>
            </div>)}
            {members.length < 5 && <button className="add-member" type="button" onClick={() => setMembers(current => [...current, newMember(connections.find(c => c.available) || connections[0], current.length)])}><Plus size={16} />Добавить участника<span>до 5 агентов</span></button>}
            </div>
          </details>
          <details className="squad-disclosure"><summary>Показать состав в сцене</summary>
            <SquadPreview members={members} />
          </details>
        </section>
        <p className="draft-note">Черновик сохраняется в этой вкладке и восстанавливается после обновления страницы.</p>
        <ErrorNote>{draft.storageError}</ErrorNote>
        <button type="button" className="text-button" onClick={() => { draft.reset(createDefaultDraft()); setIssues([]); setError(''); }}>Очистить черновик</button>
        <div className="launch-panel"><div className="flex items-start gap-3"><Flask size={18} className="mt-0.5 shrink-0 text-muted" /><label className="demo-option"><span className="flex items-center gap-2"><input type="checkbox" checked={mode === 'demo'} onChange={e => {
            const nextMode = e.target.checked ? 'demo' : 'live';
            setMode(nextMode);
            setIssues(current => current.length
              ? validateComposer({ goal, mode: nextMode, members, leaderId }, connections) : current);
          }} />Демо без запросов к моделям</span><span className="block text-xs text-muted mt-1.5">{mode === 'demo' ? 'Сценарий с образцами ответов. Результаты не созданы моделями.' : 'Реальный запуск использует ваши CLI-подписки или API.'}</span></label></div>
          {!connections.length && <p className="connection-warning">Подключения не найдены. Обновите их статус перед запуском.</p>}
          {mode === 'live' && unavailable.length > 0 && <p className="connection-warning">{unavailable.length} {unavailable.length === 1 ? 'подключение не настроено' : 'подключения не настроены'}. Настройте их или выберите доступные.</p>}
          <ErrorNote>{issues.length ? 'Проверьте отмеченные поля.' : error}</ErrorNote>
          <div className="launch-bottom"><p><Check size={14} /> План потребует вашего согласования</p><button type="submit" className="primary-button" disabled={busy || !connections.length}>{busy ? 'Создаём задачу…' : mode === 'demo' ? 'Составить демо-план' : 'Составить план'}<ArrowRight size={17} /></button></div>
        </div>
        </fieldset>
      </form>
    </main>
    <details className="context-rail workspace-details"><summary>Как работает команда</summary><div className="rail-heading"><UsersThree size={18} /><span>Как работает команда</span></div><div className="workflow-steps">{[{ title: 'Сначала — план', body: 'Лидер уточняет роли, разбивает цель на задачи и определяет критерии успеха.' }, { title: 'Вы согласовываете', body: 'Изучите план и предложите изменения перед началом работы.' }, { title: 'Агенты работают вместе', body: 'Участники обмениваются сообщениями и передают результаты друг другу.' }, { title: 'Проверенный результат', body: 'Команда собирает итоговый документ и проводит независимое ревью.' }].map((step, index) => <div className="workflow-step" key={step.title}><span className="step-number">0{index + 1}</span><div><h3>{step.title}</h3><p>{step.body}</p></div></div>)}</div><div className="rail-note"><span className="eyebrow">РАБОЧЕЕ ПРОСТРАНСТВО V0.1</span><p>Совместная работа с текстами и документами. Подключённые агенты не редактируют внешние репозитории.</p></div></details>
  </div>;
}
