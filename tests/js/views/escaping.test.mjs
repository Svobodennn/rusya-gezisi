// How this breaks, and the test that catches it:
// - a venue's notes, website, photo credit or page reach innerHTML raw → hostile place, hostile photos
// - the day's cover credit or phrase reaches innerHTML raw → hostile hero
// - a memory's caption (typed by hand in aciklamalar.txt) reaches innerHTML raw → hostile memory

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moreHtml } from '../../../app/js/views/stop-details.js';
import { cardPhotosHtml } from '../../../app/js/views/stop.js';
import { heroHtml } from '../../../app/js/views/hero.js';
import { memoriesHtml } from '../../../app/js/views/memories.js';

test('a hostile place renders as inert text', () => {
  const html = moreHtml({
    name: '"><img src=x onerror=alert(1)>',
    notes: '<script>alert(1)</script> Дом',
    branch: null,
    statusNote: null,
    website: 'javascript:alert(2)',
    lat: 55.75,
    lon: 37.61,
    stops: null,
  });
  assert.doesNotMatch(html, /<img src=x|<script>|javascript:/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt; <span lang="ru">Дом<\/span>/);
});

test('hostile photo credits and names stay text, and a javascript: page never becomes a link', () => {
  const html = cardPhotosHtml({
    name: '"><img src=x onerror=alert(1)>',
    photos: [{ src: 'img/a.webp', w: 10, h: 10, credit: '<b>x</b>', page: 'javascript:alert(3)' }],
  }, 4, 'moscow');
  assert.doesNotMatch(html, /<img src=x|<b>x<\/b>|javascript:/);
  assert.match(html, /Fotoğraflar: &lt;b&gt;x&lt;\/b&gt;/);
  assert.match(html, /<span class="card-num" aria-hidden="true">4<\/span>/);
  assert.equal(cardPhotosHtml({ name: 'No photos', photos: [] }, 1, 'spb'), '');
});

test('the day cover escapes its credit and phrase', () => {
  const day = { n: 1, date: '2026-12-19', weekday: 'Cumartesi', city: 'moscow', transit: false, sunrise: '08:56', sunset: '15:57' };
  const ctx = {
    trip: { days: [day], cities: { moscow: { label: 'Moskova' } }, places: { p: { name: '<i>n</i>' } } },
    index: 0,
    position: { phase: 'before', daysUntil: 80 },
  };
  const html = heroHtml(ctx,
    { place: 'p', src: '" onerror="x', w: 1, h: 1, credit: '<b>c</b>', page: 'javascript:alert(1)' },
    { ru: '<img src=x>', say: '<u>s</u>', tr: '<s>t</s>' });
  assert.doesNotMatch(html, /<img src=x>|<b>c<\/b>|<i>n<\/i>|<u>|<s>|javascript:|" onerror="x/);
  assert.match(html, /Geziye 80 gün/);
  assert.match(html, /<span lang="ru">МОСКВА<\/span>/);
});

test('a memory\'s caption and paths stay text', () => {
  const html = memoriesHtml([{ src: 'memories/a.webp', thumb: '" onerror="x', w: 4, h: 3, time: '18:42', caption: '<img src=x onerror=alert(1)>' }]);
  assert.doesNotMatch(html, /<img src=x|" onerror="x/);
  assert.match(html, /18:42 · &lt;img src=x onerror=alert\(1\)&gt;/);
});

test('a day without memories shows the empty album, one with them numbers each photo', () => {
  assert.match(memoriesHtml([]), /memory-album--empty/);
  assert.match(memoriesHtml(undefined), /memory-album--empty/);
  const two = memoriesHtml([{ src: 'a', thumb: 'a', w: 4, h: 3 }, { src: 'b', thumb: 'b', w: 3, h: 4 }]);
  assert.equal(two.match(/data-memory="/g).length, 2);
  assert.match(two, /aria-label="Hatıra 2 \/ 2\. Büyütmek için dokunun\."/);
});
