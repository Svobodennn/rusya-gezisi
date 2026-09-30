// How this breaks, and the test that catches it:
// - the day view shows another city's stop (a transit day), or a stop without coordinates → pinItems day mode
// - the city view hides today's stops under the others, or loses their numbers → pinItems city mode
// - the garland runs through a closed venue or out of visit order → routePins

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pinItems, routePins } from '../../../app/js/map/pins.js';

const stop = (number, id, extra = {}) => ({ number, id, name: id, city: 'spb', lat: 59.9, lon: 30.3, state: 'off', ...extra });
const stops = [
  stop(1, 'station', { city: 'moscow' }),
  stop(2, 'nevsky'),
  stop(3, 'closed-bar', { state: 'dead' }),
  stop(4, 'no-coords', { lat: null }),
  stop(5, 'pelmeni', { state: 'next' }),
];
const places = [
  { id: 'hermitage', name: 'Hermitage', city: 'spb', lat: 59.94, lon: 30.31, state: 'off', day: 20, dayLabel: '8 Ocak' },
  { id: 'nevsky', name: 'nevsky', city: 'spb', lat: 59.9, lon: 30.3, state: 'off', day: 16, dayLabel: '4 Ocak' },
];

test('day mode shows only today\'s stops that are on this city\'s map', () => {
  assert.deepEqual(pinItems({ stops, places }, 'day', 'spb').map((p) => p.id), ['nevsky', 'closed-bar', 'pelmeni']);
});

test('city mode shows every place, today\'s last and still numbered', () => {
  const items = pinItems({ stops, places }, 'city', 'spb');
  assert.deepEqual(items.map((p) => [p.id, p.today]), [['hermitage', false], ['nevsky', true]]);
  assert.equal(items[1].number, 2);
  assert.equal(items[0].aria, 'Hermitage, 8 Ocak');
});

test('the route runs through today\'s open pins in visit order', () => {
  const pins = [stop(5, 'pelmeni', { today: true }), stop(3, 'closed-bar', { today: true, state: 'dead' }),
    stop(2, 'nevsky', { today: true }), { ...places[0], today: false }];
  assert.deepEqual(routePins(pins, 'spb').map((p) => p.number), [2, 5]);
});
