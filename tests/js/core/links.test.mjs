// How this breaks, and the test that catches it:
// - Yandex coordinate order swapped (pt is lon,lat; rtext is lat,lon) → URL cases
// - the day route loses a stop or its order → day route case

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { yandexPointUrl, yandexTransitUrl, googleTransitUrl, yandexDayRouteUrl } from '../../../app/js/core/links.js';

test('the day route link lists every stop in order after the current location', () => {
  assert.equal(yandexDayRouteUrl([{ lat: 55.76, lon: 37.63 }, { lat: 55.75, lon: 37.62 }]),
    'https://yandex.ru/maps/?rtext=~55.76,37.63~55.75,37.62&rtt=mt');
});

test('map links keep each provider’s coordinate order', () => {
  // Yandex docs: pt=longitude,latitude; rtext points are latitude,longitude; rtt=mt is public transport.
  assert.equal(yandexPointUrl(59.944869, 30.335429), 'https://yandex.ru/maps/?pt=30.335429,59.944869&z=17&l=map');
  assert.equal(yandexTransitUrl(59.89, 30.29), 'https://yandex.ru/maps/?rtext=~59.89,30.29&rtt=mt');
  assert.equal(googleTransitUrl(55.75, 37.61),
    'https://www.google.com/maps/dir/?api=1&destination=55.75,37.61&travelmode=transit');
});
