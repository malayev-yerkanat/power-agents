import { access, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, isAbsolute, join } from 'node:path';
import type { Connection, TurnRunner } from '../../shared/types.js';
import { redactError } from './common.js';
import { runApi } from './api.js';
import { runCli } from './cli.js';
export { parseJsonObject } from './common.js';

async function findExecutable(name: string, fallbacks: string[]): Promise<string | undefined> {
  const directories = (process.env.PATH ?? '').split(delimiter).filter(directory => isAbsolute(directory));
  for (const path of [...directories.map(directory => join(directory, name)), ...fallbacks]) {
    try { await access(path, constants.X_OK); if ((await stat(path)).isFile()) return path; }
    catch { /* A missing PATH candidate is normal; try the next one. */ }
  }
  return undefined;
}

export async function discoverConnections(): Promise<Connection[]> {
  const specs = [
    { id: 'codex', name: 'Codex CLI', kind: 'codex-cli' as const, binary: 'codex', paths: ['/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex'] },
    { id: 'claude', name: 'Claude Code', kind: 'claude-cli' as const, binary: 'claude', paths: [join(homedir(), '.local/bin/claude')] },
    { id: 'gemini', name: 'Gemini · Antigravity CLI', kind: 'gemini-cli' as const, binary: 'agy', paths: ['/opt/homebrew/bin/agy', '/usr/local/bin/agy'] },
  ];
  const cli = await Promise.all(specs.map(async spec => {
    const executable = await findExecutable(spec.binary, spec.paths);
    return { id: spec.id, name: spec.name, kind: spec.kind, available: Boolean(executable), executable,
      detail: executable ? 'CLI найден. Вход в аккаунт не проверен; используется авторизация официального CLI.' : `CLI не найден. Установите ${spec.binary} и выполните вход.` };
  }));
  const api: Connection[] = [
    { id: 'openai-api', name: 'OpenAI API', kind: 'openai-api', available: Boolean(process.env.OPENAI_API_KEY?.trim()), detail: process.env.OPENAI_API_KEY?.trim() ? 'Ключ настроен. Доступ к модели не проверен; API оплачивается отдельно.' : 'Настройте OPENAI_API_KEY. API оплачивается отдельно.' },
    { id: 'anthropic-api', name: 'Anthropic API', kind: 'anthropic-api', available: Boolean(process.env.ANTHROPIC_API_KEY?.trim()), detail: process.env.ANTHROPIC_API_KEY?.trim() ? 'Ключ настроен. Доступ к модели не проверен; API оплачивается отдельно.' : 'Настройте ANTHROPIC_API_KEY. API оплачивается отдельно.' },
  ];
  return [...cli, ...api];
}

export const runTurn: TurnRunner = async input => {
  try {
    if (input.signal.aborted) throw new Error('Вызов агента отменён.');
    if (!input.connection.available) throw new Error('Подключение недоступно. Проверьте установку CLI или ключ API.');
    input.onProgress(`${input.connection.name}: запрос отправлен.`);
    if (input.connection.kind === 'openai-api' || input.connection.kind === 'anthropic-api') return await runApi(input);
    if (['codex-cli', 'claude-cli', 'gemini-cli'].includes(input.connection.kind)) return await runCli(input);
    throw new Error('Неизвестный провайдер.');
  } catch (error) {
    if (input.signal.aborted) throw new Error('Вызов агента отменён.');
    throw new Error(redactError(error));
  }
};
