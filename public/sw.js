/* Hex Hordes service worker: keeps the game playable offline.
 *
 * - Pages: network first, so updates arrive as soon as you're online; the cached copy otherwise.
 * - Scripts, styles, fonts, models, sounds and music: served from the cache, fetched once.
 * - Music is streamed with Range requests, which are answered from the cached file.
 *
 * sw-manifest.js (written by scripts/build-sw-manifest.mjs after each build) lists every built
 * file to cache on install, and the models and art to cache later, when the page says the game is
 * idle ('warm'), so a first visit on a slow connection gets the bandwidth; a new build changes it,
 * which installs a fresh copy of this worker.
 */
self.__PRECACHE = { version: 'dev', files: [], later: [] };
try {
  importScripts('/sw-manifest.js');
} catch {
  // No manifest (development build): cache as files are used
}

const VERSION = self.__PRECACHE.version;
const CACHE = `wwh-${VERSION}`;
const PAGES = ['/', '/campaign', '/army', '/bestiary', '/stats', '/style', '/play'];
const ASSETS = [
  '/music/manifest.json',
  '/logo.png',
  '/favicon.ico',
  ...self.__PRECACHE.files
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // One missing file shouldn't stop the rest from being cached. Built files (/_next/static, named
    // by their contents) never change, so the copies the page just downloaded are reused; pages and
    // files that keep their names (the music manifest, the logo) are fetched afresh.
    await Promise.all([...PAGES, ...ASSETS].map(url =>
      fetch(url, { cache: url.startsWith('/_next/static/') ? 'default' : 'reload' })
        .then(response => (response.ok ? cache.put(url, response) : undefined))
        .catch(() => undefined)
    ));
    // An older version's models and art are carried over (no download), so they keep working
    // offline once its cache is deleted; this happens while the older version still answers the
    // page, so nothing waits on it. The warm step checks them with the server later.
    for (const key of (await caches.keys()).filter(key => key.startsWith('wwh-') && key !== CACHE)) {
      await carryOver(key, cache).catch(() => undefined);
    }
    await self.skipWaiting();
  })());
});

// The models and art, one at a time, when the page says it's idle: those not yet cached, and those
// carried over from an older version (checked with the server, in case they changed) - again next
// time it asks, if the connection dropped part-way
const INHERITED = 'x-wwh-inherited';
let warming = null;
self.addEventListener('message', event => {
  if (event.data?.type !== 'warm' || warming) return;
  warming = (async () => {
    const cache = await caches.open(CACHE);
    for (const url of self.__PRECACHE.later ?? []) {
      const hit = await cache.match(url);
      if (hit && !hit.headers.has(INHERITED)) continue;
      try {
        const response = await fetch(url, { cache: hit ? 'no-cache' : 'default' });
        if (response.ok) await cache.put(url, response);
      } catch {
        // Offline again: the rest are cached as they're used
        break;
      }
    }
  })().finally(() => { warming = null; });
  event.waitUntil(warming);
});

// Copies an older version's cached models and art into this version's cache, marked as inherited
const carryOver = async (fromKey, cache) => {
  const later = new Set(self.__PRECACHE.later ?? []);
  const old = await caches.open(fromKey);
  for (const request of await old.keys()) {
    const path = new URL(request.url).pathname;
    if (!later.has(path) || (await cache.match(path))) continue;
    const response = await old.match(request);
    if (!response || response.status !== 200) continue;
    const headers = new Headers(response.headers);
    headers.set(INHERITED, '1');
    await cache.put(path, new Response(await response.blob(), { status: 200, headers }));
  }
};

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('wwh-') && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

const isCacheFirst = url =>
  url.pathname.startsWith('/_next/static/') ||
  url.pathname === '/_next/image' ||
  url.pathname.startsWith('/models/') ||
  url.pathname.startsWith('/sounds/') ||
  url.pathname.startsWith('/music/') ||
  /\.(?:png|jpg|webp|svg|ico|woff2?)$/.test(url.pathname);

// A cached file, fetching (and caching) the whole of it if needed
const cachedFile = async (request, url) => {
  const cache = await caches.open(CACHE);
  const key = url.pathname + url.search;
  const hit = await cache.match(key);
  if (hit) return hit;
  const response = await fetch(key);
  if (response.ok && response.status === 200) await cache.put(key, response.clone());
  return response;
};

// Answer a Range request (audio streaming) with the requested slice of a whole cached file
const rangeResponse = async (request, response) => {
  const match = /bytes=(\d*)-(\d*)/.exec(request.headers.get('range') || '');
  if (!match || response.status !== 200) return response;
  const body = await response.blob();
  const start = match[1] ? Number(match[1]) : Math.max(0, body.size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), body.size - 1) : body.size - 1;
  if (start >= body.size) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${body.size}` } });
  return new Response(body.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': response.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Range': `bytes ${start}-${end}/${body.size}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes'
    }
  });
};

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(url.pathname, response.clone());
        return response;
      } catch {
        return (await cache.match(url.pathname)) || (await cache.match('/')) || Response.error();
      }
    })());
    return;
  }

  if (isCacheFirst(url)) {
    event.respondWith((async () => {
      try {
        const response = await cachedFile(request, url);
        return request.headers.has('range') ? rangeResponse(request, response) : response;
      } catch {
        return Response.error();
      }
    })());
  }
});
