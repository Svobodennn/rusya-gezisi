// Ornament markup drawn from the sprite: the bulb-sign numerals, plate corners, the matryoshka shelf.

// 5×7 dot-matrix numerals, the bulb sign's alphabet.
const DIGITS = {
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  3: ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
};

const DOLLS = ['red', 'blue', 'green', 'gold', 'red'];

export function bulbNumber(value) {
  const pitch = 11;
  const dots = [];
  [...String(value).padStart(2, '0')].forEach((ch, i) => {
    DIGITS[ch].forEach((row, y) => [...row].forEach((bit, x) => dots.push({ x: i * 6 + x, y, on: bit === '1' })));
  });
  const circles = (on) => dots.filter((d) => d.on === on)
    .map((d) => `<circle cx="${d.x * pitch + pitch / 2}" cy="${d.y * pitch + pitch / 2}" r="4.2"/>`).join('');
  return `<svg class="bulb-number" viewBox="0 0 ${11 * pitch} ${7 * pitch}" width="${11 * pitch}" height="${7 * pitch}" aria-hidden="true">`
    + `<g class="dots-off">${circles(false)}</g><g class="dots-on">${circles(true)}</g></svg>`;
}

// Moscow corners carry Khokhloma vines; Petersburg corners carry the porcelain star.
export function cornerSymbol(city) {
  return city === 'spb' ? 'o-star' : 'o-khokhloma';
}

export function corners(city) {
  const symbol = cornerSymbol(city);
  return ['tl', 'tr', 'bl', 'br']
    .map((at) => `<svg class="corner corner--${at}" aria-hidden="true"><use href="#${symbol}"/></svg>`).join('');
}

// Five nesting dolls, largest first, with the samovar at the head of the shelf.
export function shelfHtml() {
  const dolls = DOLLS.map((colour, i) => `<svg class="doll doll--${colour} doll--${i + 1}" viewBox="0 0 100 168"><use href="#o-matryoshka"/></svg>`).join('');
  return `<div class="shelf" aria-hidden="true"><svg class="samovar" viewBox="0 0 120 160"><use href="#o-samovar"/></svg>${dolls}</div>`;
}
