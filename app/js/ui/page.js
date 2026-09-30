// Draws the page from the store and carries out what the visitor asks: change day, tick a stop, follow the clock.
import { isToday, tripPosition } from '../core/clock.js';
import { nextKeyFor } from '../core/stops.js';
import { prefersReducedMotion } from '../lib/motion.js';
import { loadTicks, toggleStoredTick } from '../state/ticks.js';
import { syncHash } from '../state/url.js';
import { dayHtml } from '../views/day.js';
import { dayLabel, longDate } from '../views/format.js';
import { rememberFocus, restoreFocus } from './focus.js';
import { playLighting } from './live-wire.js';
import { openPanelIds, reopenPanels } from './panels.js';
import { createRegions } from './regions.js';

const isViewingToday = ({ position, index }) => isToday(position, index);

// Only a change of day, countdown or next slot redraws on a clock tick, so an open panel keeps its place.
const viewSignature = (s) => [s.position.phase, s.position.index, s.position.daysUntil, s.index, nextKeyFor(s, s.index)].join('|');

export function createPage({ store, elements, extras, fixedNow }) {
  const { main } = elements;
  const regions = createRegions(elements, extras, { onPick: (pick) => pickPlace(pick) });

  function refreshClock() {
    const { trip } = store.get();
    const now = fixedNow ?? new Date();
    store.set({ now, position: tripPosition(trip.days, now, trip.dayRolloverHour) });
  }

  function render({ enter = null, keepOpen = false, background = false } = {}) {
    const snapshot = store.get();
    const open = keepOpen ? openPanelIds(main) : [];
    const focus = rememberFocus();
    document.body.dataset.city = snapshot.trip.days[snapshot.index].city;
    regions.renderHero(snapshot, isViewingToday(snapshot));
    main.innerHTML = dayHtml(snapshot);
    main.setAttribute('aria-busy', 'false');
    if (enter && !prefersReducedMotion()) {
      main.dataset.enter = enter;
      main.addEventListener('animationend', () => delete main.dataset.enter, { once: true });
    }
    reopenPanels(main, open, snapshot.trip.places);
    regions.renderRoute(snapshot);
    regions.renderGarland(snapshot);
    regions.renderPrep(snapshot);
    restoreFocus(focus, main, background);
    elements.verified.textContent =
      `Mekânlar ${longDate(snapshot.trip.verifiedOn)} tarihinde doğrulandı · sürüm ${snapshot.trip.version.slice(0, 7)}`;
    document.title = `${dayLabel(snapshot.trip.days[snapshot.index])} · Rusya Gezisi`;
  }

  function showDay(index) {
    const snapshot = store.set({ index });
    syncHash(isViewingToday(snapshot), snapshot.trip.days[index].n);
  }

  function go(target, { scrollTop = false } = {}) {
    const { trip, index: current } = store.get();
    const index = Math.max(0, Math.min(trip.days.length - 1, target));
    if (index === current) return;
    showDay(index);
    render({ enter: index > current ? 'next' : 'prev' });
    if (scrollTop) window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }

  function toggleTick(key) {
    const { ticks, lighting } = toggleStoredTick(key, store.get().ticks);
    store.set({ ticks });
    render({ keepOpen: true });
    if (lighting) playLighting(main, key);
  }

  function onClockTick() {
    const before = viewSignature(store.get());
    const followedToday = isViewingToday(store.get());
    refreshClock();
    const { position, index } = store.get();
    if (followedToday && position.phase === 'during' && position.index !== index) showDay(position.index);
    if (viewSignature(store.get()) !== before) render({ keepOpen: true, background: true });
  }

  // Another tab or the installed app ticked something.
  function reloadTicks() {
    store.set({ ticks: loadTicks() });
    render({ keepOpen: true, background: true });
  }

  // A pin was chosen: bring its card into view (on its own day, from the city view) and flash the frame.
  function pickPlace({ place, day }) {
    if (day != null && day !== store.get().index) go(day);
    const card = main.querySelector(`.stop[data-place="${CSS.escape(place)}"]`);
    if (!card) return;
    card.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    card.querySelector('.stop-toggle')?.focus({ preventScroll: true });
    card.classList.remove('is-flash');
    requestAnimationFrame(() => card.classList.add('is-flash'));
    card.addEventListener('animationend', () => card.classList.remove('is-flash'), { once: true });
  }

  return {
    refreshClock, render, go, toggleTick, onClockTick, reloadTicks,
    step: (delta) => go(store.get().index + delta),
    setMapMode: regions.setMapMode,
  };
}
