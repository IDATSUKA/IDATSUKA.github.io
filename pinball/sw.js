/* AURORA PINBALL — service worker: precache everything for offline play. */
const VERSION = 'aurora-v2';
const ASSETS = [
  './',
  './index.html',
  './classic.html',
  './view3d.html',
  './table.js',
  './scene3d.js',
  './matter.min.js',
  './three.module.min.js',
  './three.core.min.js',
  './playfield-art.png',
  './manifest.json',
  './icon.png',
  './icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// cache-first, falling back to network (and refresh cache in background)
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => {
      const fetched = fetch(e.request).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || fetched;
    })
  );
});
