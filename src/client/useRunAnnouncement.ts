import { useEffect, useRef, useState } from 'react';
import type { Run } from '../shared/types';
import { t, useLanguage } from './i18n';

const statusLabels: Record<Run['status'], string> = {
  planning: 'Лидер готовит план.',
  awaiting_approval: 'План готов к согласованию.',
  running: 'Команда выполняет задачу.',
  paused: 'Работа приостановлена.',
  completed: 'Задача завершена. Результаты доступны в разделе «Результаты».',
  failed: 'Выполнение остановлено из-за ошибки. Доступен повтор шага.',
  cancelled: 'Задача остановлена.',
};
const phaseLabels: Record<Run['phase'], string> = {
  plan: 'Планирование.', tasks: 'Выполнение задач.', synthesize: 'Сборка результата.',
  review: 'Проверка результата.', done: 'Работа завершена.',
};

function snapshot(run: Run) {
  return {
    id: run.id, status: run.status, phase: run.phase,
    finished: run.tasks.filter(task => task.status === 'completed').length,
    waiting: run.tasks.filter(task => task.status === 'waiting').length,
    messages: new Map(run.messages.map(message => [message.id, message.status])),
  };
}

/** Announce meaningful model updates, never combat frames or streaming tokens. */
export function useRunAnnouncement(run: Run) {
  useLanguage();
  const previous = useRef<ReturnType<typeof snapshot> | null>(null);
  const [announcement, setAnnouncement] = useState<{
    parts: { text: string; vars?: Record<string, string | number> }[]; sequence: number;
  }>({ parts: [], sequence: 0 });
  useEffect(() => {
    const next = snapshot(run);
    const before = previous.current;
    previous.current = next;
    if (!before || before.id !== next.id) {
      setAnnouncement(current => ({ parts: [{ text: statusLabels[run.status] }], sequence: current.sequence + 1 }));
      return;
    }
    const updates: typeof announcement.parts = [];
    if (before.status !== next.status) updates.push({ text: statusLabels[run.status] });
    else if (before.phase !== next.phase) updates.push({ text: phaseLabels[run.phase] });
    if (before.finished !== next.finished) updates.push({ text: 'Выполнено задач: {done} из {total}.', vars: { done: next.finished, total: run.tasks.length } });
    if (before.waiting !== next.waiting && next.waiting > 0) updates.push({ text: 'Ожидают ответа: {count} задач.', vars: { count: next.waiting } });
    const newMessages = run.messages.filter(message => !before.messages.has(message.id)).length;
    const delivered = run.messages.filter(message => before.messages.get(message.id) === 'queued' && message.status !== 'queued').length;
    const answered = run.messages.filter(message => before.messages.has(message.id) && before.messages.get(message.id) !== 'answered' && message.status === 'answered').length;
    if (newMessages) updates.push({ text: 'Новых сообщений в обсуждении: {count}.', vars: { count: newMessages } });
    if (delivered) updates.push({ text: 'Доставлено сообщений: {count}.', vars: { count: delivered } });
    if (answered) updates.push({ text: 'Получено ответов: {count}.', vars: { count: answered } });
    if (updates.length) setAnnouncement(current => ({ parts: updates, sequence: current.sequence + 1 }));
  }, [run]);
  return { text: announcement.parts.map(part => t(part.text, part.vars)).join(' '), sequence: announcement.sequence };
}
