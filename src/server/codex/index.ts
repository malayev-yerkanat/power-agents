import { homedir } from 'node:os';
import { join } from 'node:path';
import type { TelegramService } from '../telegram.ts';
import { CodexBridge } from './bridge.ts';
import { CodexRequests } from './requests.ts';
import { CodexAsyncQuestions, canSendAsyncAnswer } from './async-questions.ts';
import { desktopThreadIds } from './threads.ts';

export function createCodexTelegramBridge(telegram: TelegramService): CodexBridge {
  const codexHome = process.env.CODEX_HOME || join(homedir(), '.codex');
  const requests: CodexRequests = new CodexRequests({ telegram, respond: (...args): Promise<unknown> => bridge.respond(...args) });
  const asyncQuestions: CodexAsyncQuestions = new CodexAsyncQuestions({ telegram, send: async (threadId, method, params, expectedTurnId): Promise<unknown> => {
    const state = await bridge.freshSnapshot(threadId);
    if (!state || !canSendAsyncAnswer(threadId, state.cwd, state, expectedTurnId, params)) {
      throw new Error('Codex question is no longer active');
    }
    return bridge.respond(threadId, '', method, params);
  } });
  const bridge: CodexBridge = new CodexBridge({ socketPath: join(codexHome, 'ipc', 'ipc.sock'),
    threadIds: () => desktopThreadIds(join(codexHome, 'state_5.sqlite')),
    ready: () => { const status = telegram.status(); return status.ready && status.connected; }, requests, asyncQuestions });
  return bridge;
}
