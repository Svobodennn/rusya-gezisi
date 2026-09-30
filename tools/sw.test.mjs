// Run: node --test tools/sw.test.mjs
// Loads tools/sw.template.js into a sandbox with an in-memory Cache Storage and a fake network.
//
// How this breaks, and the test that catches it:
// - an update copies a file whose hash changed → stale plan offline → "update copies unchanged files"
// - an update downloads unchanged files again (17.6 MB over throttled networks) → same test
// - a hash match in an earlier cache that lost the file → put(undefined) kills the install → same test
// - an earlier cache written before manifests existed crashes the install or is trusted blindly → "without a manifest"
// - an interrupted install starts from zero → "resumes"
// - after the first failed download the other workers keep downloading and their progress hides the error → "resumes"
// - an update's progress or error replaces the working version's "ready" line → "failed update"
// - a redirected response is cached as-is and offline navigation then fails → "first install"
// - the manifest key counted as a file → "ready" with a file missing → "status"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const TEMPLATE = readFileSync(new URL('./sw.template.js', import.meta.url), 'utf8');
const PARALLEL = Number(/const PARALLEL = (\d+);/.exec(TEMPLATE)?.[1]);
const SCOPE = 'https://trip.test/gezi/';
const MANIFEST = `${SCOPE}__files.json`;

class FakeCache {
  entries = new Map();

  async match(request, { ignoreSearch = false } = {}) {
    const url = new URL(request instanceof Request ? request.url : String(request));
    if (ignoreSearch) url.search = '';
    const entry = this.entries.get(url.href);
    if (!entry) return undefined;
    const response = new Response(entry.body, { status: entry.status, headers: entry.headers });
    if (entry.redirected) Object.defineProperty(response, 'redirected', { value: true });
    return response;
  }

  async put(request, response) {
    if (!(response instanceof Response)) throw new TypeError('Cache.put needs a Response');
    const url = request instanceof Request ? request.url : String(request);
    const body = await response.text();
    this.entries.set(url, { body, status: response.status, headers: [...response.headers], redirected: response.redirected });
  }

  async keys() {
    return [...this.entries.keys()].map((url) => new Request(url));
  }

  body(path) {
    return this.entries.get(new URL(path, SCOPE).href)?.body;
  }
}

function fakeCaches() {
  const store = new Map();
  return {
    store,
    async open(name) {
      if (!store.has(name)) store.set(name, new FakeCache());
      return store.get(name);
    },
    async keys() { return [...store.keys()]; },
    async delete(name) { return store.delete(name); },
  };
}

// files: [[path, hash]]; the server answers every path with a body naming its hash. A failing path
// fails at once while every success waits for a timer, so failedAt marks the request count when it failed.
function fakeNetwork(files, { fail = [], redirect = [] } = {}) {
  const bodies = new Map(files.map(([path, hash]) => [path, `${path}@${hash}`]));
  const network = { log: [], failedAt: null };
  network.fetch = async (url, init = {}) => {
    const abortError = () => new DOMException('aborted', 'AbortError');
    if (init.signal?.aborted) throw abortError(); // an aborted fetch never leaves the device
    const path = String(url).slice(SCOPE.length) || './';
    network.log.push(path);
    if (fail.includes(path)) {
      network.failedAt ??= network.log.length;
      return new Response('no', { status: 503 });
    }
    await new Promise((resolve) => setTimeout(resolve, 1));
    if (init.signal?.aborted) throw abortError();
    const response = new Response(bodies.get(path), { status: 200 });
    if (redirect.includes(path)) Object.defineProperty(response, 'redirected', { value: true });
    return response;
  };
  return network;
}

