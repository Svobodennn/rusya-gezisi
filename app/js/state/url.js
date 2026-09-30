// What the address bar carries: a frozen clock for checking (?now=) and the day being viewed (#gun-N).

// ?now=2026-12-20T13:00:00Z freezes the clock, for checking a trip day before the trip.
export function readFixedNow() {
  const raw = new URLSearchParams(location.search).get('now');
  const parsed = raw ? new Date(raw) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
}

export function indexFromHash(dayCount) {
  const match = /^#gun-(\d+)$/.exec(location.hash);
  const n = match ? Number(match[1]) : NaN;
  return n >= 1 && n <= dayCount ? n - 1 : null;
}

// Today stays hash-less, so a reload the next morning opens the new today instead of yesterday.
export function syncHash(viewingToday, dayNumber) {
  const url = viewingToday ? location.pathname + location.search : `#gun-${dayNumber}`;
  history.replaceState(null, '', url);
}
