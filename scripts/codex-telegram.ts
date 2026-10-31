// Uses the existing local service; never starts a second Telegram poller or prints a token.
const command = process.argv[2];
if (command !== 'status' && command !== 'pair') throw new Error('Use codex:telegram:status or codex:telegram:pair.');
const port = Number(process.env.PORT ?? 4317);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid local PORT.');
const base = `http://127.0.0.1:${port}`;
try {
  const bootstrap = await fetch(`${base}/api/bootstrap`, { signal: AbortSignal.timeout(5000) });
  if (!bootstrap.ok) throw new Error('Local service unavailable.');
  const cookie = bootstrap.headers.get('set-cookie')?.split(';')[0];
  const data = await bootstrap.json() as { csrfToken?: string };
  if (!cookie || !data.csrfToken) throw new Error('Could not open a local service session.');
  const response = await fetch(`${base}/api/telegram/codex${command === 'pair' ? '/pair' : ''}`, {
    method: command === 'pair' ? 'POST' : 'GET',
    headers: { cookie, 'X-CSRF-Token': data.csrfToken, 'Content-Type': 'application/json' },
    ...(command === 'pair' ? { body: '{}' } : {}), signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error('Codex bot is unavailable. Save CODEX_TELEGRAM_BOT_TOKEN, enable CODEX_TELEGRAM_ENABLED, then restart the service.');
  const result = await response.json() as Record<string, unknown>;
  if (command === 'pair') {
    if (typeof result.url !== 'string' || !/^https:\/\/t\.me\/[A-Za-z0-9_]+\?start=[A-Za-z0-9_-]+$/.test(result.url)) throw new Error('Invalid pairing URL.');
    console.log(`Open this one-use link and press Start:\n${result.url}`);
  } else console.log(JSON.stringify({ enabled: result.enabled, configured: result.configured, ready: result.ready,
    connected: result.connected, status: result.status, error: result.error }, null, 2));
} catch (error) {
  console.error(error instanceof Error && !('cause' in error) ? error.message : 'Cannot reach Power Agents. Start the local service first.');
  process.exitCode = 1;
}
export {};
