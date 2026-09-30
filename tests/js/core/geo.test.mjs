// How this breaks, and the test that catches it:
// - pins drift off the drawn map because the projection differs from tools/build_maps.py → origin, width, Mercator stretch

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { project, mercatorY } from '../../../app/js/core/geo.js';

test('projection puts the map origin at 0,0 and grows east and south', () => {
  const proj = { lon0: 37.5, lat0: 55.85, k: 1000 / 0.3 };
  const origin = project(55.85, 37.5, proj);
  assert.ok(Math.abs(origin.x) < 1e-9 && Math.abs(origin.y) < 1e-9);
  const east = project(55.85, 37.8, proj);
  assert.ok(Math.abs(east.x - 1000) < 1e-6, 'bbox width maps to 1000 units');
  const south = project(55.7, 37.5, proj);
  assert.ok(south.y > 0, 'south is down');
  // Mercator stretches latitude by sec(lat): 0.15° at ~55.78°N is 0.15 × 1.778 ≈ 0.2667° of Mercator y.
  assert.ok(Math.abs(south.y / proj.k - (mercatorY(55.85) - mercatorY(55.7))) < 1e-12);
  assert.ok(Math.abs(mercatorY(55.85) - mercatorY(55.7) - 0.2667) < 0.0005);
});
