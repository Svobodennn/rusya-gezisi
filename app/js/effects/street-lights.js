// Strings of street lights hung across the top of the hero, redrawn to the hero's width.
import { svgEl } from '../lib/svg.js';

const LIGHTS_HEIGHT = 170;
// Two strings, as across Tverskaya or Nevsky: a short tight one in front, a long deep one behind.
const STRINGS = [
  { span: 380, sag: 78, top: -6, offset: 0, gap: 27, r: 3.3 },
  { span: 560, sag: 132, top: -12, offset: 280, gap: 31, r: 2.6 },
];

// Bulbs sit on quadratic sags between hanging points; four groups twinkle out of step.
export function hangLights(svg) {
  const width = svg.clientWidth;
  if (!width) return;
  svg.setAttribute('viewBox', `0 0 ${width} ${LIGHTS_HEIGHT}`);
  const wires = svgEl('path', { class: 'string', d: '' });
  const groups = [1, 2, 3, 4].map((n) => svgEl('g', { class: `lights tw-${n}` }));
  let d = '';
  let count = 0;
  STRINGS.forEach(({ span, sag, top, offset, gap, r }) => {
    for (let x0 = -offset; x0 < width; x0 += span) {
      const x1 = x0 + span;
      const mid = (x0 + x1) / 2;
      d += `M${x0} ${top}Q${mid} ${top + sag * 2} ${x1} ${top}`;
      const steps = Math.max(2, Math.round(span / gap));
      for (let i = 1; i < steps; i += 1) {
        const t = i / steps;
        const x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * mid + t ** 2 * x1;
        const y = top + 2 * (1 - t) * t * sag * 2;
        if (x < -8 || x > width + 8 || y < 2) continue;
        count += 1;
        const bulb = svgEl('circle', { class: count % 3 === 0 ? 'light warm' : 'light', cx: x.toFixed(1), cy: (y + r + 1).toFixed(1), r });
        groups[count % 4].append(bulb);
      }
    }
  });
  wires.setAttribute('d', d);
  svg.replaceChildren(wires, ...groups);
}
