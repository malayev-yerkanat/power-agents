import type { ReactNode } from 'react';
import { Check, Circle, CircleNotch, Pause, WarningCircle, X } from '@phosphor-icons/react';
import type { Member, RunStatus, TaskStatus } from '../shared/types';
import { providerFor } from './combat';
import { locale, t } from './i18n';
import { uiMessage } from './uiMessages';

export const statusLabels: Record<RunStatus | TaskStatus, string> = {
  planning: 'Подготовка плана', awaiting_approval: 'План на согласовании', running: 'В работе',
  paused: 'На паузе', completed: 'Завершено', failed: 'Ошибка', cancelled: 'Остановлено',
  pending: 'В очереди', waiting: 'Ждёт ответа',
};
export function Status({ status }: { status: RunStatus | TaskStatus }) {
  const Icon = status === 'completed' ? Check : status === 'failed' ? WarningCircle : status === 'paused' ? Pause : status === 'cancelled' ? X : status === 'running' || status === 'planning' ? CircleNotch : Circle;
  return <span className={`status status-${status}`}><Icon size={13} weight="bold" />{t(statusLabels[status])}</span>;
}
export function Avatar({ member, index = 0, small = false }: { member?: Pick<Member, 'name'> & Partial<Pick<Member, 'connectionId'>>; index?: number; small?: boolean }) {
  return <span className={`avatar avatar-${index % 4} avatar-provider-${providerFor(member?.connectionId || '')} ${small ? 'avatar-small' : ''}`} aria-hidden="true">{member?.name.slice(0, 2).toUpperCase() || 'PA'}</span>;
}
export function Empty({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{children}</p></div>;
}
export function ErrorNote({ children }: { children?: ReactNode }) {
  return children ? <div className="error-note" role="alert"><WarningCircle size={18} className="shrink-0" /><span>{typeof children === 'string' ? uiMessage(children) : children}</span></div> : null;
}
export function timeLabel(value: string) {
  return new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}
export function dateLabel(value: string) {
  return new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short' }).format(new Date(value));
}
