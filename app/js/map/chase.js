// The garland's chaser: every third bulb lit and the lit set stepping one bulb along every 0.4 s, as real chase
// lights do. Stepped by a timer rather than a CSS animation, so between steps the page has nothing to redraw and a
// weak device can rest; CSS turns the phase (data-chase 0–2) into the dash offset.
const STEP_MS = 400;

export function startChase(lights, { paused }) {
  let phase = 0;
  const timer = setInterval(() => {
    if (paused()) return;
    phase = (phase + 1) % 3;
    lights.setAttribute('data-chase', String(phase));
  }, STEP_MS);
  return () => clearInterval(timer);
}
