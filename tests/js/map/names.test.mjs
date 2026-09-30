// How this breaks, and the test that catches it:
// - a long name runs across half the map, wraps mid-word, or leaves one word hanging on a line → wrapLabel cases
// - the metro wins space over the best-known places, or a local church over the metro → labelSpecs order
// - a place that is a trip stop cannot give way to its pin, or a Latin name lands with lang="ru" → labelSpecs fields
// - a bad kind or tier in the data draws a dot with no colour, or crashes the page → placesOf filter
// - names run over the station dots once those grow → obstacleDots includes stations as tier 3

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { labelSpecs, obstacleDots, placesOf, wrapLabel } from '../../../app/js/map/names.js';

test('wrapLabel keeps a short name whole and breaks a long one at spaces into the evenest lines', () => {
  assert.deepEqual(wrapLabel('Bolşoy Tiyatrosu'), ['Bolşoy Tiyatrosu']);
  assert.deepEqual(wrapLabel("Saint Basil's Cathedral"), ["Saint Basil's", 'Cathedral']);
  assert.deepEqual(wrapLabel('Pushkin State Museum of Fine Arts'), ['Pushkin State', 'Museum of Fine Arts']);
  assert.deepEqual(wrapLabel('Государственный музей изобразительных искусств имени А. С. Пушкина'),
    ['Государственный музей', 'изобразительных искусств', 'имени А. С. Пушкина']);
  assert.deepEqual(wrapLabel('Российский государственный академический молодёжный театр'),
    ['Российский государственный', 'академический', 'молодёжный театр'], 'no word left alone on the last line');
  assert.deepEqual(wrapLabel('  Very   spaced  '), ['Very spaced']);
  assert.deepEqual(wrapLabel('Верхнеторговыеряды-длиннющееслово'), ['Верхнеторговыеряды-длиннющееслово'], 'one word, one line');
  const long = 'Церковь святителя Николая Чудотворца и св. мученицы царицы Александры при Путиловском заводе';
  const lines = wrapLabel(long);
  assert.equal(lines.length, 3, 'never more than three lines');
  assert.equal(lines.join(' '), long, 'no word lost or split');
});

const layers = {
  labels: [{ text: 'Тверской', x: 1, y: 1, kind: 'district' }],
  pois: [
    { name: 'Храм', lang: 'ru', kind: 'church', tier: 3, x: 5, y: 5 },
    { name: 'Red Square', lang: 'en', kind: 'sight', tier: 1, x: 2, y: 2, stop: 'msk-06' },
    { name: 'Müze', lang: 'tr', kind: 'museum', tier: 2, x: 3, y: 3 },
    { name: 'Bolşoy Tiyatrosu', lang: 'tr', kind: 'theatre', tier: 1, x: 4, y: 4 },
    { name: 'Odd', lang: 'en', kind: 'shop', tier: 1, x: 6, y: 6 },
    { name: 'No tier', lang: 'en', kind: 'sight', x: 7, y: 7 },
    { name: 'Nowhere', lang: 'en', kind: 'sight', tier: 2, x: null, y: 7 },
  ],
  stations: [{ name: 'Охотный Ряд', x: 8, y: 8 }],
  stationNames: [{ name: 'Okhotny Ryad', lang: 'en', x: 8, y: 9 }],
};

test('placesOf keeps only places with a known kind and tier at a real point', () => {
  assert.deepEqual(placesOf(layers).map((p) => p.name), ['Храм', 'Red Square', 'Müze', 'Bolşoy Tiyatrosu']);
});

test('labelSpecs puts the best known first, then the metro, then the rest in data order, each with its stop and lang', () => {
  const { areas, names } = labelSpecs(layers);
  assert.deepEqual(areas.map((a) => [a.lines[0], a.level, a.detail, a.dy]), [['Тверской', 0, false, 0]]);
  assert.deepEqual(names.map((n) => [n.lines.join(' '), n.kind, n.level, n.lang, n.stop]), [
    ['Red Square', 'major', 1, 'en', 'msk-06'],
    ['Bolşoy Tiyatrosu', 'major', 1, 'tr', null],
    ['Okhotny Ryad', 'metro', 2, 'en', null],
    ['Храм', 'place', 3, 'ru', null],
    ['Müze', 'place', 2, 'tr', null],
  ]);
  names.forEach((n) => assert.ok(n.dy > n.halfH, 'a name hangs below its dot, clear of it'));
});

test('obstacleDots holds every place dot with its tier and stop, and each station as a tier-3 dot', () => {
  assert.deepEqual(obstacleDots(layers).map((d) => [d.x, d.tier, d.stop]), [
    [5, 3, null], [2, 1, 'msk-06'], [3, 2, null], [4, 1, null], [8, 3, null],
  ]);
});
