// Slot windows, ticks and bulb states. Pure: no DOM, no storage.
import { DAY_MINUTES } from './clock.js';

const GONE = new Set(['closed', 'not_found']);

// A venue that is closed for good or could not be found: never routed to, never burning.
export function isGone(place) {
  return GONE.has(place?.status);
}

// A tick's storage key: a visit is "<date>|<placeId>", a free slot "<date>|<slotKey>".
export function tickKey(date, id) {
  return `${date}|${id}`;
}

export function slotOf(day, key) {
  return day.slots.find((s) => s.key === key);
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function slotWindow(slot) {
  const start = toMinutes(slot.start);
  let end = toMinutes(slot.end);
  if (end <= start) end += DAY_MINUTES;
  return { start, end };
}

export function tickKeys(day, slot) {
  return slot.places.length ? slot.places.map((id) => tickKey(day.date, id)) : [tickKey(day.date, slot.key)];
}

function isSlotDone(day, slot, ticks) {
  return tickKeys(day, slot).some((key) => ticks.has(key));
}

export function isSlotDead(slot, places) {
  return slot.places.length > 0 && slot.places.every((id) => isGone(places[id]));
}

// The first slot of today, in order, that has not ended and is not done yet.
export function nextSlotKey(day, slotDefs, nowMinutes, ticks) {
  for (const def of slotDefs) {
    const slot = slotOf(day, def.key);
    if (!slot) continue;
    if (nowMinutes < slotWindow(def).end && !isSlotDone(day, slot, ticks)) return def.key;
  }
  return null;
}

// Bulb state for one slot: 'lit' (visited) > 'dead' (every venue closed) > 'next' (burning) > 'off'.
// A dead slot never burns, even when it is next: the bulb must not promise a venue that is gone.
export function slotState(day, slot, places, ticks, nextKey) {
  if (isSlotDone(day, slot, ticks)) return 'lit';
  if (isSlotDead(slot, places)) return 'dead';
  if (slot.key === nextKey) return 'next';
  return 'off';
}

// Current runs from the last lit bulb on to the next one: for each slot, whether its incoming and outgoing wire is live.
export function liveWires(states, nextIndex) {
  const lastLit = nextIndex < 0 ? -1 : states.slice(0, nextIndex).lastIndexOf('lit');
  return states.map((_, i) => ({
    in: lastLit >= 0 && i > lastLit && i <= nextIndex,
    out: lastLit >= 0 && i >= lastLit && i < nextIndex,
  }));
}
