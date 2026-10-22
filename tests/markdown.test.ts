import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MarkdownDocument } from '../src/client/MarkdownDocument';
import { ArtifactView } from '../src/client/ArtifactView';

const render = (body: string) => renderToStaticMarkup(createElement(MarkdownDocument, { body }));

test('documents have nested headings, lists, tables and safe links', () => {
  const html = render('# Heading\n\n## Section\n\n### Detail\n\n#### Deep\n\n- Item\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n[Source](https://example.com)');
  assert.match(html, /<h3>Heading<\/h3>/);
  assert.match(html, /<h4>Section<\/h4>/);
  assert.match(html, /<h5>Detail<\/h5>/);
  assert.match(html, /<h6>Deep<\/h6>/);
  assert.match(html, /<li>Item<\/li>/);
  assert.match(html, /role="region"[^>]*><table>/);
  assert.match(html, /href="https:\/\/example.com\/"/);
  assert.match(html, /rel="noopener noreferrer"/);
});

test('model content cannot introduce HTML, images or dangerous links', () => {
  const html = render('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[bad](javascript:alert%281%29)\n\n![remote](https://example.com/track.png)');
  assert.doesNotMatch(html, /<script|<img|onerror=|href="javascript:/i);
  assert.match(html, /\[Изображение: remote\]/);
});

test('non-web, credentialed and relative links remain text', () => {
  const html = render('[ftp](ftp://example.com) [credentialed](https://user:pass@example.com/path) [relative](/api/secret)');
  assert.doesNotMatch(html, /href=/);
  assert.match(html, /ftp.*credentialed.*relative/);
});

test('artifact reader keeps source and download actions available', () => {
  const artifact = { id: 'final/1', title: 'Report', body: '# Result\n\n## Section', authorId: 'author', kind: 'final' as const, createdAt: '2026-10-09T08:01:00Z' };
  const html = renderToStaticMarkup(createElement(ArtifactView, { artifact, runId: 'run/1', label: 'Accepted', author: 'Writer', expanded: true }));
  assert.match(html, /<h2>Report<\/h2>[\s\S]*<h3>Result<\/h3>[\s\S]*<h4>Section<\/h4>/);
  assert.match(html, /Исходный Markdown/);
  assert.match(html, /Копировать Markdown/);
  assert.match(html, /href="\/api\/runs\/run%2F1\/artifacts\/final%2F1"/);
});
