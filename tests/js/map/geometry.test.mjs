// How this breaks, and the test that catches it:
// - two stops a few metres apart hide each other's numbers → fanOffsets separates close bulbs, leaves lone ones be
// - the fan loses the visit order or drifts away from the stops → ring centred on the cluster, first bulb first
// - one far stop (the airport) shrinks the whole city view → withoutOutliers drops it, keeps a normal spread
// - the garland skips a stop, or draws a zero-length hop → garlandPath cases
// - the camera leaves a stop outside the frame or zooms in to a street corner → fitCamera cases
// - a pin's label runs off the map or over another pin → layoutPins sides
// - a street name is drawn over a pin, off the frame, or on top of another name → placeLabels cases
// - zooming slides the map away from the finger or cursor, or zooms without end → zoomAt cases
// - a drag moves the map the wrong way, or off the drawing entirely → panBy and clampCamera cases

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fanOffsets, withoutOutliers, garlandPath, fitCamera, toScreen, layoutPins, placeLabels, panBy, zoomAt, clampCamera, scaleLimits,
} from '../../../app/js/map/geometry.js';

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const moved = (points, offsets) => points.map((p, i) => ({ x: p.x + offsets[i].dx, y: p.y + offsets[i].dy }));

test('fanOffsets pulls close bulbs apart and leaves lone ones where they are', () => {
  const points = [{ x: 100, y: 100 }, { x: 110, y: 104 }, { x: 400, y: 300 }];
  const placed = moved(points, fanOffsets(points));
  assert.ok(dist(placed[0], placed[1]) >= 36, 'a 32 px bulb needs at least that much room');
  assert.deepEqual(placed[2], points[2]);
});

test('fanOffsets keeps a cluster centred on its stops, however many there are', () => {
  const points = [{ x: 50, y: 50 }, { x: 52, y: 50 }, { x: 50, y: 53 }, { x: 51, y: 51 }];
  const placed = moved(points, fanOffsets(points));
  const centre = (list) => ({ x: list.reduce((s, p) => s + p.x, 0) / list.length, y: list.reduce((s, p) => s + p.y, 0) / list.length });
  assert.ok(dist(centre(placed), centre(points)) < 1e-9);
  placed.forEach((p, i) => placed.slice(i + 1).forEach((q) => assert.ok(dist(p, q) >= 36)));
});

test('fanOffsets puts identical points on a ring, the first one on top', () => {
  const points = [{ x: 10, y: 10 }, { x: 10, y: 10 }];
  const placed = moved(points, fanOffsets(points));
  assert.ok(placed[0].y < placed[1].y, 'with no direction to keep, the first stop goes up');
});

test('withoutOutliers drops the one stop far from the rest, and nothing from a normal spread', () => {
  const city = [0, 1, 2, 3, 4, 5].map((i) => ({ x: 100 + i * 10, y: 100 + (i % 2) * 10 }));
  assert.equal(withoutOutliers([...city, { x: 900, y: 2000 }]).length, city.length);
  assert.equal(withoutOutliers(city).length, city.length);
  const few = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 900, y: 900 }];
  assert.equal(withoutOutliers(few).length, 3, 'under five points nothing counts as an outlier');
});

test('garlandPath hangs one sagging curve per hop and skips a hop with nowhere to go', () => {
  const d = garlandPath([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]);
  assert.equal(d.match(/Q/g).length, 2);
  assert.match(d, /^M0\.0 0\.0Q50\.0 22\.0 100\.0 0\.0/, 'a 100 px hop sags 22 px at its control point');
  assert.equal(garlandPath([]), '');
});

