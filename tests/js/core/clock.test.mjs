// Run: node --test "tests/**/*.test.mjs"  (also under another TZ, e.g. TZ=America/New_York, to prove the device clock is ignored)
//
// How this breaks, and the test that catches it:
// - device time zone used instead of Moscow time → instants are built in UTC, suite runs under any TZ
// - day flips at midnight, so 02:00 after a night out lands on the wrong day → rollover cases, NYE night
// - year boundary (31 Dec → 1 Jan) mishandled → NYE and 1 Jan cases

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moscowClock, tripDateFor, minutesIntoTripDay, tripPosition, daysBetween } from '../../../app/js/core/clock.js';

const ROLL = 5;
const at = (iso) => new Date(iso);
const DAYS = [
  { date: '2026-12-19' }, { date: '2026-12-20' }, { date: '2026-12-31' }, { date: '2027-01-01' }, { date: '2027-01-14' },
];

test('Moscow clock is UTC+3 whatever the device zone', () => {
  assert.deepEqual(moscowClock(at('2026-12-20T13:00:00Z')), { date: '2026-12-20', hours: 16, minutes: 0 });
  assert.deepEqual(moscowClock(at('2026-12-31T21:30:00Z')), { date: '2027-01-01', hours: 0, minutes: 30 });
});

test('trip day rolls over at 05:00 Moscow time, not at midnight', () => {
  assert.equal(tripDateFor(at('2026-12-20T01:59:00Z'), ROLL), '2026-12-19'); // 04:59
  assert.equal(tripDateFor(at('2026-12-20T02:00:00Z'), ROLL), '2026-12-20'); // 05:00
  assert.equal(tripDateFor(at('2026-12-19T23:00:00Z'), ROLL), '2026-12-19'); // 02:00 on the 20th
});

test('New Year night still belongs to 31 December until 05:00', () => {
  assert.equal(tripDateFor(at('2026-12-31T20:59:00Z'), ROLL), '2026-12-31'); // 23:59
  assert.equal(tripDateFor(at('2027-01-01T00:00:00Z'), ROLL), '2026-12-31'); // 03:00 on 1 Jan
  assert.equal(tripDateFor(at('2027-01-01T02:00:00Z'), ROLL), '2027-01-01'); // 05:00 on 1 Jan
});

test('minutes into the trip day count past midnight', () => {
  assert.equal(minutesIntoTripDay(at('2026-12-20T05:00:00Z'), ROLL), 8 * 60); // 08:00
  assert.equal(minutesIntoTripDay(at('2026-12-20T23:00:00Z'), ROLL), 26 * 60); // 02:00 next morning
});

test('trip position before, during and after the trip', () => {
  assert.deepEqual(tripPosition(DAYS, at('2026-09-30T09:00:00Z'), ROLL), { phase: 'before', index: 0, daysUntil: 80 });
  assert.deepEqual(tripPosition(DAYS, at('2026-12-31T22:00:00Z'), ROLL), { phase: 'during', index: 2 }); // 01:00 on 1 Jan
  assert.deepEqual(tripPosition(DAYS, at('2027-01-15T06:00:00Z'), ROLL), { phase: 'after', index: 4 });
  assert.equal(daysBetween('2026-12-19', '2027-01-14'), 26);
});
