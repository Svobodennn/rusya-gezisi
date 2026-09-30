// Whether a slot's free-text plan line says anything the venue names do not. Pure.

const WORDS = /[\p{L}\p{N}']+/gu;
const wordsOf = (text) => (text ?? '').toLowerCase().replace(/’/g, "'").match(WORDS) ?? [];

// The plan line earns its place only when it says more than the venue names below it.
export function planAddsInfo(plan, places) {
  const names = new Set(places.flatMap((p) => [...wordsOf(p.name), ...wordsOf(p.nameEn)]));
  return wordsOf(plan).filter((word) => !names.has(word)).length >= 2;
}
