import test from 'node:test';
import assert from 'node:assert/strict';
import { formatLocation, parseLocation, type WorkspaceLocation } from '../src/client/navigation.ts';

test('new, history, run, and run tabs round trip through hash links', () => {
  const routes: WorkspaceLocation[] = [
    { view: 'new' },
    { view: 'history' },
    { view: 'flows' },
    { view: 'flow', flowId: 'flow_123' },
    { view: 'run', runId: 'run_123' },
    { view: 'run', runId: 'review-fixture', tab: 'artifacts' },
    { view: 'run', runId: 'f4e598ee-7c4f-4ace-9c28-315df11628a2', tab: 'messages' },
  ];
  for (const route of routes) assert.deepEqual(parseLocation(formatLocation(route)), route);
  assert.deepEqual(parseLocation(''), { view: 'new' });
  assert.deepEqual(parseLocation('#'), { view: 'new' });
});

test('malformed paths, IDs, tabs, and query strings produce a missing route', () => {
  for (const value of [
    '#/flows/', '#/flows/..', '#/flows/id/extra', '#/flows/id?tab=tasks', '#/flows/id%2Fother',
    `#/flows/${'a'.repeat(101)}`, '#/flows?mode=demo',
    '#/runs/%', '#/runs/..', '#/runs/id?tab=unknown', '#/admin', '#/runs/id/extra',
    '#/runs/', '#/runs/id?tab=', '#/runs/id?tab=tasks&token=x',
    `#/runs/${'a'.repeat(81)}`, '#/runs/id%2Fother', '#/new?token=x',
  ]) assert.deepEqual(parseLocation(value), { view: 'missing' }, value);
});
