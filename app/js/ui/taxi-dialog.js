// The taxi sign: a place's Cyrillic name and address, full screen, for the driver to read or to copy, under a live
// Yandex map of the spot when there is a connection.
import { yandexWidgetUrl } from '../core/links.js';

const OFFLINE_NOTE = 'Harita için internet gerekiyor; adres aşağıda, şoföre gösterebilirsin.';

function mapFrame(place) {
  const frame = document.createElement('iframe');
  frame.src = yandexWidgetUrl(place.lat, place.lon);
  frame.title = `Yandex Haritalar: ${place.local || place.name}`;
  frame.allowFullscreen = true;
  frame.referrerPolicy = 'no-referrer';
  frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox');
  return frame;
}

function offlineNote() {
  const note = document.createElement('p');
  note.className = 'taxi-map-note';
  note.textContent = OFFLINE_NOTE;
  return note;
}

export function createTaxiDialog(dialog) {
  const name = dialog.querySelector('#taxi-name');
  const address = dialog.querySelector('#taxi-address');
  const copyLabel = dialog.querySelector('#taxi-copy span');
  const map = dialog.querySelector('#taxi-map');

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(`${name.textContent}, ${address.textContent}`);
      copyLabel.textContent = 'Kopyalandı';
    } catch {
      copyLabel.textContent = 'Kopyalanamadı; adrese uzun basıp kopyalayın';
    }
  }

  // The map is built on every open and dropped on close, so a closed sign keeps nothing loading.
  function showMap(place) {
    const located = place.lat != null && place.lon != null;
    map.hidden = !located;
    map.replaceChildren(...(located ? [navigator.onLine ? mapFrame(place) : offlineNote()] : []));
  }

  dialog.querySelector('#taxi-close').addEventListener('click', () => dialog.close());
  dialog.querySelector('#taxi-copy').addEventListener('click', copyAddress);
  dialog.addEventListener('close', () => map.replaceChildren());

  return {
    open(place) {
      name.textContent = place.local || place.name;
      address.textContent = place.address;
      copyLabel.textContent = 'Adresi kopyala';
      showMap(place);
      dialog.showModal();
    },
    isOpen: () => dialog.open,
  };
}
