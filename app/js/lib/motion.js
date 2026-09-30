// Whether things may move on their own: not when the visitor's system asks for reduced motion, nor in the light look
// (html[data-lite]) for weak devices. Read lazily, so modules stay importable outside a browser.

const QUERY = '(prefers-reduced-motion: reduce)';
let media = null;
const query = () => {
  media ??= matchMedia(QUERY);
  return media;
};

export function prefersReducedMotion() {
  return query().matches || document.documentElement.hasAttribute('data-lite');
}

export function onReducedMotionChange(listener) {
  const list = query();
  list.addEventListener('change', listener);
  return () => list.removeEventListener('change', listener);
}
