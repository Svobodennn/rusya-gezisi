// Entry point: loads the trip, builds the page, and wires it to the visitor, the clock and other tabs.
import { tripPosition } from './core/clock.js';
import { mountSprite } from './lib/sprite.js';
import { setupOffline } from './pwa/offline.js';
import { loadJson } from './state/load.js';
import { createStore } from './state/store.js';
import { TICKS_KEY, loadTicks } from './state/ticks.js';
import { indexFromHash, readFixedNow } from './state/url.js';
import { wireActions } from './ui/actions.js';
import { setupArrowKeys, setupSwipe } from './ui/gestures.js';
import { showLoadError } from './ui/load-error.js';
import { createPage } from './ui/page.js';
import { createTaxiDialog } from './ui/taxi-dialog.js';

const CLOCK_TICK_MS = 60_000;

function pageElements() {
  const byId = (id) => document.getElementById(id);
  return {
    hero: byId('hero'), main: byId('day'), route: byId('route'), garland: byId('garland'),
    tripSection: byId('trip'), prep: byId('prep'), verified: byId('verified'),
  };
}

async function start() {
  setupOffline();
  const ticks = loadTicks();
  const elements = pageElements();
  const [trip, heroes, phrases] = await Promise.all(['trip', 'heroes', 'phrases'].map(loadJson).concat(mountSprite()));
  if (!trip) {
    showLoadError(elements.hero, elements.main);
    return;
  }
  const fixedNow = readFixedNow();
  const now = fixedNow ?? new Date();
  const position = tripPosition(trip.days, now, trip.dayRolloverHour);
  const index = indexFromHash(trip.days.length) ?? position.index;
  // The covers and phrases are decoration: without them the day still renders.
  const extras = { heroes: heroes ?? {}, phrases: phrases ?? {} };
  const store = createStore({ trip, ticks, now, position, index });
  const page = createPage({ store, elements, extras, fixedNow });
  page.render();

  const taxi = createTaxiDialog(document.getElementById('taxi'));
  wireActions({ page, taxi, store });
  setupArrowKeys(page.step, taxi.isOpen);
  setupSwipe(elements.main, page.step);
  setupSwipe(elements.hero, page.step);
  window.addEventListener('storage', (event) => {
    if (event.key === TICKS_KEY) page.reloadTicks();
  });
  if (!fixedNow) setInterval(page.onClockTick, CLOCK_TICK_MS);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) page.onClockTick();
  });
}

start();
