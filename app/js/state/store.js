// The page's single source of truth: a frozen snapshot replaced whole by set(patch). The values it holds (the trip,
// the tick Set) are never edited in place either: a change always arrives as a new value.

export function createStore(initial) {
  let snapshot = Object.freeze({ ...initial });
  return {
    get: () => snapshot,
    set(patch) {
      snapshot = Object.freeze({ ...snapshot, ...patch });
      return snapshot;
    },
  };
}
