import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FlowMedia, FlowUpload, mediaUrl } from '../src/client/flows/FlowMedia.tsx';
import { FlowInspector } from '../src/client/flows/FlowInspector.tsx';
import type { FlowNode, FlowRegistryNode } from '../src/shared/flow-types.ts';
import { setLanguage } from '../src/client/i18n.ts';

const node: FlowNode = { id: 'capture', type: 'capture', title: 'Capture', position: { x: 0, y: 0 }, config: {}, gate: true,
  status: 'failed', version: 3, notes: [], needsHuman: true, error: 'Record a take', upload: { name: 'take.mp4', bytes: 100, at: '' },
  output: { video: { files: ['clip one.mp4', 'frame.png'] }, audio: { files: ['narration.mp3'] }, edit: { files: ['edit.json'] } } };

test('media URLs encode flow, node and individual path components', () => {
  assert.equal(mediaUrl('flow 1', 'capture', 3, 'nested/clip #1.mp4'), '/api/flows/flow%201/files/capture/v3/nested/clip%20%231.mp4');
});

test('file outputs render native media controls and downloadable links for every port', () => {
  const markup = renderToStaticMarkup(createElement(FlowMedia, { flowId: 'f', node }));
  assert.match(markup, /<video[^>]*controls=""/);
  assert.match(markup, /<audio[^>]*controls=""/);
  for (const file of ['clip%20one.mp4', 'frame.png', 'narration.mp3', 'edit.json']) assert.ok(markup.includes(`/api/flows/f/files/capture/v3/${file}`));
  assert.doesNotMatch(markup, /autoplay/);
  // Links open a new tab, so screen readers hear that before following one.
  assert.equal(markup.match(/<span class="sr-only"> \(откроется в новой вкладке\)<\/span><\/a>/g)?.length, 4);
});

test('retained media keeps its successful output version during a new execution', () => {
  const markup = renderToStaticMarkup(createElement(FlowMedia, { flowId: 'f', node: { ...node, version: 4, outputVersion: 3 } }));
  assert.ok(markup.includes('/api/flows/f/files/capture/v3/clip%20one.mp4'));
  assert.ok(!markup.includes('/v4/'));
});

test('capture upload accepts mp4 and mov and respects pending state', () => {
  const markup = renderToStaticMarkup(createElement(FlowUpload, { node, pending: true, upload: () => {} }));
  assert.match(markup, /type="file"/);
  assert.match(markup, /accept=".mp4,.mov"/);
  assert.match(markup, /disabled=""/);
  assert.match(markup, /take.mp4/);
  assert.equal(renderToStaticMarkup(createElement(FlowUpload, { node: { ...node, type: 'voice' }, pending: false, upload: () => {} })), '');
});

test('inspector shows human action, capture upload and versioned file links', () => {
  const definition: FlowRegistryNode = { type: 'capture', title: 'Capture', inputs: [], outputs: [], gate: true, configDefaults: {} };
  const markup = renderToStaticMarkup(createElement(FlowInspector, { node, definition, flowId: 'f', pending: false,
    connections: [], save: async () => true, close: () => {}, upload: () => {} }));
  assert.match(markup, /Нужно действие/);
  assert.match(markup, /Загрузить съёмку/);
  assert.match(markup, /\/api\/flows\/f\/files\/capture\/v3\/edit.json/);
});

test('Capture upload translates its label and file size in English', () => {
  setLanguage('en');
  try {
    const markup = renderToStaticMarkup(createElement(FlowUpload, { node: { ...node, upload: { name: 'take.mp4', bytes: 1048576, at: '' } }, pending: false, upload: () => {} }));
    assert.match(markup, /Upload capture/);
    assert.match(markup, /1.0 MB/);
    assert.doesNotMatch(markup, /МБ/);
  } finally { setLanguage('ru'); }
});
