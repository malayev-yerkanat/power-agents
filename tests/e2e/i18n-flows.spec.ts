import { expect, test } from '@playwright/test';
import type { Flow, FlowPatch, FlowRegistryNode } from '../../src/shared/flow-types';
import { connections, mockWorkspace } from './fixtures';

test('flow labels switch without persisting translated defaults or losing inspector edits', async ({ page }) => {
  await mockWorkspace(page);
  const types: FlowRegistryNode[] = [
    { type: 'brand', title: 'Brand', inputs: [], outputs: [{ name: 'brand', type: 'brand' }], gate: false, configDefaults: { text: '' } },
    { type: 'prompt', title: 'Prompt / Note', inputs: [], outputs: [{ name: 'text', type: 'text' }], gate: false, configDefaults: { text: '' } },
  ];
  let flow: Flow = { id: 'language-flow', title: 'Мой поток', mode: 'demo', autoRun: false, version: 0,
    createdAt: '2026-10-30T00:00:00Z', updatedAt: '2026-10-30T00:00:00Z', edges: [],
    nodes: [{ id: 'brand', type: 'brand', title: 'Brand', config: { text: 'Мой текст' }, gate: false,
      position: { x: 0, y: 0 }, status: 'idle', version: 0, notes: [] }] };
  await page.route('**/api/flows/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/registry')) return route.fulfill({ json: { types } });
    if (path.endsWith('/connections')) return route.fulfill({ json: { connections } });
    if (request.method() === 'PATCH') {
      const patch = request.postDataJSON() as FlowPatch;
      expect(patch.version).toBe(flow.version);
      flow = { ...flow, version: flow.version + 1,
        nodes: patch.nodes?.map(node => ({ status: 'idle' as const, version: 0, notes: [], ...node })) ?? flow.nodes };
    }
    return route.fulfill({ json: { flow } });
  });
  await page.goto('/#/flows/language-flow');
  const brand = page.getByTestId('flow-node-brand');
  await expect(brand.getByRole('heading', { name: 'Бренд', exact: true })).toBeVisible();
  await brand.getByRole('heading').click();
  const inspector = page.locator('.flow-inspector');
  await inspector.getByLabel('Текст', { exact: true }).fill('Несохранённый текст');
  await page.getByRole('button', { name: 'Switch to English' }).click();
  await expect(brand.getByRole('heading', { name: 'Brand', exact: true })).toBeVisible();
  await expect(inspector.getByLabel('Node title', { exact: true })).toHaveValue('Brand');
  await expect(inspector.getByLabel('Text', { exact: true })).toHaveValue('Несохранённый текст');
  await inspector.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => flow.nodes[0].config.text).toBe('Несохранённый текст');
  expect(flow.nodes[0].title).toBe('Brand');
  await page.getByRole('button', { name: '+ Node', exact: true }).click();
  await page.getByRole('button', { name: 'Note', exact: true }).click();
  await expect.poll(() => flow.nodes.length).toBe(2);
  const note = flow.nodes.find(node => node.type === 'prompt')!;
  expect(note.title).toBe('Prompt / Note');
  await page.getByRole('button', { name: 'Переключить на русский' }).click();
  await expect(brand.getByRole('heading', { name: 'Бренд', exact: true })).toBeVisible();
  await expect(page.getByTestId(`flow-node-${note.id}`).getByRole('heading')).toHaveText('Заметка');
  await expect(inspector.getByLabel('Название узла', { exact: true })).toHaveValue('Бренд');
  await expect(page.getByRole('heading', { name: 'Мой поток', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Switch to English' }).click();
  await inspector.getByLabel('Node title', { exact: true }).fill('Моё название');
  await page.getByRole('button', { name: 'Переключить на русский' }).click();
  await expect(inspector.getByLabel('Название узла', { exact: true })).toHaveValue('Моё название');
});
