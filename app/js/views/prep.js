// Before the trip: the countdown and the four things to do before leaving.
import { isSlotDead } from '../core/slots.js';

export function prepHtml({ trip, position }) {
  const deadSlots = trip.days.flatMap((day) => day.slots).filter((slot) => isSlotDead(slot, trip.places)).length;
  return `<h2 id="prep-title" class="section-title">Yola çıkmadan<span lang="ru">перед поездкой</span></h2>
    <p class="prep-lead">Geziye <strong>${position.daysUntil} gün</strong> var. O güne kadar sayfa ilk günü gösteriyor.</p>
    <ol class="prep-list">
      <li><strong>Yayın adresi seçilince telefonlara kurun.</strong> Sayfa şimdilik yalnızca bilgisayarda; telefona kurmak için HTTPS'li bir adres gerekiyor. Sonra iPhone'da Safari › Paylaş › Ana Ekrana Ekle, Android'de Chrome menüsü › Uygulamayı yükle.</li>
      <li><strong>Çevrimdışı hazır mı bakın.</strong> Kurulumdan sonra sayfanın en altında “Çevrimdışı hazır” yazmalı.</li>
      <li><strong>İki şehrin haritasını Yandex Maps'e indirin.</strong> Moskova ve St. Petersburg; internet kesildiğinde harita yine açılır.</li>
      <li><strong>${deadSlots} slot için yer seçin.</strong> Bu slotlarda açık mekân kalmadı; kapanan ve bulunamayan mekânlar ilgili günlerde etiketli.</li>
    </ol>`;
}
