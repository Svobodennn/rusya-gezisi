// The taxi sign: a place's Cyrillic name and address, full screen, for the driver to read or to copy.

export function createTaxiDialog(dialog) {
  const name = dialog.querySelector('#taxi-name');
  const address = dialog.querySelector('#taxi-address');
  const copyLabel = dialog.querySelector('#taxi-copy span');

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(`${name.textContent}, ${address.textContent}`);
      copyLabel.textContent = 'Kopyalandı';
    } catch {
      copyLabel.textContent = 'Kopyalanamadı; adrese uzun basıp kopyalayın';
    }
  }

  dialog.querySelector('#taxi-close').addEventListener('click', () => dialog.close());
  dialog.querySelector('#taxi-copy').addEventListener('click', copyAddress);

  return {
    open(place) {
      name.textContent = place.local || place.name;
      address.textContent = place.address;
      copyLabel.textContent = 'Adresi kopyala';
      dialog.showModal();
    },
    isOpen: () => dialog.open,
  };
}
