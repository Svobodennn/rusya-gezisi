// The map's names as data: which notable places, metro stations and areas can be named, in what order, on how many
// lines and in how big a box. Pure: map data in, plain objects out.
import { finite } from './geometry.js';

export const POI_KINDS = ['sight', 'historic', 'museum', 'theatre', 'church'];
export const LINE_EM = 1.2;
const TIERS = [1, 2, 3];
const LANGS = ['tr', 'en', 'ru'];
const LABEL_SIZE = { street: 10.5, major: 12, place: 10.5, metro: 10, default: 12.5 };
// Letter width in em: Oranienbaum with 0.24em tracking for area names, the condensed sign face for the rest.
const PER_CHAR = { major: 0.5, place: 0.5, metro: 0.5, default: 0.84 };

// The notable places the map can show: a known kind and tier at a finite point.
export const placesOf = (layers) => (layers.pois ?? [])
  .filter((p) => POI_KINDS.includes(p.kind) && TIERS.includes(p.tier) && finite(p.x, p.y));

// What names keep clear of: every place's dot, and the station dots, which grow from level 2 on (as a tier-3 dot
// shows). A dot that is a trip stop carries the stop's id, so it can give way while that stop has a pin.
export function obstacleDots(layers) {
  return [
    ...placesOf(layers).map(({ x, y, tier, stop }) => ({ x, y, tier, stop: stop ?? null })),
    ...(layers.stations ?? []).filter((s) => finite(s.x, s.y)).map(({ x, y }) => ({ x, y, tier: 3, stop: null })),
  ];
}

// Every way to cut n words into `count` runs, as the index after each run.
function cuts(n, count) {
  if (count < 2) return [[n]];
  const out = [];
  for (let a = 1; a <= n - count + 1; a += 1) {
    if (count === 2) out.push([a, n]);
    else for (let b = a + 1; b < n; b += 1) out.push([a, b, n]);
  }
  return out;
}

// A long name breaks at its spaces into two or three lines, the way printed maps set them: the split whose longest
// line is shortest and, among those, the most even one.
export function wrapLabel(text, maxLine = 22) {
  const words = text.trim().split(/\s+/);
  const count = Math.min(3, words.length, Math.ceil(words.join(' ').length / maxLine));
  let best = null;
  cuts(words.length, count).forEach((ends) => {
    const lines = ends.map((end, i) => words.slice(i ? ends[i - 1] : 0, end).join(' '));
    const longest = Math.max(...lines.map((line) => line.length));
    const spread = lines.reduce((sum, line) => sum + line.length ** 2, 0);
    if (!best || longest < best.longest || (longest === best.longest && spread < best.spread)) best = { lines, longest, spread };
  });
  return best.lines;
}

function spec(label) {
  const kind = /^[a-z]+$/.test(label.kind ?? '') ? label.kind : 'default';
  const size = LABEL_SIZE[kind] ?? LABEL_SIZE.default;
  const lines = label.detail ? wrapLabel(String(label.text)) : [String(label.text)];
  const angle = Number(label.angle) || 0;
  const w = Math.max(...lines.map((line) => line.length)) * size * (PER_CHAR[kind] ?? PER_CHAR.default);
  const h = size * (LINE_EM * lines.length + 0.2);
  const rad = (angle * Math.PI) / 180;
  return {
    kind, size, lines, angle, x: label.x, y: label.y, level: label.level, detail: label.detail, major: kind === 'major',
    lang: LANGS.includes(label.lang) ? label.lang : null, stop: label.stop ?? null,
    dy: label.detail ? 5 + h / 2 : 0, // a place's name hangs just under its dot
    halfW: (Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad))) / 2,
    halfH: (Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad))) / 2,
  };
}

// Every name the map can show: area names at any zoom; then, each from its level of detail on and in this order of
// precedence, the best-known places, the metro stations and the other places, the better known first.
export function labelSpecs(layers) {
  const pois = placesOf(layers);
  const place = (p) => ({
    text: p.name, lang: p.lang, x: p.x, y: p.y, kind: p.tier === 1 ? 'major' : 'place', level: p.tier, stop: p.stop,
  });
  const station = (s) => ({ text: s.name, lang: s.lang, x: s.x, y: s.y, kind: 'metro', level: 2 });
  const named = (label) => label.text && finite(label.x, label.y);
  const names = [...pois.filter((p) => p.tier === 1).map(place), ...(layers.stationNames ?? []).map(station),
    ...pois.filter((p) => p.tier > 1).map(place)];
  return {
    areas: (layers.labels ?? []).filter(named).map((label) => spec({ ...label, level: 0, detail: false })),
    names: names.filter(named).map((label) => spec({ ...label, detail: true })),
  };
}
