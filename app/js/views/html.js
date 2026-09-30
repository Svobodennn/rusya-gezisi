// Safe markup primitives shared by every view: escaping, Russian tagging, URL filtering, icons.

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// Sofia Sans draws Bulgarian letterforms unless the text is tagged Russian, so Cyrillic runs get lang="ru".
// Runs start and end on Cyrillic or digits and never contain '&', so an escaped entity is never split.
const CYRILLIC_RUN = /[Ѐ-ӿ](?:[Ѐ-ӿ\d\s.,:;«»№()\-–—/]*[Ѐ-ӿ\d»)])?/g;

export function ruText(value) {
  return esc(value).replace(CYRILLIC_RUN, (run) => `<span lang="ru">${run}</span>`);
}

export function safeUrl(url) {
  return /^https?:\/\//.test(url ?? '') ? url : null;
}

export function icon(id) {
  return `<svg class="icon" aria-hidden="true"><use href="#${id}"/></svg>`;
}

// A photograph's source: a link when its page is a web address, plain text otherwise.
export function sourceLink(page, credit) {
  const url = safeUrl(page);
  return url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(credit)}</a>` : esc(credit);
}

// One label for both states: a toggle's name must not change, aria-pressed carries the state.
export function tickButton(key, ticked, label, describedBy) {
  return `<button type="button" class="act act--tick" data-tick="${esc(key)}" aria-pressed="${ticked}" aria-describedby="${describedBy}">`
    + `${icon('i-bulb')}${label}</button>`;
}
