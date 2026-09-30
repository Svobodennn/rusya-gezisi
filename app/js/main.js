// Entry point: loads the trip, builds the page, and wires it to the visitor, the clock and other tabs.
import { tripPosition } from './core/clock.js';
import { mountSprite } from './lib/sprite.js';
import { setupOffline } from './pwa/offline.js';
import { readLite } from './state/lite.js';
import { loadJson } from './state/load.js';
import { createStore } from './state/store.js';
import { TICKS_KEY, loadTicks } from './state/ticks.js';
import { indexFromHash, readFixedNow } from './state/url.js';
import { wireActions } from './ui/actions.js';
import { setupArrowKeys, setupSwipe } from './ui/gestures.js';
import { setupLiteSwitch } from './ui/lite-switch.js';
import { showLoadError } from './ui/load-error.js';
import { createPage } from './ui/page.js';
import { createPhotoViewer } from './ui/photo-viewer.js';
import { createTaxiDialog } from './ui/taxi-dialog.js';

const CLOCK_TICK_MS = 60_000;

const whenIdle = (task) => (window.requestIdleCallback ? requestIdleCallback(task, { timeout: 3000 }) : setTimeout(task, 500));

function pageElements() {
  const byId = (id) => document.getElementById(id);
  return {
    hero: byId('hero'), main: byId('day'), route: byId('route'), garland: byId('garland'),
    tripSection: byId('trip'), prep: byId('prep'), verified: byId('verified'),
  };
}

async function startPage(lite) {
  const ticks = loadTicks();
  const elements = pageElements();
  const [trip, heroes, phrases, memories] = await Promise.all(
    ['trip', 'heroes', 'phrases', 'memories'].map(loadJson).concat(mountSprite()),
  );
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
  const store = createStore({ trip, memories: memories ?? {}, ticks, now, position, index, lite: lite.on });
  const page = createPage({ store, elements, extras, fixedNow });
  page.render();

  const taxi = createTaxiDialog(document.getElementById('taxi'));
  const viewer = createPhotoViewer(document.getElementById('photo-viewer'));
  wireActions({ page, taxi, viewer, store });
  setupLiteSwitch(lite);
  setupArrowKeys(page.step, () => taxi.isOpen() || viewer.isOpen());
  // Only the cover swipes between days: on the stops a sideways swipe is too easy to make by accident.
  setupSwipe(elements.hero, page.step);
  window.addEventListener('storage', (event) => {
    if (event.key === TICKS_KEY) page.reloadTicks();
  });
  if (!fixedNow) setInterval(page.onClockTick, CLOCK_TICK_MS);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) page.onClockTick();
  });
}

async function start() {
  // Decided before anything is drawn, so a weak device never starts the effects it cannot carry.
  const lite = readLite();
  document.documentElement.toggleAttribute('data-lite', lite.on);
  try {
    await startPage(lite);
  } finally {
    // The offline copy (about 21 MB) starts once the day is drawn and the browser has a quiet moment; also when
    // drawing failed, so that a fixed version can still arrive.
    whenIdle(setupOffline);
  }
}

start();
