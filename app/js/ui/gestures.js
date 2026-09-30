// Changing the day without buttons: a horizontal swipe, or the arrow keys.

const SWIPE_MIN_PX = 70;
const SWIPE_RATIO = 1.6; // horizontal travel must beat vertical by this much, so scrolling never flips the day

// Only a single-finger swipe changes the day; a second finger means pinch-zoom and cancels it.
export function setupSwipe(el, onStep) {
  let start = null;
  el.addEventListener('pointerdown', (event) => {
    const ignored = !event.isPrimary || event.pointerType === 'mouse' || event.target.closest('a, button');
    start = ignored ? null : { x: event.clientX, y: event.clientY };
  });
  el.addEventListener('pointerup', (event) => {
    if (!start || !event.isPrimary) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    start = null;
    if (Math.abs(dx) > SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy) * SWIPE_RATIO) onStep(dx < 0 ? 1 : -1);
  });
  el.addEventListener('pointercancel', () => { start = null; });
}

export function setupArrowKeys(onStep, isBlocked) {
  document.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || isBlocked()) return;
    if (event.target.closest?.('.garland-scroll, input, textarea')) return;
    if (event.key === 'ArrowLeft') onStep(-1);
    if (event.key === 'ArrowRight') onStep(1);
  });
}
