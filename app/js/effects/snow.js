// Snow falling on the hero's canvas. Pauses off screen and in a hidden tab; under reduced motion it lies still.
import { onReducedMotionChange, prefersReducedMotion } from '../lib/motion.js';

export function startSnow(canvas) {
  const context = canvas.getContext('2d');
  if (!context) return () => {};
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
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
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
    last = now;
    paint(dt);
    frame = requestAnimationFrame(tick);
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
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
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
