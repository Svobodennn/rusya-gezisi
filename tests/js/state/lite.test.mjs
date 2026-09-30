// How this breaks, and the test that catches it:
// - a TV box or a 2 GB phone keeps the full look and crashes → device cases
// - the visitor's choice (the switch, ?lite=) is ignored or forgotten, or a strong device is forced light → choice cases
// - storage blocked (private mode) throws on start and the page never draws → blocked case
// - the switch "does nothing" (a same-address reload that is only a jump to #gun-N), or loses the choice where
//   storage is blocked, or drops ?now= / the day → switchUrl cases

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LITE_KEY, readLite, saveLite, switchUrl } from '../../../app/js/state/lite.js';

function memoryStorage() {
  const data = new Map();
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)) };
}

const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
const MI_BOX = 'Mozilla/5.0 (Linux; Android 9; MIBOX4 Build/PI; wv) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

function device({ search = '', userAgent = MAC, deviceMemory = 8, saveData = false, storage = memoryStorage() } = {}) {
  globalThis.location = { search };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userAgent, deviceMemory, connection: { saveData } } });
  globalThis.localStorage = storage;
  return storage;
}

test('a strong device keeps the full look; a TV box, 2 GB of memory or data saver get the light one', () => {
  device();
  assert.deepEqual(readLite(), { on: false, chosen: false });
  device({ userAgent: MI_BOX });
  assert.deepEqual(readLite(), { on: true, chosen: false });
  device({ deviceMemory: 2 });
  assert.equal(readLite().on, true);
  device({ deviceMemory: undefined });
  assert.equal(readLite().on, false, 'Safari says nothing about its memory');
  device({ saveData: true });
  assert.equal(readLite().on, true);
});

test('?lite= in the address wins over the device, and is remembered for the next visit', () => {
  const storage = device({ search: '?lite=0', userAgent: MI_BOX });
  assert.deepEqual(readLite(), { on: false, chosen: true });
  assert.equal(storage.data.get(LITE_KEY), '0');
  device({ userAgent: MI_BOX, storage });
  assert.deepEqual(readLite(), { on: false, chosen: true }, 'the next visit, without the parameter');
  device({ search: '?lite=1&now=2026-12-20T13:00:00Z', storage });
  assert.deepEqual(readLite(), { on: true, chosen: true });
  device({ search: '?lite=maybe', storage });
  assert.deepEqual(readLite(), { on: true, chosen: true }, 'a value it does not know changes nothing');
});

test('the switch\'s choice is what the reload reads', () => {
  const storage = device();
  saveLite(true);
  assert.deepEqual(readLite(), { on: true, chosen: true });
  saveLite(false);
  device({ deviceMemory: 1, storage });
  assert.deepEqual(readLite(), { on: false, chosen: true });
});

test('with storage blocked, the page still starts and the address still decides', () => {
  const blocked = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('SecurityError'); } };
  device({ storage: blocked });
  assert.deepEqual(readLite(), { on: false, chosen: false });
  device({ search: '?lite=1', storage: blocked });
  assert.deepEqual(readLite(), { on: true, chosen: true });
});

test('switchUrl always gives a different address that carries the choice, and keeps the clock and the day', () => {
  assert.equal(switchUrl('https://x.test/app/#gun-5', true), 'https://x.test/app/?lite=1#gun-5');
  assert.equal(switchUrl('https://x.test/app/?now=2026-12-20T13:00:00Z&lite=1#gun-5', false),
    'https://x.test/app/?now=2026-12-20T13%3A00%3A00Z&lite=0#gun-5');
  const blocked = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('SecurityError'); } };
  device({ search: new URL(switchUrl('https://x.test/', true)).search, storage: blocked });
  assert.deepEqual(readLite(), { on: true, chosen: true }, 'with storage blocked the address alone decides');
});
