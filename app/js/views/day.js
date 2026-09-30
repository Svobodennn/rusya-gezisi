// The day: navigation, then the three slots on one wire, then good night.
import { isToday } from '../core/clock.js';
import { planAddsInfo } from '../core/plan-text.js';
import { liveWires, slotOf, slotState } from '../core/slots.js';
import { dayStops, nextKeyFor } from '../core/stops.js';
import { esc, icon } from './html.js';
import { dayLabel, shortLabel, slotTime } from './format.js';
import { shelfHtml } from './ornaments.js';
import { stopHtml } from './stop.js';
import { freeHtml } from './free-slot.js';

const BULB_WORDS = { lit: 'yapıldı', dead: 'açık mekân yok' };

function navButton(dir, day, target) {
  if (!day) return `<button type="button" class="nav-btn" data-dir="${dir}" disabled aria-hidden="true"></button>`;
  const text = `<span>${shortLabel(day)}</span>`;
  const label = `${dir === 'prev' ? 'Önceki' : 'Sonraki'} gün: ${dayLabel(day)}`;
  const inner = dir === 'prev' ? icon('i-left') + text : text + icon('i-right');
  return `<button type="button" class="nav-btn" data-dir="${dir}" data-go="${target}" aria-label="${label}">${inner}</button>`;
}

function navHtml({ trip, index, position }) {
  const showToday = position.phase === 'during' && !isToday(position, index);
  const today = showToday
    ? `<button type="button" class="nav-btn nav-btn--today" data-go="${position.index}">Bugün</button>`
    : '<span></span>';
  return `<nav class="day-nav" aria-label="Günler">`
    + `${navButton('prev', trip.days[index - 1], index - 1)}${today}${navButton('next', trip.days[index + 1], index + 1)}</nav>`;
}

const live = (on) => (on ? ' data-live' : '');

function slotHtml(snapshot, day, { def, slot, state, wire, isNext }, numbers) {
  const { trip } = snapshot;
  const now = isNext ? '<em class="slot-now">Sıradaki</em>' : '';
  const word = BULB_WORDS[state] ? `<span class="visually-hidden">, ${BULB_WORDS[state]}</span>` : '';
  const hasPlaces = slot.places.length > 0;
  const body = hasPlaces
    ? slot.places.map((id) => stopHtml(snapshot, day, slot.key, id, numbers.get(`${slot.key}|${id}`))).join('')
    : freeHtml(snapshot, day, slot);
  const showPlan = hasPlaces && planAddsInfo(slot.plan, slot.places.map((id) => trip.places[id]));
  const plan = showPlan ? `<p class="slot-plan" lang="en">“${esc(slot.plan)}”</p>` : '';
  return `<li class="slot" data-key="${esc(def.key)}" data-state="${esc(state)}">
      <div class="slot-rail" aria-hidden="true"><span class="wire wire--in"${live(wire.in)}></span><span class="bulb" data-state="${state}"></span><span class="wire wire--out"${live(wire.out)}></span></div>
      <div class="slot-body glass">
        <h2 class="slot-time"><strong>${esc(slotTime(def))}</strong><span>${esc(def.label)}</span>${now}${word}</h2>
        ${plan}
        <div class="stops">${body}</div>
      </div>
    </li>`;
}

function dayEndHtml() {
  return `<div class="day-end" aria-hidden="true">${shelfHtml()}`
    + '<p class="day-end-text"><span lang="ru">Спокойной ночи!</span><span>İyi geceler</span></p></div>';
}

export function dayHtml(snapshot) {
  const { trip, index, ticks } = snapshot;
  const day = trip.days[index];
  const nextKey = nextKeyFor(snapshot, index);
  const numbers = new Map(dayStops(snapshot, index).map((stop) => [`${stop.slot}|${stop.id}`, stop.number]));
  const rows = trip.slots.map((def) => {
    const slot = slotOf(day, def.key);
    return { def, slot, state: slotState(day, slot, trip.places, ticks, nextKey), isNext: def.key === nextKey };
  });
  const wires = liveWires(rows.map((row) => row.state), rows.findIndex((row) => row.isNext));
  const slots = rows.map((row, i) => slotHtml(snapshot, day, { ...row, wire: wires[i] }, numbers)).join('');
  return `${navHtml(snapshot)}<ol class="slots">${slots}</ol>${dayEndHtml()}`;
}
