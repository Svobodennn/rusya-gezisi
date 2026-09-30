// The map's SVG: the frame of stacked layers, and the city's base drawing built from the OSM data.
import { svgEl } from '../lib/svg.js';

const COLOUR = /^#[0-9a-f]{3,8}$/i;
const LABEL_SIZE = { street: 10.5, default: 12.5 };
const CONTROLS = [['zoom-in', 'i-plus', 'Yakınlaştır'], ['zoom-out', 'i-minus', 'Uzaklaştır'], ['recenter', 'i-target', 'Günün rotasına dön']];

const joinPaths = (list) => (Array.isArray(list) ? list.filter((d) => typeof d === 'string').join('') : '');
export const finite = (...values) => values.every(Number.isFinite);

// Base drawing under a camera group, route and labels in screen space over it, pin buttons on top.
export function mountFrame(root) {
  const base = svgEl('svg', { class: 'map-svg', 'aria-hidden': 'true' });
  const cameraGroup = svgEl('g');
  base.append(cameraGroup);
  const overlay = svgEl('svg', { class: 'map-overlay', 'aria-hidden': 'true' });
  const labelGroup = svgEl('g', { class: 'm-labels', lang: 'ru' });
  const wire = svgEl('path', { class: 'route-wire' });
  const lights = svgEl('path', { class: 'route-lights' });
  const leaders = svgEl('path', { class: 'pin-leaders' });
  const anchors = svgEl('path', { class: 'pin-anchors' });
  overlay.append(labelGroup, wire, lights, leaders, anchors);
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
  return { cameraGroup, overlay, labelGroup, wire, lights, leaders, anchors, pinLayer, note, controls };
}

export function baseLayers(data) {
  const layers = data.layers ?? {};
  const group = svgEl('g');
  const add = (cls, d, extra = {}) => {
    if (d) group.append(svgEl('path', { class: cls, d, ...extra }));
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
  // Zero-length subpaths with round caps: every station a dot of the same screen size at any zoom.
  const stations = (layers.stations ?? []).filter((s) => finite(s.x, s.y));
  add('m-station', stations.map((s) => `M${s.x} ${s.y}h0`).join(''));
  const landmarks = [];
  (layers.landmarks ?? []).forEach((mark) => {
    if (typeof mark.d !== 'string') return;
    const path = svgEl('path', { class: 'm-landmark', d: mark.d });
    group.append(path);
    landmarks.push({ place: mark.place, path });
  });
  return { group, landmarks };
}

export function labelNodes(data) {
  return (data.layers?.labels ?? []).filter((label) => label.text && finite(label.x, label.y)).map((label) => {
    const kind = /^[a-z]+$/.test(label.kind ?? '') ? label.kind : 'default';
    const size = LABEL_SIZE[kind] ?? LABEL_SIZE.default;
    const node = svgEl('text', { class: `m-label m-label--${kind}`, 'font-size': size, 'text-anchor': 'middle', 'dominant-baseline': 'central' });
    node.textContent = label.text;
    const angle = Number(label.angle) || 0;
    // Oranienbaum with 0.24em tracking runs about 0.84em a letter.
    const w = String(label.text).length * size * 0.84;
    const h = size * 1.4;
    const rad = (angle * Math.PI) / 180;
    return {
      node, x: label.x, y: label.y, angle,
      halfW: (Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad))) / 2,
      halfH: (Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad))) / 2,
    };
  });
}
