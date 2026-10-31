export const workspaceTabs = ['tasks', 'messages', 'artifacts', 'events'] as const;
export type WorkspaceTab = typeof workspaceTabs[number];

export type WorkspaceLocation =
  | { view: 'new' }
  | { view: 'history' }
  | { view: 'flows' }
  | { view: 'flow'; flowId: string }
  | { view: 'missing' }
  | { view: 'run'; runId: string; tab?: WorkspaceTab };

export function parseLocation(hash: string): WorkspaceLocation {
  if (!hash || hash === '#' || hash === '#/new') return { view: 'new' };
  if (hash === '#/flows') return { view: 'flows' };
  const flow = /^#\/flows\/([a-zA-Z0-9_-]{1,100})$/.exec(hash);
  if (flow) return { view: 'flow', flowId: flow[1] };
  if (hash === '#/runs') return { view: 'history' };
  const match = /^#\/runs\/([a-zA-Z0-9_-]{1,80})(?:\?tab=(tasks|messages|artifacts|events))?$/.exec(hash);
  return match
    ? { view: 'run', runId: match[1], ...(match[2] ? { tab: match[2] as WorkspaceTab } : {}) }
    : { view: 'missing' };
}

export function formatLocation(route: WorkspaceLocation): string {
  if (route.view === 'new') return '#/new';
  if (route.view === 'history') return '#/runs';
  if (route.view === 'flows') return '#/flows';
  if (route.view === 'flow') return `#/flows/${encodeURIComponent(route.flowId)}`;
  if (route.view === 'missing') return '#/missing';
  return `#/runs/${encodeURIComponent(route.runId)}${route.tab ? `?tab=${route.tab}` : ''}`;
}
