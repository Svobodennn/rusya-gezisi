// Service worker registration and the offline-readiness line in the footer.
const ICONS = { pending: 'i-sync', progress: 'i-sync', ready: 'i-ready', error: 'i-warn', unsupported: 'i-warn', insecure: 'i-warn' };
const TEXT = {
  pending: () => 'Çevrimdışı kullanım hazırlanıyor',
  progress: ({ done, total }) => `Çevrimdışı kullanım hazırlanıyor · ${done} / ${total}`,
  ready: ({ total }) => `Çevrimdışı hazır · ${total} dosya bu cihazda`,
  error: () => 'Çevrimdışı hazırlık tamamlanamadı. İnternete bağlıyken sayfayı yeniden açın.',
  unsupported: () => 'Bu tarayıcı çevrimdışı kullanımı desteklemiyor.',
  insecure: () => 'Çevrimdışı kullanım için sayfa HTTPS adresinden açılmalı.',
};

function show(state, data = {}) {
  const line = document.getElementById('offline');
  if (!line) return;
  const text = TEXT[state](data);
  const changed = line.dataset.state !== state;
  line.dataset.state = state;
  line.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#${ICONS[state]}"/></svg><span></span>`;
  line.querySelector('span').textContent = text;
  // Screen readers hear each state once; progress ticks only redraw the visible line.
  const live = document.getElementById('offline-live');
  if (changed && live) live.textContent = text;
}

function onMessage(event) {
  const { controller } = navigator.serviceWorker;
  // An update installing in the background must not overwrite the working version's status.
  if (controller && event.source !== controller) return;
  const type = event.data?.type;
  // hasOwnProperty rather than Object.hasOwn: TV boxes still run WebViews from before Chromium 93.
  if (typeof type === 'string' && Object.prototype.hasOwnProperty.call(TEXT, type)) show(type, event.data);
}

function offerUpdate(worker, accept) {
  const box = document.getElementById('update');
  const button = document.getElementById('update-button');
  if (!box || !button) return;
  box.hidden = false;
  // Assigned, not added: a newer waiting worker replaces the one offered before it.
  button.onclick = () => {
    accept();
    worker.postMessage({ type: 'skip-waiting' });
  };
}

function watchForUpdates(registration, accept) {
  let watched = null;
  const watch = (worker) => {
    if (!worker || worker === watched) return;
    watched = worker;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(worker, accept);
    });
  };
  if (registration.waiting && navigator.serviceWorker.controller) offerUpdate(registration.waiting, accept);
  // An install that started before register() resolved has already fired updatefound.
  watch(registration.installing);
  registration.addEventListener('updatefound', () => watch(registration.installing));
}

export async function setupOffline() {
  try {
    if (!window.isSecureContext) {
      show('insecure');
      return;
    }
    if (!('serviceWorker' in navigator)) {
      show('unsupported');
      return;
    }
    const container = navigator.serviceWorker;
    let accepted = false;
    let hadController = Boolean(container.controller);
    container.addEventListener('message', onMessage);
    container.addEventListener('controllerchange', () => {
      // Tabs that were already controlled run old JS against a cache the new worker just deleted, so they
      // reload too; the first install (nothing controlled this page before) keeps the page as it is.
      if (accepted || hadController) location.reload();
      hadController = true;
    });
    const registration = await container.register('sw.js');
    watchForUpdates(registration, () => { accepted = true; });
    const ready = await container.ready;
    ready.active?.postMessage({ type: 'status' });
  } catch {
    show('error');
  }
}
