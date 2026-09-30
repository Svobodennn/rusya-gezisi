// The route map's arithmetic: camera fitting and easing, the garland's curve, pin fan-out and label placement.
// Pure: screen-space numbers in, numbers out.

const METRES_PER_DEGREE = 111_320;
const MIN_SPAN_M = 1600; // closest zoom: a day's stops are never shown across less than ~1.6 km
const PAD_WIDE = { t: 64, r: 150, b: 56, l: 56 };
const PAD_NARROW = { t: 56, r: 48, b: 48, l: 48 };
const PAD_CITY = { t: 40, r: 40, b: 40, l: 40 };
const FAN_GAP = 34; // bulbs closer than this on screen would cover each other's numbers

export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const overlaps = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

export function toScreen(point, camera, { width, height }) {
  return { x: (point.x - camera.x) * camera.s + width / 2, y: (point.y - camera.y) * camera.s + height / 2 };
}

function metresPerUnit({ lat0, k }) {
  return (METRES_PER_DEGREE * Math.cos((lat0 * Math.PI) / 180)) / k;
}

// The camera that frames the points inside the mode's padding, never closer than MIN_SPAN_M.
export function fitCamera(points, { width, height, mode, projection }) {
  const pad = mode === 'city' ? PAD_CITY : width < 560 ? PAD_NARROW : PAD_WIDE;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const box = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  const innerW = Math.max(width - pad.l - pad.r, 40);
  const innerH = Math.max(height - pad.t - pad.b, 40);
  const maxScale = Math.min(innerW, innerH) / (MIN_SPAN_M / metresPerUnit(projection));
  const s = Math.min(innerW / Math.max(box.x1 - box.x0, 1e-6), innerH / Math.max(box.y1 - box.y0, 1e-6), maxScale);
  // The map point that must sit at the padded area's centre, re-expressed as the point at the element's centre.
  const x = (box.x0 + box.x1) / 2 - (pad.l + innerW / 2 - width / 2) / s;
  const y = (box.y0 + box.y1) / 2 - (pad.t + innerH / 2 - height / 2) / s;
  return { x, y, s };
}

// Without stops to frame: the whole 1000-unit-wide drawing, centred.
export function overviewCamera({ width, height }, mapHeight = 600) {
  return { x: 500, y: mapHeight / 2, s: Math.min(width, height) / 1000 };
}

// Moving the map by a drag of dx, dy screen pixels.
export function panBy(camera, dx, dy) {
  return { ...camera, x: camera.x - dx / camera.s, y: camera.y - dy / camera.s };
}

// Zooming by a factor while the map point under `at` (screen pixels) stays under it; the scale stays within limits.
export function zoomAt(camera, factor, at, { width, height }, { min, max }) {
  const s = Math.min(max, Math.max(min, camera.s * factor));
  const x = camera.x + (at.x - width / 2) / camera.s;
  const y = camera.y + (at.y - height / 2) / camera.s;
  return { x: x - (at.x - width / 2) / s, y: y - (at.y - height / 2) / s, s };
}

// How far a visitor may zoom: out to the whole city drawing, in to a few streets (about 350 m across).
export function scaleLimits({ width, height }, projection, mapHeight = 600) {
  return {
    min: Math.min(width / 1000, height / mapHeight) * 0.8,
    max: Math.min(width, height) / (350 / metresPerUnit(projection)),
  };
}

// The camera's centre stays over the drawing, so the city can never be dragged off into the dark.
export function clampCamera(camera, mapHeight = 600) {
  return { ...camera, x: Math.min(1000, Math.max(0, camera.x)), y: Math.min(mapHeight, Math.max(0, camera.y)) };
}

export function interpolateCamera(from, to, t) {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    s: Math.exp(Math.log(from.s) + (Math.log(to.s) - Math.log(from.s)) * t),
  };
}

export function isSameCamera(a, b) {
  return Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01 && Math.abs(a.s / b.s - 1) < 1e-4;
}

// Without a base map the stops still get a projection of their own, so the route stays drawable.
export function fallbackProjection(points) {
  const lons = points.map((p) => p.lon);
  const lats = points.map((p) => p.lat);
  const west = Math.min(...lons) - 0.02;
  const east = Math.max(...lons) + 0.02;
  return { lon0: west, lat0: Math.max(...lats) + 0.01, k: 1000 / Math.max(east - west, 0.01) };
}

