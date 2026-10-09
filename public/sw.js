/* Hex Hordes service worker: keeps the game playable offline.
 *
 * - Pages: network first, so updates arrive as soon as you're online; the cached copy otherwise.
 * - Scripts, styles, fonts, models, sounds and music: served from the cache, fetched once.
 * - Music is streamed with Range requests, which are answered from the cached file.
 *
 * sw-manifest.js (written by scripts/build-sw-manifest.mjs after each build) lists every built
 * file to cache on install; a new build changes it, which installs a fresh copy of this worker.
 */
self.__PRECACHE = { version: 'dev', files: [] };
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
    // One missing file shouldn't stop the rest from being cached
    await Promise.all([...PAGES, ...ASSETS].map(url =>
      fetch(url, { cache: 'reload' })
        .then(response => (response.ok ? cache.put(url, response) : undefined))
        .catch(() => undefined)
    ));
    await self.skipWaiting();
  })());
});

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
  /\.(?:png|jpg|svg|ico|woff2?)$/.test(url.pathname);

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
