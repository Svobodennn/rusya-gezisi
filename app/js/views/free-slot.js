// A slot the plan leaves empty: what it is for, and a tick of its own. The samovar keeps it company.
import { tickKey } from '../core/slots.js';
import { esc, tickButton } from './html.js';

const FREE_PLANS = {
  'Rest and prep for the long night': 'Dinlen, uzun geceye hazırlan',
  'Recovery Day / No Work': 'Toparlanma günü, çalışma yok',
  'Last-minute shopping': 'Son dakika alışverişi',
};

export function freeHtml({ ticks }, day, slot) {
  const key = tickKey(day.date, slot.key);
  const planId = esc(`plan-${day.date}-${slot.key}`);
  return `<div class="free">
      <p class="free-plan" id="${planId}">${esc(FREE_PLANS[slot.plan] ?? slot.plan)}</p>
      <p class="free-note">Plan bu saate bir mekân koymuyor.</p>
      <div class="stop-actions">${tickButton(key, ticks.has(key), 'Yapıldı', planId)}</div>
      <svg class="free-art" viewBox="0 0 120 160" aria-hidden="true"><use href="#o-samovar"/></svg>
    </div>`;
}