// The city view frames where the stops cluster; one far point (the airport) must not shrink the whole city.
export function withoutOutliers(points) {
  if (points.length < 5) return points;
  const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const cx = median(points.map((p) => p.x));
  const cy = median(points.map((p) => p.y));
  const distances = points.map((p) => Math.hypot(p.x - cx, p.y - cy));
  const limit = 3 * median(distances);
  return points.filter((_, i) => distances[i] <= limit);
}

// Each hop between two stops hangs like a string of lights: a quadratic sag proportional to its length.
export function garlandPath(points) {
  let d = '';
  points.forEach((p, i) => {
    if (i === 0) {
      d = `M${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      return;
    }
    const a = points[i - 1];
    const length = Math.hypot(p.x - a.x, p.y - a.y);
    if (length < 1) return;
    const sag = Math.min(80, length * 0.22);
    d += `Q${((a.x + p.x) / 2).toFixed(1)} ${((a.y + p.y) / 2 + sag).toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  });
  return d;
}

// Bulbs that would overlap are fanned out on a small ring around their centre, in visit order, starting from the
// side the first of them actually lies on; a leader line keeps each bulb tied to its true spot.
export function fanOffsets(points) {
  const clusters = [];
  points.forEach((q, i) => {
    const home = clusters.find((members) => members.some((j) => Math.hypot(points[j].x - q.x, points[j].y - q.y) < FAN_GAP));
    if (home) home.push(i);
    else clusters.push([i]);
  });
  const offsets = points.map(() => ({ dx: 0, dy: 0 }));
  clusters.filter((members) => members.length > 1).forEach((members) => {
    const cx = members.reduce((sum, j) => sum + points[j].x, 0) / members.length;
    const cy = members.reduce((sum, j) => sum + points[j].y, 0) / members.length;
    const first = points[members[0]];
    const start = Math.hypot(first.x - cx, first.y - cy) > 0.5 ? Math.atan2(first.y - cy, first.x - cx) : -Math.PI / 2;
    const radius = Math.max(22, 20 / Math.sin(Math.PI / members.length));
    members.forEach((j, k) => {
      const angle = start + (2 * Math.PI * k) / members.length;
      offsets[j] = { dx: cx + radius * Math.cos(angle) - points[j].x, dy: cy + radius * Math.sin(angle) - points[j].y };
    });
  });
  return offsets;
}

// Bulbs fan out first (when asked), then each label goes right of its bulb where it fits, else left, else none.
// Returns each pin's offset and label side, and every box now taken (bulbs, then placed labels).
export function layoutPins(points, labelWidths, { width, fan, labels }) {
  const offsets = fan ? fanOffsets(points) : points.map(() => ({ dx: 0, dy: 0 }));
  const placed = points.map((p, i) => ({ x: p.x + offsets[i].dx, y: p.y + offsets[i].dy }));
  const boxes = placed.map((q) => ({ x0: q.x - 20, x1: q.x + 20, y0: q.y - 20, y1: q.y + 20 }));
  const sides = placed.map((q, i) => {
    if (!labels || !labelWidths[i]) return null;
    const right = { x0: q.x + 22, x1: q.x + 30 + labelWidths[i], y0: q.y - 13, y1: q.y + 13 };
    const left = { x0: q.x - 30 - labelWidths[i], x1: q.x - 22, y0: q.y - 13, y1: q.y + 13 };
    const fits = (box) => box.x0 >= 6 && box.x1 <= width - 6 && !boxes.some((other, j) => j !== i && overlaps(other, box));
    const side = fits(right) ? 'right' : fits(left) ? 'left' : null;
    if (side) boxes.push(side === 'right' ? right : left);
    return side;
  });
  return { offsets, sides, boxes };
}

// Map labels in list order: each shows only inside the frame and clear of pins and of the labels before it.
export function placeLabels(labels, positions, taken, { width, height }) {
  const boxes = [...taken];
  return labels.map((label, i) => {
    const q = positions[i];
    const box = { x0: q.x - label.halfW, x1: q.x + label.halfW, y0: q.y - label.halfH, y1: q.y + label.halfH };
    const inside = box.x0 > 4 && box.y0 > 4 && box.x1 < width - 4 && box.y1 < height - 4;
    const show = inside && !boxes.some((other) => overlaps(other, box));
    if (show) boxes.push(box);
    return show;
  });
}
