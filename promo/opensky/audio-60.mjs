// OpenSky 60s — ambient score, synthesized from scratch (no samples).
// Pad chords change on each aperture cut; a soft piano-like motif marks the openings. Writes out/opensky-60.wav.
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const SR = 48000, DUR = 60, LEN = SR * DUR, TAU = Math.PI * 2;
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

// ---------- score (D major, ~72 bpm feel) ----------
// prologue 0–5.6 / 01 LIGHT 5.6 / 02 TEXTURE 16.8 / 03 WINDOW 28.4 / 04 CITY 40.0 / tilt 51–53.2 / statement 53.4 / logo 56.5
function pulse(t0, t1, note, g = .08, beat = 60 / 72) { // soft low heartbeat
  for (let t = t0; t < t1 - .1; t += beat) add(t, SR * .9, x => Math.sin(TAU * hz(note) * x) * Math.min(1, x / .01) * Math.exp(-x / .28), { gain: g * Math.min(1, (t - t0) / 2 + .3) });
}
// prologue: near-silence, one held low note and two questions on the piano
add(0, SR * 6.2, t => Math.sin(TAU * hz(38) * t) * Math.min(1, t / 3) * Math.max(0, 1 - Math.max(0, t - 5.4) / .8) * .9, { gain: .09 });
air(0.0, 60.0, .03, 700);
piano(0.9, 69, .12, -.2); piano(3.25, 66, .12, .2); piano(4.6, 64, .08, 0);
// pads follow the shots
const PADS = [
  [5.6, 11.6, [50, 57, 61, 64, 66]],   // Dmaj9
  [11.6, 16.8, [43, 50, 54, 57, 62]],  // Gmaj7
  [16.8, 22.6, [47, 54, 57, 62, 64]],  // Bm11
  [22.6, 28.4, [40, 52, 55, 59, 62]],  // Em9
  [28.4, 34.2, [43, 50, 54, 57, 61]],  // Gmaj7#11
  [34.2, 40.0, [45, 52, 57, 59, 64]],  // Asus
  [40.0, 45.8, [45, 52, 57, 61, 64]],  // A(add9)
  [45.8, 50.9, [42, 54, 57, 61, 64]],  // F#m7
  [50.9, 53.4, [47, 54, 59, 62, 66]],  // Bm(add9) — the tilt
  [53.4, 56.5, [43, 55, 59, 62, 66]],  // Gmaj7 — statement
];
for (const [a, b, n] of PADS) pad(a, b, n, .085, a === 5.6 ? 1.4 : .9);
pad(56.5, 59.2, [50, 57, 62, 66, 69, 73], .1, .8, .8); // Dmaj7 — resolves on the logo
// aperture openings and the within-chapter dissolves
for (const c of [5.6, 16.8, 28.4, 40.0]) openSwell(c + .5, .16);
for (const c of [11.6, 22.6, 34.2, 45.8, 49.8]) { const bp = biquad('bp', 900, .9); add(c - .2, SR * 1.6, t => bp(noise()) * Math.sin(Math.min(1, t / 1.6) * Math.PI) ** 2 * 1.2, { gain: .05, send: .5 }); }
// motif: one short phrase per line of copy
const PH = [
  [7.0, [74, 69, 71]], [12.6, [78, 76, 74, 71]], [18.1, [71, 66, 69]], [23.6, [76, 74, 71, 69]],
  [29.7, [74, 76, 78]], [35.2, [81, 78, 76, 74]], [41.3, [69, 74, 76, 78]], [46.6, [78, 81, 78, 76]],
];
PH.forEach(([t0, notes], j) => notes.forEach((n, i) => piano(t0 + i * .62 + (i === notes.length - 1 ? .25 : 0), n, .15 - i * .01, (i % 2 ? .25 : -.25) * (j % 2 ? -1 : 1))));
pulse(28.4, 50.6, 38, .07);
rain(40.0, 50.9, .05);
// tilt: everything rises into the open sky
{ const bp = biquad('bp', 300, 1.3); add(50.6, SR * 2.8, t => { const k = t / 2.8; bp.set(250 * Math.pow(24, k)); return bp(noise()) * Math.pow(k, 2) * 2; }, { gain: .12, send: .6 }); }
piano(53.4, 74, .14, -.2); piano(54.3, 78, .14, .2); piano(54.95, 81, .1, 0);
chime(54.9, .035); // meteor
piano(56.5, 50, .16); piano(56.5, 62, .1); piano(56.52, 66, .1); piano(56.54, 69, .09); piano(57.1, 81, .1, .2);
chime(57.1, .07); chime(57.9, .03);

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
  const t = i / SR, edge = Math.min(1, t / .02, (DUR - t) / 1.2);
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
writeFileSync(path.join(dir, 'out', 'opensky-60.wav'), buf);
console.log('peak', peak.toFixed(3));
