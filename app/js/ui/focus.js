// Keyboard focus across re-renders: remember what had it, give it back to the element that replaced it.

export function rememberFocus() {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  if (el.dataset?.tick) return { tick: el.dataset.tick };
  if (el.dataset?.dir) return { dir: el.dataset.dir };
  if (el.matches('.stop-toggle')) return { toggle: el.getAttribute('aria-controls') };
  if (el.closest('.day-nav, #garland, #hero')) return { heading: true };
  return null;
}

// A render the user did not start (clock, another tab) must never move the page.
export function restoreFocus(memo, main, background) {
  if (!memo) return;
  const target = memo.tick ? main.querySelector(`[data-tick="${CSS.escape(memo.tick)}"]`)
    : memo.toggle ? main.querySelector(`[aria-controls="${CSS.escape(memo.toggle)}"]`)
      : memo.dir && main.querySelector(`.nav-btn[data-dir="${CSS.escape(memo.dir)}"]:not([disabled])`);
  (target || document.getElementById('hero-title'))?.focus({ preventScroll: background || Boolean(target) });
}
