import { setTimeout } from 'node:timers/promises';
import type { TurnRunner } from '../../shared/types.ts';
import type { Context } from './prompts.ts';
export const demoRunner: TurnRunner = async input => {
  await setTimeout(400, undefined, { signal: input.signal });
  const { run, taskId, requestId } = JSON.parse(input.prompt.split('\nCONTEXT:\n')[1]) as Context;
  const other = run.members.find(m => m.id !== input.member.id)!;
  const output = { summary: 'Демонстрационный ход завершён.', status: 'done', messages: [] as unknown[], artifact: undefined as unknown, verdict: undefined as unknown };
  if (input.purpose === 'plan') return { text: JSON.stringify({
    summary: 'Демонстрация совместной работы: подготовка, запрос коллеге, объединение и независимая проверка. Реальные провайдеры не вызываются.',
    successCriteria: ['Участники обменялись вопросом и ответом', 'Итог собран и проверен другим участником'],
    roles: run.members.map((m, i) => ({ memberId: m.id, role: i === 0 ? 'Координация и итог' : 'Подготовка и проверка' })),
    tasks: run.members.map((m, i) => ({ id: `task-${i + 1}`, title: i === 0 ? 'Подготовить подход' : `Дополнить результат · ${m.name}`, description: `Подготовить текстовый материал по цели: ${run.goal}`, assigneeId: m.id, dependsOn: i === 0 ? [] : ['task-1'] })),
  }) };
  if (input.purpose === 'reply') output.summary = `Демо-ответ: добавим ограничения, конкретные шаги и критерии готовности.`;
  if (input.purpose === 'task') {
    const asked = run.messages.some(m => m.taskId === taskId && m.fromId === input.member.id && m.request);
    if (!asked) {
      output.status = 'waiting';
      output.messages = [{ toId: other.id, body: 'Какие критерии результата нужно учесть?', request: true }];
      output.summary = 'Запрашиваю мнение коллеги.';
    } else output.artifact = { title: `Материал · ${input.member.name}`, body: `# Демонстрационный материал\n\nЦель: ${run.goal}\n\nУчтён ответ коллеги: ограничения, шаги и критерии готовности.\n\nЭто пример обмена результатами; содержательную работу выполняет режим реальных агентов.` };
  }
  if (input.purpose === 'synthesize') output.artifact = { title: 'Итог команды · демо', body: `# Демонстрация команды${run.reviewRound ? ' · исправленная версия' : ''}\n\n${run.reviewRound ? 'Учтено замечание: добавлен явный критерий — все вопросы получили ответ.\n\n' : ''}Цель: ${run.goal}\n\nКоманда согласовала план, выполнила ${run.tasks.length} задач и обменялась сообщениями.\n\n${run.artifacts.filter(a => a.kind === 'work').map(a => a.body).join('\n\n---\n\n')}` };
  if (input.purpose === 'review') { output.verdict = run.reviewRound === 0 ? 'changes_requested' : 'pass'; output.artifact = { title: 'Независимая проверка · демо', body: run.reviewRound === 0 ? 'Добавьте в итог явный критерий: все вопросы коллег получили ответ. Это демонстрационное замечание.' : 'Замечание учтено. Демонстрационный цикл завершён. Это имитация проверки.' }; }
  return { text: JSON.stringify(output) };
};
