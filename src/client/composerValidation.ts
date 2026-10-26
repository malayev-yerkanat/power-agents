import type { Connection, CreateRunInput } from '../shared/types';

export type ComposerIssue = { fieldId: string; message: string };

export function validateComposer(input: CreateRunInput, connections: Connection[]): ComposerIssue[] {
  const issues: ComposerIssue[] = [];
  if (input.repoPath && !input.repoPath.startsWith('/')) {
    issues.push({ fieldId: 'repoPath', message: 'Укажите полный путь к папке проекта, начиная с /.' });
  }
  if (input.goal.trim().length < 10) {
    issues.push({ fieldId: 'goal', message: 'Опишите цель подробнее: минимум 10 символов.' });
  }

  for (const member of input.members) {
    const connection = connections.find(item => item.id === member.connectionId);
    if (!member.name.trim()) {
      issues.push({ fieldId: `name-${member.id}`, message: 'Укажите имя участника.' });
    }
    if (!connection || (input.mode === 'live' && !connection.available)) {
      issues.push({ fieldId: `connection-${member.id}`, message: 'Выберите доступное подключение для этого участника.' });
    }
    if (input.mode === 'live' && connection?.kind.endsWith('-api') && !member.model.trim()) {
      issues.push({ fieldId: `model-${member.id}`, message: 'Выберите модель для API-подключения.' });
    }
  }

  return issues;
}
