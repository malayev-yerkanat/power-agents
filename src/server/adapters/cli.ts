import type { TurnInput, TurnResult, AdapterKind } from '../../shared/types.js';
import { optionalText, parseJsonObject, record, requiredText } from './common.js';
import { runProcess, runtimeEnvironment } from './process.js';

export function buildCliCommand(input: TurnInput): { args: string[]; stdin?: string } {
  const model = input.member.model.trim();
  const modelArgs = model ? ['--model', model] : [];
  if (input.connection.kind === 'codex-cli') {
    const args = ['exec', '--json', '--ignore-user-config', '-s', 'read-only', '-C', input.cwd, ...modelArgs];
    return { args: [...args, ...(input.sessionId ? ['resume', input.sessionId] : []), '-'], stdin: input.prompt };
  }
  if (input.connection.kind === 'claude-cli') {
    return { args: ['-p', '--permission-mode', 'plan', '--output-format', 'json', '--tools', '', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--disable-slash-commands', '--settings', '{"disableAllHooks":true}', ...modelArgs, ...(input.sessionId ? ['--resume', input.sessionId] : [])], stdin: input.prompt };
  }
  if (input.connection.kind === 'gemini-cli') {
    return { args: ['--mode', 'plan', '--sandbox', '--disable-slash-commands', '--output-format', 'json', '--print-timeout', '300s', ...modelArgs, ...(input.sessionId ? ['--conversation', input.sessionId] : []), '--print', input.prompt] };
  }
  throw new Error('Неизвестный CLI-провайдер.');
}

function parseCodex(output: string): TurnResult {
  const events = output.split('\n').filter(line => line.trim()).map(line => record(parseJsonObject(line)));
  const error = events.find(event => event.type === 'turn.failed' || event.type === 'error');
  if (error) throw new Error(optionalText(error.message) ?? optionalText(record(error.error ?? {}).message) ?? 'Ошибка Codex CLI.');
  if (!events.some(event => event.type === 'turn.completed')) throw new Error('Codex не подтвердил завершение ответа.');
  const messages = events.filter(event => event.type === 'item.completed')
    .map(event => record(event.item)).filter(item => item.type === 'agent_message').map(item => requiredText(item.text));
  return { text: requiredText(messages.at(-1)), sessionId: optionalText(events.find(event => event.type === 'thread.started')?.thread_id) };
}

export function parseCliResult(kind: AdapterKind, output: string): TurnResult {
  if (kind === 'codex-cli') return parseCodex(output);
  const result = record(parseJsonObject(output));
  if (kind === 'claude-cli') {
    if (result.is_error || result.subtype !== 'success') throw new Error(optionalText(result.result) ?? 'Ошибка Claude CLI. Проверьте вход в claude.');
    return { text: requiredText(result.result), sessionId: optionalText(result.session_id) };
  }
  if (kind === 'gemini-cli') {
    if (result.status !== 'SUCCESS') throw new Error(optionalText(result.error) ?? 'Ошибка Gemini CLI. Проверьте вход в agy.');
    return { text: requiredText(result.response), sessionId: optionalText(result.conversation_id) };
  }
  throw new Error('Неизвестный CLI-провайдер.');
}

export function cliEnvironment(kind: AdapterKind): NodeJS.ProcessEnv {
  const keys = kind === 'codex-cli' ? ['CODEX_HOME', 'OPENAI_API_KEY', 'OPENAI_ORG_ID']
    : kind === 'claude-cli' ? ['CLAUDE_CONFIG_DIR', 'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN']
      : ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_APPLICATION_CREDENTIALS'];
  return { ...runtimeEnvironment(), ...Object.fromEntries(keys.filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]])) };
}

export async function runCli(input: TurnInput): Promise<TurnResult> {
  if (!input.connection.executable) throw new Error('CLI не найден. Установите его и выполните вход.');
  const command = buildCliCommand(input);
  const output = await runProcess(input.connection.executable, command.args, { cwd: input.cwd, signal: input.signal, stdin: command.stdin, env: cliEnvironment(input.connection.kind) });
  const result = parseCliResult(input.connection.kind, output);
  return { ...result, sessionId: result.sessionId ?? input.sessionId };
}
