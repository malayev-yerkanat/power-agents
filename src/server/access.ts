import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** A launch link works once and only for a few minutes; the cookie it sets lasts across restarts. */
export const LAUNCH_TTL_MS = 5 * 60_000;
export const accessKeyPath = (dataRoot: string) => join(dataRoot, 'access.key');

/** Reads the per-install secret, creating it owner-only on first start. */
export function loadAccessKey(path: string): Buffer {
  try {
    const value = readFileSync(path, 'utf8').trim();
    if (/^[0-9a-f]{64}$/.test(value)) return Buffer.from(value, 'hex');
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  mkdirSync(dirname(path), { recursive: true });
  const key = randomBytes(32);
  writeFileSync(path, `${key.toString('hex')}\n`, { mode: 0o600 });
  chmodSync(path, 0o600);
  return key;
}

const sign = (key: Buffer, value: string) => createHmac('sha256', key).update(value).digest('base64url');
function same(left: string, right: string): boolean {
  const a = Buffer.from(left), b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The session cookie value: stable for this install, so a server restart keeps open tabs signed in. */
export const sessionValue = (key: Buffer) => sign(key, 'session:v1');
/** The CSRF token follows the session, so a restart does not invalidate forms in open tabs. */
export const csrfValue = (key: Buffer) => sign(key, 'csrf:v1');

export function createLaunchToken(key: Buffer, now = Date.now()): string {
  const body = `${now + LAUNCH_TTL_MS}.${randomBytes(12).toString('base64url')}`;
  return `${body}.${sign(key, `launch:${body}`)}`;
}

/** Accepts each unexpired, correctly signed token once; spent nonces are kept until they expire. */
export function createLaunchVerifier(key: Buffer): (token: string, now?: number) => boolean {
  const spent = new Map<string, number>();
  return (token, now = Date.now()) => {
    for (const [nonce, expires] of spent) if (expires <= now) spent.delete(nonce);
    const match = /^(\d{13})\.([A-Za-z0-9_-]{16})\.([A-Za-z0-9_-]{43})$/.exec(token);
    if (!match) return false;
    const [, expiry, nonce, signature] = match;
    const expires = Number(expiry);
    if (expires <= now || expires > now + LAUNCH_TTL_MS || spent.has(nonce)) return false;
    if (!same(signature, sign(key, `launch:${expiry}.${nonce}`))) return false;
    spent.set(nonce, expires);
    return true;
  };
}

export const launchUrl = (port: number, token: string) => `http://127.0.0.1:${port}/?launch=${token}`;
