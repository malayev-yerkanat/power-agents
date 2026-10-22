import { useEffect, useRef, useState } from 'react';
import type { Run } from '../shared/types';

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
  const previous = useRef<ReturnType<typeof snapshot> | null>(null);
  const [announcement, setAnnouncement] = useState({ text: '', sequence: 0 });
  useEffect(() => {
    const next = snapshot(run);
    const before = previous.current;
    previous.current = next;
    if (!before || before.id !== next.id) {
      setAnnouncement(current => ({ text: statusLabels[run.status], sequence: current.sequence + 1 }));
      return;
    }
    const updates: string[] = [];
    if (before.status !== next.status) updates.push(statusLabels[run.status]);
    else if (before.phase !== next.phase) updates.push(phaseLabels[run.phase]);
    if (before.finished !== next.finished) updates.push(`Выполнено задач: ${next.finished} из ${run.tasks.length}.`);
    if (before.waiting !== next.waiting && next.waiting > 0) updates.push(`Ожидают ответа: ${next.waiting} задач.`);
    const newMessages = run.messages.filter(message => !before.messages.has(message.id)).length;
    const delivered = run.messages.filter(message => before.messages.get(message.id) === 'queued' && message.status !== 'queued').length;
    const answered = run.messages.filter(message => before.messages.has(message.id) && before.messages.get(message.id) !== 'answered' && message.status === 'answered').length;
    if (newMessages) updates.push(`Новых сообщений в обсуждении: ${newMessages}.`);
    if (delivered) updates.push(`Доставлено сообщений: ${delivered}.`);
    if (answered) updates.push(`Получено ответов: ${answered}.`);
    if (updates.length) setAnnouncement(current => ({ text: updates.join(' '), sequence: current.sequence + 1 }));
  }, [run]);
  return announcement;
}
