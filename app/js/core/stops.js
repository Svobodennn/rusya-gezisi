// The day's stops as the cards and the map both see them. Pure: works on the view snapshot, touches nothing.
import { isToday, minutesIntoTripDay } from './clock.js';
import { isGone, nextSlotKey, slotOf, slotState, tickKey } from './slots.js';

export function nextKeyFor({ trip, position, now, ticks }, dayIndex) {
  if (!isToday(position, dayIndex)) return null;
  return nextSlotKey(trip.days[dayIndex], trip.slots, minutesIntoTripDay(now, trip.dayRolloverHour), ticks);
}

// One numbering for the day, shared by the cards and the map pins: stops in slot order, free slots skipped.
export function dayStops(snapshot, dayIndex) {
  const { trip, ticks } = snapshot;
  const day = trip.days[dayIndex];
  const nextKey = nextKeyFor(snapshot, dayIndex);
  let number = 0;
  return trip.slots.flatMap((def) => {
    const slot = slotOf(day, def.key);
    const state = slotState(day, slot, trip.places, ticks, nextKey);
    return slot.places.map((id) => {
      number += 1;
      const place = trip.places[id];
      const ticked = ticks.has(tickKey(day.date, id));
      const pinState = isGone(place) ? 'dead' : ticked ? 'lit' : state === 'next' ? 'next' : 'off';
      return { number, id, slot: def.key, state: pinState, name: place.name, city: place.city, lat: place.lat, lon: place.lon };
    });
  });
}

// Every place of a city that the plan visits, with the index of the first day it appears on.
export function cityPlaces(trip, city) {
  const firstDay = new Map();
  trip.days.forEach((day, i) => day.slots.forEach((slot) => slot.places.forEach((id) => {
    if (!firstDay.has(id)) firstDay.set(id, i);
  })));
  return Object.values(trip.places)
    .filter((place) => place.city === city && firstDay.has(place.id))
    .map((place) => ({
      id: place.id, name: place.name, city: place.city, lat: place.lat, lon: place.lon,
      day: firstDay.get(place.id), state: isGone(place) ? 'dead' : 'off',
    }));
}

// On this city's map: it has coordinates and lies in the city (a transit day begins in the other one).
export function isOnMap(item, city) {
  return item.lat != null && item.lon != null && item.city === city;
}

// The day's route through a city: its stops on that map that are still open, in visit order.
export function routeStops(stops, city) {
  return stops.filter((stop) => isOnMap(stop, city) && stop.state !== 'dead');
}
