// A photograph full screen (a memory, or a stop's picture): at its own proportions, with its note, previous and next.

export function createPhotoViewer(dialog) {
  // The photo element is made on first open, so the page never ships an <img> without a source.
  const image = document.createElement('img');
  image.className = 'viewer-img';
  const frame = dialog.querySelector('.viewer-frame');
  const note = dialog.querySelector('.viewer-note');
  const count = dialog.querySelector('.viewer-count');
  let photos = [];
  let index = 0;

  function show(next) {
    index = (next + photos.length) % photos.length;
    const photo = photos[index];
    image.src = photo.src;
    image.width = photo.w;
    image.height = photo.h;
    image.alt = photo.caption || `Fotoğraf ${index + 1}`;
    note.textContent = [photo.time, photo.caption].filter(Boolean).join(' · ');
    count.textContent = `${index + 1} / ${photos.length}`;
    dialog.dataset.single = String(photos.length === 1);
    if (!image.isConnected) frame.replaceChildren(image);
  }

  dialog.querySelector('[data-viewer="prev"]').addEventListener('click', () => show(index - 1));
  dialog.querySelector('[data-viewer="next"]').addEventListener('click', () => show(index + 1));
  dialog.querySelector('[data-viewer="close"]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') show(index - 1);
    if (event.key === 'ArrowRight') show(index + 1);
  });

  return {
    open(list, at) {
      if (!list?.length) return;
      photos = list;
      show(at);
      dialog.showModal();
    },
    isOpen: () => dialog.open,
  };
}
