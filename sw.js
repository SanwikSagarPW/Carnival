/* Sparky's Carnival service worker.
   - App shell (html/js/css): serve cached code immediately and refresh it in the background.
   - Everything else (images, audio, rig textures, rig scripts and data, fonts): cache first, so each file is downloaded once and then works offline.
   Bump VERSION whenever an existing non-shell file is replaced under the same name. */
const VERSION = 'sparky-carnival-v30';
const SHELL = [
  './', 'index.html', 'style.css', 'game.js', 'audio.js', 'dialogues.js', 'timers.js',
  'assets/fonts/nunito-latin.woff2', 'assets/fonts/baloo2-latin.woff2', 'assets/sparky-poster.webp?v=2',
  'assets/bg-park.webp', 'assets/ui/board.svg', 'assets/ui/button-shell.svg',
  'assets/icon-check.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // One failure (e.g. a flaky connection) must not stop the worker from installing.
    await Promise.all(SHELL.map((p) => cache.add(p).catch((error) => console.warn('Shell cache failed.', p, error))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('sparky-carnival-') && key !== VERSION) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.endsWith('/sw.js')) return;
  event.respondWith(handle(req, url, event));
});

/* Only the small app shell (html/js/css next to sw.js) is revalidated. Everything under assets/, Dialogues/ and
   sparky-animations/ is fetched once and then served from the cache, so repeat visits cost almost no bandwidth. */
const scopePath = () => { try { return new URL(self.registration.scope).pathname; } catch { return '/'; } };
const isShell = (url) => {
  const base = scopePath();
  const rel = url.pathname.startsWith(base) ? url.pathname.slice(base.length) : url.pathname;
  return rel === '' || /^[^/]+\.(?:html|js|mjs|css)$/i.test(rel);
};
// Query strings are cache-busters; one stored copy per path is enough.
const keyOf = (url) => url.origin + url.pathname;

async function handle(req, url, event) {
  const key = keyOf(url);
  let cache, hit;
  try {
    cache = await caches.open(VERSION);
    hit = await cache.match(key);
  } catch (error) {
    console.warn('Offline cache unavailable; using the network.', error);
    return fetch(req);
  }

  if (isShell(url)) {
    const network = fetch(req).then((res) => {
      if (res.ok) event.waitUntil(cache.put(key, res.clone()).catch((error) => console.warn('Asset cache failed.', key, error)));
      else if (res.status >= 500 && hit) return hit;
      return res;
    });
    if (!hit) return network;
    event.waitUntil(network.catch((error) => console.warn('Code refresh deferred; serving cached copy.', error)));
    return hit;
  }

  const range = req.headers.get('range');
  if (hit) return range ? sliceResponse(hit, range) : hit;

  // Fetch the whole file (never a partial) so it can be cached, then answer a Range request from it.
  const res = await fetch(range ? url.href : req);
  if (res.ok && res.status === 200) {
    event.waitUntil(cache.put(key, res.clone()).catch((error) => console.warn('Asset cache failed.', key, error)));
    return range ? sliceResponse(res, range) : res;
  }
  return res;
}

async function sliceResponse(res, rangeHeader) {
  const buf = await res.clone().arrayBuffer();
  const total = buf.byteLength;
  const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
  if (!m) return res;
  const start = m[1] === '' ? Math.max(0, total - Number(m[2])) : Number(m[1]);
  const end = m[1] === '' || m[2] === '' ? total - 1 : Math.min(Number(m[2]), total - 1);
  if (start > end || start >= total) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${total}` } });
  }
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Content-Length': String(end - start + 1),
    },
  });
}
