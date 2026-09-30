// The page's patterns, ornaments and icons live in sprite.svg. It is placed inline, as the body's first child,
// because url(#…) fills and <use href="#…"> only reach definitions inside the same document.

export async function mountSprite() {
  try {
    const response = await fetch('sprite.svg');
    if (response.ok) document.body.insertAdjacentHTML('afterbegin', await response.text());
  } catch {
    // Without the sprite the page loses its ornaments and icons, not its content.
  }
}
