/* IDATSUKA — site-wide motion system */
(function () {
  'use strict';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(pointer: fine)').matches;

  /* ── Scroll progress bar ── */
  var bar = document.createElement('div');
  bar.className = 'scroll-progress';
  document.body.appendChild(bar);

  /* ── Nav hide on scroll down / reveal on scroll up ── */
  var nav = document.querySelector('nav');
  var hero = document.getElementById('hero');
  var heroInner = document.querySelector('.hero-inner');
  var pageH1 = document.querySelector('.page-header h1');
  var lastY = 0, ticking = false;

  function onScroll() {
    var y = window.scrollY;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = 'scaleX(' + (max > 0 ? y / max : 0) + ')';

    if (nav) {
      if (y > 160 && y > lastY + 4) nav.classList.add('nav-hidden');
      else if (y < lastY - 4 || y < 160) nav.classList.remove('nav-hidden');
    }

    if (!reduced) {
      if (heroInner && hero) {
        var hh = hero.offsetHeight || 1;
        var p = Math.min(y / hh, 1);
        heroInner.style.transform = 'translateY(' + (y * 0.28) + 'px)';
        heroInner.style.opacity = String(1 - p * 1.15);
      }
      if (pageH1) {
        pageH1.style.transform = 'translateY(' + (y * 0.14) + 'px)';
      }
    }

    lastY = y;
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  /* ── Staggered reveals ── */
  var groups = new Map();
  document.querySelectorAll('.rv').forEach(function (el) {
    var p = el.parentElement;
    var i = groups.get(p) || 0;
    groups.set(p, i + 1);
    el.style.transitionDelay = Math.min(i * 90, 450) + 'ms';
  });

  /* ── 3D tilt on cards (desktop) ── */
  if (fine && !reduced) {
    var tiltEls = document.querySelectorAll(
      '.work-card, .work-card-home, .landing-door, .sns-item, .note-card, .skill-item, .landing-stat'
    );
    tiltEls.forEach(function (card) {
      card.addEventListener('pointerenter', function () {
        card.classList.add('tilting');
      });
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform =
          'perspective(900px) rotateY(' + (px * 4).toFixed(2) + 'deg)' +
          ' rotateX(' + (-py * 4).toFixed(2) + 'deg) translateY(-2px)';
      });
      card.addEventListener('pointerleave', function () {
        card.style.transform = '';
        setTimeout(function () { card.classList.remove('tilting'); }, 200);
      });
    });
  }

  /* ── Cursor follower (desktop) ── */
  if (fine && !reduced) {
    var dot = document.createElement('div');
    dot.className = 'cursor-dot';
    var ring = document.createElement('div');
    ring.className = 'cursor-ring';
    document.body.appendChild(dot);
    document.body.appendChild(ring);

    var mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my, seen = false;
    window.addEventListener('pointermove', function (e) {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = 'translate(' + mx + 'px,' + my + 'px)';
      if (!seen) { seen = true; dot.style.opacity = '1'; ring.style.opacity = '1'; rx = mx; ry = my; }
    }, { passive: true });

    (function loop() {
      rx += (mx - rx) * 0.13;
      ry += (my - ry) * 0.13;
      ring.style.transform = 'translate(' + rx + 'px,' + ry + 'px)';
      requestAnimationFrame(loop);
    })();

    document.addEventListener('pointerover', function (e) {
      if (e.target.closest && e.target.closest('a, button, input, textarea, select, canvas')) {
        ring.classList.add('on');
      } else {
        ring.classList.remove('on');
      }
    }, { passive: true });
  }
})();
