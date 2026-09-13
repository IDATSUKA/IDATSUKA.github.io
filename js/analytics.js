/* IDATSUKA — access measurement
 *
 * ────────────────────────────────────────────────────────────
 *  SETUP: paste the site token below, once. That is the whole job.
 * ────────────────────────────────────────────────────────────
 *
 *  1. https://dash.cloudflare.com → Analytics & Logs → Web Analytics
 *  2. "Add a site" → idatsuka.com
 *  3. It shows a snippet containing  "token": "xxxxxxxx…"
 *  4. Copy just that token string into TOKEN below and push.
 *
 * Until the token is filled in, this file does nothing at all — no request,
 * no cookie, no console noise. Nothing to undo if it is left empty.
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

  var TOKEN = '';   // ← paste the Cloudflare Web Analytics site token here

  if (!TOKEN) return;

  /* Respect the browser's "do not track" signal. It costs a few visits in
     the numbers and it is the right default for a site that has no login
     and sells nothing that needs tracking. */
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;

  /* Local and preview builds should not land in the production figures. */
  var h = location.hostname;
  if (h === 'localhost' || h === '127.0.0.1' || h.endsWith('.local')) return;

  var s = document.createElement('script');
  s.defer = true;
  s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  s.setAttribute('data-cf-beacon', JSON.stringify({ token: TOKEN }));
  document.head.appendChild(s);
})();
