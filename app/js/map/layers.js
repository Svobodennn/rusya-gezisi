// The map's SVG: the frame of stacked layers, and the city's base drawing built from the OSM data.
import { svgEl } from '../lib/svg.js';
import { finite } from './geometry.js';
import { createLabelLayer } from './labels.js';
import { POI_KINDS, placesOf } from './names.js';

const COLOUR = /^#[0-9a-f]{3,8}$/i;
const TOP_LAST = [3, 2, 1]; // tiers in paint order: the best-known places on top
const CONTROLS = [['zoom-in', 'i-plus', 'Yakınlaştır'], ['zoom-out', 'i-minus', 'Uzaklaştır'], ['recenter', 'i-target', 'Günün rotasına dön']];

const joinPaths = (list) => (Array.isArray(list) ? list.filter((d) => typeof d === 'string').join('') : '');
// Zero-length subpaths with round caps: every point a dot of the same screen size at any zoom.
const dotPath = (points) => points.map((p) => `M${p.x} ${p.y}h0`).join('');

// Base drawing under a camera group, route and names in screen space over it, pin buttons on top.
export function mountFrame(root) {
  const base = svgEl('svg', { class: 'map-svg', 'aria-hidden': 'true' });
  const cameraGroup = svgEl('g');
  base.append(cameraGroup);
  const overlay = svgEl('svg', { class: 'map-overlay', 'aria-hidden': 'true' });
  const labelGroup = svgEl('g', { class: 'm-labels', lang: 'ru' });
  const wire = svgEl('path', { class: 'route-wire' });
  const bulbs = svgEl('path', { class: 'route-bulbs' });
  const lights = svgEl('path', { class: 'route-lights' });
  const leaders = svgEl('path', { class: 'pin-leaders' });
  const anchors = svgEl('path', { class: 'pin-anchors' });
  overlay.append(labelGroup, wire, bulbs, lights, leaders, anchors);
  const pinLayer = document.createElement('div');
  pinLayer.className = 'map-pins';
  const note = document.createElement('p');
  note.className = 'map-note';
  note.hidden = true;
  const controls = document.createElement('div');
  controls.className = 'map-controls';
  controls.innerHTML = CONTROLS.map(([action, iconId, label]) => `<button type="button" class="map-control" `
    + `data-map-control="${action}" aria-label="${label}"><svg class="icon" aria-hidden="true"><use href="#${iconId}"/></svg></button>`).join('');
  root.replaceChildren(base, overlay, pinLayer, note, controls);
  return {
    cameraGroup, overlay, labels: createLabelLayer(labelGroup), wire, bulbs, lights, leaders, anchors, pinLayer, note, controls,
  };
}

// The screen box the zoom buttons take, with a margin, in the map's own pixels; null before the map is laid out.
export function controlsBox({ controls }, root) {
  const box = controls.getBoundingClientRect();
  const origin = root.getBoundingClientRect();
  return box.width
    ? { x0: box.left - origin.left - 4, x1: box.right - origin.left + 4, y0: box.top - origin.top - 4, y1: box.bottom - origin.top + 4 }
    : null;
}

export function baseLayers(data) {
  const layers = data.layers ?? {};
  const group = svgEl('g');
  const add = (cls, d, extra = {}, parent = group) => {
    if (d) parent.append(svgEl('path', { class: cls, d, ...extra }));
  };
  add('m-water-area', joinPaths(layers.water?.areas));
  add('m-park', joinPaths(layers.parks));
  add('m-water-line', joinPaths(layers.water?.lines));
  add('m-road-minor', joinPaths(layers.roads?.minor));
  add('m-rail', joinPaths(layers.rail));
  add('m-road-major', joinPaths(layers.roads?.major));
  (layers.metro ?? []).forEach((line) => {
    add('m-metro', typeof line.d === 'string' ? line.d : '', COLOUR.test(line.colour ?? '') ? { stroke: line.colour } : {});
  });
  add('m-station', dotPath((layers.stations ?? []).filter((s) => finite(s.x, s.y))));
  const landmarks = [];
  (layers.landmarks ?? []).forEach((mark) => {
    if (typeof mark.d !== 'string') return;
    const path = svgEl('path', { class: 'm-landmark', d: mark.d });
    group.append(path);
    landmarks.push({ place: mark.place, path });
  });
  return { group, landmarks, stopDots: placeDots(placesOf(layers), add, group) };
}

// Notable places over everything else: dots on a dark halo, coloured by kind, one path per tier and kind so CSS can
// show each tier from its level of detail (map/detail.js), the best known painted last. A place that is a trip stop
// gets a group of its own, which the route map hides while that stop has a pin.
function placeDots(pois, add, group) {
  const shared = pois.filter((p) => !p.stop);
  TOP_LAST.forEach((tier) => add(`m-poi-halo m-tier-${tier}`, dotPath(shared.filter((p) => p.tier === tier))));
  TOP_LAST.forEach((tier) => POI_KINDS.forEach((kind) => {
    add(`m-poi m-poi--${kind} m-tier-${tier}`, dotPath(shared.filter((p) => p.tier === tier && p.kind === kind)));
  }));
  return pois.filter((p) => p.stop).map((p) => {
    const node = svgEl('g');
    add(`m-poi-halo m-tier-${p.tier}`, dotPath([p]), {}, node);
    add(`m-poi m-poi--${p.kind} m-tier-${p.tier}`, dotPath([p]), {}, node);
    group.append(node);
    return { place: p.stop, node };
  });
}
