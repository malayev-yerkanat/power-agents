import type { TurnInput, TurnResult, AdapterKind } from '../../shared/types.js';
import { optionalText, parseJsonObject, record, requiredText } from './common.js';
import { ProcessExitError, runProcess, runtimeEnvironment } from './process.js';

/** An error the CLI itself reported, as opposed to output the adapter could not read. */
class CliReportedError extends Error {}

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
    return {
      args: ['--mode', 'plan', '--sandbox', '--disable-slash-commands', '--input-format', 'stream-json', '--output-format', 'stream-json', '--print-timeout', '300s', ...modelArgs, ...(input.sessionId ? ['--conversation', input.sessionId] : [])],
      stdin: `${JSON.stringify({ event: 'user', message: { content: input.prompt } })}\n`,
    };
  }
  throw new Error('Неизвестный CLI-провайдер.');
}

function parseCodex(output: string): TurnResult {
  const events = output.split('\n').filter(line => line.trim()).map(line => record(parseJsonObject(line)));
  const error = events.find(event => event.type === 'turn.failed' || event.type === 'error');
  if (error) throw new CliReportedError(optionalText(error.message) ?? optionalText(record(error.error ?? {}).message) ?? 'Ошибка Codex CLI.');
  if (!events.some(event => event.type === 'turn.completed')) throw new Error('Codex не подтвердил завершение ответа.');
  const messages = events.filter(event => event.type === 'item.completed')
    .map(event => record(event.item)).filter(item => item.type === 'agent_message').map(item => requiredText(item.text));
  return { text: requiredText(messages.at(-1)), sessionId: optionalText(events.find(event => event.type === 'thread.started')?.thread_id) };
}

export function parseCliResult(kind: AdapterKind, output: string): TurnResult {
  if (kind === 'codex-cli') return parseCodex(output);
  if (kind === 'claude-cli') {
    const result = record(parseJsonObject(output));
    if (result.is_error || result.subtype !== 'success') throw new CliReportedError(optionalText(result.result) ?? 'Ошибка Claude CLI. Проверьте вход в claude.');
    return { text: requiredText(result.result), sessionId: optionalText(result.session_id) };
  }
  if (kind === 'gemini-cli') {
    const lines = output.trim().split('\n').filter(line => line.trim());
    const events = lines.map(line => record(parseJsonObject(line)));
    const results = events.filter(event => event.event === 'result');
    if (results.length > 1 || (events.some(event => 'event' in event) && results.length !== 1)) {
      throw new Error('Gemini CLI не вернул единственный результат завершения.');
    }
    const result = results.length === 1 ? record(results[0].result) : record(parseJsonObject(output));
    if (result.status !== 'SUCCESS') throw new CliReportedError(optionalText(result.error) ?? 'Ошибка Gemini CLI. Проверьте вход в agy.');
    return { text: requiredText(result.response), sessionId: optionalText(result.conversation_id) };
  }
  throw new Error('Неизвестный CLI-провайдер.');
}

function reportedFailure(kind: AdapterKind, output: string): Error | undefined {
  try { parseCliResult(kind, output); } catch (error) { if (error instanceof CliReportedError) return error; }
  return undefined;
}

/** CLIs keep their own sign-in; the app's API keys would silently switch them to paid API billing. */
export function cliEnvironment(kind: AdapterKind): NodeJS.ProcessEnv {
  const keys = kind === 'codex-cli' ? ['CODEX_HOME']
    : kind === 'claude-cli' ? ['CLAUDE_CONFIG_DIR', 'CLAUDE_CODE_OAUTH_TOKEN']
      : ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_APPLICATION_CREDENTIALS'];
  return { ...runtimeEnvironment(), ...Object.fromEntries(keys.filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]])) };
}

export async function runCli(input: TurnInput): Promise<TurnResult> {
  if (!input.connection.executable) throw new Error('CLI не найден. Установите его и выполните вход.');
  const command = buildCliCommand(input);
  const output = await runProcess(input.connection.executable, command.args, { cwd: input.cwd, signal: input.signal, stdin: command.stdin, env: cliEnvironment(input.connection.kind) })
    .catch((error: unknown) => { throw error instanceof ProcessExitError ? reportedFailure(input.connection.kind, error.output) ?? error : error; });
  const result = parseCliResult(input.connection.kind, output);
  return { ...result, sessionId: result.sessionId ?? input.sessionId };
}
