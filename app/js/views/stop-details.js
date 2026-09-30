// A stop's opened panel: branch, notes, status note, sub-stops, and links out to the map apps.
import { googleTransitUrl, yandexPointUrl, yandexTransitUrl } from '../core/links.js';
import { esc, icon, ruText, safeUrl } from './html.js';

function linkItem(href, iconId, label) {
  return `<li><a href="${esc(href)}" target="_blank" rel="noopener">${icon(iconId)}${label}</a></li>`;
}

function substopsHtml(place) {
  if (!place.stops?.length) return '';
  const items = place.stops.map((stop) => `<li><span>${ruText(stop.name)}</span>`
    + `<a class="act" href="${esc(yandexTransitUrl(stop.lat, stop.lon))}" target="_blank" rel="noopener">${icon('i-route')}Rota</a></li>`).join('');
  return `<ol class="substops" aria-label="Duraklar">${items}</ol>`;
}

function linksHtml(place) {
  const website = safeUrl(place.website);
  const items = [
    place.lat != null && linkItem(yandexPointUrl(place.lat, place.lon), 'i-pin', 'Yandex Haritalar'),
    place.lat != null && linkItem(googleTransitUrl(place.lat, place.lon), 'i-route', 'Google Maps rotası'),
    website && linkItem(website, 'i-external', 'Web sitesi'),
  ].filter(Boolean).join('');
  return items ? `<ul class="stop-links">${items}</ul>` : '';
}

export function moreHtml(place) {
  const text = [
    place.branch && `<p class="stop-branch">${ruText(place.branch)}</p>`,
    place.notes && `<p class="stop-notes">${ruText(place.notes)}</p>`,
    place.statusNote && `<p class="stop-status-note">${ruText(place.statusNote)}</p>`,
  ].filter(Boolean).join('');
  return text + substopsHtml(place) + linksHtml(place);
}
