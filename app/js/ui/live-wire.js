// The lighting moment on the day's wire (which wires are live is decided in core/slots.js).
import { prefersReducedMotion } from '../lib/motion.js';

// The one authored moment: the filament warms up and current runs on to the next bulb.
export function playLighting(main, key) {
  const slot = main.querySelector(`[data-tick="${CSS.escape(key)}"]`)?.closest('.slot');
  const bulb = slot?.querySelector('.slot-rail .bulb');
  const once = (el, cls) => {
    el.classList.add(cls);
    el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
  };
  if (prefersReducedMotion()) return;
  if (bulb?.dataset.state === 'lit') once(bulb, 'is-warming');
  main.querySelectorAll('.wire[data-live]').forEach((wire) => once(wire, 'is-flowing'));
}
