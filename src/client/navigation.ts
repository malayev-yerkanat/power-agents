export const workspaceTabs = ['tasks', 'messages', 'artifacts', 'events'] as const;
export type WorkspaceTab = typeof workspaceTabs[number];

export type WorkspaceLocation =
  | { view: 'new' }
  | { view: 'history' }
  | { view: 'missing' }
  | { view: 'run'; runId: string; tab?: WorkspaceTab };

export function parseLocation(hash: string): WorkspaceLocation {
  if (!hash || hash === '#' || hash === '#/new') return { view: 'new' };
  if (hash === '#/runs') return { view: 'history' };
  const match = /^#\/runs\/([a-zA-Z0-9_-]{1,80})(?:\?tab=(tasks|messages|artifacts|events))?$/.exec(hash);
  return match
    ? { view: 'run', runId: match[1], ...(match[2] ? { tab: match[2] as WorkspaceTab } : {}) }
    : { view: 'missing' };
}

export function formatLocation(route: WorkspaceLocation): string {
  if (route.view === 'new') return '#/new';
  if (route.view === 'history') return '#/runs';
  if (route.view === 'missing') return '#/missing';
  return `#/runs/${encodeURIComponent(route.runId)}${route.tab ? `?tab=${route.tab}` : ''}`;
}
