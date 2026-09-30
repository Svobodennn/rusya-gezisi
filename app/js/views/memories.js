// The day's memories, at the end of the day: its photos as an old album page, each held by paper corners.
import { esc } from './html.js';

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

export function memoriesHtml(photos = []) {
  const title = '<h2 class="section-title" id="memories-title">Hatıralar<span lang="ru">воспоминания</span></h2>';
  if (!photos.length) {
    const slots = '<li class="memory memory--empty" aria-hidden="true"><span class="memory-open"><span class="memory-corners"></span></span></li>'.repeat(EMPTY_SLOTS);
    return `<section class="memories glass" aria-labelledby="memories-title">${title}
      <p class="memories-empty">Günün fotoğrafları eklenince burada, albüm sayfasında duracak.</p>
      <ol class="memory-album memory-album--empty">${slots}</ol>
    </section>`;
  }
  const items = photos.map((photo, i) => photoHtml(photo, i, photos.length)).join('');
  return `<section class="memories glass" aria-labelledby="memories-title">${title}<ol class="memory-album">${items}</ol></section>`;
}
