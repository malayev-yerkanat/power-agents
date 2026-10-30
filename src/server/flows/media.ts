import { randomUUID } from 'node:crypto';
import { createReadStream, statSync } from 'node:fs';
import { mkdir, open, unlink } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { basename, extname, join } from 'node:path';
import { pipeline as streamPipeline } from 'node:stream/promises';
import { pipelineFile } from './pipeline.ts';

export const UPLOAD_LIMIT = 2 * 1024 ** 3;
class MediaError extends Error { constructor(public statusCode: number, message: string) { super(message); } }
export async function receiveUpload(req: IncomingMessage, dir: string, limit = UPLOAD_LIMIT): Promise<{ name: string; bytes: number; at: string }> {
  if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/octet-stream') throw new MediaError(415, 'Content-Type must be application/octet-stream');
  const header = req.headers['x-file-name'];
  let rawName: string;
  try { rawName = typeof header === 'string' ? decodeURIComponent(header) : ''; } catch { throw new MediaError(400, 'Invalid X-File-Name'); }
  const filename = basename(rawName.replaceAll('\\', '/'));
  if (!filename || !['.mp4', '.mov'].includes(extname(filename).toLowerCase())) throw new MediaError(400, 'Upload an mp4 or mov take');
  if (Number(req.headers['content-length']) > limit) { req.resume(); throw new MediaError(413, 'Upload exceeds 2 GB'); }
  const name = `${randomUUID()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-160)}`;
  await mkdir(dir, { recursive: true });
  const full = join(dir, name), file = await open(full, 'wx');
  let bytes = 0;
  try {
    for await (const raw of req.iterator({ destroyOnReturn: false })) {
      const chunk = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
      bytes += chunk.length;
      if (bytes > limit) { req.resume(); throw new MediaError(413, 'Upload exceeds 2 GB'); }
      // FileHandle.write may write fewer bytes; writeFile handles the complete chunk.
      await file.writeFile(chunk);
    }
    if (req.aborted) throw new MediaError(400, 'Upload was interrupted');
    return { name, bytes, at: new Date().toISOString() };
  } catch (error) { await unlink(full).catch(() => {}); throw error; }
  finally { await file.close(); }
}
const mime: Record<string, string> = { '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.mp3': 'audio/mpeg', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
/** One RFC 9110 byte range; multipart requests are deliberately refused. */
export async function serveMedia(req: IncomingMessage, res: ServerResponse, dir: string, path: string): Promise<void> {
  const full = pipelineFile(dir, path);
  if (!full) throw new MediaError(404, 'File not found');
  const size = statSync(full).size;
  const headers: Record<string, string | number> = { 'Content-Type': mime[extname(path).toLowerCase()] ?? 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes' };
  let start = 0, end = size - 1, status = 200;
  if (req.headers.range !== undefined) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if (match && (match[1] || match[2])) {
      start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
      end = match[1] ? (match[2] ? Math.min(Number(match[2]), size - 1) : size - 1) : size - 1;
    } else start = -1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) {
      res.writeHead(416, { ...headers, 'Content-Range': `bytes */${size}`, 'Content-Length': 0 }); res.end(); return;
    }
    status = 206; headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
  }
  headers['Content-Length'] = Math.max(0, end - start + 1);
  res.writeHead(status, headers);
  if (size === 0) { res.end(); return; }
  await streamPipeline(createReadStream(full, { start, end }), res);
}
