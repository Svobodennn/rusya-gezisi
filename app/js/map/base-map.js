// A city's base drawing: fetched once per visit, then drawn into the map's frame, or a note when it is missing.
import { loadJson } from '../state/load.js';
import { fallbackProjection } from './geometry.js';
import { baseLayers, finite, labelNodes } from './layers.js';

const loaded = new Map();

export function loadMapData(city) {
  if (!loaded.has(city)) loaded.set(city, loadJson(`map-${city}`));
  return loaded.get(city);
}

function hasProjection(data) {
  const projection = data?.projection;
  return Boolean(projection) && finite(projection.lon0, projection.lat0, projection.k);
}

// Draws the city into the frame and returns what the route map keeps: projection, landmark paths, label nodes.
// Without a base map the stops still get a projection of their own, so the route stays drawable.
export function drawCity(frame, data, points) {
  if (hasProjection(data)) {
    const { group, landmarks } = baseLayers(data);
    const labels = labelNodes(data);
    frame.cameraGroup.replaceChildren(group);
    frame.labelGroup.replaceChildren(...labels.map((label) => label.node));
    frame.note.hidden = true;
    return { projection: data.projection, landmarks, labels };
  }
  frame.cameraGroup.replaceChildren();
  frame.labelGroup.replaceChildren();
  frame.note.textContent = 'Şehir altlığı yüklenemedi; duraklar yine doğru sırada.';
  frame.note.hidden = false;
  const projection = points.length ? fallbackProjection(points) : { lon0: 0, lat0: 0, k: 1 };
  return { projection, landmarks: [], labels: [] };
}
