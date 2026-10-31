import { expect, test as base, type Page } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FlowEngine } from '../../src/server/flows/engine';
import { handleFlows } from '../../src/server/flows/http';
import { Store } from '../../src/server/store';
import type { FlowEvent } from '../../src/shared/flow-types';
import { connections } from './fixtures';

interface FlowHarness {
  store: Store;
  engine: FlowEngine;
  reads: string[];
  setEventsEnabled: (enabled: boolean) => void;
  flushEvents: () => Promise<void>;
}

const test = base.extend<{ flows: FlowHarness }>({
  flows: async ({ page }, use) => {
    const root = mkdtempSync(join(tmpdir(), 'power-agents-canvas-'));
    const store = new Store(':memory:');
    const engine = new FlowEngine({ store, root });
    const reads: string[] = [];
    let eventsEnabled = true;
    let delivery = Promise.resolve();
    const deliveryErrors: unknown[] = [];

    await page.addInitScript(() => {
      const streams: EventTarget[] = [];
      Object.assign(window, { __flowStreams: streams });
      class FixtureEventSource extends EventTarget {
        onopen: ((event: Event) => void) | null = null;
        onerror: ((event: Event) => void) | null = null;
        constructor() {
          super();
          streams.push(this);
          setTimeout(() => this.onopen?.(new Event('open')), 0);
        }
        close() { streams.splice(streams.indexOf(this), 1); }
      }
      Object.defineProperty(window, 'EventSource', { value: FixtureEventSource });
    });

    const unsubscribe = store.subscribeFlows((event: FlowEvent) => {
      if (!eventsEnabled) return;
      delivery = delivery.then(() => page.evaluate(value => {
        const windowWithStreams = window as unknown as { __flowStreams?: EventTarget[] };
        for (const stream of windowWithStreams.__flowStreams ?? []) {
          stream.dispatchEvent(new MessageEvent('flow', { data: JSON.stringify(value) }));
        }
      }, event)).catch(error => { deliveryErrors.push(error); });
    });

    await page.route('**/api/**', async route => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (path === '/api/bootstrap') {
        await route.fulfill({ json: { connections, runs: [], totalRuns: 0, csrfToken: 'flow-fixture', eventCursor: 0, maxConcurrent: 3 } });
        return;
      }
      if (path === '/api/telegram/status') {
        await route.fulfill({ json: { configured: false, ready: false, connected: false, notifications: { approval: false, completed: false } } });
        return;
      }
      if (!path.startsWith('/api/flows')) {
        await route.fulfill({ status: 404, json: { error: 'Unknown flow fixture endpoint' } });
        return;
      }
      if (request.method() === 'GET') reads.push(path);
      else expect(request.headers()['x-csrf-token']).toBe('flow-fixture');
      let response: { status: number; body: unknown } | undefined;
      class FixtureHttpError extends Error {
        constructor(public statusCode: number, message: string) { super(message); }
      }
      try {
        await handleFlows({ method: request.method() } as IncomingMessage, {} as ServerResponse,
          path.slice(1).split('/'), store, engine, {
            readBody: async () => request.postDataJSON() ?? {},
            json: (_res, status, body) => { response = { status, body }; },
            HttpError: FixtureHttpError,
          });
        if (!response) throw new Error('Flow route did not return a response');
        await route.fulfill({ status: response.status, json: response.body });
      } catch (error) {
        const status = error instanceof Error && 'statusCode' in error ? Number(error.statusCode) : 400;
        await route.fulfill({ status, json: { error: error instanceof Error ? error.message : 'Flow request failed' } });
      }
    });

    try {
      await use({ store, engine, reads, setEventsEnabled: enabled => { eventsEnabled = enabled; }, flushEvents: () => delivery });
      await delivery;
      expect(deliveryErrors).toEqual([]);
    } finally {
      unsubscribe();
      engine.shutdown();
      store.close();
      rmSync(root, { recursive: true, force: true });
    }
  },
});

const card = (page: Page, id: string) => page.getByTestId(`flow-node-${id}`);

