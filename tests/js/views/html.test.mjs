// How this breaks, and the test that catches it:
// - a data string reaches innerHTML unescaped → esc
// - a javascript: URL becomes a link → safeUrl
// - the Cyrillic wrapper splits an HTML entity or swallows Turkish text → ruText cases
// - Cyrillic outside a lang="ru" span falls back to Sofia Sans' Bulgarian forms → ruText wraps every run

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esc, ruText, safeUrl } from '../../../app/js/views/html.js';

test('esc neutralises every HTML-significant character', () => {
  assert.equal(esc(`<a href="x" onclick='y'>&</a>`), '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
  assert.equal(esc(null), '');
});

test('safeUrl only lets http(s) through', () => {
  assert.equal(safeUrl('https://example.org/a'), 'https://example.org/a');
  assert.equal(safeUrl('javascript:alert(1)'), null);
  assert.equal(safeUrl(' https://padded.example'), null);
  assert.equal(safeUrl(undefined), null);
});

test('ruText tags Cyrillic runs as Russian and leaves Turkish alone', () => {
  assert.equal(ruText('Yeni adı Дизайн завод'), 'Yeni adı <span lang="ru">Дизайн завод</span>');
  assert.equal(
    ruText('Большой Овчинниковский пер. 16 (ТДЦ «Аркадия», laptopla uygun)'),
    '<span lang="ru">Большой Овчинниковский пер. 16 (ТДЦ «Аркадия»</span>, laptopla uygun)',
  );
});

test('ruText never splits an escaped entity', () => {
  assert.equal(ruText('"Дом" & Москва'), '&quot;<span lang="ru">Дом</span>&quot; &amp; <span lang="ru">Москва</span>');
  assert.equal(ruText('<Дом>'), '&lt;<span lang="ru">Дом</span>&gt;');
});
