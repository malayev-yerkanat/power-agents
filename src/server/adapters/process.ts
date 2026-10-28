import { spawn } from 'node:child_process';
import { MAX_OUTPUT_BYTES, StalledError, TURN_TIMEOUT_MS, redactError } from './common.js';

/** A non-zero exit that keeps stdout: some CLIs report the reason there, not on stderr. */
export class ProcessExitError extends Error {
  constructor(message: string, readonly output: string) { super(message); }
}

/** isComplete lets a caller accept output from a CLI that answers but never exits; the process group is then stopped. */
interface ProcessOptions { cwd: string; signal: AbortSignal; stdin?: string; timeoutMs?: number; idleMs?: number; env?: NodeJS.ProcessEnv; isComplete?: (output: string) => boolean }

export function runtimeEnvironment(): NodeJS.ProcessEnv {
  const keys = ['PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'TMPDIR', 'TMP', 'TEMP', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TERM', 'SYSTEMROOT', 'WINDIR', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_CACHE_HOME', 'SSL_CERT_FILE', 'SSL_CERT_DIR', 'NODE_EXTRA_CA_CERTS', 'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY', 'http_proxy', 'https_proxy', 'no_proxy'];
  return Object.fromEntries(keys.filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]));
}

/** Spawn without a shell, with a dedicated process group on POSIX. */
export function runProcess(executable: string, args: string[], options: ProcessOptions): Promise<string> {
  if (options.signal.aborted) return Promise.reject(new Error('Вызов агента отменён.'));
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd: options.cwd, shell: false, env: options.env ?? runtimeEnvironment(), detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '';
    let outputBytes = 0;
    let stderr = '';
    let failure: Error | undefined;
    let settled = false;
    const kill = (signal: NodeJS.Signals) => {
      if (!child.pid) return;
      try { if (process.platform === 'win32') child.kill(signal); else process.kill(-child.pid, signal); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') failure ??= new Error('Не удалось остановить процесс агента.'); }
    };
    const stop = (reason: string | Error) => {
      if (failure) return;
      failure = typeof reason === 'string' ? new Error(reason) : reason;
      kill('SIGTERM');
      // Keep the escalation even if the direct child exits: descendants may remain.
      setTimeout(() => kill('SIGKILL'), 500).unref();
    };
    const onAbort = () => stop('Вызов агента отменён.');
    const timeout = setTimeout(() => stop('Превышено время ожидания агента.'), options.timeoutMs ?? TURN_TIMEOUT_MS);
    let idle: NodeJS.Timeout | undefined;
    const watchIdle = () => {
      if (!options.idleMs) return;
      clearTimeout(idle);
      idle = setTimeout(() => stop(new StalledError(Math.round(options.idleMs! / 1000))), options.idleMs);
    };
    watchIdle();
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      clearTimeout(idle);
      options.signal.removeEventListener('abort', onAbort);
      if (error instanceof StalledError) reject(error);
      else if (error instanceof ProcessExitError) reject(new ProcessExitError(redactError(error), error.output));
      else if (error) reject(new Error(redactError(error))); else resolve(output);
    };
    options.signal.addEventListener('abort', onAbort, { once: true });
    if (options.signal.aborted) onAbort();
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      watchIdle();
      outputBytes += Buffer.byteLength(chunk);
      if (outputBytes > MAX_OUTPUT_BYTES) stop('Ответ агента превысил лимит 2 МиБ.');
      else if (!failure) {
        output += chunk;
        if (!settled && options.isComplete?.(output)) {
          finish();
          kill('SIGTERM');
          setTimeout(() => kill('SIGKILL'), 500).unref();
        }
      }
    });
    child.stderr.on('data', (chunk: string) => { stderr = (stderr + chunk).slice(-8000); });
    child.on('error', error => finish(error));
    child.on('close', (code, signal) => finish(failure ?? (code === 0 ? undefined : new ProcessExitError(`CLI завершился с ошибкой (${code ?? signal}): ${stderr.trim() || 'нет подробностей'}`, output))));
    child.stdin.on('error', error => { if ((error as NodeJS.ErrnoException).code !== 'EPIPE') stop('Не удалось передать запрос агенту.'); });
    child.stdin.end(options.stdin ?? '');
  });
}
