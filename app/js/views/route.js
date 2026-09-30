// The route section's frame: title, day/city switch, the map's box, the Yandex link, the shelf.
import { icon } from './html.js';
import { shelfHtml } from './ornaments.js';

// What the dots on the map stand for: the notable places by kind, then the metro.
const LEGEND = [
  ['sight', 'Gezilecek yer'], ['historic', 'Tarihi yapı, anıt'], ['museum', 'Müze, galeri'],
  ['theatre', 'Tiyatro, konser'], ['church', 'İbadet yeri'], ['metro', 'Metro'],
];

function legendHtml() {
  return `<ul class="map-legend" aria-label="Haritadaki noktalar">${LEGEND.map(([kind, text]) => (
    `<li><span class="map-key map-key--${kind}" aria-hidden="true"></span>${text}</li>`)).join('')}</ul>`;
}

export function routeShellHtml() {
  return `<div class="route-head">
      <h2 id="route-title" class="section-title">Günün rotası<span lang="ru">маршрут дня</span></h2>
      <div class="map-modes" role="group" aria-label="Harita görünümü">
        <button type="button" class="map-mode" data-map-mode="day" aria-pressed="true">Gün</button>
        <button type="button" class="map-mode" data-map-mode="city" aria-pressed="false">Şehir</button>
      </div>
    </div>
    <div class="map" id="map" data-mode="day" role="group"></div>
    ${legendHtml()}
    <div class="map-foot">
      <a class="act act--accent" id="route-open" href="#" target="_blank" rel="noopener">${icon('i-route')}Rotayı Yandex'te aç</a>
      <p class="map-credit">Harita: © OpenStreetMap katkıcıları · internetsiz çizildi · yakınlaştırdıkça yer adları çıkar</p>
    </div>
    ${shelfHtml()}`;
}
