// Builds the board + moving-part sprites from the reference render.
//
//   REF=/path/to/reference.png node build-assets.cjs
//
// The reference photo itself is not kept in the repository; only the derived
// images are. All cut-out geometry comes from table.js (T.G), so the sprites
// always line up with the physics.
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');
const T = require('./table.js');
const G = T.G, SP = G.sprites;
const OUT = __dirname;
const REF = process.env.REF;
if (!REF) { console.error('set REF=/path/to/reference.png'); process.exit(1); }

// tapered flipper outline (union of circles from pivot r1 to tip r2), swept
// straight down from dy0 to dy1 to cover the bat's body as well as its cap
function flipperMask(ctx, f, ox, oy, pad, dy0, dy1) {
  ctx.beginPath();
  for (let dy = dy0; dy <= dy1; dy += 2) {
    for (let i = 0; i <= 48; i++) {
      const u = i / 48;
      const cx = f.piv[0] + (f.tip[0] - f.piv[0]) * u - ox;
      const cy = f.piv[1] + (f.tip[1] - f.piv[1]) * u + dy - oy;
      const r = f.r1 + (f.r2 - f.r1) * u + pad;
      ctx.moveTo(cx + r, cy); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    }
  }
}
// which side of the apron edge line a point is on (true = playfield side)
function playSide(line, x, y, pf) {
  const [[ax, ay], [bx, by]] = line;
  const l = Math.hypot(bx - ax, by - ay);
  const s = ((bx - ax) * (y - ay) - (by - ay) * (x - ax)) / l;
  const r = (bx - ax) * (pf[1] - ay) - (by - ay) * (pf[0] - ax);
  return Math.sign(r) * s > 5;                       // keep clear of the edge's chrome trim
}

// diffusion (Laplace) inpainting of a masked region. Only the surrounding
// light playfield pixels are used as boundary values; dark trim (apron edge,
// inlane guide) is solved over rather than smeared into the fill.
function inpaint(ctx, x0, y0, w, h, maskFn, iters) {
  const id = ctx.getImageData(x0, y0, w, h), d = id.data;
  const m = new Uint8Array(w * h), free = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, luma = 0.3 * d[i * 4] + 0.59 * d[i * 4 + 1] + 0.11 * d[i * 4 + 2];
    m[i] = maskFn(x0 + x, y0 + y) ? 1 : 0;
    free[i] = m[i] || luma < 150 ? 1 : 0;
  }
  for (let c = 0; c < 3; c++) {
    const a = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) a[i] = d[i * 4 + c];
    solve(a, free, w, h, iters);
    for (let i = 0; i < w * h; i++) if (m[i]) d[i * 4 + c] = a[i];
  }
  for (let i = 0; i < w * h; i++) if (m[i]) {
    const n = (Math.random() - 0.5) * 5;                 // a little grain so it isn't plastic
    for (let c = 0; c < 3; c++) d[i * 4 + c] = Math.max(0, Math.min(255, d[i * 4 + c] + n));
  }
  ctx.putImageData(id, x0, y0);
}
// multi-scale Laplace solve: the coarse level gives the free pixels a good
// start (plain Gauss-Seidel on a big hole never converges and leaves a flat,
// too-bright patch), then each finer level relaxes it
function solve(a, free, w, h, iters) {
  if (w > 24 && h > 24) {
    const cw = w >> 1, ch = h >> 1, ca = new Float32Array(cw * ch), cf = new Uint8Array(cw * ch);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      let s = 0, n = 0;
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const i = (2 * y + dy) * w + 2 * x + dx; if (!free[i]) { s += a[i]; n++; }
      }
      ca[y * cw + x] = n ? s / n : 0; cf[y * cw + x] = n ? 0 : 1;
    }
    solve(ca, cf, cw, ch, iters);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; if (free[i]) a[i] = ca[Math.min(ch - 1, y >> 1) * cw + Math.min(cw - 1, x >> 1)];
    }
  } else {
    let s = 0, n = 0; for (let i = 0; i < w * h; i++) if (!free[i]) { s += a[i]; n++; }
    for (let i = 0; i < w * h; i++) if (free[i]) a[i] = n ? s / n : 200;
  }
  for (let it = 0; it < iters; it++)
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x; if (free[i]) a[i] = (a[i - 1] + a[i + 1] + a[i - w] + a[i + w]) * 0.25;
    }
}

