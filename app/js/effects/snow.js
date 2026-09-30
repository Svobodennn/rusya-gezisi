// Snow falling on the hero's canvas. Pauses off screen and in a hidden tab; under reduced motion it lies still.
// The flakes are soft dots, so the canvas is drawn at one pixel per CSS pixel and 30 frames a second: on a 2x screen
// that is a quarter of the pixels to fill and hand to the compositor, half as often, and it looks the same.
import { onReducedMotionChange, prefersReducedMotion } from '../lib/motion.js';

export function startSnow(canvas) {
  const context = canvas.getContext('2d');
  if (!context) return () => {};
  const FRAME_MS = 30;
  let flakes = [];
  let width = 0;
  let height = 0;
  let frame = 0;
  let last = 0;
  let onScreen = true;

  const flake = (anywhere) => {
    const r = 0.6 + Math.random() ** 2 * 2.6;
    return {
      x: Math.random() * width,
      y: anywhere ? Math.random() * height : -6,
      r,
      fall: 12 + r * 15,
      phase: Math.random() * Math.PI * 2,
      sway: 5 + Math.random() * 16,
      alpha: 0.3 + Math.random() * 0.6,
    };
  };

  const paint = (dt) => {
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#fff';
    flakes.forEach((f, i) => {
      if (dt) {
        f.y += f.fall * dt;
        f.phase += dt * 0.7;
        if (f.y > height + 6) flakes[i] = flake(false);
      }
      context.globalAlpha = f.alpha;
      context.beginPath();
      context.arc(f.x + Math.sin(f.phase) * f.sway, f.y, f.r, 0, Math.PI * 2);
      context.fill();
    });
    context.globalAlpha = 1;
  };

  const tick = (now) => {
    frame = requestAnimationFrame(tick);
    if (last && now - last < FRAME_MS) return;
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
    last = now;
    paint(dt);
  };

  const run = () => {
    cancelAnimationFrame(frame);
    last = 0;
    if (prefersReducedMotion()) paint(0);
    else if (onScreen && !document.hidden) frame = requestAnimationFrame(tick);
  };

  const resize = () => {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.round(width);
    canvas.height = Math.round(height);
    flakes = Array.from({ length: Math.round(Math.min(170, (width * height) / 7500)) }, () => flake(true));
    run();
  };

  const sizeWatch = new ResizeObserver(resize);
  const viewWatch = new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    canvas.parentElement?.toggleAttribute('data-offscreen', !onScreen);
    run();
  });
  sizeWatch.observe(canvas);
  viewWatch.observe(canvas);
  document.addEventListener('visibilitychange', run);
  const stopWatchingMotion = onReducedMotionChange(run);
  return () => {
    cancelAnimationFrame(frame);
    sizeWatch.disconnect();
    viewWatch.disconnect();
    document.removeEventListener('visibilitychange', run);
    stopWatchingMotion();
  };
}
