// The route map by hand: the mouse or one finger drags it sideways, two fingers pan and pinch, Ctrl + wheel (or a
// trackpad pinch) zooms, and the corner buttons zoom or bring back the day's route. A vertical one-finger swipe still
// scrolls the page (touch-action: pan-y), so the map never traps the phone's scrolling.

const WHEEL_STEP = 0.0035;
const BUTTON_ZOOM = 1.6;

const midpoint = ([a, b]) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const spread = ([a, b]) => Math.hypot(a.x - b.x, a.y - b.y);

export function enableMapInteraction({ root, controls }, { begin, pan, zoom, recenter }) {
  const pointers = new Map();
  const local = (event) => {
    const box = root.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };
  const centre = () => ({ x: root.clientWidth / 2, y: root.clientHeight / 2 });

  root.addEventListener('pointerdown', (event) => {
    if (event.target.closest('.pin, .map-controls') || (event.pointerType === 'mouse' && event.button !== 0)) return;
    pointers.set(event.pointerId, local(event));
    root.setPointerCapture(event.pointerId);
    root.classList.add('is-dragging');
    begin();
  });

  root.addEventListener('pointermove', (event) => {
    if (!pointers.has(event.pointerId)) return;
    const before = [...pointers.values()];
    pointers.set(event.pointerId, local(event));
    const after = [...pointers.values()];
    if (after.length === 1) {
      pan(after[0].x - before[0].x, after[0].y - before[0].y);
    } else if (after.length === 2) {
      const [from, to] = [midpoint(before), midpoint(after)];
      zoom(spread(after) / Math.max(spread(before), 1), to);
      pan(to.x - from.x, to.y - from.y);
    }
  });

  const release = (event) => {
    pointers.delete(event.pointerId);
    if (!pointers.size) root.classList.remove('is-dragging');
  };
  root.addEventListener('pointerup', release);
  root.addEventListener('pointercancel', release);

  // A plain wheel scrolls the page, as on any embedded map; Ctrl + wheel (a trackpad pinch sends it too) zooms.
  root.addEventListener('wheel', (event) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    begin();
    zoom(Math.exp(-event.deltaY * WHEEL_STEP * (event.deltaMode === 1 ? 16 : 1)), local(event));
  }, { passive: false });

  controls.addEventListener('click', (event) => {
    const action = event.target.closest('[data-map-control]')?.dataset.mapControl;
    if (action === 'recenter') recenter();
    else if (action) zoom(action === 'zoom-in' ? BUTTON_ZOOM : 1 / BUTTON_ZOOM, centre(), { animate: true });
  });
}
