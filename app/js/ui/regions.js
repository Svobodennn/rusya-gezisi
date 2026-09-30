// The page's regions around the day: the cover, the route map, the trip garland and the countdown.
import { yandexDayRouteUrl } from '../core/links.js';
import { cityPlaces, dayStops, routeStops } from '../core/stops.js';
import { startWeather } from '../effects/weather.js';
import { createRouteMap } from '../map/route-map.js';
import { dayLabel } from '../views/format.js';
import { garlandHtml } from '../views/garland.js';
import { heroHtml } from '../views/hero.js';
import { prepHtml } from '../views/prep.js';
import { routeShellHtml } from '../views/route.js';

export function createRegions({ hero, route, garland, tripSection, prep }, extras, { onPick }) {
  let heroKey = '';
  let stopWeather = () => {};
  let routeMap = null;

  // The cover only changes with the day or the countdown; ticking a stop must not restart the snow.
  function renderHero(snapshot, viewingToday) {
    const { index, position } = snapshot;
    const day = snapshot.trip.days[index];
    const key = [index, position.phase, position.daysUntil, viewingToday].join('|');
    if (key === heroKey) return;
    heroKey = key;
    stopWeather();
    hero.innerHTML = heroHtml(snapshot, extras.heroes[day.date], extras.phrases[day.date]);
    stopWeather = startWeather(hero);
  }

  function renderRoute(snapshot) {
    if (!routeMap) {
      route.innerHTML = routeShellHtml();
      route.hidden = false;
      routeMap = createRouteMap(route.querySelector('#map'), { onPick });
    }
    const day = snapshot.trip.days[snapshot.index];
    const stops = dayStops(snapshot, snapshot.index);
    const places = cityPlaces(snapshot.trip, day.city)
      .map((place) => ({ ...place, dayLabel: dayLabel(snapshot.trip.days[place.day]) }));
    routeMap.show({ city: day.city, stops, places });
    const live = routeStops(stops, day.city);
    const link = route.querySelector('#route-open');
    link.hidden = live.length === 0;
    if (live.length) link.href = yandexDayRouteUrl(live);
  }

  function renderGarland(snapshot) {
    garland.innerHTML = garlandHtml(snapshot);
    tripSection.hidden = false;
    const scroller = garland.parentElement;
    scroller.setAttribute('aria-label', `${snapshot.trip.days.length} günlük gezi`);
    const current = garland.querySelector('.is-view');
    if (current) scroller.scrollLeft = current.offsetLeft - scroller.clientWidth / 2 + current.offsetWidth / 2;
  }

  function renderPrep(snapshot) {
    prep.hidden = snapshot.position.phase !== 'before';
    if (!prep.hidden) prep.innerHTML = prepHtml(snapshot);
  }

  function setMapMode(button) {
    route.querySelectorAll('[data-map-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    routeMap?.setMode(button.dataset.mapMode);
  }

  return { renderHero, renderRoute, renderGarland, renderPrep, setMapMode };
}
