/* IDATSUKA — theme control
   The <head> one-liner sets data-theme before first paint; this owns the
   control that changes it. It lives apart from motion.js because not every
   page loads motion.js (about.html runs its own choreography), and the
   toggle has to work on all of them.

   Dark stays the default: prefers-color-scheme is deliberately not consulted.
   A light reading of this site is a choice, not a guess at one.

   Anything that has to repaint listens for 'themechange' rather than polling
   the attribute (see js/hero-scenes.js). */
(function () {
  'use strict';
  var root = document.documentElement;
  var KEY = 'idatsuka-theme';
  var btn = document.getElementById('themeToggle');

  var meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }

  function isLight() { return root.getAttribute('data-theme') === 'light'; }

  function sync() {
    meta.setAttribute('content', isLight() ? '#fbfbfa' : '#060607');
    if (btn) btn.setAttribute('aria-label', (isLight() ? 'Dark' : 'Light') + ' モードに切り替える');
  }
  sync();

  function apply(theme, remember) {
    root.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
    if (remember) { try { localStorage.setItem(KEY, theme); } catch (e) { } }
    sync();
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: theme } }));
  }

  if (btn) {
    btn.addEventListener('click', function () { apply(isLight() ? 'dark' : 'light', true); });
  }

  /* another tab flipped it — keep the two windows telling the same story */
  window.addEventListener('storage', function (e) {
    if (e.key !== KEY || !e.newValue) return;
    if (e.newValue !== (isLight() ? 'light' : 'dark')) apply(e.newValue, false);
  });
})();
