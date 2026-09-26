// OpenSky 15s — ambient score, synthesized from scratch (no samples).
// Pad chords change on each aperture cut; a soft piano-like motif marks the openings. Writes out/opensky.wav.
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const SR = 48000, DUR = 15, LEN = SR * DUR, TAU = Math.PI * 2;
const L = new Float32Array(LEN), R = new Float32Array(LEN), VL = new Float32Array(LEN), VR = new Float32Array(LEN);
let seed = 77; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; const noise = () => rnd() * 2 - 1;
const hz = n => 440 * Math.pow(2, (n - 69) / 12); // midi → Hz

function add(t0, n, fn, { gain = 1, pan = 0, send = 0 } = {}) {
  const s0 = Math.round(t0 * SR), gl = gain * Math.cos((pan + 1) * Math.PI / 4), gr = gain * Math.sin((pan + 1) * Math.PI / 4);
  for (let i = 0; i < n; i++) {
    const k = s0 + i; if (k < 0 || k >= LEN) continue;
    const v = fn(i / SR, i);
    L[k] += v * gl * Math.SQRT2; R[k] += v * gr * Math.SQRT2;
    if (send) { VL[k] += v * gl * send; VR[k] += v * gr * send; }
  }
}
function biquad(type, f, q = .707) {
  let b0, b1, b2, a1, a2, x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const set = f => {
    const w = TAU * Math.min(f, SR * .45) / SR, c = Math.cos(w), s = Math.sin(w), a = s / (2 * q), d0 = 1 + a; let n0, n1, n2;
    if (type === 'lp') { n0 = (1 - c) / 2; n1 = 1 - c; n2 = n0; } else if (type === 'hp') { n0 = (1 + c) / 2; n1 = -(1 + c); n2 = n0; } else { n0 = a; n1 = 0; n2 = -a; }
    b0 = n0 / d0; b1 = n1 / d0; b2 = n2 / d0; a1 = -2 * c / d0; a2 = (1 - a) / d0;
  };
  set(f);
  const run = x => { const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
  run.set = set; return run;
}

// soft felt-piano: decaying partials, gentle hammer noise
function piano(t0, note, g = .2, pan = 0) {
  const f = hz(note), parts = [1, 2, 3, 4, 5, 6].map(n => [f * n * (1 + .0004 * n * n), 1 / Math.pow(n, 1.7), 2.6 / (1 + n * .9)]);
  const lp = biquad('lp', 2600);
  add(t0, SR * 4, (t) => {
    let s = 0; for (const [fr, a, d] of parts) s += Math.sin(TAU * fr * t) * a * Math.exp(-t / d);
    return lp(s * Math.min(1, t / .004) + (t < .01 ? noise() * .05 * (1 - t / .01) : 0));
  }, { gain: g, pan, send: .75 });
}
function pad(t0, t1, notes, g = .07, fadeIn = .9, fadeOut = 1.1) {
  const len = t1 - t0 + fadeOut, lp = biquad('lp', 900), ph = notes.map(() => [rnd(), rnd(), rnd()]);
  add(t0, SR * len, (t) => {
    let s = 0;
    notes.forEach((n, i) => { const f = hz(n); [.996, 1, 1.0045].forEach((d, j) => { ph[i][j] += f * d / SR; s += 2 * (ph[i][j] % 1) - 1; }); });
    lp.set(700 + 500 * Math.sin(t * .8) ** 2);
    const e = Math.min(1, t / fadeIn) * (t > t1 - t0 ? Math.max(0, 1 - (t - (t1 - t0)) / fadeOut) : 1);
    return lp(s / (notes.length * 3)) * e;
  }, { gain: g, send: .6 });
}
function air(t0, t1, g = .05, f = 900) { // breath / room tone
  const bp = biquad('bp', f, .6), len = t1 - t0;
  add(t0, SR * len, t => bp(noise()) * Math.min(1, t / .8, (len - t) / .8), { gain: g, send: .3 });
}
function openSwell(t0, g = .16) { // the aperture: filtered noise rising and blooming
  const bp = biquad('bp', 300, 1.1), len = 1.4;
  add(t0 - .45, SR * len, t => { const k = t / len; bp.set(250 * Math.pow(18, Math.sin(k * Math.PI * .9))); return bp(noise()) * Math.sin(k * Math.PI) ** 2 * 1.8; }, { gain: g, send: .5 });
  add(t0 + .05, SR * 2.2, t => Math.sin(TAU * 49 * t) * Math.min(1, t / .05) * Math.exp(-t / .7), { gain: g * .55 });
}
function rain(t0, t1, g = .06) {
  const hp = biquad('hp', 1800), len = t1 - t0;
  add(t0, SR * len, t => hp(noise()) * Math.min(1, t / .6, (len - t) / .9) * (.8 + .2 * Math.sin(t * 1.3)), { gain: g, pan: 0, send: .15 });
  for (let i = 0; i < 70; i++) { const tt = t0 + rnd() * len, f = 2500 + rnd() * 3500; add(tt, SR * .03, t => Math.sin(TAU * f * t) * Math.exp(-t / .004), { gain: .025 * Math.min(1, (tt - t0) / .6, (t1 - tt) / .9), pan: rnd() * 2 - 1, send: .3 }); }
}
function chime(t0, g = .1) { // star
  [[88, 1], [95, .5], [100, .3], [107, .15]].forEach(([n, a], i) => add(t0 + i * .06, SR * 3, t => Math.sin(TAU * hz(n) * t) * Math.exp(-t / 1.1) * a * Math.min(1, t / .002), { gain: g, pan: (i - 1.5) * .3, send: .9 }));
}

// ---------- score (D major, slow) ----------
// cuts: 0 / 3.3 / 6.4 / 9.4, tilt 10.95–12.75, logo 12.45–
pad(0.0, 3.3, [50, 57, 61, 64, 66], .09, 1.2);          // Dmaj9
pad(3.3, 6.4, [47, 54, 57, 62, 64], .09);               // Bm11
pad(6.4, 9.4, [43, 50, 54, 57, 61], .09);               // Gmaj7#11 colour
pad(9.4, 12.45, [45, 52, 57, 61, 64], .09);             // A(add9)
pad(12.45, 14.2, [50, 57, 62, 66, 69, 73], .09, .8, .75);  // Dmaj7 — resolves
air(0.0, 15.0, .035, 700);
rain(9.4, 11.6, .05);
for (const c of [0.0, 3.3, 6.4, 9.4]) openSwell(c + .45, c === 0 ? .12 : .16);
const MOTIF = [[.55, 74], [1.25, 69], [3.75, 78], [4.45, 76], [6.85, 74], [7.55, 71], [9.85, 69], [10.55, 76], [11.6, 78], [12.0, 81]];
MOTIF.forEach(([t, n], i) => piano(t, n, .17, i % 2 ? .25 : -.25));
piano(9.85, 57, .1); piano(12.5, 50, .16); piano(12.5, 62, .1); piano(12.52, 66, .1); piano(12.54, 69, .09);
chime(13.1, .07);
chime(13.45, .04); // meteor

// ---------- reverb ----------
function comb(b, d, fb, damp) { const o = new Float32Array(b.length); let lp = 0; for (let i = 0; i < b.length; i++) { const y = i >= d ? o[i - d] : 0; lp = y * (1 - damp) + lp * damp; o[i] = b[i] + lp * fb; } return o; }
function allpass(b, d, gg) { const o = new Float32Array(b.length); for (let i = 0; i < b.length; i++) { const bd = i >= d ? b[i - d] : 0, od = i >= d ? o[i - d] : 0; o[i] = -gg * b[i] + bd + gg * od; } return o; }
function verb(inp, off) {
  const sum = new Float32Array(inp.length);
  for (const d of [1557, 1617, 1491, 1422, 1277, 1356]) { const c = comb(inp, Math.round(d * 1.6) + off, .88, .42); for (let i = 0; i < sum.length; i++) sum[i] += c[i] / 6; }
  return allpass(allpass(sum, 341 + off, .6), 811 + off, .6);
}
const rl = verb(VL, 0), rr = verb(VR, 37);

// ---------- master ----------
const oL = new Float32Array(LEN), oR = new Float32Array(LEN), hL = biquad('hp', 30), hR = biquad('hp', 30);
let peak = 0;
for (let i = 0; i < LEN; i++) {
  const t = i / SR, edge = Math.min(1, t / .02, (DUR - t) / .6);
  oL[i] = Math.tanh(hL(L[i] + rl[i] * .5) * 1.2) * edge; oR[i] = Math.tanh(hR(R[i] + rr[i] * .5) * 1.2) * edge;
  peak = Math.max(peak, Math.abs(oL[i]), Math.abs(oR[i]));
}
const norm = .84 / peak;
const buf = Buffer.alloc(44 + LEN * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + LEN * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(LEN * 4, 40);
const cl = x => Math.max(-1, Math.min(1, x));
for (let i = 0; i < LEN; i++) { buf.writeInt16LE(Math.round(cl(oL[i] * norm) * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(cl(oR[i] * norm) * 32767), 46 + i * 4); }
const dir = path.dirname(fileURLToPath(import.meta.url));
mkdirSync(path.join(dir, 'out'), { recursive: true });
writeFileSync(path.join(dir, 'out', 'opensky.wav'), buf);
console.log('peak', peak.toFixed(3));
