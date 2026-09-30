// Dates and names as the page writes them, in Turkish and in Russian. Plain text: callers escape.

export const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const MONTHS_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
// Russian dates take the genitive month: "20 декабря".
export const RU_MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export const RU_WEEKDAYS = {
  Pazartesi: 'понедельник', Salı: 'вторник', Çarşamba: 'среда', Perşembe: 'четверг',
  Cuma: 'пятница', Cumartesi: 'суббота', Pazar: 'воскресенье',
};
// Each city's name as the hero and the garland letter it, in Cyrillic.
export const CITY_TITLES = {
  moscow: { name: 'МОСКВА' },
  spb: { pre: 'Санкт-', name: 'ПЕТЕРБУРГ' },
};

export function dateParts(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}

export function dayLabel(day) {
  const { m, d } = dateParts(day.date);
  return `${d} ${MONTHS[m - 1]}`;
}

export function longDate(iso) {
  const { y, m, d } = dateParts(iso);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function shortLabel(day) {
  const { m, d } = dateParts(day.date);
  return `${d} ${MONTHS_SHORT[m - 1]}`;
}

export function slotTime(def) {
  return def.end <= def.start ? `${def.start}+` : `${def.start}–${def.end}`;
}
