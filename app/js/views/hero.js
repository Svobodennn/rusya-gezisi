// The day's cover: photograph, weather layers, bulb-sign date, the city in Cyrillic, the postcard, the city's edge.
import { esc, icon, sourceLink } from './html.js';
import { CITY_TITLES, MONTHS, RU_MONTHS, RU_WEEKDAYS, dateParts } from './format.js';
import { bulbNumber, cornerSymbol } from './ornaments.js';

function edgeHtml(city) {
  return city === 'spb'
    ? '<svg aria-hidden="true"><rect width="100%" height="56" fill="url(#p-railing)"/><rect y="56" width="100%" height="22" fill="url(#p-cobalt)"/></svg>'
    : '<svg aria-hidden="true"><rect width="100%" height="100%" fill="url(#p-kremlin)"/></svg>';
}

function phraseHtml(phrase, day) {
  if (!phrase) return '';
  const { m, d } = dateParts(day.date);
  return `<figure class="hero-phrase" aria-label="Günün Rusçası">
      <svg class="corner corner--tl" aria-hidden="true"><use href="#${cornerSymbol(day.city)}"/></svg>
      <svg class="corner corner--br" aria-hidden="true"><use href="#${cornerSymbol(day.city)}"/></svg>
      <blockquote class="phrase-ru" lang="ru">${esc(phrase.ru)}</blockquote>
      <p class="phrase-say">${esc(phrase.say)}</p>
      <figcaption class="phrase-tr">${esc(phrase.tr)}</figcaption>
      <div class="phrase-stamp" aria-hidden="true"><span lang="ru">ПОЧТА</span><strong>${d}</strong><span lang="ru">${RU_MONTHS[m - 1].slice(0, 3).toUpperCase()}</span></div>
    </figure>`;
}

function cityTitle(day) {
  const title = CITY_TITLES[day.city];
  const pre = title.pre ? `<span class="hero-city-pre">${title.pre}</span>` : '';
  const from = day.transit ? `<span class="hero-city-pre">${CITY_TITLES[day.from].name} ${icon('i-train')}</span>` : pre;
  return `${from}<span lang="ru">${title.name}</span>`;
}

function creditHtml(hero, place) {
  if (!hero) return '';
  return `<p class="hero-credit">Kapak: ${esc(place?.name)} · Fotoğraf: ${sourceLink(hero.page, hero.credit)}</p>`;
}

export function heroHtml({ trip, index, position }, hero, phrase) {
  const day = trip.days[index];
  const { m, d } = dateParts(day.date);
  const where = day.transit ? `${trip.cities[day.from].label} › ${trip.cities[day.city].label}` : trip.cities[day.city].label;
  const countdown = position.phase === 'before' ? ` · Geziye ${position.daysUntil} gün` : '';
  const photo = hero
    ? `<img class="hero-photo" src="${esc(hero.src)}" width="${Number(hero.w)}" height="${Number(hero.h)}" alt="" decoding="async" fetchpriority="high">`
    : '';
  return `${photo}<div class="hero-shade" aria-hidden="true"></div>
    <svg class="hero-lights" aria-hidden="true"></svg>
    <canvas class="hero-snow" aria-hidden="true"></canvas>
    <div class="hero-inner">
      <div class="hero-date">${bulbNumber(d)}</div>
      <div class="hero-text">
        <h1 id="hero-title" class="hero-city" tabindex="-1"><span class="visually-hidden">${d} ${MONTHS[m - 1]} ${esc(day.weekday)}, ${esc(where)}. </span>${cityTitle(day)}</h1>
        <p class="hero-line">${d} ${MONTHS[m - 1]} ${esc(day.weekday)} · <span lang="ru">${RU_WEEKDAYS[day.weekday] ?? ''}, ${d} ${RU_MONTHS[m - 1]}</span> · Gün ${day.n} / ${trip.days.length}${countdown}</p>
        <p class="hero-sun"><span>${icon('i-sunrise')}Gün doğumu ${esc(day.sunrise)}</span><span>${icon('i-sunset')}Gün batımı ${esc(day.sunset)}</span></p>
        ${creditHtml(hero, hero ? trip.places[hero.place] : null)}
      </div>
      ${phraseHtml(phrase, day)}
    </div>
    <div class="hero-edge" aria-hidden="true">${edgeHtml(day.city)}</div>`;
}
