// How this breaks, and the test that catches it:
// - the light look still decodes full-size side pictures on a device short of memory → light case
// - the full look (or a photo without a thumbnail) gets a blurry thumbnail → full and fallback cases

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardPhotosHtml } from '../../../app/js/views/stop.js';

const place = {
  name: 'Stop',
  photos: [
    { src: 'img/a-1.webp', thumb: 'img/a-1-t.webp', w: 960, h: 640 },
    { src: 'img/a-2.webp', thumb: 'img/a-2-t.webp', w: 960, h: 640 },
    { src: 'img/a-3.webp', w: 960, h: 640 },
  ],
};
const sources = (html) => [...html.matchAll(/<img src="([^"]+)"/g)].map((m) => m[1]);

test('the full look shows every picture at full size', () => {
  assert.deepEqual(sources(cardPhotosHtml(place, 1, 'moscow')), ['img/a-1.webp', 'img/a-2.webp', 'img/a-3.webp']);
});

test('the light look keeps the cover full size and takes the side pictures from their thumbnails, where there is one', () => {
  assert.deepEqual(sources(cardPhotosHtml(place, 1, 'moscow', { lite: true })), ['img/a-1.webp', 'img/a-2-t.webp', 'img/a-3.webp']);
});
