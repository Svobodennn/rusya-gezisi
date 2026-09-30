// The names on the map as SVG text: laid out each frame by map/detail.js and drawn with as few DOM writes as a frame
// allows. A name's node is made the first time it shows; after that only names that appear, move or go are touched.
import { svgEl } from '../lib/svg.js';
import { layoutMapLabels } from './detail.js';
import { LINE_EM, labelSpecs, obstacleDots } from './names.js';

function textNode(spec) {
  const node = svgEl('text', {
    class: `m-label m-label--${spec.kind}`, 'font-size': spec.size, 'text-anchor': 'middle', 'dominant-baseline': 'central',
  });
  if (spec.lines.length === 1) {
    node.textContent = spec.lines[0];
  } else {
    // Each line re-anchors at x = 0, so every line centres under the dot; the block centres on the label's point.
    node.append(...spec.lines.map((line, i) => {
      const span = svgEl('tspan', { x: 0, dy: `${i ? LINE_EM : (-(spec.lines.length - 1) * LINE_EM) / 2}em` });
      span.textContent = line;
      return span;
    }));
  }
  if (spec.lang) node.setAttribute('lang', spec.lang);
  return node;
}

export function createLabelLayer(group) {
  let city = { areas: [], names: [], dots: [] };
  let names = [];
  let dots = [];
  let nodes = new Map(); // label → its <text>, once it has shown
  let drawn = new Map(); // label → the transform it has on screen now

  return {
    // A new city: its names and dots, and no nodes until a name first shows.
    setCity(layers) {
      city = { ...labelSpecs(layers), dots: obstacleDots(layers) };
      names = city.names;
      dots = city.dots;
      nodes = new Map();
      drawn = new Map();
      group.replaceChildren();
    },
    // A place that is a stop pinned right now gives way to the pin: its name and dot drop out.
    setPinned(pinned) {
      names = city.names.filter((label) => !pinned.has(label.stop));
      dots = city.dots.filter((dot) => !pinned.has(dot.stop));
    },
    // quiet: only the area names, while the camera glides and the pins' boxes are still the destination's.
    draw({ camera, size, pins, level, quiet }) {
      const next = new Map();
      layoutMapLabels({ areas: city.areas, names: quiet ? [] : names }, dots, { camera, size, pins, level })
        .forEach(({ label, x, y }) => {
          const transform = `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${label.angle})`;
          let node = nodes.get(label);
          if (!node) {
            node = textNode(label);
            nodes.set(label, node);
            group.append(node);
          } else if (!drawn.has(label)) {
            node.removeAttribute('hidden');
          }
          if (drawn.get(label) !== transform) node.setAttribute('transform', transform);
          next.set(label, transform);
        });
      drawn.forEach((_, label) => {
        if (!next.has(label)) nodes.get(label).setAttribute('hidden', '');
      });
      drawn = next;
    },
  };
}
