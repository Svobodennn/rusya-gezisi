// A city's base drawing: fetched once per visit, then drawn into the map's frame, or a note when it is missing.
import { loadJson } from '../state/load.js';
import { fallbackProjection, finite } from './geometry.js';
import { baseLayers } from './layers.js';

const loaded = new Map();

export function loadMapData(city) {
  if (!loaded.has(city)) loaded.set(city, loadJson(`map-${city}`));
  return loaded.get(city);
}

function hasProjection(data) {
  const projection = data?.projection;
  return Boolean(projection) && finite(projection.lon0, projection.lat0, projection.k);
}

// Draws the city into the frame, hands its names to the label layer, and returns what the route map keeps: the
// projection, the landmark footprints and the dots of places that are trip stops.
// Without a base map the stops still get a projection of their own, so the route stays drawable.
export function drawCity(frame, data, points) {
  if (hasProjection(data)) {
    const { group, landmarks, stopDots } = baseLayers(data);
    frame.cameraGroup.replaceChildren(group);
    frame.labels.setCity(data.layers ?? {});
    frame.note.hidden = true;
    return { projection: data.projection, landmarks, stopDots };
  }
  frame.cameraGroup.replaceChildren();
  frame.labels.setCity({});
  frame.note.textContent = 'Şehir altlığı yüklenemedi; duraklar yine doğru sırada.';
  frame.note.hidden = false;
  const projection = points.length ? fallbackProjection(points) : { lon0: 0, lat0: 0, k: 1 };
  return { projection, landmarks: [], stopDots: [] };
}

// Today's footprints light up; a place that is a trip stop pinned right now gives way to its pin, dot and name.
export function markPinned(frame, { landmarks, stopDots }, { today, pinned }) {
  landmarks.forEach(({ place, path }) => path.classList.toggle('is-today', today.has(place)));
  stopDots.forEach(({ place, node }) => node.toggleAttribute('hidden', pinned.has(place)));
  frame.labels.setPinned(pinned);
}