async function createDemoFlow(page: Page, flows: FlowHarness): Promise<string> {
  await page.goto('/#/flows');
  await page.getByRole('button', { name: 'Новый поток', exact: true }).click();
  await expect(page).toHaveURL(/#\/flows\/[a-zA-Z0-9_-]+$/);
  await expect(card(page, 'brand')).toBeVisible();
  const flow = flows.store.listFlows()[0];
  expect(flow.mode).toBe('demo');
  expect(flows.store.getFlow(flow.id)?.template).toBe('roblox-reel');
  return flow.id;
}

async function runNode(page: Page, id: string, gated = true) {
  const node = card(page, id);
  await expect(node.getByRole('button', { name: 'Запустить', exact: true })).toBeEnabled();
  await node.getByRole('button', { name: 'Запустить', exact: true }).click();
  await expect(node).toHaveAttribute('data-status', gated ? 'awaiting_approval' : 'approved');
  await expect(node).toContainText(`"type": "${id}"`);
}

async function approveNode(page: Page, id: string) {
  await card(page, id).getByRole('button', { name: 'Одобрить', exact: true }).click();
  await expect(card(page, id)).toHaveAttribute('data-status', 'approved');
}

test('demo template runs Brand and Idea, then approval unlocks Script through flow events', async ({ page, flows }) => {
  const id = await createDemoFlow(page, flows);
  const scriptRun = card(page, 'script').getByRole('button', { name: 'Запустить', exact: true });
  await expect(scriptRun).toBeDisabled();
  const readsBeforeBrand = flows.reads.filter(path => path === `/api/flows/${id}`).length;
  await runNode(page, 'brand', false);
  await expect.poll(() => flows.reads.filter(path => path === `/api/flows/${id}`).length).toBeGreaterThan(readsBeforeBrand);
  await runNode(page, 'idea');
  await expect(scriptRun).toBeDisabled();
  await approveNode(page, 'idea');
  await expect(scriptRun).toBeEnabled();
  await runNode(page, 'script');
  expect(flows.store.nodeRuns(id).map(run => run.nodeId)).toEqual(['script', 'idea', 'brand']);

  // This change has no browser mutation response: only the flow event can reveal it.
  const current = flows.engine.get(id);
  const readsBeforeEvent = flows.reads.filter(path => path === `/api/flows/${id}`).length;
  flows.engine.update(id, { version: current.version,
    nodes: current.nodes.map(node => node.id === 'script' ? { ...node, title: 'Сценарий из события' } : node) });
  await expect(card(page, 'script')).toContainText('Сценарий из события');
  expect(flows.reads.filter(path => path === `/api/flows/${id}`).length).toBeGreaterThan(readsBeforeEvent);
});

test('the complete demo reel reaches Final from the canvas without model calls', async ({ page, flows }) => {
  const id = await createDemoFlow(page, flows);
  await runNode(page, 'brand', false);
  for (const nodeId of ['idea', 'script', 'voice', 'scenes', 'capture', 'edit', 'preview']) {
    await runNode(page, nodeId);
    await approveNode(page, nodeId);
  }
  await runNode(page, 'qa', false);
  await runNode(page, 'final');
  await approveNode(page, 'final');
  expect(flows.store.getFlow(id)?.nodes.every(node => node.status === 'approved')).toBe(true);
  expect(flows.store.nodeRuns(id)).toHaveLength(10);
});

test('Capture offers an upload on the card and inspector and displays versioned media', async ({ page, flows }) => {
  const id = await createDemoFlow(page, flows);
  flows.store.updateFlow(id, flow => ({ ...flow, nodes: flow.nodes.map(node => node.id === 'capture'
    ? { ...node, status: 'failed', needsHuman: true, error: 'Record the take in Roblox Studio' } : node) }),
  { type: 'flow.node', nodeId: 'capture', message: 'Needs take' });
  await expect(card(page, 'capture')).toContainText('Нужно действие');
  await expect(card(page, 'capture').getByLabel('Загрузить съёмку', { exact: true })).toBeEnabled();
  await card(page, 'capture').getByRole('heading').click();
  const inspector = page.getByRole('complementary', { name: 'Инспектор узла' });
  await expect(inspector.getByLabel('Загрузить съёмку', { exact: true })).toBeEnabled();
  await page.route(`**/api/flows/${id}/files/**`, route => route.fulfill({ status: 200, body: '', contentType: 'video/mp4' }));
  await page.route(`**/api/flows/${id}/nodes/capture/upload`, async route => {
    expect(route.request().headers()['content-type']).toBe('application/octet-stream');
    expect(route.request().headers()['x-csrf-token']).toBe('flow-fixture');
    expect(decodeURIComponent(route.request().headers()['x-file-name'])).toBe('take.mp4');
    expect(route.request().postDataBuffer()?.length).toBe(4);
    const flow = flows.store.updateFlow(id, current => ({ ...current, nodes: current.nodes.map(node => node.id === 'capture'
      ? { ...node, status: 'stale', needsHuman: undefined, error: undefined, version: 1,
        upload: { name: 'take.mp4', bytes: 4, at: new Date().toISOString() }, output: { video: { files: ['footage.mp4'] } } } : node) }),
    { type: 'flow.node', nodeId: 'capture', message: 'Uploaded' });
    await route.fulfill({ json: { flow } });
  });
  await inspector.getByLabel('Загрузить съёмку', { exact: true }).setInputFiles({ name: 'take.mp4', mimeType: 'video/mp4', buffer: Buffer.from('take') });
  await expect(card(page, 'capture')).toContainText('take.mp4');
  await expect(card(page, 'capture').locator('video')).toHaveAttribute('controls', '');
  await expect(inspector.getByRole('link', { name: 'footage.mp4 (откроется в новой вкладке)', exact: true }))
    .toHaveAttribute('href', `/api/flows/${id}/files/capture/v1/footage.mp4`);
});

test('inspector refreshes persisted fields from events and recovers server values after a version conflict', async ({ page, flows }) => {
  const id = await createDemoFlow(page, flows);
  await card(page, 'brand').getByRole('heading').click();
  const inspector = page.getByRole('complementary', { name: 'Инспектор узла' });
  const title = inspector.getByLabel('Название узла', { exact: true });
  const gate = inspector.getByLabel('Требовать одобрение', { exact: true });
  const text = inspector.getByLabel('Текст', { exact: true });
  const rules = inspector.getByLabel('Правила (по одному на строку)', { exact: true });
  await expect(title).toHaveValue('Бренд');
  const before = flows.engine.get(id);
  const nodeVersion = before.nodes.find(node => node.id === 'brand')!.version;
  flows.engine.update(id, { version: before.version, nodes: before.nodes.map(node => node.id === 'brand'
    ? { ...node, title: 'Бренд из события', gate: true, config: { text: 'Новые правила бренда', rules: ['Правило из события'] } } : node) });
  await expect(title).toHaveValue('Бренд из события');
  await expect(gate).toBeChecked();
  await expect(text).toHaveValue('Новые правила бренда');
  await expect(rules).toHaveValue('Правило из события');
  expect(flows.engine.get(id).nodes.find(node => node.id === 'brand')!.version).toBe(nodeVersion);

  await title.fill('Бренд после сохранения');
  await gate.uncheck();
  await text.fill('Сохранённый текст');
  await rules.fill('Первое правило\nВторое правило');
  await inspector.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect.poll(() => flows.engine.get(id).nodes.find(node => node.id === 'brand')?.config.rules)
    .toEqual(['Первое правило', 'Второе правило']);
  await expect(title).toHaveValue('Бренд после сохранения');
  await expect(gate).not.toBeChecked();

  let conflictInjected = false;
  await page.route(`**/api/flows/${id}`, async route => {
    if (route.request().method() === 'PATCH' && !conflictInjected) {
      conflictInjected = true;
      const latest = flows.engine.get(id);
      // Simulate a concurrent editor whose event was missed during reconnection.
      flows.setEventsEnabled(false);
      try {
        flows.engine.update(id, { version: latest.version, nodes: latest.nodes.map(node => node.id === 'brand'
          ? { ...node, title: 'Текущий серверный бренд', gate: true,
            config: { text: 'Текущий серверный текст', rules: ['Актуальное правило'] } } : node) });
      } finally { flows.setEventsEnabled(true); }
    }
    await route.fallback();
  });
  await title.fill('Устаревший локальный черновик');
  await text.fill('Устаревший текст');
  const readsBeforeConflict = flows.reads.filter(path => path === `/api/flows/${id}`).length;
  await inspector.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Поток изменился');
  await expect(title).toHaveValue('Текущий серверный бренд');
  await expect(gate).toBeChecked();
  await expect(text).toHaveValue('Текущий серверный текст');
  await expect(rules).toHaveValue('Актуальное правило');
  expect(flows.reads.filter(path => path === `/api/flows/${id}`).length).toBeGreaterThan(readsBeforeConflict);
  expect(flows.engine.get(id).nodes.find(node => node.id === 'brand')!.version).toBe(nodeVersion);
});

test('canvas persists adding and dragging a node, connecting ports, and deleting a node with its edge', async ({ page, flows }) => {
  const id = await createDemoFlow(page, flows);
  const template = flows.engine.get(id);
  flows.engine.update(id, { version: template.version,
    nodes: template.nodes.filter(node => ['brand', 'idea'].includes(node.id)), edges: [] });
  await expect(card(page, 'script')).toHaveCount(0);
  await page.getByRole('button', { name: 'Показать весь поток', exact: true }).click();

  await card(page, 'brand').getByLabel('Выход brand', { exact: true })
    .dragTo(card(page, 'idea').getByLabel('Вход brand', { exact: true }));
  await expect.poll(() => flows.engine.get(id).edges.length).toBe(1);
  expect(flows.engine.get(id).edges[0]).toMatchObject({ from: { node: 'brand', port: 'brand' }, to: { node: 'idea', port: 'brand' } });

  await page.getByRole('button', { name: '+ Узел', exact: true }).click();
  await page.getByRole('button', { name: 'Заметка', exact: true }).click();
  await expect.poll(() => flows.engine.get(id).nodes.length).toBe(3);
  const added = flows.engine.get(id).nodes.find(node => node.type === 'prompt')!;
  const note = card(page, added.id);
  await expect(note).toBeVisible();
  const heading = await note.getByRole('heading').boundingBox();
  if (!heading) throw new Error('Added node heading is not visible');
  await page.mouse.move(heading.x + heading.width / 2, heading.y + heading.height / 2);
  await page.mouse.down();
  await page.mouse.move(heading.x + heading.width / 2 + 360, heading.y + heading.height / 2 + 150, { steps: 12 });
  await page.mouse.up();
  await expect.poll(() => flows.engine.get(id).nodes.find(node => node.id === added.id)?.position)
    .not.toEqual(added.position);
  const draggedPosition = flows.engine.get(id).nodes.find(node => node.id === added.id)!.position;
  await note.locator('..').focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => flows.engine.get(id).nodes.find(node => node.id === added.id)?.position)
    .not.toEqual(draggedPosition);
  const savedPosition = flows.engine.get(id).nodes.find(node => node.id === added.id)!.position;
  await flows.flushEvents();
  await page.reload();
  await expect(card(page, added.id)).toBeVisible();
  expect(flows.engine.get(id).nodes.find(node => node.id === added.id)!.position).toEqual(savedPosition);

  await card(page, 'brand').getByRole('heading').click();
  await page.keyboard.press('Delete');
  await expect(card(page, 'brand')).toHaveCount(0);
  await expect.poll(() => flows.engine.get(id).edges.length).toBe(0);
  expect(flows.engine.get(id).nodes.map(node => node.id)).toEqual(['idea', added.id]);
});

test('add-node menu takes focus, closes on Escape and outside clicks, and the canvas is a named region', async ({ page, flows }) => {
  await createDemoFlow(page, flows);
  await expect(page.getByRole('region', { name: 'Канвас потока', exact: true })).toBeVisible();
  const toggle = page.getByRole('button', { name: '+ Узел', exact: true });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#flow-add-menu button').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#flow-add-menu')).toHaveCount(0);
  await expect(toggle).toBeFocused();
  await toggle.click();
  await page.getByRole('heading', { level: 1 }).click();
  await expect(page.locator('#flow-add-menu')).toHaveCount(0);
});
