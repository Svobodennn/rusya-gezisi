// How this breaks, and the test that catches it:
// - storage blocked (private mode): a second tick wipes the first, and a tick can never be undone → blocked cases
// - another tab's ticks are lost when this tab ticks → a toggle starts from what storage holds

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TICKS_KEY, loadTicks, toggleStoredTick } from '../../../app/js/state/ticks.js';

function memoryStorage() {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)) };
}

const blockedStorage = {
  getItem() { throw new Error('SecurityError'); },
  setItem() { throw new Error('SecurityError'); },
};

test('with storage blocked, ticks still add up for this visit', () => {
  globalThis.localStorage = blockedStorage;
  let ticks = loadTicks();
  ({ ticks } = toggleStoredTick('2026-12-20|a', ticks));
  ({ ticks } = toggleStoredTick('2026-12-20|b', ticks));
  assert.deepEqual([...ticks].sort(), ['2026-12-20|a', '2026-12-20|b']);
});

test('with storage blocked, a tick can be undone', () => {
  globalThis.localStorage = blockedStorage;
  const on = toggleStoredTick('2026-12-20|a', new Set());
  const off = toggleStoredTick('2026-12-20|a', on.ticks);
  assert.equal(on.lighting, true);
  assert.equal(off.lighting, false);
  assert.deepEqual([...off.ticks], []);
});

test('a toggle starts from what another tab stored, and stores the result', () => {
  const storage = memoryStorage();
  globalThis.localStorage = storage;
  storage.setItem(TICKS_KEY, JSON.stringify(['2026-12-20|other-tab']));
  const { ticks } = toggleStoredTick('2026-12-20|mine', new Set());
  assert.deepEqual([...ticks].sort(), ['2026-12-20|mine', '2026-12-20|other-tab']);
  assert.deepEqual(JSON.parse(storage.getItem(TICKS_KEY)).sort(), ['2026-12-20|mine', '2026-12-20|other-tab']);
});
