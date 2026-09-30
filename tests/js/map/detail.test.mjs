// How this breaks, and the test that catches it:
// - the city view drowns in hundreds of dots, or a close-up shows none → detailLevel steps, dotShown tiers
// - a place's name covers another place's dot, a station dot, a pin, the zoom buttons or an area name → obstacles case
// - a famous name never shows in a dense centre because small dots crowd it out → major-name case
// - area names vanish or move because places now have names → layoutMapLabels leaves them to the pins alone
// - a name shows before its zoom, or during a glide → levels case, the quiet (empty) names list
// - a name sits on the frame's gold hairline → edge case

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detailLevel, dotShown, layoutMapLabels } from '../../../app/js/map/detail.js';
import { placeLabels, toScreen } from '../../../app/js/map/geometry.js';

// lat0 60°: one map unit is 111 320 · cos 60° / k metres; with k = 5566 exactly 10 m.
const projection = { lon0: 30, lat0: 60, k: 5566 };
const at = (mpp) => ({ x: 0, y: 0, s: 10 / mpp });

test('detailLevel steps from the whole city to a street corner as each pixel covers less ground', () => {
  const levels = [60, 25.1, 24.9, 9.1, 8.9, 4.6, 4.4, 1].map((mpp) => detailLevel(at(mpp), projection));
  assert.deepEqual(levels, [0, 0, 1, 1, 2, 2, 3, 3]);
});

test('the best-known places always show a dot, the others only closer in', () => {
  assert.deepEqual([0, 1, 2, 3].map((level) => [1, 2, 3].map((tier) => dotShown(tier, level))), [
    [true, false, false], [true, true, false], [true, true, true], [true, true, true],
  ]);
});

const size = { width: 400, height: 300 };
const camera = { x: 0, y: 0, s: 1 }; // map point (0, 0) sits at the centre of the frame
const label = (x, y, extra = {}) => ({ x, y, halfW: 30, halfH: 8, dy: 0, level: 0, ...extra });
const name = (x, y, text, level = 1) => label(x, y, { text, detail: true, level });
const shownOf = (entries) => entries.map((entry) => entry.label.text);

test('layoutMapLabels places area names against the pins alone, exactly as placeLabels would', () => {
  const areas = [label(0, 0, { text: 'a' }), label(10, 2, { text: 'b' }), label(-150, -100, { text: 'c' })];
  const pins = [{ x0: 40, x1: 60, y0: 190, y1: 210 }];
  const before = placeLabels(areas, areas.map((l) => toScreen(l, camera, size)), pins, size);
  const now = layoutMapLabels({ areas, names: [name(0, 60, 'p')] }, [{ x: 0, y: 0, tier: 1 }], { camera, size, pins, level: 3 });
  assert.deepEqual(shownOf(now.filter((entry) => !entry.label.detail)), areas.filter((_, i) => before[i]).map((l) => l.text));
});

test('layoutMapLabels keeps a place name off the dots, the pins, the area names and earlier names', () => {
  const names = [
    name(-100, 0, 'free'),
    name(100, 0, 'on a dot'),
    name(0, 100, 'on a pin'),
    name(-100, -100, 'on an area name'),
    name(-95, 4, 'on the first name'),
    name(100, -60, 'on a station'),
  ];
  const areas = [label(-100, -104, { text: 'area' })];
  const dots = [
    { x: 110, y: 2, tier: 1 },
    { x: -100, y: 5, tier: 3 }, // under 'free', but tier 3 shows no dot at level 1…
    { x: 100, y: -60, tier: 1 }, // …while a station's dot (tier 1 here, to be on show) keeps 'on a station' off
  ];
  const pins = [{ x0: 190, x1: 210, y0: 240, y1: 260 }];
  const shown = layoutMapLabels({ areas, names }, dots, { camera, size, pins, level: 1 });
  assert.deepEqual(shownOf(shown), ['area', 'free']);
});

test('a best-known name may cover a lesser place\'s dot, while any other name keeps clear of it', () => {
  const dots = [{ x: 0, y: 3, tier: 3 }, { x: 100, y: 3, tier: 1 }];
  const names = [
    name(0, 0, 'major over a small dot'), name(100, 0, 'major over a great dot'), name(-100, 0, 'free place'),
  ].map((n, i) => ({ ...n, major: i < 2 }));
  const shown = layoutMapLabels({ areas: [], names: [...names, { ...name(0, 0, 'place over a small dot', 2) }] }, dots,
    { camera, size, pins: [], level: 2 });
  assert.deepEqual(shownOf(shown), ['major over a small dot', 'free place']);
  const alone = layoutMapLabels({ areas: [], names: [name(0, 40, 'place over a small dot', 2)] }, [{ x: 0, y: 43, tier: 3 }],
    { camera, size, pins: [], level: 2 });
  assert.deepEqual(alone, []);
});

test('layoutMapLabels shows no name before its level, none when quiet, and keeps names off the edge', () => {
  const names = [name(0, 0, 'close up', 3)];
  const view = { camera, size, pins: [] };
  assert.deepEqual(layoutMapLabels({ areas: [], names }, [], { ...view, level: 2 }), []);
  assert.deepEqual(layoutMapLabels({ areas: [], names: [] }, [], { ...view, level: 3 }), [], 'a glide passes no names');
  const [entry] = layoutMapLabels({ areas: [], names: [{ ...names[0], dy: 12 }] }, [], { ...view, level: 3 });
  assert.deepEqual({ x: entry.x, y: entry.y }, { x: 200, y: 162 }, 'hung dy under its point');
  const edge = layoutMapLabels({ areas: [], names: [name(-165, 0, 'by the edge')] }, [], { ...view, level: 1 });
  assert.deepEqual(edge, [], 'x 5–65 reaches into the 12 px band along the frame');
  const edgeArea = layoutMapLabels({ areas: [label(-165, 0, { text: 'area by the edge' })], names: [] }, [], { ...view, level: 1 });
  assert.deepEqual(shownOf(edgeArea), ['area by the edge'], 'area names keep their old 4 px margin');
});
