// The memories strip's arrows: move the strip about one screenful of prints either way.
import { prefersReducedMotion } from '../lib/motion.js';

export function scrollStrip(button) {
  const album = button.closest('.memories')?.querySelector('.memory-album');
  if (!album) return;
  const step = Math.max(album.clientWidth * 0.8, 160) * Number(button.dataset.strip);
  album.scrollBy({ left: step, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}
