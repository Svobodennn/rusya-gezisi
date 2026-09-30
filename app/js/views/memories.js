// The day's memories, at the end of the day: its photos on a strip of album page that scrolls sideways, each print
// held by paper corners.
import { esc, icon } from './html.js';

const EMPTY_SLOTS = 3;

function note(photo) {
  return [photo.time, photo.caption].filter(Boolean).map(esc).join(' · ');
}

function photoHtml(photo, i, count) {
  const text = note(photo);
  const label = `Hatıra ${i + 1} / ${count}${text ? `: ${text}` : ''}. Büyütmek için dokunun.`;
  return `<li class="memory">
      <button type="button" class="memory-open" data-memory="${i}" aria-label="${label}">
        <img class="memory-img" src="${esc(photo.thumb)}" width="${Number(photo.w)}" height="${Number(photo.h)}" alt="" loading="lazy" decoding="async">
        <span class="memory-corners" aria-hidden="true"></span>
      </button>
      ${text ? `<p class="memory-note">${text}</p>` : ''}
    </li>`;
}

// Mouse users get arrows; on touch screens the strip is simply swiped (the arrows are hidden by CSS there).
function stripNav() {
  return `<div class="strip-nav">
      <button type="button" class="strip-btn" data-strip="-1" aria-label="Önceki fotoğraflar">${icon('i-left')}</button>
      <button type="button" class="strip-btn" data-strip="1" aria-label="Sonraki fotoğraflar">${icon('i-right')}</button>
    </div>`;
}

export function memoriesHtml(photos = []) {
  const title = '<h2 class="section-title" id="memories-title">Hatıralar<span lang="ru">воспоминания</span></h2>';
  if (!photos.length) {
    const slots = '<li class="memory memory--empty" aria-hidden="true"><span class="memory-open"><span class="memory-corners"></span></span></li>'.repeat(EMPTY_SLOTS);
    return `<section class="memories glass" aria-labelledby="memories-title">
      <div class="memories-head">${title}</div>
      <p class="memories-empty">Günün fotoğrafları eklenince burada, albüm şeridinde duracak.</p>
      <ol class="memory-album memory-album--empty">${slots}</ol>
    </section>`;
  }
  const items = photos.map((photo, i) => photoHtml(photo, i, photos.length)).join('');
  return `<section class="memories glass" aria-labelledby="memories-title">
      <div class="memories-head">${title}<span class="memories-count">${photos.length} fotoğraf</span>${stripNav()}</div>
      <ol class="memory-album" aria-label="Günün fotoğrafları, yana kaydırılır">${items}</ol>
    </section>`;
}
