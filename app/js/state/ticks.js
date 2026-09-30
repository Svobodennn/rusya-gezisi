// "Gittik" ticks: kept on this device only, as a list of "<date>|<placeId or slotKey>" keys.

export const TICKS_KEY = 'rusya-gezisi.ticks.v1';

// The stored ticks, or null when storage is blocked (private mode) or unreadable.
function readStoredTicks() {
  try {
    return new Set(JSON.parse(localStorage.getItem(TICKS_KEY) ?? '[]'));
  } catch {
    return null;
  }
}

function storeTicks(ticks) {
  try {
    localStorage.setItem(TICKS_KEY, JSON.stringify([...ticks]));
  } catch {
    // Storage blocked (private mode): ticks still work for this visit.
  }
}

export function loadTicks() {
  return readStoredTicks() ?? new Set();
}

// Starts from storage, since another tab or the installed app may have ticked since this one loaded; when storage
// is blocked, the ticks this visit already holds are the truth.
export function toggleStoredTick(key, current) {
  const base = readStoredTicks() ?? current;
  const lighting = !base.has(key);
  const ticks = new Set(base);
  if (lighting) ticks.add(key);
  else ticks.delete(key);
  storeTicks(ticks);
  return { ticks, lighting };
}
