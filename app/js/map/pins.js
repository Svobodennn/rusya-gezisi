// Pins: which stops the map shows in each mode, and the buttons that stand for them.
import { isOnMap, routeStops } from '../core/stops.js';

const stopAria = (stop) => `${stop.number}. durak: ${stop.name}`;

// Day mode: the day's stops in this city. City mode: every place the plan visits here, today's marked.
// Today's pins come last, so in the city view they are drawn over the others.
export function pinItems({ stops, places }, mode, city) {
  const onMap = (item) => isOnMap(item, city);
  const byPlace = new Map(stops.map((stop) => [stop.id, stop]));
  const items = mode === 'city'
    ? places.filter(onMap).map((place) => {
      const stop = byPlace.get(place.id);
      return stop
        ? { ...stop, today: true, aria: stopAria(stop) }
        : { ...place, today: false, state: place.state, aria: `${place.name}, ${place.dayLabel}` };
    })
    : stops.filter(onMap).map((stop) => ({ ...stop, today: true, aria: stopAria(stop) }));
  return [...items].sort((a, b) => Number(a.today) - Number(b.today));
}

// The day's route runs through today's live pins in visit order.
export function routePins(pins, city) {
  return routeStops(pins.filter((pin) => pin.today), city).sort((a, b) => a.number - b.number);
}

export function pinButton(item) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = item.today ? 'pin is-today' : 'pin';
  button.dataset.state = item.state;
  const bulb = document.createElement('span');
  bulb.className = 'pin-bulb';
  bulb.textContent = item.number ?? '';
  const label = document.createElement('span');
  label.className = 'pin-label';
  label.textContent = item.name;
  button.append(bulb, label);
  button.setAttribute('aria-label', item.aria);
  button.dataset.place = item.id;
  if (!item.today) button.tabIndex = -1;
  return button;
}
