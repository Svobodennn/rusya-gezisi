// How this breaks, and the test that catches it:
// - "next" stays on a skipped or finished slot → nextSlotKey cases
// - a closed venue's bulb burns as if it were open → slotState precedence
// - a free slot's tick collides with a place visit → tickKeys cases
// - current runs on the wrong stretch of wire, or with nothing lit → liveWires cases

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextSlotKey, slotState, isSlotDead, tickKeys, liveWires } from '../../../app/js/core/slots.js';

const SLOT_DEFS = [
  { key: 'work', start: '08:00', end: '16:00' },
  { key: 'afternoon', start: '16:00', end: '19:30' },
  { key: 'evening', start: '19:30', end: '05:00' },
];
const day = {
  date: '2026-12-21',
  slots: [
    { key: 'work', places: ['msk-10'] },
    { key: 'afternoon', places: ['msk-11'] },
    { key: 'evening', places: ['msk-12'] },
  ],
};
const PLACES = {
  'msk-10': { status: 'open' },
  'msk-11': { status: 'open' },
  'msk-12': { status: 'closed' },
  'msk-20': { status: 'not_found' },
  'msk-19': { status: 'open' },
};

test('next slot follows time and ticks', () => {
  const none = new Set();
  assert.equal(nextSlotKey(day, SLOT_DEFS, 7 * 60, none), 'work');
  assert.equal(nextSlotKey(day, SLOT_DEFS, 10 * 60, none), 'work');
  assert.equal(nextSlotKey(day, SLOT_DEFS, 10 * 60, new Set(['2026-12-21|msk-10'])), 'afternoon');
  assert.equal(nextSlotKey(day, SLOT_DEFS, 17 * 60, none), 'afternoon'); // work skipped and over
  assert.equal(nextSlotKey(day, SLOT_DEFS, 26 * 60, none), 'evening'); // 02:00, night not over
  const all = new Set(['2026-12-21|msk-10', '2026-12-21|msk-11', '2026-12-21|msk-12']);
  assert.equal(nextSlotKey(day, SLOT_DEFS, 12 * 60, all), null);
});

test('free slots are ticked by slot key', () => {
  const free = { date: '2026-12-31', slots: [{ key: 'afternoon', places: [] }] };
  assert.deepEqual(tickKeys(free, free.slots[0]), ['2026-12-31|afternoon']);
  assert.deepEqual(tickKeys(day, day.slots[0]), ['2026-12-21|msk-10']);
});

test('a slot is dead only when every venue in it is closed or missing', () => {
  assert.equal(isSlotDead({ places: ['msk-12'] }, PLACES), true);
  assert.equal(isSlotDead({ places: ['msk-20'] }, PLACES), true);
  assert.equal(isSlotDead({ places: ['msk-19', 'msk-20'] }, PLACES), false);
  assert.equal(isSlotDead({ places: [] }, PLACES), false);
});

test('bulb precedence: visited, then dead, then next', () => {
  const evening = day.slots[2];
  assert.equal(slotState(day, evening, PLACES, new Set(), 'evening'), 'dead'); // a closed venue never burns
  assert.equal(slotState(day, evening, PLACES, new Set(['2026-12-21|msk-12']), 'evening'), 'lit');
  assert.equal(slotState(day, day.slots[1], PLACES, new Set(), 'afternoon'), 'next');
  assert.equal(slotState(day, day.slots[1], PLACES, new Set(), 'evening'), 'off');
});

test('current runs from the last lit bulb to the next one, and nowhere without a lit one', () => {
  const pair = (w) => w.map((x) => `${x.in ? 'i' : '-'}${x.out ? 'o' : '-'}`).join(' ');
  assert.equal(pair(liveWires(['lit', 'off', 'next'], 2)), '-o io i-');
  assert.equal(pair(liveWires(['lit', 'next', 'off'], 1)), '-o i- --');
  assert.equal(pair(liveWires(['off', 'lit', 'next'], 2)), '-- -o i-');
  assert.equal(pair(liveWires(['off', 'off', 'next'], 2)), '-- -- --', 'nothing lit: the wire stays dark');
  assert.equal(pair(liveWires(['lit', 'lit', 'lit'], -1)), '-- -- --', 'no next slot: no current');
});
