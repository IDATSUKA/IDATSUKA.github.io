/* AURORA PINBALL — service worker.
   Network-first for everything, so a new version shows up on the next launch;
   the cache is only the offline fallback. */
const VERSION = 'aurora-v8';
const ASSETS = [
  './',
  './index.html',
  './classic.html',
  './view3d.html',
  './table.js',
  './table-classic.js',
  './scene3d.js',
  './matter.min.js',
  './three.module.min.js',
  './three.core.min.js',
  './board.png',
  './flipperL.png',
  './flipperR.png',
  './plunger.png',
  './bump0.png',
  './bump1.png',
  './bump2.png',
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

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
