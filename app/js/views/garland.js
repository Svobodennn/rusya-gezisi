// The whole trip as one garland: three bulbs a day, the month and the city lettered above the wire.
import { isToday } from '../core/clock.js';
import { slotOf, slotState } from '../core/slots.js';
import { nextKeyFor } from '../core/stops.js';
import { esc, icon } from './html.js';
import { CITY_TITLES, MONTHS, dateParts, dayLabel } from './format.js';

export function garlandHtml(snapshot) {
  const { trip, index, position, ticks } = snapshot;
  return trip.days.map((day, i) => {
    const nextKey = nextKeyFor(snapshot, i);
    const states = trip.slots.map((def) => slotState(day, slotOf(day, def.key), trip.places, ticks, nextKey));
    const done = states.filter((s) => s === 'lit').length;
    const { m, d } = dateParts(day.date);
    const cityStart = i === 0 || day.transit;
    const cityName = cityStart ? `<span class="g-city" lang="ru" aria-hidden="true">${CITY_TITLES[day.city].name}</span>` : '';
    const month = i === 0 || d === 1 ? `<span class="g-month" aria-hidden="true">${MONTHS[m - 1]}</span>` : '';
    const sep = day.transit ? `<li class="g-sep" aria-hidden="true">${icon('i-train')}</li>` : '';
    const today = isToday(position, i);
    const classes = ['g-day', i === index && 'is-view', today && 'is-today'].filter(Boolean).join(' ');
    const label = `${dayLabel(day)} ${day.weekday}, ${trip.cities[day.city].label}${today ? ', bugün' : ''}: ${done} / ${trip.slots.length} yapıldı`;
    const bulbs = states.map((s) => `<span class="bulb" data-state="${s}"></span>`).join('');
    return `${sep}<li class="${classes}">${cityName}${month}<button type="button" data-go="${i}" aria-label="${esc(label)}"${i === index ? ' aria-current="true"' : ''}>`
      + `<span class="g-bulbs" aria-hidden="true">${bulbs}</span><span class="g-date" aria-hidden="true">${d}</span></button></li>`;
  }).join('');
}
