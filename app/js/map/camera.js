// Moves the map's camera to a new framing over 900 ms, easing in and out. Returns a function that stops it.
import { easeInOutCubic, interpolateCamera } from './geometry.js';

const TWEEN_MS = 900;

export function tweenCamera(from, to, onFrame) {
  let frame = 0;
  const started = performance.now();
  const step = (now) => {
    const t = easeInOutCubic(Math.min((now - started) / TWEEN_MS, 1));
    onFrame(interpolateCamera(from, to, t));
    if (t < 1) frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
  return () => cancelAnimationFrame(frame);
}