test('fitCamera frames every stop inside the padding and stops zooming at street level', () => {
  const projection = { lon0: 37.5, lat0: 55.8, k: 4000 };
  const size = { width: 600, height: 500, mode: 'day', projection };
  const spread = [{ x: 100, y: 100 }, { x: 400, y: 300 }];
  const camera = fitCamera(spread, size);
  spread.map((p) => toScreen(p, camera, size)).forEach((q) => {
    assert.ok(q.x >= 56 - 1e-6 && q.x <= 600 - 150 + 1e-6, `x ${q.x} inside the wide padding`);
    assert.ok(q.y >= 64 - 1e-6 && q.y <= 500 - 56 + 1e-6, `y ${q.y} inside the padding`);
  });
  const single = fitCamera([{ x: 200, y: 200 }], size);
  assert.ok(Number.isFinite(single.s) && single.s < 1e6, 'one stop does not zoom in forever');
});

test('layoutPins puts a label right of its bulb, left at the right edge, and drops it when neither fits', () => {
  const width = 400;
  const points = [{ x: 100, y: 100 }, { x: 350, y: 200 }, { x: 200, y: 300 }, { x: 200, y: 326 }];
  const { sides } = layoutPins(points, [120, 120, 500, 0], { width, fan: false, labels: true });
  assert.equal(sides[0], 'right');
  assert.equal(sides[1], 'left', 'no room on the right: 350 + 30 + 120 > 400');
  assert.equal(sides[2], null, 'a 500 px label fits on neither side');
  assert.equal(sides[3], null, 'no label width, no label');
});

test('layoutPins keeps a label off a neighbouring bulb, and city mode has no labels', () => {
  const points = [{ x: 200, y: 100 }, { x: 270, y: 100 }];
  const { sides } = layoutPins(points, [80, 0], { width: 600, fan: false, labels: true });
  assert.equal(sides[0], 'left', 'the right side would cover the bulb at x=270');
  const city = layoutPins(points, [80, 80], { width: 600, fan: false, labels: false });
  assert.deepEqual(city.sides, [null, null]);
});

test('placeLabels hides a name outside the frame, over a pin, or over an earlier name', () => {
  const size = { width: 300, height: 200 };
  const label = (halfW) => ({ halfW, halfH: 8 });
  const labels = [label(40), label(40), label(40), label(40)];
  const positions = [{ x: 100, y: 50 }, { x: 110, y: 52 }, { x: 290, y: 100 }, { x: 150, y: 150 }];
  const pin = [{ x0: 140, x1: 180, y0: 130, y1: 170 }];
  assert.deepEqual(placeLabels(labels, positions, pin, size), [true, false, false, false]);
});

test('zoomAt keeps the map point under the cursor where it is, and stops at the limits', () => {
  const size = { width: 400, height: 300 };
  const camera = { x: 500, y: 400, s: 1 };
  const at = { x: 300, y: 80 };
  const under = (c) => ({ x: c.x + (at.x - size.width / 2) / c.s, y: c.y + (at.y - size.height / 2) / c.s });
  const zoomed = zoomAt(camera, 2, at, size, { min: 0.5, max: 4 });
  assert.equal(zoomed.s, 2);
  assert.ok(Math.abs(under(zoomed).x - under(camera).x) < 1e-9 && Math.abs(under(zoomed).y - under(camera).y) < 1e-9);
  assert.equal(zoomAt(camera, 100, at, size, { min: 0.5, max: 4 }).s, 4);
  assert.equal(zoomAt(camera, 0.01, at, size, { min: 0.5, max: 4 }).s, 0.5);
});

test('a drag moves the map with the finger, and the centre stays over the drawing', () => {
  const moved = panBy({ x: 500, y: 400, s: 2 }, 40, -20);
  assert.deepEqual(moved, { x: 480, y: 410, s: 2 }, 'dragging right shows what lies to the left');
  assert.deepEqual(clampCamera({ x: -50, y: 2000, s: 1 }, 900), { x: 0, y: 900, s: 1 });
});

test('scaleLimits lets the whole city fit and stops a few streets in', () => {
  const limits = scaleLimits({ width: 500, height: 400 }, { lon0: 37.5, lat0: 55.83, k: 4278 }, 998.5);
  const cityFits = Math.min(500 / 1000, 400 / 998.5);
  assert.ok(limits.min < cityFits && limits.max > 10 * cityFits);
});
