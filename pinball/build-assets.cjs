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

// tapered flipper mask = union of circles from pivot (r1) to tip (r2),
// plus the same shape shifted down to include the flipper's visible side face
function flipperMask(ctx, f, ox, oy, pad) {
  const [sx, sy] = SP.flipSide;
  ctx.beginPath();
  for (const [dx, dy] of [[0, 0], [sx, sy], [sx * 0.5, sy * 0.5], [sx * 0.25, sy * 0.25], [sx * 0.75, sy * 0.75]]) {
    for (let i = 0; i <= 48; i++) {
      const u = i / 48;
      const cx = f.piv[0] + (f.tip[0] - f.piv[0]) * u + dx - ox;
      const cy = f.piv[1] + (f.tip[1] - f.piv[1]) * u + dy - oy;
      const r = f.r1 + (f.r2 - f.r1) * u + pad;
      ctx.moveTo(cx + r, cy); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    }
  }
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
  const ch = [0, 1, 2].map(c => { const a = new Float32Array(w * h); for (let i = 0; i < w * h; i++) a[i] = d[i * 4 + c]; return a; });
  for (const a of ch) {
    let s = 0, n = 0;
    for (let i = 0; i < w * h; i++) if (!free[i]) { s += a[i]; n++; }
    for (let i = 0; i < w * h; i++) if (free[i]) a[i] = n ? s / n : 200;
  }
  for (let it = 0; it < iters; it++) {
    for (const a of ch) {
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const i = y * w + x; if (!free[i]) continue;
        a[i] = (a[i - 1] + a[i + 1] + a[i - w] + a[i + w]) * 0.25;
      }
    }
  }
  for (let i = 0; i < w * h; i++) if (m[i]) {
    const n = (Math.random() - 0.5) * 6;                 // a little grain so it isn't plastic
    for (let c = 0; c < 3; c++) d[i * 4 + c] = Math.max(0, Math.min(255, ch[c][i] + n));
  }
  ctx.putImageData(id, x0, y0);
}

(async () => {
  const img = await loadImage(REF);
  const W = img.width, H = img.height;
  if (W !== T.PHOTO_W || H !== T.PHOTO_H) throw new Error('unexpected reference size ' + W + 'x' + H);

  // ── board: photo with the flippers + plunger rod removed ──
  const bd = createCanvas(W, H), b = bd.getContext('2d');
  b.drawImage(img, 0, 0);
  const mcv = createCanvas(W, H), mx = mcv.getContext('2d');
  mx.fillStyle = '#fff';
  [G.flipL, G.flipR].forEach(f => { flipperMask(mx, f, 0, 0, 4.5); mx.fill(); });
  const md = mx.getImageData(0, 0, W, H).data;
  const inMask = (x, y) => md[(y * W + x) * 4 + 3] > 20;
  [G.flipL, G.flipR].forEach(f => {
    const xs = [f.piv[0], f.tip[0]], ys = [f.piv[1], f.tip[1]];
    const x0 = Math.min(...xs) - 50, y0 = Math.min(...ys) - 45;
    const x1 = Math.max(...xs) + 55, y1 = Math.max(...ys) + 60;
    inpaint(b, x0, y0, x1 - x0, y1 - y0, inMask, 900);
  });
  // plunger: the rod's vacated top is refilled with the empty lane just above it
  const pr = SP.plunger;
  b.drawImage(img, pr.x + 14, pr.y - 60, 44, 60, pr.x + 14, pr.y, 44, 60);
  fs.writeFileSync(path.join(OUT, 'board.png'), bd.toBuffer('image/png'));

  // ── flipper sprites (square, centred on the pivot) ──
  const S = SP.flipS;
  [['flipperL', G.flipL], ['flipperR', G.flipR]].forEach(([name, f]) => {
    const cv = createCanvas(S, S), x = cv.getContext('2d');
    const ox = f.piv[0] - S / 2, oy = f.piv[1] - S / 2;
    x.drawImage(img, ox, oy, S, S, 0, 0, S, S);
    x.globalCompositeOperation = 'destination-in';
    flipperMask(x, f, ox, oy, 3); x.fillStyle = '#fff'; x.fill();
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
  console.log('assets built');
})().catch(e => { console.error(e); process.exit(1); });
