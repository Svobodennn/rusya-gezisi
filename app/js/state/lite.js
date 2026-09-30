// The light look, for weak devices (an old phone, a TV box): solid plates instead of frosted glass, nothing moving
// on its own, no snow, the plain night ground. The visitor's choice wins (the footer switch, or ?lite=1 / ?lite=0 in
// the address, both remembered on this device); without one, the device decides by what it says about itself.

export const LITE_KEY = 'rusya-gezisi.lite.v1';
// Set-top boxes and TV sets: Android TV (Xiaomi Mi Box and the like), Fire TV, Samsung Tizen, LG webOS, HbbTV.
const TV = /Android TV|AFT\w|MIBOX|MiTV|BRAVIA|SMART-?TV|Tizen|Web0S|HbbTV|GoogleTV/i;

function storedChoice() {
  try {
    return localStorage.getItem(LITE_KEY);
  } catch {
    return null;
  }
}

export function saveLite(on) {
  try {
    localStorage.setItem(LITE_KEY, on ? '1' : '0');
  } catch {
    // Storage blocked (private mode): the choice holds for this visit through the address only.
  }
}

// The address that opens the page in the other look: ?lite= set, the rest (?now=, #gun-N) kept. Always a different
// address, so going there is a real reload, and the choice travels in it even where storage is blocked.
export function switchUrl(href, on) {
  const url = new URL(href);
  url.searchParams.set('lite', on ? '1' : '0');
  return url.href;
}

// 2 GB or less of memory, a TV's browser, or data saver asked for.
function weakDevice({ deviceMemory, userAgent = '', connection }) {
  return deviceMemory <= 2 || TV.test(userAgent) || connection?.saveData === true;
}

// { on, chosen }: chosen when the visitor decided (now or earlier), otherwise the device's own guess.
export function readLite() {
  const asked = new URLSearchParams(location.search).get('lite');
  if (asked === '1' || asked === '0') saveLite(asked === '1');
  const choice = asked === '1' || asked === '0' ? asked : storedChoice();
  if (choice === '1' || choice === '0') return { on: choice === '1', chosen: true };
  return { on: weakDevice(navigator), chosen: false };
}
