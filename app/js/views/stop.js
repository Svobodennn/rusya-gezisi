// One stop: its photo plate, name, warnings, Cyrillic address and actions.
import { isGone, tickKey } from '../core/slots.js';
import { yandexTransitUrl } from '../core/links.js';
import { esc, icon, ruText, sourceLink, tickButton } from './html.js';
import { corners } from './ornaments.js';

const FLAG_ICONS = { warn: 'i-warn', info: 'i-info', moved: 'i-moved', closed: 'i-dead', not_found: 'i-dead' };

function flagHtml(flag) {
  return `<p class="flag" data-level="${esc(flag.level)}">${icon(FLAG_ICONS[flag.level] ?? 'i-info')}<span>${ruText(flag.text)}</span></p>`;
}

function actionsHtml(place, key, ticked, nameId) {
  const gone = isGone(place);
  const described = `aria-describedby="${nameId}"`;
  const route = place.lat != null && !gone
    ? `<a class="act" href="${esc(yandexTransitUrl(place.lat, place.lon))}" target="_blank" rel="noopener" ${described}>${icon('i-route')}Rota</a>`
    : '';
  const address = place.address && !gone
    ? `<button type="button" class="act" data-taxi="${esc(place.id)}" ${described}>${icon('i-plate')}Adres</button>`
    : '';
  return route + address + tickButton(key, ticked, gone ? 'Başka yere gittik' : 'Gittik', nameId);
}

// The photographs as one framed plate, numbered like the stop's pin on the map. In the light look the two small
// pictures beside the cover come from the thumbnails: a seventh of the memory each, on the devices short of it.
export function cardPhotosHtml(place, number, city, { lite = false } = {}) {
  const photos = place.photos ?? [];
  if (!photos.length) return '';
  const source = (photo, i) => (lite && i > 0 && photo.thumb ? photo.thumb : photo.src);
  // Each picture is a button: a tap opens it full screen in the photo viewer.
  const images = photos.map((photo, i) => `<button type="button" class="card-img card-img--${i === 0 ? 'cover' : 'side'}" data-photo="${i}" `
    + `aria-label="${esc(place.name)}, fotoğraf ${i + 1}: büyüt"><img src="${esc(source(photo, i))}" width="${Number(photo.w)}" `
    + `height="${Number(photo.h)}" alt="" loading="lazy" decoding="async"></button>`).join('');
  const credits = photos.map((photo) => sourceLink(photo.page, photo.credit)).join(' · ');
  return `<div class="card-media"><figure class="card-photos" data-count="${photos.length}">${images}${corners(city)}`
    + `<span class="card-num" aria-hidden="true">${number ?? ''}</span></figure>`
    + `<p class="card-credits">Fotoğraflar: ${credits}</p></div>`;
}

export function stopHtml({ trip, ticks, lite }, day, slotKey, id, number) {
  const place = trip.places[id];
  const key = tickKey(day.date, id);
  const nameId = esc(`name-${day.date}-${slotKey}-${id}`);
  const panel = esc(`more-${day.date}-${slotKey}-${id}`);
  const flags = [place.short, trip.visitWarnings[key]].filter(Boolean).map(flagHtml).join('');
  const local = place.local && place.local !== place.name ? `<span class="stop-local" lang="ru">${esc(place.local)}</span>` : '';
  const address = place.address && !isGone(place) ? `<p class="stop-address" lang="ru">${esc(place.address)}</p>` : '';
  return `<article class="stop" id="stop-${number}" data-place="${esc(id)}" data-status="${esc(place.status)}">
      ${cardPhotosHtml(place, number, day.city, { lite })}
      <div class="card-body">
        <h3 class="stop-title"><button type="button" class="stop-toggle" aria-expanded="false" aria-controls="${panel}">
          <span class="stop-name" id="${nameId}">${esc(place.name)}${icon('i-right')}</span>${local}
        </button></h3>
        ${flags}${address}
        <div class="stop-actions">${actionsHtml(place, key, ticks.has(key), nameId)}</div>
        <div class="stop-more" id="${panel}" data-place="${esc(id)}" hidden></div>
      </div>
    </article>`;
}
