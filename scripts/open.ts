// Opens the local app with a one-time launch link signed by this install's key; the key itself is never printed.
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { accessKeyPath, createLaunchToken, launchUrl, loadAccessKey } from '../src/server/access.ts';

const port = Number(process.env.PORT ?? 4317);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT must be an integer between 1024 and 65535.');
const keyPath = accessKeyPath(resolve('.power-agents'));
if (!existsSync(keyPath)) {
  console.error('No access key yet. Start Power Agents once (npm run dev, npm start or npm run service:start), then run npm run open.');
  process.exit(1);
}
const url = launchUrl(port, createLaunchToken(loadAccessKey(keyPath)));
if (process.argv.includes('--print') || process.platform !== 'darwin') console.log(`Open within 5 minutes (works once):\n${url}`);
else execFile('open', [url], error => { if (error) { console.log(`Open within 5 minutes (works once):\n${url}`); } });
