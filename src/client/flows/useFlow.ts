import { useCallback, useEffect, useRef, useState } from 'react';
import type { Flow, FlowEvent, FlowPatch, FlowRegistryNode } from '../../shared/flow-types';
import type { Connection } from '../../shared/types';
import { ApiError } from '../session';

export type Request = <T>(path: string, options?: RequestInit) => Promise<T>;
export const flowEventName = 'power-agents:flow';
export function useFlow(id: string, request: Request, csrfToken: string) {
  const [flow, setFlow] = useState<Flow | null>(null);
  const [types, setTypes] = useState<FlowRegistryNode[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const current = useRef<Flow | null>(null);
  const mounted = useRef(false);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const path = `/api/flows/${encodeURIComponent(id)}`;
  const apply = useCallback((incoming: Flow) => {
    if (current.current && incoming.version < current.current.version) return;
    // Pending layout writes may flush after navigation; keep their version current too.
    current.current = incoming;
    if (mounted.current) setFlow(incoming);
  }, []);
  const refetch = useCallback(async () => {
    const data = await request<{ flow: Flow }>(path);
    apply(data.flow);
  }, [path, request, apply]);
  const report = useCallback((cause: unknown) => {
    if (mounted.current) setError(cause instanceof Error ? cause.message : 'Не удалось обновить поток.');
  }, []);
  useEffect(() => {
    mounted.current = true;
    void refetch().catch(report);
    void request<{ types: FlowRegistryNode[] }>('/api/flows/registry')
      .then(data => { if (mounted.current) setTypes(data.types); }).catch(report);
    void request<{ connections: Connection[] }>('/api/flows/connections')
      .then(data => { if (mounted.current) setConnections(data.connections); }).catch(report);
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<FlowEvent | undefined>).detail;
      if (!detail || detail.flowId === id) void refetch().catch(report);
    };
    window.addEventListener(flowEventName, receive);
    return () => { mounted.current = false; window.removeEventListener(flowEventName, receive); };
  }, [id, refetch, report, request]);
  const mutate = useCallback((operation: (latest: Flow) => { url?: string; method?: string; body: unknown }) => {
    const job = queue.current.then(async () => {
      const latest = current.current;
      if (!latest) return false;
      if (mounted.current) setPending(true);
      try {
        const { url = path, method = 'PATCH', body } = operation(latest);
        const result = await request<{ flow: Flow }>(url, { method,
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body: JSON.stringify(body) });
        apply(result.flow);
        return true;
      } catch (cause) {
        report(cause);
        // Re-read on all rejected writes: local graph always returns to server truth.
        try { await refetch(); } catch (refreshError) { report(refreshError); }
        if (cause instanceof ApiError && cause.status === 409 && mounted.current)
          setError('Поток изменился. Данные обновлены; повторите действие.');
        return false;
      } finally { if (mounted.current) setPending(false); }
    });
    queue.current = job;
    return job;
  }, [path, request, csrfToken, apply, refetch, report]);
  const patch = useCallback((build: (latest: Flow) => Omit<FlowPatch, 'version'>) =>
    mutate(latest => ({ body: { ...build(latest), version: latest.version } })), [mutate]);
  const action = useCallback((nodeId: string, action: 'run' | 'approve' | 'reject', note?: string) =>
    mutate(() => ({ url: `${path}/nodes/${encodeURIComponent(nodeId)}/${action}`, method: 'POST',
      body: action === 'reject' ? { note } : {} })), [mutate, path]);
  return { flow, types, connections, error, setError, pending, patch, action, refetch };
}
