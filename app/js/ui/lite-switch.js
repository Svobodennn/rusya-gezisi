// The footer switch between the full look and the light one; the page reloads into the other look.
import { saveLite, switchUrl } from '../state/lite.js';

const TEXT = {
  on: ['Hafif görünüm açık: buzlu cam, kar ve hareketli ışıklar kapalı.', 'Tam görünüme dön'],
  off: ['Sayfa bu cihazda ağır mı geliyor?', 'Hafif görünüme geç'],
};

export function setupLiteSwitch(lite) {
  const note = document.getElementById('lite-note');
  const button = document.getElementById('lite-button');
  if (!note || !button) return;
  const [text, label] = TEXT[lite.on ? 'on' : 'off'];
  note.textContent = text;
  button.textContent = label;
  button.hidden = false;
  button.addEventListener('click', () => {
    saveLite(!lite.on);
    location.replace(switchUrl(location.href, !lite.on));
  });
}
