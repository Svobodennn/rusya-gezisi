// A memory full screen: the photo at its own proportions, its time and caption, previous and next.

export function createMemoryViewer(dialog) {
  const image = dialog.querySelector('.viewer-img');
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
    image.alt = photo.caption || `Hatıra ${index + 1}`;
    note.textContent = [photo.time, photo.caption].filter(Boolean).join(' · ');
    count.textContent = `${index + 1} / ${photos.length}`;
    dialog.dataset.single = String(photos.length === 1);
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
