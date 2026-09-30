// Moscow time and the trip calendar. Pure: no DOM, no storage, no device time zone.

const MINUTE = 60_000;
export const DAY_MINUTES = 1440;

// Russia has used UTC+3 all year since 2014, so a fixed offset is exact.
const MOSCOW_OFFSET_MINUTES = 180;

export function moscowClock(instant) {
  const t = new Date(instant.getTime() + MOSCOW_OFFSET_MINUTES * MINUTE);
  return {
    date: t.toISOString().slice(0, 10),
    hours: t.getUTCHours(),
    minutes: t.getUTCMinutes(),
  };
}

// A trip day runs from rolloverHour to rolloverHour, so 02:00 after a night out still belongs to the evening before.
export function tripDateFor(instant, rolloverHour) {
  const shifted = new Date(instant.getTime() + (MOSCOW_OFFSET_MINUTES - rolloverHour * 60) * MINUTE);
  return shifted.toISOString().slice(0, 10);
}

export function minutesIntoTripDay(instant, rolloverHour) {
  const { hours, minutes } = moscowClock(instant);
  const clock = hours * 60 + minutes;
  return hours < rolloverHour ? clock + DAY_MINUTES : clock;
}

export function daysBetween(fromIso, toIso) {
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / (DAY_MINUTES * MINUTE));
}

// Whether the trip is on and dayIndex is the day it is on.
export function isToday(position, dayIndex) {
  return position.phase === 'during' && position.index === dayIndex;
}

export function tripPosition(days, instant, rolloverHour) {
  const today = tripDateFor(instant, rolloverHour);
  const first = days[0].date;
  const last = days[days.length - 1].date;
  if (today < first) return { phase: 'before', index: 0, daysUntil: daysBetween(today, first) };
  if (today > last) return { phase: 'after', index: days.length - 1 };
  return { phase: 'during', index: days.findIndex((d) => d.date === today) };
}
