/* IDATSUKA — hero background scenes
   Five interactive canvas scenes behind the front-page hero.
   Selection: ?scene=<id>  →  session override (switch button)  →  day-of-year rotation.
   Each scene answers to the cursor, to a drag, and to a click. */
(function () {
  'use strict';

  var canvas = document.getElementById('heroCanvas');
  if (!canvas || !canvas.getContext) return;
  var hero = canvas.parentElement;
  if (!hero) return;
  var ctx = canvas.getContext('2d');

  var TAU = Math.PI * 2;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var narrow = window.matchMedia('(max-width: 600px)').matches;

  var W = 0, H = 0, dpr = 1;

  /* ══════════════════════════════════════════
     Shared helpers
     ══════════════════════════════════════════ */

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function gauss() { return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; }

  /* Pre-rendered glow sprites — no per-particle shadowBlur anywhere. */
  function makeSprite(stops) {
    var s = document.createElement('canvas');
    s.width = s.height = 32;
    var c = s.getContext('2d');
    var g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
    for (var i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
    c.fillStyle = g;
    c.fillRect(0, 0, 32, 32);
    return s;
  }
  /* ══════════════════════════════════════════
     Palette

     Every scene here is additive light: strokes pile towards white on a black
     ground. Run that on paper and it disappears — white plus light is still
     white. So the light theme draws the same geometry the other way round:
     'multiply' instead of 'lighter', ink instead of glow. Nothing below this
     block knows which theme is on; it all reads PAL.
     ══════════════════════════════════════════ */
  var PAL = {};
  var sprite, spriteWhite;

  function readPalette() {
    var light = document.documentElement.getAttribute('data-theme') === 'light';
    PAL.light = light;
    PAL.blend = light ? 'multiply' : 'lighter';

    /* Line work, coolest to densest. The cold end has to be pushed much
       further from the paper than its dark-theme twin is from the black:
       these strokes land at alpha .05–.3, and a 3% grey on white is simply
       not there, while a 3% grey on black reads as structure. */
    PAL.inkDim = light ? 'rgba(104,124,140,1)' : 'rgba(140,168,186,1)';
    PAL.inkCold = light ? 'rgba(116,128,141,1)' : 'rgba(58,63,71,1)';
    PAL.ink = light ? 'rgba(29,109,142,1)' : 'rgba(159,214,236,1)';
    PAL.inkHi = light ? 'rgba(16,72,96,1)' : 'rgba(205,234,246,1)';
    PAL.inkHi2 = light ? 'rgba(14,66,88,1)' : 'rgba(214,238,247,1)';
    PAL.inkMax = light ? 'rgba(10,26,34,1)' : 'rgba(255,255,255,1)';

    /* soft fields */
    PAL.wash = light ? 'rgba(29,109,142,.10)' : 'rgba(159,214,236,.09)';
    PAL.wash2 = light ? 'rgba(29,109,142,.13)' : 'rgba(159,214,236,.12)';
    PAL.washNil = light ? 'rgba(29,109,142,0)' : 'rgba(159,214,236,0)';

    /* the wash that eats the previous frame in the trail scene, and the two
       veils that keep the hero type and the bottom controls legible */
    PAL.trail = light ? 'rgba(251,251,250,.26)' : 'rgba(6,6,7,.26)';
    PAL.veil = light ? '251,251,250' : '6,6,7';

    /* aurora curtains: ice, one restrained secondary tint, and the hot core */
    PAL.curtainIce = light ? [29, 109, 142] : [159, 214, 236];
    PAL.curtainTint = light ? [34, 104, 98] : [144, 206, 202];
    PAL.curtainHot = light ? [12, 52, 70] : [236, 246, 251];

    sprite = makeSprite(light ? [
      [0, 'rgba(16,44,58,1)'],
      [.25, 'rgba(29,109,142,.8)'],
      [.6, 'rgba(29,109,142,.22)'],
      [1, 'rgba(29,109,142,0)']
    ] : [
      [0, 'rgba(255,255,255,1)'],
      [.25, 'rgba(199,231,244,.85)'],
      [.6, 'rgba(159,214,236,.25)'],
      [1, 'rgba(159,214,236,0)']
    ]);
    spriteWhite = makeSprite(light ? [
      [0, 'rgba(18,19,22,1)'],
      [.3, 'rgba(30,42,50,.6)'],
      [.7, 'rgba(29,109,142,.16)'],
      [1, 'rgba(29,109,142,0)']
    ] : [
      [0, 'rgba(255,255,255,1)'],
      [.3, 'rgba(255,255,255,.6)'],
      [.7, 'rgba(226,240,248,.16)'],
      [1, 'rgba(226,240,248,0)']
    ]);
  }
  readPalette();

  /* 2D simplex noise (Gustavson-style, seeded permutation) */
  var perm = new Uint8Array(512);
  (function () {
    var p = new Uint8Array(256), i, j, tmp, s = 1337;
    function rnd() { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }
    for (i = 0; i < 256; i++) p[i] = i;
    for (i = 255; i > 0; i--) { j = (rnd() * (i + 1)) | 0; tmp = p[i]; p[i] = p[j]; p[j] = tmp; }
    for (i = 0; i < 512; i++) perm[i] = p[i & 255];
  })();
  var GX = [1, -1, 1, -1, 1, -1, 0, 0];
  var GY = [1, 1, -1, -1, 0, 0, 1, -1];
  var F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
  function snoise(xin, yin) {
    var s = (xin + yin) * F2;
    var i = Math.floor(xin + s), j = Math.floor(yin + s);
    var t = (i + j) * G2;
    var x0 = xin - (i - t), y0 = yin - (j - t);
    var i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    var x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    var x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    var ii = i & 255, jj = j & 255;
    var n0 = 0, n1 = 0, n2 = 0, g, tt;
    tt = 0.5 - x0 * x0 - y0 * y0;
    if (tt > 0) { tt *= tt; g = perm[ii + perm[jj]] & 7; n0 = tt * tt * (GX[g] * x0 + GY[g] * y0); }
    tt = 0.5 - x1 * x1 - y1 * y1;
    if (tt > 0) { tt *= tt; g = perm[ii + i1 + perm[jj + j1]] & 7; n1 = tt * tt * (GX[g] * x1 + GY[g] * y1); }
    tt = 0.5 - x2 * x2 - y2 * y2;
    if (tt > 0) { tt *= tt; g = perm[ii + 1 + perm[jj + 1]] & 7; n2 = tt * tt * (GX[g] * x2 + GY[g] * y2); }
    return 70 * (n0 + n1 + n2);
  }

  /* ══════════════════════════════════════════
     Scene 01 — RING  (ported verbatim from the original hero orb)
     ══════════════════════════════════════════ */
  function ringScene() {
    var N = narrow ? 700 : 1300;
    var ring = [], dust = [], waves = [];
    var FORCE_R = narrow ? 90 : 150;
    var baseTilt = 0.68;
    var curX = 0, curY = 0, spin = 0, spinVel = 0;
    var P = null, f = 1;
    var w2, h2;

    for (var i = 0; i < N; i++) {
      ring.push({
        theta: (i / N) * TAU + Math.random() * .02,
        rOff: gauss() * .12,
        yOff: gauss() * .045,
        speed: .00018 + Math.random() * .0002,
        size: .6 + Math.random() * 1.3,
        tw: Math.random() * TAU,
        twSpeed: .0004 + Math.random() * .001,
        bright: Math.random() < .08 ? 1.5 : 1,
        ox: 0, oy: 0, ovx: 0, ovy: 0, glow: 0
      });
    }
    for (i = 0; i < (narrow ? 40 : 70); i++) {
      dust.push({
        x: Math.random(), y: Math.random(),
        vy: .00001 + Math.random() * .00004,
        size: .4 + Math.random() * 1.1,
        a: .04 + Math.random() * .12,
        tw: Math.random() * TAU
      });
    }

    return {
      id: 'ring',
      veil: 0,
      label: 'Orbit Ring',
      safe: 0,
      init: function (c, w, h) { w2 = w; h2 = h; },
      resize: function (w, h) { w2 = w; h2 = h; },
      onDrag: function (dx) { spinVel += dx * .00032; },
      onClick: function (x, y, now) {
        waves.push({ x: x, y: y, t0: now });
        if (waves.length > 4) waves.shift();
      },
      update: function (t, dt, pointer) {
        P = pointer;
        f = clamp(dt / 16.667, .2, 3);
        curX += (pointer.nx - curX) * (1 - Math.pow(.97, f));
        curY += (pointer.ny - curY) * (1 - Math.pow(.97, f));
        spin += spinVel * 16 * f;
        spinVel *= Math.pow(.955, f);
        for (var i = waves.length - 1; i >= 0; i--) if (t - waves[i].t0 > 1400) waves.splice(i, 1);
      },
      draw: function (c, t) {
        var px = P.x, py = P.y, pIn = P.in;
        var cx = w2 / 2, cy = h2 * .40;
        var R = Math.min(w2 * .27, h2 * .34);
        var fov = R * 1.7;
        var tilt = baseTilt + curY * .12;
        var cosT = Math.cos(tilt), sinT = Math.sin(tilt);
        var yaw = curX * .22;
        var cosY = Math.cos(yaw), sinY = Math.sin(yaw);
        var i, w, p;

        c.globalCompositeOperation = PAL.blend;

        if (pIn) {
          var g = c.createRadialGradient(px, py, 0, px, py, FORCE_R * 1.4);
          g.addColorStop(0, PAL.wash);
          g.addColorStop(1, PAL.washNil);
          c.fillStyle = g;
          c.fillRect(px - FORCE_R * 1.4, py - FORCE_R * 1.4, FORCE_R * 2.8, FORCE_R * 2.8);
        }

        for (i = 0; i < waves.length; i++) {
          w = waves[i];
          var age = Math.max(0, t - w.t0);
          var wr = Math.max(0, age * .75);
          c.globalAlpha = Math.max(0, 1 - age / 1200) * .35;
          c.strokeStyle = PAL.ink;
          c.lineWidth = 1;
          c.beginPath(); c.arc(w.x, w.y, wr, 0, TAU); c.stroke();
        }

        for (i = 0; i < dust.length; i++) {
          p = dust[i];
          p.y -= p.vy * 16 * f;
          if (p.y < -.02) { p.y = 1.02; p.x = Math.random(); }
          c.globalAlpha = p.a * (.7 + .3 * Math.sin(t * .001 + p.tw));
          var ds = p.size * 4;
          c.drawImage(sprite, p.x * w2 - ds / 2, p.y * h2 - ds / 2, ds, ds);
        }

        var damp = Math.pow(.88, f), glowDamp = Math.pow(.93, f);
        for (i = 0; i < ring.length; i++) {
          p = ring[i];
          if (!reduced) p.theta += p.speed * 16 * f;
          var th = p.theta + spin;
          var r = R * (1 + p.rOff);
          var x = Math.cos(th) * r;
          var z = Math.sin(th) * r;
          var y = p.yOff * R;
          var x2 = x * cosY - z * sinY;
          var z2 = x * sinY + z * cosY;
          var y2 = y * cosT - z2 * sinT;
          var z3 = y * sinT + z2 * cosT;
          var scale = fov / (fov + z3);
          var sx = cx + x2 * scale;
          var sy = cy + y2 * scale;

          var ex = sx + p.ox, ey = sy + p.oy;
          if (pIn) {
            var dx = ex - px, dy = ey - py;
            var d2 = dx * dx + dy * dy;
            if (d2 < FORCE_R * FORCE_R) {
              var d = Math.sqrt(d2) || 1;
              var ff = 1 - d / FORCE_R;
              p.ovx += (dx / d) * ff * 2.2 * f;
              p.ovy += (dy / d) * ff * 2.2 * f;
              if (ff > p.glow) p.glow = ff;
            }
          }
          for (var k = 0; k < waves.length; k++) {
            w = waves[k];
            var wage = Math.max(0, t - w.t0);
            var wrr = Math.max(0, wage * .75);
            var wdx = ex - w.x, wdy = ey - w.y;
            var wd = Math.sqrt(wdx * wdx + wdy * wdy) || 1;
            var band = Math.abs(wd - wrr);
            if (band < 70) {
              var wf = (1 - band / 70) * Math.max(0, 1 - wage / 1200);
              p.ovx += (wdx / wd) * wf * 7 * f;
              p.ovy += (wdy / wd) * wf * 7 * f;
              if (wf > p.glow) p.glow = wf;
            }
          }
          p.ovx += -p.ox * .04 * f; p.ovy += -p.oy * .04 * f;
          p.ovx *= damp; p.ovy *= damp;
          p.ox += p.ovx * f; p.oy += p.ovy * f;
          p.glow *= glowDamp;

          var near = clamp((scale - .62) / 1.8, 0, 1);
          var twinkle = .85 + .15 * Math.sin(t * p.twSpeed + p.tw);
          var a = (.14 + .72 * near) * twinkle * p.bright + p.glow * .8;
          c.globalAlpha = Math.min(a, 1);
          var s = p.size * (1.2 + 5.5 * near + p.glow * 3) * 2;
          c.drawImage(sprite, sx + p.ox - s / 2, sy + p.oy - s / 2, s, s);
        }
      }
    };
  }

  /* ══════════════════════════════════════════
     Scene 02 — FLOW  (curl-noise field, trailing streaks)
     ══════════════════════════════════════════ */
  function flowScene() {
    var N = narrow ? 600 : 1150;
    var BURST_MAX = narrow ? 220 : 380;
    var pts = [], burst = [];
    var fieldAngle = 0, fieldVel = 0, nOff = 0, nOffVel = 0;
    var w2 = 1, h2 = 1;
    var SC = 0.00105;                    // large, laminar features — sweeping lines, not scribble
    var VORT_R = narrow ? 150 : 240;

    function spawn(p) {
      p.x = Math.random() * w2;
      p.y = Math.random() * h2;
      p.px = p.x; p.py = p.y;
      p.life = 22 + Math.random() * 92;
      p.max = p.life;
      p.sp = .7 + Math.random() * 1.25;
      p.bright = Math.random() < .14 ? 2.1 : 1;
      p.hot = 0;
      return p;
    }
    for (var i = 0; i < N; i++) pts.push(spawn({}));

    function field(x, y, out) {
      var e = 6;
      var a = snoise((x + e) * SC + nOff, y * SC);
      var b = snoise((x - e) * SC + nOff, y * SC);
      var cc = snoise(x * SC + nOff, (y + e) * SC);
      var d = snoise(x * SC + nOff, (y - e) * SC);
      var vx = (cc - d), vy = -(a - b);
      var m = Math.sqrt(vx * vx + vy * vy) || 1;
      vx /= m; vy /= m;
      var ca = Math.cos(fieldAngle), sa = Math.sin(fieldAngle);
      out[0] = vx * ca - vy * sa;
      out[1] = vx * sa + vy * ca;
    }
    var fv = [0, 0];

    return {
      id: 'flow',
      veil: .74,
      label: 'Curl Flow',
      safe: .62,
      persistent: true,
      init: function (c, w, h) { w2 = w; h2 = h; for (var i = 0; i < pts.length; i++) spawn(pts[i]); },
      resize: function (w, h) { w2 = w; h2 = h; },
      onDrag: function (dx, dy) { fieldVel += dx * .00022; nOffVel += dy * .00012; },
      onClick: function (x, y) {
        var n = narrow ? 90 : 150;
        for (var i = 0; i < n; i++) {
          var a = (i / n) * TAU + Math.random() * .35;
          var sp = 3.2 + Math.random() * 7.5;
          burst.push({
            x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            life: 1, sz: .45 + Math.random() * .85, w: Math.random() < .22
          });
        }
        while (burst.length > BURST_MAX) burst.shift();
      },
      update: function (t, dt, P) {
        var f = clamp(dt / 16.667, .2, 3);
        fieldAngle += fieldVel * f;
        fieldVel *= Math.pow(.94, f);
        nOff += (nOffVel + .00022) * f;
        nOffVel *= Math.pow(.94, f);

        var i, p, dx, dy, d2, d, w;
        for (i = 0; i < pts.length; i++) {
          p = pts[i];
          p.px = p.x; p.py = p.y;
          field(p.x, p.y, fv);
          var vx = fv[0], vy = fv[1];
          if (P.in) {
            dx = p.x - P.x; dy = p.y - P.y;
            d2 = dx * dx + dy * dy;
            if (d2 < VORT_R * VORT_R) {
              d = Math.sqrt(d2) || 1;
              w = 1 - d / VORT_R;
              // tangential swirl + gentle inward pull
              vx += (-dy / d) * w * 2.6 - (dx / d) * w * .7;
              vy += (dx / d) * w * 2.6 - (dy / d) * w * .7;
              p.hot = Math.max(p.hot || 0, w);
            }
          }
          p.hot = (p.hot || 0) * Math.pow(.94, f);
          var m = Math.sqrt(vx * vx + vy * vy) || 1;
          var step = p.sp * 2.7 * f;
          p.x += (vx / m) * step;
          p.y += (vy / m) * step;
          p.life -= f;
          if (p.life <= 0 || p.x < -30 || p.x > w2 + 30 || p.y < -30 || p.y > h2 + 30) {
            spawn(p); p.px = p.x; p.py = p.y;
          }
        }
        for (i = burst.length - 1; i >= 0; i--) {
          p = burst[i];
          field(p.x, p.y, fv);
          // the field takes them over as their own impulse dies away
          p.vx += (fv[0] * 2.2 - p.vx) * .045 * f;
          p.vy += (fv[1] * 2.2 - p.vy) * .045 * f;
          p.x += p.vx * f; p.y += p.vy * f;
          p.life -= .0065 * f;
          if (p.life <= 0) burst.splice(i, 1);
        }
      },
      draw: function (c, t) {
        // trails: translucent wash instead of a clear
        c.globalCompositeOperation = 'source-over';
        c.globalAlpha = 1;
        c.fillStyle = PAL.trail;
        c.fillRect(0, 0, w2, h2);

        c.globalCompositeOperation = PAL.blend;
        c.lineCap = 'round';

        // bucket the streaks so the whole field costs a handful of strokes
        var buckets = [[], [], [], [], []];
        var i, p;
        for (i = 0; i < pts.length; i++) {
          p = pts[i];
          var lf = p.life / p.max;
          var a = Math.min(1, (lf < .2 ? lf / .2 : (lf > .85 ? (1 - lf) / .15 : 1)) * .62 * p.bright + (p.hot || 0) * .9);
          if (a <= .02) continue;
          var b = Math.min(4, (a * 5) | 0);
          buckets[b].push(p);
        }
        for (var bi = 0; bi < 5; bi++) {
          var arr = buckets[bi];
          if (!arr.length) continue;
          c.globalAlpha = (bi + 1) / 5 * .66;
          c.strokeStyle = bi >= 3 ? PAL.inkHi : PAL.ink;
          c.lineWidth = bi >= 3 ? 1.35 : .85;
          c.beginPath();
          for (i = 0; i < arr.length; i++) {
            p = arr[i];
            c.moveTo(p.px, p.py);
            c.lineTo(p.x, p.y);
          }
          c.stroke();
        }

        for (i = 0; i < burst.length; i++) {
          p = burst[i];
          c.globalAlpha = Math.max(0, Math.min(1, p.life * .85));
          var s = Math.max(0, p.sz * (2.4 + p.life * 4.2));
          c.drawImage(p.w ? spriteWhite : sprite, p.x - s / 2, p.y - s / 2, s, s);
        }
      }
    };
  }

  /* ══════════════════════════════════════════
     Scene 03 — PLEXUS  (drifting nodes + hairline links)
     ══════════════════════════════════════════ */
  function plexusScene() {
    var N = narrow ? 80 : 140;
    var LINK = narrow ? 110 : 140;
    var PULL_R = narrow ? 140 : 200;
    var nodes = [], pulses = [];
    var panVX = 0, panVY = 0;
    var w2 = 1, h2 = 1;
    var M = 60; // wrap margin
    var Pc = { x: -9999, y: -9999, in: false };

    for (var i = 0; i < N; i++) {
      nodes.push({
        x: Math.random(), y: Math.random(),
        vx: (Math.random() - .5) * .22, vy: (Math.random() - .5) * .22,
        sz: .7 + Math.random() * 1.3,
        tw: Math.random() * TAU,
        hot: 0
      });
    }

    return {
      id: 'plexus',
      veil: .3,
      label: 'Plexus',
      safe: .5,
      init: function (c, w, h) {
        w2 = w; h2 = h;
        for (var i = 0; i < nodes.length; i++) {
          nodes[i].x = -M + Math.random() * (w + M * 2);
          nodes[i].y = -M + Math.random() * (h + M * 2);
        }
      },
      resize: function (w, h) { w2 = w; h2 = h; },
      onDrag: function (dx, dy) { panVX += dx * .16; panVY += dy * .16; },
      onClick: function (x, y, now) {
        pulses.push({ x: x, y: y, t0: now });
        if (pulses.length > 3) pulses.shift();
      },
      update: function (t, dt, P) {
        Pc = P;
        var f = clamp(dt / 16.667, .2, 3);
        panVX *= Math.pow(.92, f); panVY *= Math.pow(.92, f);
        var i, n, dx, dy, d2, d, w;
        for (i = 0; i < nodes.length; i++) {
          n = nodes[i];
          n.x += (n.vx + panVX) * f;
          n.y += (n.vy + panVY) * f;
          if (P.in) {
            dx = P.x - n.x; dy = P.y - n.y;
            d2 = dx * dx + dy * dy;
            if (d2 < PULL_R * PULL_R) {
              d = Math.sqrt(d2) || 1;
              w = 1 - d / PULL_R;
              n.x += (dx / d) * w * w * 3.6 * f;
              n.y += (dy / d) * w * w * 3.6 * f;
              if (w > n.hot) n.hot = w;
            }
          }
          n.hot *= Math.pow(.95, f);
          if (n.x < -M) n.x += w2 + M * 2; else if (n.x > w2 + M) n.x -= w2 + M * 2;
          if (n.y < -M) n.y += h2 + M * 2; else if (n.y > h2 + M) n.y -= h2 + M * 2;
        }
        for (i = pulses.length - 1; i >= 0; i--) if (t - pulses[i].t0 > 1700) pulses.splice(i, 1);
      },
      draw: function (c, t) {
        var P = Pc;
        var i, j, a, b, dx, dy, d2, d, n;
        c.globalCompositeOperation = PAL.blend;

        // pulse rings
        for (i = 0; i < pulses.length; i++) {
          var pu = pulses[i];
          var age = Math.max(0, t - pu.t0);
          var pr = Math.max(0, age * .62);
          c.globalAlpha = Math.max(0, 1 - age / 1600) * .4;
          c.strokeStyle = PAL.inkHi2;
          c.lineWidth = 1;
          c.beginPath(); c.arc(pu.x, pu.y, pr, 0, TAU); c.stroke();
        }

        // links
        c.lineWidth = 1;
        for (i = 0; i < nodes.length; i++) {
          a = nodes[i];
          for (j = i + 1; j < nodes.length; j++) {
            b = nodes[j];
            dx = a.x - b.x; dy = a.y - b.y;
            d2 = dx * dx + dy * dy;
            if (d2 > LINK * LINK) continue;
            d = Math.sqrt(d2);
            var prox = 1 - d / LINK;
            var al = prox * prox * .5;
            // pulse flash
            var flash = 0;
            for (var k = 0; k < pulses.length; k++) {
              var p2 = pulses[k];
              var page = Math.max(0, t - p2.t0);
              var prr = Math.max(0, page * .62);
              var mx = (a.x + b.x) * .5 - p2.x, my = (a.y + b.y) * .5 - p2.y;
              var md = Math.sqrt(mx * mx + my * my);
              var band = Math.abs(md - prr);
              if (band < 44) {
                var fl = (1 - band / 44) * Math.max(0, 1 - page / 1500);
                if (fl > flash) flash = fl;
              }
            }
            var hot = Math.max(a.hot, b.hot);
            c.globalAlpha = Math.min(1, al + hot * .35 + flash * .9);
            c.strokeStyle = flash > .12 ? PAL.inkMax
              : (hot > .15 ? PAL.ink : PAL.inkDim);
            c.lineWidth = flash > .12 ? 1.3 : 1;
            c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
          }
        }

        // links to the cursor
        if (P.in) {
          var bg = c.createRadialGradient(P.x, P.y, 0, P.x, P.y, PULL_R);
          bg.addColorStop(0, PAL.wash2);
          bg.addColorStop(1, PAL.washNil);
          c.globalAlpha = 1;
          c.fillStyle = bg;
          c.fillRect(P.x - PULL_R, P.y - PULL_R, PULL_R * 2, PULL_R * 2);
          c.lineWidth = 1.1;
          c.strokeStyle = PAL.ink;
          for (i = 0; i < nodes.length; i++) {
            n = nodes[i];
            dx = n.x - P.x; dy = n.y - P.y;
            d2 = dx * dx + dy * dy;
            if (d2 > PULL_R * PULL_R) continue;
            d = Math.sqrt(d2);
            c.globalAlpha = Math.pow(1 - d / PULL_R, 1.4) * .85;
            c.beginPath(); c.moveTo(P.x, P.y); c.lineTo(n.x, n.y); c.stroke();
          }
          var gs = 34;
          c.globalAlpha = 1;
          c.drawImage(sprite, P.x - gs / 2, P.y - gs / 2, gs, gs);
        }

        // nodes
        for (i = 0; i < nodes.length; i++) {
          n = nodes[i];
          var tw = .72 + .28 * Math.sin(t * .0011 + n.tw);
          c.globalAlpha = Math.min(1, (.42 + n.hot * .6) * tw);
          var s = Math.max(0, n.sz * (5.5 + n.hot * 9));
          c.drawImage(n.hot > .35 ? spriteWhite : sprite, n.x - s / 2, n.y - s / 2, s, s);
        }
      }
    };
  }

  /* ══════════════════════════════════════════
     Scene 04 — AURORA  (layered curtains of light)
     ══════════════════════════════════════════ */
  function auroraScene() {
    var LAYERS = 4;
    var PER = narrow ? 76 : 128;
    var curtains = [], ripples = [];
    var WIND0 = .00016;
    var wind = WIND0, windVel = 0;
    var drift = 0;
    var w2 = 1, h2 = 1;
    var Pc = { x: -9999, y: -9999, in: false };

    /* Soft on every edge: vertical light falloff masked by a horizontal
       feather, so overlapping strokes read as a sheet, not a picket fence. */
    function curtainSprite(r, g, b) {
      var s = document.createElement('canvas');
      s.width = 32; s.height = 160;
      var c = s.getContext('2d');
      var col = function (a) { return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'; };
      var gr = c.createLinearGradient(0, 0, 0, 160);
      gr.addColorStop(0, col(0));
      gr.addColorStop(.14, col(.06));
      gr.addColorStop(.40, col(.30));
      gr.addColorStop(.58, col(.50));
      gr.addColorStop(.78, col(.34));
      gr.addColorStop(1, col(0));
      c.fillStyle = gr;
      c.fillRect(0, 0, 32, 160);
      c.globalCompositeOperation = 'destination-in';
      var hm = c.createLinearGradient(0, 0, 32, 0);
      hm.addColorStop(0, 'rgba(0,0,0,0)');
      hm.addColorStop(.5, 'rgba(0,0,0,1)');
      hm.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = hm;
      c.fillRect(0, 0, 32, 160);
      return s;
    }
    var spIce = curtainSprite(PAL.curtainIce[0], PAL.curtainIce[1], PAL.curtainIce[2]);
    var spTint = curtainSprite(PAL.curtainTint[0], PAL.curtainTint[1], PAL.curtainTint[2]);   // one restrained secondary tint
    var spHot = curtainSprite(PAL.curtainHot[0], PAL.curtainHot[1], PAL.curtainHot[2]);

    for (var L = 0; L < LAYERS; L++) {
      curtains.push({
        seed: L * 37.7,
        depth: L / (LAYERS - 1),
        amp: .85 + L * .10,
        cx: .14 + L * .24,            // each sheet owns a band of the width
        halfW: .32 + (L % 2) * .12,
        speed: .00006 + L * .000035,
        alpha: .62 - L * .072,
        tint: (L === 2) ? spTint : spIce
      });
    }

    return {
      id: 'aurora',
      veil: .9,
      scale: .5,                    // soft curtains — half-res costs nothing visually
      label: 'Aurora',
      safe: .45,
      init: function (c, w, h) { w2 = w; h2 = h; },
      resize: function (w, h) { w2 = w; h2 = h; },
      onDrag: function (dx) { windVel += dx * .0000075; },
      onClick: function (x, y, now) {
        ripples.push({ x: x, t0: now });
        if (ripples.length > 3) ripples.shift();
      },
      update: function (t, dt, P) {
        Pc = P;
        var f = clamp(dt / 16.667, .2, 3);
        wind += windVel * f;
        wind = clamp(wind, -.0011, .0011);
        windVel *= Math.pow(.93, f);
        wind += (WIND0 - wind) * .006 * f;   // settles back to the ambient drift
        drift += wind * dt;
        for (var i = ripples.length - 1; i >= 0; i--) if (t - ripples[i].t0 > 2200) ripples.splice(i, 1);
      },
      draw: function (c, t) {
        var P = Pc;
        c.globalCompositeOperation = PAL.blend;
        var spanX = w2 * 1.3, x0 = -w2 * .15;
        var stepX = spanX / PER;
        var sw = Math.max(5, stepX * 1.7);      // soft-edged strokes, still striated
        var bottom = h2 * 1.02;                 // bright band lands below the tagline
        var CURS_R = narrow ? 170 : 270;

        for (var L = 0; L < curtains.length; L++) {
          var cu = curtains[L];
          var phase = t * cu.speed + drift * (0.5 + cu.depth);
          // bounded sway: drift is unbounded (it drives the noise phase), so the
          // curtain's own position has to ride it through a sine, or a long drag
          // walks every sheet off the canvas.
          var sway = Math.sin(t * .00011 + cu.seed) * .09
            + Math.sin(drift * 1.5 + cu.seed * .6) * .17;
          var centre = cu.cx + sway;
          for (var i = 0; i < PER; i++) {
            var x = x0 + i * stepX;
            var u = x / w2;

            // horizontal envelope — this sheet only exists in its own band
            var env = 1 - Math.abs(u - centre) / cu.halfW;
            if (env <= 0) continue;
            env = env * env * (3 - 2 * env);

            var n = snoise(u * 2.1 + phase * 6, cu.seed);
            var n2 = snoise(u * 5.4 - phase * 9, cu.seed + 11);
            var sine = Math.sin(u * 7.5 + t * .00042 + cu.seed) * .5
              + Math.sin(u * 3.1 - t * .00027 + cu.seed * .7) * .5;
            var hn = (n * .55 + n2 * .28 + sine * .5);
            // fine ridging is what makes a sheet read as a curtain
            var ridge = .66 + .34 * (snoise(u * 27 + phase * 5, cu.seed + 31) * .5 + .5);
            var h = h2 * cu.amp * (.55 + .45 * (hn * .5 + .5)) * (.5 + .5 * env) * ridge;
            var a = cu.alpha * env;
            var dx = 0;
            var spr = cu.tint;

            // cursor: horizontal displacement wave — strokes lift and lean in
            if (P.in) {
              var d = Math.abs(x - P.x);
              if (d < CURS_R) {
                var w = 1 - d / CURS_R;
                w = w * w;
                var lift = (1 - clamp(P.y / h2, 0, 1)) * .55 + .45;
                h += h2 * .26 * w * lift * env;
                dx += (P.x - x) * w * .26;
                a += w * .17 * env;
                if (w > .72) spr = spHot;
              }
            }

            // click: bright ripple running left and right along the curtains
            for (var k = 0; k < ripples.length; k++) {
              var rp = ripples[k];
              var age = Math.max(0, t - rp.t0);
              var front = age * .95;
              var rd = Math.abs(x - rp.x);
              var band = Math.abs(rd - front);
              if (band < 120) {
                var fl = (1 - band / 120) * Math.max(0, 1 - age / 2000);
                h += h2 * .30 * fl * env;
                a += fl * .40 * env;
                if (fl > .45) spr = spHot;
              }
            }

            if (a <= .012) continue;             // nothing to see — skip the blit
            h = Math.max(1, h);
            c.globalAlpha = Math.min(1, a);
            c.drawImage(spr, x + dx - sw / 2, bottom - h, sw, h);
          }
        }

      }
    };
  }

  /* ══════════════════════════════════════════
     Scene 05 — LATTICE  (tilted 3D dot plane)
     ══════════════════════════════════════════ */
  function latticeScene() {
    var G = narrow ? 18 : 26;
    var pts = [];
    var waves = [];
    var PITCH0 = .60;
    var yaw = 0, yawVel = 0, pitch = PITCH0, pitchVel = 0;
    var w2 = 1, h2 = 1;
    var BUMP_R = narrow ? 130 : 190;
    var BUCKETS = 6;
    var BUCKET_A = [.05, .09, .16, .30, .48, .72];
    var bucket = [[], [], [], [], [], []];

    for (var j = 0; j < G; j++) {
      for (var i = 0; i < G; i++) {
        pts.push({
          u: (i / (G - 1)) * 2 - 1,
          v: (j / (G - 1)) * 2 - 1,
          sx: 0, sy: 0, sc: 1, bump: 0, h: 0, vis: 0
        });
      }
    }

    return {
      id: 'lattice',
      veil: .76,
      label: 'Lattice',
      safe: .38,
      init: function (c, w, h) { w2 = w; h2 = h; },
      resize: function (w, h) { w2 = w; h2 = h; },
      onDrag: function (dx, dy) { yawVel += dx * .00035; pitchVel += dy * .00018; },
      onClick: function (x, y, now) {
        waves.push({ x: x, y: y, t0: now });
        if (waves.length > 3) waves.shift();
      },
      update: function (t, dt, P) {
        var f = clamp(dt / 16.667, .2, 3);
        yaw = clamp(yaw + yawVel * f, -.5, .5);
        pitch = clamp(pitch + pitchVel * f, .42, .86);
        yawVel *= Math.pow(.94, f); pitchVel *= Math.pow(.94, f);
        if (yaw <= -.5 || yaw >= .5) yawVel *= -.3;
        if (pitch <= .42 || pitch >= .86) pitchVel *= -.3;
        // gentle recentring
        yawVel += (0 - yaw) * .0006 * f;
        pitchVel += (PITCH0 - pitch) * .0006 * f;

        // a lit floor plane in the lower half — the horizon sits under the logo
        var cx = w2 / 2, cy = h2 * .80;
        var S = Math.min(w2 * .36, h2 * .58);
        var fov = S * 1.75;
        var cosY = Math.cos(yaw), sinY = Math.sin(yaw);
        var cosT = Math.cos(pitch), sinT = Math.sin(pitch);
        var amp = S * .14;
        var i, p, k;

        for (i = 0; i < pts.length; i++) {
          p = pts[i];
          var rr = Math.sqrt(p.u * p.u + p.v * p.v);
          var base = Math.sin(rr * 4.2 - t * .0016) * .55
            + Math.sin(p.u * 3.1 + t * .0009) * .25
            + snoise(p.u * 1.6 + t * .00016, p.v * 1.6) * .5;
          p.h = base * amp;

          // pass 1 — where does this point sit with no bump
          var X = p.u * S, Z = p.v * S, Y = -p.h;
          var x2 = X * cosY - Z * sinY, z2 = X * sinY + Z * cosY;
          var y2 = Y * cosT - z2 * sinT, z3 = Y * sinT + z2 * cosT;
          var sc = fov / (fov + z3);
          var bx = cx + x2 * sc, by = cy + y2 * sc;

          // bump under the pointer + travelling click waves
          var bump = 0;
          if (P.in) {
            var dx = bx - P.x, dy = by - P.y;
            var d = Math.sqrt(dx * dx + dy * dy);
            if (d < BUMP_R) {
              var w = 1 - d / BUMP_R;
              bump += w * w * (3 - 2 * w) * 1.0;
            }
          }
          for (k = 0; k < waves.length; k++) {
            var wv = waves[k];
            var age = Math.max(0, t - wv.t0);
            var front = age * .55;
            var wdx = bx - wv.x, wdy = by - wv.y;
            var wd = Math.sqrt(wdx * wdx + wdy * wdy);
            var band = Math.abs(wd - front);
            if (band < 100) {
              bump += (1 - band / 100) * Math.max(0, 1 - age / 1800) * 1.15;
            }
          }
          p.bump = bump;

          // pass 2 — reproject with the bump applied
          Y = -(p.h + bump * S * .26);
          y2 = Y * cosT - z2 * sinT; z3 = Y * sinT + z2 * cosT;
          sc = fov / (fov + z3);
          p.sx = cx + x2 * sc; p.sy = cy + y2 * sc; p.sc = sc;
          // far rows dissolve into the horizon
          p.vis = clamp((sc - .58) / .62, 0, 1);
        }
      },
      draw: function (c, t) {
        var i, j, p, q;
        c.globalCompositeOperation = PAL.blend;

        // structural hairlines along the grid, brightening where lifted.
        // bucketed so the whole grid costs a handful of strokes.
        for (var b = 0; b < BUCKETS; b++) bucket[b].length = 0;
        for (j = 0; j < G; j++) {
          for (i = 0; i < G; i++) {
            p = pts[j * G + i];
            if (i < G - 1) push(pts[j * G + i + 1], p);
            if (j < G - 1) push(pts[(j + 1) * G + i], p);
          }
        }
        c.lineWidth = 1;
        for (var bi = 0; bi < BUCKETS; bi++) {
          var arr = bucket[bi];
          if (!arr.length) continue;
          var hot = bi >= 3;
          c.globalAlpha = BUCKET_A[bi];
          c.strokeStyle = hot ? PAL.ink : PAL.inkCold;
          c.lineWidth = hot ? 1.1 : 1;
          c.beginPath();
          for (i = 0; i < arr.length; i += 2) {
            c.moveTo(arr[i].sx, arr[i].sy);
            c.lineTo(arr[i + 1].sx, arr[i + 1].sy);
          }
          c.stroke();
        }

        for (i = 0; i < pts.length; i++) {
          p = pts[i];
          var b = Math.min(1.4, p.bump);
          var a = (.10 + .46 * p.vis) + b * .62;
          c.globalAlpha = Math.min(1, a);
          var s = Math.max(0, (1.2 + 5.4 * p.vis + b * 7) * 1.5);
          c.drawImage(b > .45 ? spriteWhite : sprite, p.sx - s / 2, p.sy - s / 2, s, s);
        }
      }
    };

    function push(p, q) {
      var b = Math.max(p.bump, q.bump);
      var a = .09 * Math.min(p.vis, q.vis) + b * .55;
      if (a < .025) return;
      var bi = b > .3 ? (a > .55 ? 5 : (a > .3 ? 4 : 3))
        : (a > .12 ? 2 : (a > .07 ? 1 : 0));
      bucket[bi].push(p, q);
    }
  }

  /* ══════════════════════════════════════════
     Runner
     ══════════════════════════════════════════ */

  var FACTORIES = [ringScene, flowScene, plexusScene, auroraScene, latticeScene];
  var IDS = ['ring', 'flow', 'plexus', 'aurora', 'lattice'];
  var LABELS = ['Orbit Ring', 'Curl Flow', 'Plexus', 'Aurora', 'Lattice'];
  var STORE_KEY = 'hero-scene-override';
  var instances = new Array(FACTORIES.length);

  /* Day-of-year rotation — the hero changes on its own once a day. */
  function dayIndex(nowMs, count) {
    var n = count || FACTORIES.length;
    var d = Math.floor(nowMs / 86400000);
    return ((d % n) + n) % n;
  }

  function storedOverride() {
    var v = null;
    try { v = window.sessionStorage.getItem(STORE_KEY); } catch (e) { }
    if (v === null) { try { v = window.localStorage.getItem(STORE_KEY); } catch (e2) { } }
    return v;
  }

  function pickIndex() {
    var q = null;
    try { q = new URLSearchParams(window.location.search).get('scene'); } catch (e) { }
    if (q) {
      var qi = IDS.indexOf(q);
      if (qi >= 0) return qi;
      var qn = parseInt(q, 10);
      if (!isNaN(qn) && qn >= 0 && qn < IDS.length) return qn;
    }
    var s = storedOverride();
    if (s !== null) {
      var si = IDS.indexOf(s);
      if (si >= 0) return si;
      var sn = parseInt(s, 10);
      if (!isNaN(sn) && sn >= 0 && sn < IDS.length) return sn;
    }
    return dayIndex(Date.now(), IDS.length);
  }

  function getScene(i) {
    if (!instances[i]) {
      var s = FACTORIES[i]();
      s.init(ctx, W, H, { narrow: narrow, dpr: dpr, sprite: sprite });
      instances[i] = s;
    }
    return instances[i];
  }

  /* ── sizing ── */
  function resize() {
    var r = hero.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (var i = 0; i < instances.length; i++) {
      if (instances[i]) {
        instances[i].resize(W, H);
        if (instances[i]._buf) sizeBuf(instances[i]);
      }
    }
    if (reduced) staticFrame();
  }

  /* A scene may declare `scale` to render into a smaller buffer that is then
     upscaled — soft, low-frequency scenes look identical at half resolution and
     cost a quarter of the fill rate. Scene code still draws in CSS pixels. */
  function bufK(s) { return (s.scale || 1) * dpr; }
  function sizeBuf(s) {
    var k = bufK(s);
    s._buf.width = Math.max(1, Math.round(W * k));
    s._buf.height = Math.max(1, Math.round(H * k));
    s._bctx.setTransform(k, 0, 0, k, 0, 0);
    s._bufK = k;
  }
  function ensureBuf(s) {
    if (!s._buf) {
      s._buf = document.createElement('canvas');
      s._bctx = s._buf.getContext('2d');
      sizeBuf(s);
    } else if (s._bufK !== bufK(s) ||
               s._buf.width !== Math.max(1, Math.round(W * bufK(s))) ||
               s._buf.height !== Math.max(1, Math.round(H * bufK(s)))) {
      sizeBuf(s);
    }
    return s;
  }

  /* ── pointer ── */
  var pointer = { x: -9999, y: -9999, in: false, nx: 0, ny: 0, down: false };
  var dragging = false, dragX = 0, dragY = 0, dragT = 0, moved = 0;

  function localPos(e) {
    var r = hero.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  if (!reduced) {
    window.addEventListener('pointermove', function (e) {
      pointer.nx = e.clientX / window.innerWidth - .5;
      pointer.ny = e.clientY / window.innerHeight - .5;
      var l = localPos(e);
      pointer.x = l.x; pointer.y = l.y;
      pointer.in = l.x >= 0 && l.y >= 0 && l.x <= W && l.y <= H;
      if (dragging) {
        var dx = e.clientX - dragX, dy = e.clientY - dragY;
        dragX = e.clientX; dragY = e.clientY;
        moved += Math.abs(dx) + Math.abs(e.movementY || dy);
        eachActive(function (s) { if (s.onDrag) s.onDrag(dx, dy); });
      }
    }, { passive: true });

    hero.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.target.closest && e.target.closest('a, button')) return;
      dragging = true; pointer.down = true;
      dragX = e.clientX; dragY = e.clientY;
      dragT = performance.now(); moved = 0;
      var l = localPos(e);
      pointer.x = l.x; pointer.y = l.y; pointer.in = true;
      hero.classList.add('is-dragging', 'touched');
    });

    function endDrag(e, allowClick) {
      if (!dragging) return;
      dragging = false; pointer.down = false;
      hero.classList.remove('is-dragging');
      if (allowClick && moved < 8 && performance.now() - dragT < 400) {
        var l = localPos(e);
        if (l.x >= 0 && l.y >= 0 && l.x <= W && l.y <= H) {
          var now = performance.now();
          eachActive(function (s) { if (s.onClick) s.onClick(l.x, l.y, now); });
        }
      }
      // a finger leaves no cursor behind — don't pin the hover reaction
      if (e && e.pointerType && e.pointerType !== 'mouse') pointer.in = false;
    }
    window.addEventListener('pointerup', function (e) { endDrag(e, true); });
    window.addEventListener('pointercancel', function (e) { endDrag(e, false); });
    hero.addEventListener('pointerleave', function () { pointer.in = false; });
  }

  /* ── scene switching ── */
  var curIdx = pickIndex();
  var cur = null, prev = null, fadeT0 = 0;
  var FADE = 600;

  function eachActive(fn) {
    if (cur) fn(cur);
    if (prev) fn(prev);
  }

  var hintEl = hero.querySelector('.hero-hint');
  var switchEl = hero.querySelector('.hero-switch');
  var revealT = 0;

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function updateHint() {
    if (!hintEl) return;
    var head = 'Scene ' + pad2(curIdx + 1) + ' / ' + pad2(IDS.length) + ' — ' + LABELS[curIdx];
    hintEl.textContent = reduced ? head
      : (narrow ? head : head + ' · Drag · Click');
    if (switchEl) {
      var nextI = (curIdx + 1) % IDS.length;
      switchEl.setAttribute('aria-label',
        'Background scene ' + (curIdx + 1) + ' of ' + IDS.length + ': ' + LABELS[curIdx] +
        '. Switch to ' + LABELS[nextI] + '.');
      switchEl.setAttribute('title', 'Next scene — ' + LABELS[nextI]);
    }
  }

  function switchTo(i, animate) {
    if (i === curIdx && cur) return;
    var incoming = getScene(i);
    if (cur && animate && !reduced) { prev = cur; fadeT0 = performance.now(); }
    else { prev = null; }
    curIdx = i;
    cur = incoming;
    cur.resize(W, H);
    updateHint();
    if (reduced) staticFrame();
  }

  if (switchEl) {
    switchEl.addEventListener('click', function (e) {
      e.preventDefault();
      var next = (curIdx + 1) % IDS.length;
      try { window.sessionStorage.setItem(STORE_KEY, IDS[next]); } catch (err) { }
      switchTo(next, true);
      if (hintEl) {
        hintEl.classList.add('reveal');
        clearTimeout(revealT);
        revealT = setTimeout(function () { hintEl.classList.remove('reveal'); }, 3200);
      }
      switchEl.blur();
    });
  }

  /* ── the elliptical safe zone that keeps the centre text legible ── */
  function safeZone(c, strength) {
    if (strength <= .003) return;
    var cx = W / 2, cy = H * .46;
    var rx = Math.max(W * .34, 260), ry = Math.max(H * .26, 160);
    c.save();
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    c.translate(cx, cy);
    c.scale(1, ry / rx);
    var g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, 'rgba(' + PAL.veil + ',' + strength.toFixed(3) + ')');
    g.addColorStop(.5, 'rgba(' + PAL.veil + ',' + (strength * .78).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(' + PAL.veil + ',0)');
    c.fillStyle = g;
    c.beginPath(); c.arc(0, 0, rx, 0, TAU); c.fill();
    c.restore();
  }

  /* Grounding veil — the bottom strip carries the hint and the switch, so the
     brightest part of a scene must not sit on top of them. Applied on the main
     canvas (never inside a scene) so a trail-persistent surface can't compound it. */
  function groundVeil(c, strength) {
    if (strength <= .003) return;
    var top = H * .80;
    c.save();
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    var g = c.createLinearGradient(0, top, 0, H);
    g.addColorStop(0, 'rgba(' + PAL.veil + ',0)');
    g.addColorStop(.55, 'rgba(' + PAL.veil + ',' + (strength * .55).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(' + PAL.veil + ',' + strength.toFixed(3) + ')');
    c.fillStyle = g;
    c.fillRect(0, top, W, H - top);
    c.restore();
  }

  function blit(el, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(el, 0, 0, W, H);
    ctx.restore();
  }

  function renderOne(s, alpha, t) {
    var c;
    if (s.persistent || s.scale || alpha < .999) {
      ensureBuf(s);
      c = s._bctx;
      if (!s.persistent) { c.setTransform(s._bufK, 0, 0, s._bufK, 0, 0); c.clearRect(0, 0, W, H); }
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      s.draw(c, t);
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      blit(s._buf, alpha);
    } else {
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      s.draw(ctx, t);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
  }

  var last = 0;
  function frame(t) {
    var dt = last ? Math.min(Math.max(t - last, 0), 50) : 16.667;
    last = t;

    var pa = 0, ca = 1;
    if (prev) {
      var k = clamp((t - fadeT0) / FADE, 0, 1);
      ca = k; pa = 1 - k;
      if (k >= 1) { prev = null; pa = 0; ca = 1; }
    }

    if (prev) prev.update(t, dt, pointer);
    cur.update(t, dt, pointer);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);

    if (prev) renderOne(prev, pa, t);
    renderOne(cur, ca, t);

    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    safeZone(ctx, (prev ? prev.safe * pa : 0) + cur.safe * ca);
    groundVeil(ctx, (prev ? (prev.veil || 0) * pa : 0) + (cur.veil || 0) * ca);

    requestAnimationFrame(frame);
  }

  function staticFrame() {
    if (!cur) return;
    var t = performance.now();
    if (cur.persistent) {
      // one pass of trails would be invisible — build the surface silently first
      ensureBuf(cur);
      for (var i = 0; i < 40; i++) {
        var ti = t + i * 16.667;
        cur.update(ti, 16.667, pointer);
        cur._bctx.globalAlpha = 1; cur._bctx.globalCompositeOperation = 'source-over';
        cur.draw(cur._bctx, ti);
      }
      cur._bctx.globalAlpha = 1; cur._bctx.globalCompositeOperation = 'source-over';
    } else {
      cur.update(t, 16.667, pointer);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);
    if (cur.persistent) blit(cur._buf, 1);
    else renderOne(cur, 1, t);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    safeZone(ctx, cur.safe);
    groundVeil(ctx, cur.veil || 0);
  }

  /* ── boot ── */
  resize();
  window.addEventListener('resize', function () {
    narrow = window.matchMedia('(max-width: 600px)').matches;
    resize();
    updateHint();
  });

  cur = getScene(curIdx);
  cur.resize(W, H);
  updateHint();

  /* ── theme ──
     Sprites and curtain sheets are baked at build time, and the trail scene
     keeps a painted surface, so a repaint is not enough: drop the instances
     and let the same scene id come back in the other palette. */
  window.addEventListener('themechange', function () {
    readPalette();
    for (var i = 0; i < instances.length; i++) instances[i] = null;
    prev = null;
    cur = getScene(curIdx);
    cur.resize(W, H);
    if (reduced) staticFrame();
  });

  if (reduced) staticFrame();
  else requestAnimationFrame(frame);

  /* exposed for tests / debugging */
  window.__heroScenes = {
    ids: IDS,
    labels: LABELS,
    dayIndex: dayIndex,
    current: function () { return IDS[curIdx]; },
    go: function (id) { var i = IDS.indexOf(id); if (i >= 0) switchTo(i, true); }
  };
})();