function loadWorker({ version, files, caches, network, active = null }) {
  const listeners = {};
  const messages = [];
  // postMessage structured-clones, which also moves the object out of the sandbox's realm.
  const client = { postMessage: (message) => messages.push(structuredClone(message)) };
  const self = {
    registration: { scope: SCOPE, active },
    location: { origin: new URL(SCOPE).origin },
    clients: { matchAll: async () => [client], claim: async () => {} },
    skipWaiting: () => {},
    addEventListener: (type, listener) => { listeners[type] = listener; },
  };
  const source = TEMPLATE.replace('__VERSION__', version).replace('__FILES__', JSON.stringify(files));
  vm.runInNewContext(source, { self, caches, fetch: network.fetch, Response, Request, URL, AbortController, DOMException });
  const dispatch = (type, fields = {}) => {
    let pending = Promise.resolve();
    listeners[type]({ ...fields, waitUntil: (promise) => { pending = promise; } });
    return pending;
  };
  return {
    messages,
    install: () => dispatch('install'),
    status: () => dispatch('message', { data: { type: 'status' }, source: client }),
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

function version1() {
  return [['./', 'aaaaaaaaaaa0'], ...Array.from({ length: 30 }, (_, i) => [`f${String(i).padStart(2, '0')}.js`, `bbbbbbbbbb${String(i).padStart(2, '0')}`])];
}

async function installed(files, caches) {
  const worker = loadWorker({ version: 'v1', files, caches, network: fakeNetwork(files) });
  await worker.install();
  return caches.store.get('rusya-gezisi-v1');
}

test('first install downloads every file once, keeps its manifest and reports progress up to the total', async () => {
  const files = version1();
  const caches = fakeCaches();
  const network = fakeNetwork(files, { redirect: ['./'] });
  const worker = loadWorker({ version: 'v1', files, caches, network });
  await worker.install();

  assert.deepEqual([...network.log].sort(), files.map(([path]) => path).sort());
  const cache = caches.store.get('rusya-gezisi-v1');
  assert.deepEqual(JSON.parse(cache.entries.get(MANIFEST).body), Object.fromEntries(files));
  for (const [path, hash] of files) assert.equal(cache.body(path), `${path}@${hash}`);
  const shell = await cache.match(SCOPE);
  assert.equal(shell.redirected, false, 'a redirected response cannot answer a navigation');
  assert.equal(shell.status, 200);
  assert.deepEqual(worker.messages.at(-1), { type: 'progress', done: files.length, total: files.length });
  assert.ok(worker.messages.every((message) => message.type === 'progress'));
});

test('an update copies unchanged files from the earlier cache and downloads only changed, new or lost ones, silently', async () => {
  const caches = fakeCaches();
  const old = await installed(version1(), caches);
  old.entries.delete(new URL('f03.js', SCOPE).href);
  const files = version1()
    .filter(([path]) => path !== 'f05.js')
    .map(([path, hash]) => (path === 'f02.js' || path === './' ? [path, 'cccccccccccc'] : [path, hash]))
    .concat([['f99.js', 'dddddddddddd']]);
  const network = fakeNetwork(files);
  const worker = loadWorker({ version: 'v2', files, caches, network, active: {} });
  await worker.install();

  assert.deepEqual([...network.log].sort(), ['./', 'f02.js', 'f03.js', 'f99.js']);
  const cache = caches.store.get('rusya-gezisi-v2');
  for (const [path, hash] of files) assert.equal(cache.body(path), `${path}@${hash}`, path);
  assert.equal(cache.body('f05.js'), undefined);
  assert.deepEqual(JSON.parse(cache.entries.get(MANIFEST).body), Object.fromEntries(files));
  assert.deepEqual(worker.messages, []);
});

test('an earlier cache without a manifest is not trusted: everything is downloaded', async () => {
  const files = version1();
  const caches = fakeCaches();
  const legacy = await caches.open('rusya-gezisi-legacy');
  for (const [path] of files) await legacy.put(new URL(path, SCOPE), new Response('stale'));
  const network = fakeNetwork(files);
  await loadWorker({ version: 'v1', files, caches, network, active: {} }).install();

  assert.equal(network.log.length, files.length);
  assert.equal(caches.store.get('rusya-gezisi-v1').body('f00.js'), `f00.js@${files[1][1]}`);
});

test('the first failed download stops every worker, the error is the last word, and a retry resumes', async () => {
  const files = version1();
  const caches = fakeCaches();
  const broken = fakeNetwork(files, { fail: ['f20.js'] });
  const first = loadWorker({ version: 'v1', files, caches, network: broken });
  await assert.rejects(first.install(), /f20\.js: HTTP 503/);
  await settle();

  assert.deepEqual(broken.log.slice(broken.failedAt), [], 'downloads started after the failure');
  assert.equal(first.messages.at(-1).type, 'error');
  assert.equal(first.messages.filter((message) => message.type === 'error').length, 1);

  const stored = new Set(files.map(([path]) => path).filter((path) => caches.store.get('rusya-gezisi-v1').body(path)));
  assert.ok(stored.size > PARALLEL, `only ${stored.size} files stored before the failure: the resume check below proves little`);
  const network = fakeNetwork(files);
  await loadWorker({ version: 'v1', files, caches, network }).install();
  assert.deepEqual(network.log.filter((path) => stored.has(path)), [], 'files stored before the failure were fetched again');
  assert.equal(network.log.length, files.length - stored.size);
});

test('a failed update reports update-error only, and leaves the working version alone', async () => {
  const caches = fakeCaches();
  await installed(version1(), caches);
  const files = version1().map(([path, hash]) => (path === 'f07.js' ? [path, 'eeeeeeeeeeee'] : [path, hash]));
  const worker = loadWorker({ version: 'v2', files, caches, network: fakeNetwork(files, { fail: ['f07.js'] }), active: {} });
  await assert.rejects(worker.install());
  await settle();

  assert.deepEqual(worker.messages.map((message) => message.type), ['update-error']);
  assert.equal(caches.store.get('rusya-gezisi-v1').body('f07.js'), `f07.js@${version1()[8][1]}`);
});

test('status is ready only when every listed file is cached; the manifest does not count', async () => {
  const files = version1();
  const caches = fakeCaches();
  const cache = await installed(files, caches);
  const worker = loadWorker({ version: 'v1', files, caches, network: fakeNetwork(files), active: {} });
  await worker.status();
  assert.deepEqual(worker.messages.at(-1), { type: 'ready', total: files.length, version: 'v1' });

  cache.entries.delete(new URL('f10.js', SCOPE).href);
  await worker.status();
  assert.deepEqual(worker.messages.at(-1), { type: 'progress', done: files.length - 1, total: files.length });
});
