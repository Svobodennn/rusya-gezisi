// Clicks anywhere on the page, routed by the element's data attribute to the action it stands for.
import { setPanel } from './panels.js';
import { scrollStrip } from './strip.js';

export function wireActions({ page, taxi, viewer, store }) {
  const places = () => store.get().trip.places;
  // A stop's pictures for the viewer, each noted with the place and where the photograph comes from.
  const stopPhotos = (id) => {
    const place = places()[id];
    return (place?.photos ?? []).map((photo) => ({ src: photo.src, w: photo.w, h: photo.h, caption: `${place.name} · ${photo.credit}` }));
  };
  const dayMemories = () => {
    const { trip, index, memories } = store.get();
    return memories[trip.days[index].date] ?? [];
  };
  // In order of precedence: an element matching several selectors takes the first.
  const actions = [
    ['[data-go]', (el) => page.go(Number(el.dataset.go), { scrollTop: Boolean(el.closest('#garland')) })],
    ['[data-tick]', (el) => page.toggleTick(el.dataset.tick)],
    ['[data-taxi]', (el) => taxi.open(places()[el.dataset.taxi])],
    ['[data-map-mode]', (el) => page.setMapMode(el)],
    ['[data-memory]', (el) => viewer.open(dayMemories(), Number(el.dataset.memory))],
    ['[data-photo]', (el) => viewer.open(stopPhotos(el.closest('.stop').dataset.place), Number(el.dataset.photo))],
    ['[data-strip]', (el) => scrollStrip(el)],
    ['.stop-toggle', (el) => setPanel(el, el.getAttribute('aria-expanded') !== 'true', places())],
  ];
  const anyAction = actions.map(([selector]) => selector).join(', ');

  document.addEventListener('click', (event) => {
    const target = event.target.closest(anyAction);
    if (!target) return;
    const [, act] = actions.find(([selector]) => target.matches(selector));
    act(target);
  });
}