(async () => {
  const img = await loadImage(REF);
  const W = img.width, H = img.height;
  if (W !== T.PHOTO_W || H !== T.PHOTO_H) throw new Error('unexpected reference size ' + W + 'x' + H);

  // ── board: photo with the flippers + plunger rod removed ──
  const bd = createCanvas(W, H), b = bd.getContext('2d');
  b.drawImage(img, 0, 0);
  const mcv = createCanvas(W, H), mx = mcv.getContext('2d');
  const BODY = SP.flipBody;
  mx.fillStyle = '#fff';
  // the whole bat: cap, dark rim and the black body below it
  [G.flipL, G.flipR].forEach(f => { flipperMask(mx, f, 0, 0, BODY.rim + 4, -3, BODY.h + 5); mx.fill(); flipperMask(mx, f, 0, 0, BODY.rim + 10, 8, BODY.h + 30); mx.fill(); });
  const md = mx.getImageData(0, 0, W, H).data;
  const flips = [G.flipL, G.flipR];
  const inMask = (x, y) => {
    if (md[(y * W + x) * 4 + 3] <= 20) return false;
    // never paint over the apron / inlane guide the bat sits against
    const k = x < G.CL ? 0 : 1, f = flips[k];
    return playSide(SP.flipApron[k], x, y, [(f.piv[0] + f.tip[0]) / 2, f.piv[1] - 30]);
  };
  flips.forEach(f => {
    const xs = [f.piv[0], f.tip[0]], ys = [f.piv[1], f.tip[1]];
    const x0 = Math.min(...xs) - 60, y0 = Math.min(...ys) - 55;
    const x1 = Math.max(...xs) + 65, y1 = Math.max(...ys) + 75;
    inpaint(b, x0, y0, x1 - x0, y1 - y0, inMask, 300);
  });
  // plunger: the rod's vacated top is refilled with the empty lane just above it
  const pr = SP.plunger;
  b.drawImage(img, pr.x + 14, pr.y - 60, 44, 60, pr.x + 14, pr.y, 44, 60);
  fs.writeFileSync(path.join(OUT, 'board.png'), bd.toBuffer('image/png'));

  // ── flipper cap sprites (square, centred on the pivot) ──
  const S = SP.flipS;
  [['flipperL', G.flipL], ['flipperR', G.flipR]].forEach(([name, f]) => {
    const cv = createCanvas(S, S), x = cv.getContext('2d');
    const ox = f.piv[0] - S / 2, oy = f.piv[1] - S / 2;
    x.drawImage(img, ox, oy, S, S, 0, 0, S, S);
    x.globalCompositeOperation = 'destination-in';
    flipperMask(x, f, ox, oy, 2.5, 0, 0); x.fillStyle = '#fff'; x.fill();
    fs.writeFileSync(path.join(OUT, name + '.png'), cv.toBuffer('image/png'));
  });

  // ── plunger sprite: rod + spring + knob only (lane walls stay on the board) ──
  {
    const cv = createCanvas(pr.w, pr.h), x = cv.getContext('2d');
    x.drawImage(img, pr.x, pr.y, pr.w, pr.h, 0, 0, pr.w, pr.h);
    x.globalCompositeOperation = 'destination-in';
    x.beginPath();                                      // assembly outline (photo px, relative)
    const poly = [[16, 8], [44, 8], [46, 90], [44, 215], [78, 220], [80, 318], [90, 322], [90, 408], [32, 408], [32, 322], [36, 318], [34, 220], [30, 90], [16, 40]];
    poly.forEach(([px, py], i) => i ? x.lineTo(px, py) : x.moveTo(px, py));
    x.closePath(); x.fillStyle = '#fff'; x.fill();
    fs.writeFileSync(path.join(OUT, 'plunger.png'), cv.toBuffer('image/png'));
  }

  // ── pop-bumper caps (animated down/up on each hit) ──
  SP.caps.forEach((cp, i) => {
    const s = cp.r * 2 + 4, cv = createCanvas(s, s), x = cv.getContext('2d');
    x.drawImage(img, cp.c[0] - s / 2, cp.c[1] - s / 2, s, s, 0, 0, s, s);
    x.globalCompositeOperation = 'destination-in';
    x.beginPath(); x.ellipse(s / 2, s / 2, cp.r, cp.r * 0.86, 0, 0, Math.PI * 2); x.fillStyle = '#fff'; x.fill();
    fs.writeFileSync(path.join(OUT, 'bump' + i + '.png'), cv.toBuffer('image/png'));
  });
  // ── clear ramp cap: only its bright plastic edges (alpha from brightness) ──
  {
    const rc = SP.rampCap, cv = createCanvas(rc.w, rc.h), x = cv.getContext('2d');
    x.drawImage(img, rc.x, rc.y, rc.w, rc.h, 0, 0, rc.w, rc.h);
    const id = x.getImageData(0, 0, rc.w, rc.h), d = id.data;
    const pm = createCanvas(rc.w, rc.h), pmx = pm.getContext('2d');
    pmx.beginPath(); rc.poly.forEach(([px, py], i) => i ? pmx.lineTo(px - rc.x, py - rc.y) : pmx.moveTo(px - rc.x, py - rc.y));
    pmx.closePath(); pmx.fillStyle = '#fff'; pmx.fill();
    const md2 = pmx.getImageData(0, 0, rc.w, rc.h).data;
    for (let i = 0; i < rc.w * rc.h; i++) {
      const l = 0.3 * d[i * 4] + 0.59 * d[i * 4 + 1] + 0.11 * d[i * 4 + 2];
      d[i * 4 + 3] = Math.round(Math.max(0, Math.min(1, (l - 55) / 110)) * 235 * (md2[i * 4 + 3] / 255));
    }
    x.putImageData(id, 0, 0);
    fs.writeFileSync(path.join(OUT, 'rampcap.png'), cv.toBuffer('image/png'));
  }
  console.log('assets built');
})().catch(e => { console.error(e); process.exit(1); });
