import { randomUUID } from 'node:crypto';
import { lstatSync } from 'node:fs';
import { createConnection, type Socket } from 'node:net';
import { dirname } from 'node:path';

export type Message = Record<string, unknown>;
const maxFrame = 16 * 1024 * 1024;

export function encodeFrame(message: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(message));
  if (body.length > maxFrame) throw new Error('Invalid IPC frame size');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length);
  return Buffer.concat([header, body]);
}

export class FrameDecoder {
  private buffer = Buffer.alloc(0);
  push(chunk: Buffer): Message[] {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const messages: Message[] = [];
    while (this.buffer.length >= 4) {
      const length = this.buffer.readUInt32LE(0);
      if (!length || length > maxFrame) throw new Error('Invalid IPC frame size');
      if (this.buffer.length < length + 4) break;
      const value: unknown = JSON.parse(this.buffer.subarray(4, length + 4).toString('utf8'));
      this.buffer = this.buffer.subarray(length + 4);
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected IPC object');
      messages.push(value as Message);
    }
    return messages;
  }
}

/** Adapter for the installed desktop's private, version-0 local IPC protocol. */
export class DesktopIpc {
  private socket?: Socket;
  private clientId = 'initializing-client';
  private readonly pending = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  constructor(private readonly path: string, private readonly onMessage: (message: Message) => void,
    private readonly onClose: () => void) {}

  async connect(): Promise<void> {
    const stat = lstatSync(this.path);
    const parent = lstatSync(dirname(this.path));
    if (!stat.isSocket() || stat.uid !== process.getuid?.() || (stat.mode & 0o077) !== 0
      || !parent.isDirectory() || parent.uid !== process.getuid?.() || (parent.mode & 0o022) !== 0) {
      throw new Error('Codex IPC socket must be private and owned by this user');
    }
    const decoder = new FrameDecoder();
    const socket = createConnection(this.path);
    this.socket = socket;
    socket.on('data', chunk => {
      try { for (const message of decoder.push(chunk)) this.receive(message); }
      catch { socket.destroy(); }
    });
    socket.on('error', () => socket.destroy());
    socket.once('close', () => {
      for (const wait of this.pending.values()) wait.reject(new Error('Codex IPC disconnected'));
      this.pending.clear(); this.onClose();
    });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { socket.destroy(); reject(new Error('Codex IPC connection timed out')); }, 5000);
      socket.once('connect', () => { clearTimeout(timer); resolve(); });
      socket.once('error', () => { clearTimeout(timer); reject(new Error('Codex IPC unavailable')); });
    });
    const result = await this.request('initialize', { clientType: 'power-agents-telegram' });
    if (!result || typeof result !== 'object' || !('clientId' in result) || typeof result.clientId !== 'string') {
      this.close(); throw new Error('Unsupported Codex IPC initialization');
    }
    this.clientId = result.clientId;
  }

  request(method: string, params: unknown, targetClientId?: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.destroyed) { reject(new Error('Codex IPC unavailable')); return; }
      const requestId = randomUUID();
      const timer = setTimeout(() => { this.pending.delete(requestId); reject(new Error('Codex IPC request timed out')); }, 10_000);
      this.pending.set(requestId, {
        resolve: value => { clearTimeout(timer); resolve(value); },
        reject: error => { clearTimeout(timer); reject(error); },
      });
      this.socket.write(encodeFrame({ type: 'request', requestId, sourceClientId: this.clientId,
        version: method === 'initialize' ? 0 : 1, timeoutMs: 5000, method, params, ...(targetClientId ? { targetClientId } : {}) }));
    });
  }

  close(): void { this.socket?.destroy(); }

  follow(threadId: string, owner: string, following = true): void {
    if (!this.socket || this.socket.destroyed) return;
    this.socket.write(encodeFrame({ type: 'broadcast', sourceClientId: this.clientId, version: 1,
      method: 'thread-stream-following-changed', targetClientIds: [owner],
      params: { hostId: 'local', conversationId: threadId, following } }));
  }

  private receive(message: Message): void {
    if (message.type === 'response' && typeof message.requestId === 'string') {
      const wait = this.pending.get(message.requestId);
      if (!wait) return;
      this.pending.delete(message.requestId);
      if (message.resultType === 'success') wait.resolve(message.method === 'thread-owner-discovery'
        ? { owner: message.handledByClientId } : message.result);
      else wait.reject(new Error('Codex desktop rejected the request'));
    } else if (message.type === 'client-discovery-request') {
      this.socket?.write(encodeFrame({ type: 'client-discovery-response', requestId: message.requestId,
        response: { canHandle: false } }));
    } else if (message.type === 'broadcast') this.onMessage(message);
  }
}
