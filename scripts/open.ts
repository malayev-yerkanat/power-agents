// Opens the local app with a one-time launch link signed by this install's key; the key itself is never printed.
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { accessKeyPath, createLaunchToken, launchUrl, loadAccessKey } from '../src/server/access.ts';

const port = Number(process.env.PORT ?? 4317);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT must be an integer between 1024 and 65535.');
const keyPath = accessKeyPath(resolve('.power-agents'));
// `npm run service:restart` returns before the new server is listening, so wait briefly for it.
const deadline = Date.now() + 15_000;
const healthy = () => fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(1000) }).then(r => r.ok, () => false);
while (!(existsSync(keyPath) && await healthy()) && Date.now() < deadline) await sleep(300);
if (!existsSync(keyPath)) {
  console.error('No access key yet. Start Power Agents once (npm run dev, npm start or npm run service:start), then run npm run open.');
  process.exit(1);
}
if (!await healthy()) console.error(`Power Agents is not answering on port ${port} yet; the link works once it is.`);
const url = launchUrl(port, createLaunchToken(loadAccessKey(keyPath)));
if (process.argv.includes('--print') || process.platform !== 'darwin') console.log(`Open within 5 minutes (works once):\n${url}`);
else execFile('open', [url], error => { if (error) { console.log(`Open within 5 minutes (works once):\n${url}`); } });
