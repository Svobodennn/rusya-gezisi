// How this breaks, and the test that catches it:
// - a card's number and its map pin drift apart, or a free slot eats a number → dayStops numbering
// - a closed venue lights up on the map, or a ticked one stays dark → dayStops pin states
// - the plan line repeats the venue names (noise) or hides real intent → planAddsInfo cases from the real plan
// - the city view sends a place to the wrong day, or lists a place the plan never visits → cityPlaces

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayStops, cityPlaces } from '../../../app/js/core/stops.js';
import { planAddsInfo } from '../../../app/js/core/plan-text.js';

test('plan line shows only when it says more than the venue names', () => {
  const red = [{ name: 'Red Square' }, { name: "St. Basil's Cathedral" }, { name: 'GUM' }];
  assert.equal(planAddsInfo('Red Square, St. Basil’s Cathedral, GUM', red), false); // curly vs straight apostrophe
  assert.equal(planAddsInfo('Stars Coffee (Arbat District)', [{ name: 'Stars Coffee (Arbat)' }]), false);
  assert.equal(planAddsInfo('Techno night at Propaganda Club', [{ name: 'Propaganda Club' }]), true);
  assert.equal(planAddsInfo('Gorky Park (Ice Skating & stroll)', [{ name: 'Gorky Park' }]), true);
  assert.equal(planAddsInfo('Mariinsky Theatre area', [{ name: 'Mariinsky Theatre' }]), false);
});

// Two slots of places around a free one: numbers run through the places only, in slot order.

function stopsContext(ticks = []) {
  const slots = [
    { key: 'work', label: 'Çalışma', start: '08:00', end: '16:00' },
    { key: 'afternoon', label: 'Gezi', start: '16:00', end: '19:30' },
    { key: 'evening', label: 'Akşam', start: '19:30', end: '05:00' },
  ];
  const place = (id, status = 'open') => ({ id, name: id, city: 'moscow', status, lat: 55.7, lon: 37.6 });
  return {
    trip: {
      slots,
      days: [{
        n: 1, date: '2026-12-19', city: 'moscow',
        slots: [
          { key: 'evening', plan: 'Bar', places: ['c', 'd'] },
          { key: 'work', plan: 'Cafe', places: ['a'] },
          { key: 'afternoon', plan: 'Rest and prep for the long night', places: [] },
        ],
      }],
      places: { a: place('a'), c: place('c', 'closed'), d: place('d') },
    },
    position: { phase: 'before', daysUntil: 80 },
    now: new Date('2026-09-30T12:00:00Z'),
    ticks: new Set(ticks),
  };
}

test('dayStops numbers the day in slot order and skips free slots', () => {
  const stops = dayStops(stopsContext(), 0);
  assert.deepEqual(stops.map((s) => [s.number, s.id, s.slot]), [[1, 'a', 'work'], [2, 'c', 'evening'], [3, 'd', 'evening']]);
});

test('dayStops pins: closed is dead even when ticked, ticked is lit, the rest off', () => {
  const stops = dayStops(stopsContext(['2026-12-19|d', '2026-12-19|c']), 0);
  assert.deepEqual(stops.map((s) => [s.id, s.state]), [['a', 'off'], ['c', 'dead'], ['d', 'lit']]);
});

test('cityPlaces keeps the city, the first day a place appears, and gone places as dead', () => {
  const trip = {
    days: [
      { slots: [{ places: ['a'] }, { places: [] }] },
      { slots: [{ places: ['b', 'a'] }] },
    ],
    places: {
      a: { id: 'a', name: 'A', city: 'moscow', status: 'open', lat: 1, lon: 2 },
      b: { id: 'b', name: 'B', city: 'moscow', status: 'closed', lat: 3, lon: 4 },
      c: { id: 'c', name: 'C', city: 'moscow', status: 'open', lat: 5, lon: 6 },
      d: { id: 'd', name: 'D', city: 'spb', status: 'open', lat: 7, lon: 8 },
    },
  };
  assert.deepEqual(cityPlaces(trip, 'moscow').map((p) => [p.id, p.day, p.state]), [['a', 0, 'off'], ['b', 1, 'dead']]);
  assert.deepEqual(cityPlaces(trip, 'spb'), []);
});
