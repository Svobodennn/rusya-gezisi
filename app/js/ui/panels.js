// A stop's notes panel: filled on first open, and reopened after a re-render if it was open before.
import { moreHtml } from '../views/stop-details.js';

export function openPanelIds(main) {
  return [...main.querySelectorAll('.stop-toggle[aria-expanded="true"]')].map((b) => b.getAttribute('aria-controls'));
}

export function setPanel(button, open, places, { restored = false } = {}) {
  const panel = button && document.getElementById(button.getAttribute('aria-controls'));
  if (!panel) return;
  if (open && !panel.dataset.filled) {
    panel.innerHTML = moreHtml(places[panel.dataset.place]);
    panel.dataset.filled = 'true';
  }
  if (restored) panel.dataset.restored = 'true';
  else delete panel.dataset.restored;
  panel.hidden = !open;
  button.setAttribute('aria-expanded', String(open));
}

export function reopenPanels(main, ids, places) {
  ids.forEach((id) => setPanel(main.querySelector(`[aria-controls="${CSS.escape(id)}"]`), true, places, { restored: true }));
}
