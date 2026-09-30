// The map's level of detail: which dots and names the zoom allows, and where the names go. Pure: map and screen
// numbers in, numbers out.
import { labelBox, metresPerPixel, placeLabels } from './geometry.js';

// Ground metres per screen pixel at which level 1 (a district), 2 (a few streets) and 3 (a street corner) begin.
const LEVEL_STARTS = [25, 9, 4.5];
const DOT_REACH = 4; // a dot and its halo, in screen pixels: no name may cover it
const EDGE = 12; // names keep off the frame's gold hairline (8 px in)

export function detailLevel(camera, projection) {
  const mpp = metresPerPixel(camera, projection);
  return LEVEL_STARTS.filter((limit) => mpp <= limit).length;
}

// A place of tier t shows its dot from level t − 1 and its name from level t (the best known, tier 1, always a dot).
export const dotShown = (tier, level) => tier - 1 <= level;

const edges = ({ width, height }) => [
  { x0: -Infinity, x1: Infinity, y0: -Infinity, y1: EDGE }, { x0: -Infinity, x1: Infinity, y0: height - EDGE, y1: Infinity },
  { x0: -Infinity, x1: EDGE, y0: -Infinity, y1: Infinity }, { x0: width - EDGE, x1: Infinity, y0: -Infinity, y1: Infinity },
];

// The labels of `list` that `accept` allows and the frame can show, in order, each clear of `taken` and of the ones
// placed before it. A label whose box lies wholly off screen is dropped before anything is made for it.
function place(list, taken, { camera, size, accept }) {
  const kept = [];
  const positions = [];
  list.forEach((label) => {
    if (!accept(label)) return;
    const x = (label.x - camera.x) * camera.s + size.width / 2;
    const y = (label.y - camera.y) * camera.s + size.height / 2 + label.dy;
    if (x + label.halfW < 0 || x - label.halfW > size.width || y + label.halfH < 0 || y - label.halfH > size.height) return;
    kept.push(label);
    positions.push({ x, y });
  });
  const shown = placeLabels(kept, positions, taken, size);
  return kept.flatMap((label, i) => (shown[i] ? [{ label, ...positions[i] }] : []));
}

// The boxes of the dots on show at this level, on screen, of tier `upTo` or better.
function dotBoxes(dots, { camera, size, level }, upTo) {
  const boxes = [];
  dots.forEach((dot) => {
    if (dot.tier > upTo || !dotShown(dot.tier, level)) return;
    const x = (dot.x - camera.x) * camera.s + size.width / 2;
    const y = (dot.y - camera.y) * camera.s + size.height / 2;
    if (x < -DOT_REACH || x > size.width + DOT_REACH || y < -DOT_REACH || y > size.height + DOT_REACH) return;
    boxes.push({ x0: x - DOT_REACH, x1: x + DOT_REACH, y0: y - DOT_REACH, y1: y + DOT_REACH });
  });
  return boxes;
}

const boxesOf = (entries) => entries.map(({ label, x, y }) => labelBox(label, { x, y }));

// Area names first, clear of the pins and the map's controls (`pins`). Then the names this level allows, in their
// order of precedence, each clear of those, of the area names, of the frame's edge and of the names placed before
// it: the best-known (major) names may cover a lesser place's dot, as printed maps let a great name run over a small
// symbol, while every other name keeps clear of every dot on show. Returns the labels to show and where.
export function layoutMapLabels({ areas, names }, dots, { camera, size, pins, level }) {
  const view = { camera, size, level };
  const areasShown = place(areas, pins, { camera, size, accept: () => true });
  if (level < 1 || !names.length) return areasShown; // no name shows before level 1
  const taken = [...pins, ...boxesOf(areasShown), ...edges(size)];
  const allowed = (label) => label.level <= level;
  const major = place(names, [...taken, ...dotBoxes(dots, view, 1)], { camera, size, accept: (l) => allowed(l) && l.major });
  const others = place(names, [...taken, ...boxesOf(major), ...dotBoxes(dots, view, 3)], {
    camera, size, accept: (l) => allowed(l) && !l.major,
  });
  return [...areasShown, ...major, ...others];
}
