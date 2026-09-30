// Deep links into the map apps that do the navigating.

// Yandex documents pt as longitude,latitude and rtext points as latitude,longitude.
export function yandexPointUrl(lat, lon) {
  return `https://yandex.ru/maps/?pt=${lon},${lat}&z=17&l=map`;
}

export function yandexTransitUrl(lat, lon) {
  return `https://yandex.ru/maps/?rtext=~${lat},${lon}&rtt=mt`;
}

// The whole day as one public-transport route: stops in order, from wherever you are now.
export function yandexDayRouteUrl(points) {
  const stops = points.map(({ lat, lon }) => `${lat},${lon}`).join('~');
  return `https://yandex.ru/maps/?rtext=~${stops}&rtt=mt`;
}

export function googleTransitUrl(lat, lon) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=transit`;
}
