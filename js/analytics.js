/* IDATSUKA — access measurement
 *
 * Live since 2026-09-13. Figures: https://dash.cloudflare.com
 * → Analytics & Logs → Web Analytics → idatsuka.com
 *
 * The token is not a secret. It ships in the page source of every site that
 * uses Web Analytics, and on its own it grants nothing — it only labels the
 * page views so Cloudflare files them under this site. Emptying TOKEN turns
 * measurement off completely: no request, no cookie, nothing to undo.
 *
 * Why Cloudflare Web Analytics: no cookies and no cross-site identifiers, so
 * no consent banner is required; it does not need the site to be proxied
 * through Cloudflare; and the beacon is about 5 KB, loaded after paint, so
 * it cannot slow the first render.
 *
 * To use something else instead, replace the block at the bottom with that
 * tool's snippet. Everything above it is just the guard.
 */
(function () {
  'use strict';

  var TOKEN = '72122194810b460e9b3fbba7f39b9340';   // idatsuka.com — Cloudflare Web Analytics

  if (!TOKEN) return;

  /* Respect the browser's "do not track" signal. It costs a few visits in
     the numbers and it is the right default for a site that has no login
     and sells nothing that needs tracking. */
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;

  /* Local and preview builds should not land in the production figures. */
  var h = location.hostname;
  if (h === 'localhost' || h === '127.0.0.1' || h.endsWith('.local')) return;

  /* type="module" is what Cloudflare's current snippet uses; module scripts
     are deferred by definition, so this still cannot block the first paint. */
  var s = document.createElement('script');
  s.type = 'module';
  s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  s.setAttribute('data-cf-beacon', JSON.stringify({ token: TOKEN }));
  document.head.appendChild(s);
})();
