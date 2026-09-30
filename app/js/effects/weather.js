// The hero's weather: snow on its canvas and the street lights across its sky. Returns a function that stops both.
import { startSnow } from './snow.js';
import { hangLights } from './street-lights.js';

export function startWeather(hero) {
  const canvas = hero.querySelector('.hero-snow');
  const lights = hero.querySelector('.hero-lights');
  const stopSnow = canvas ? startSnow(canvas) : () => {};
  let lastWidth = 0;
  const lightsWatch = new ResizeObserver(() => {
    if (!lights || lights.clientWidth === lastWidth) return;
    lastWidth = lights.clientWidth;
    hangLights(lights);
  });
  if (lights) lightsWatch.observe(lights);
  return () => {
    stopSnow();
    lightsWatch.disconnect();
  };
}
