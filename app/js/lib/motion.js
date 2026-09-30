// The visitor's reduced-motion preference, read lazily so modules stay importable outside a browser.

const QUERY = '(prefers-reduced-motion: reduce)';
let media = null;
const query = () => {
  media ??= matchMedia(QUERY);
  return media;
};

export function prefersReducedMotion() {
  return query().matches;
}

export function onReducedMotionChange(listener) {
  const list = query();
  list.addEventListener('change', listener);
  return () => list.removeEventListener('change', listener);
}
