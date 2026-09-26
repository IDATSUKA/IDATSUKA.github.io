// Sound design for reel.html, synthesized from scratch (no samples).
// 120 bpm, cues locked to the picture's hit list. Writes out/reel.wav (48 kHz, stereo, 16-bit, 15.000 s).
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const SR = 48000, DUR = 15, LEN = SR * DUR;
const L = new Float32Array(LEN), R = new Float32Array(LEN);      // dry bus
const VL = new Float32Array(LEN), VR = new Float32Array(LEN);    // reverb send
const TAU = Math.PI * 2;
let seed = 1234;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const noise = () => rnd() * 2 - 1;

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
  const set = (f) => {
    const w = TAU * Math.min(f, SR * .45) / SR, c = Math.cos(w), s = Math.sin(w), a = s / (2 * q);
    let n0, n1, n2; const d0 = 1 + a;
    if (type === 'lp') { n0 = (1 - c) / 2; n1 = 1 - c; n2 = (1 - c) / 2; }
    else if (type === 'hp') { n0 = (1 + c) / 2; n1 = -(1 + c); n2 = (1 + c) / 2; }
    else { n0 = a; n1 = 0; n2 = -a; }
    b0 = n0 / d0; b1 = n1 / d0; b2 = n2 / d0; a1 = -2 * c / d0; a2 = (1 - a) / d0;
  };
  set(f);
  const run = x => { const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
  run.set = set; return run;
}
const env = (t, a, d) => t < a ? t / a : Math.exp(-(t - a) / d);

// ---------- instruments ----------
function kick(t0, g = 1) {
  let ph = 0;
  add(t0, SR * .6, (t) => {
    const f = 42 + 110 * Math.exp(-t / .035);
    ph += TAU * f / SR;
    return Math.tanh(Math.sin(ph) * 1.6) * env(t, .002, .22) * .9 + (t < .004 ? noise() * .3 : 0);
  }, { gain: g });
}
function hat(t0, g = .12, pan = .2) {
  const hp = biquad('hp', 8000);
  add(t0, SR * .08, (t) => hp(noise()) * env(t, .001, .018), { gain: g, pan });
}
function click(t0, g = .25, f = 2400, pan = 0) {
  add(t0, SR * .05, (t) => (Math.sin(TAU * f * t) * .6 + noise() * .4) * env(t, .0005, .006), { gain: g, pan, send: .2 });
}
function snare(t0, g = .5) {
  const bp = biquad('bp', 1900, .8);
  add(t0, SR * .4, (t) => bp(noise()) * env(t, .001, .07) * 2 + Math.sin(TAU * 190 * t) * env(t, .001, .04) * .5, { gain: g, send: .35 });
}
function impact(t0, g = 1) {
  kick(t0, 1.1 * g);
  const lp = biquad('lp', 3200);
  add(t0, SR * 1.2, (t) => { lp.set(3200 * Math.exp(-t / .12) + 200); return lp(noise()) * env(t, .001, .16); }, { gain: .55 * g, send: .5 });
  add(t0, SR * 1.8, (t) => Math.sin(TAU * 41 * t) * env(t, .01, .6), { gain: .5 * g });
}
function whoosh(tc, len = .5, g = .35, f0 = 300, f1 = 5000, panSweep = true) {
  const bp = biquad('bp', f0, 1.4);
  const t0 = tc - len / 2;
  add(t0, SR * len, (t) => {
    const k = t / len; bp.set(f0 * Math.pow(f1 / f0, Math.sin(k * Math.PI)));
    return bp(noise()) * Math.pow(Math.sin(k * Math.PI), 2) * 2.2;
  }, { gain: g, send: .3 });
}
function riser(t0, t1, g = .35) {
  const bp = biquad('bp', 400, 2.5), len = t1 - t0;
  let ph = 0;
  add(t0, SR * len, (t) => {
    const k = t / len; bp.set(300 * Math.pow(30, k));
    ph += TAU * (110 + 440 * k * k) / SR;
    return (bp(noise()) * 2.2 + Math.sin(ph) * .12) * Math.pow(k, 2.2);
  }, { gain: g, send: .25 });
}
function ping(t0, f, g = .2, pan = 0) {
  add(t0, SR * 1.2, (t) => (Math.sin(TAU * f * t) + .3 * Math.sin(TAU * f * 2.01 * t)) * env(t, .001, .18), { gain: g, pan, send: .9 });
}
function bell(t0, g = .22) {
  const parts = [[587.3, 1], [880, .6], [1174.7, .45], [1760, .22], [2637, .12]];
  add(t0, SR * 2.5, (t) => parts.reduce((s, [f, a], i) => s + Math.sin(TAU * f * t) * a * env(t, .002, .9 / (1 + i * .5)), 0), { gain: g, send: .8 });
}
function bass(t0, f, len, g = .3) {
  const lp = biquad('lp', 400); let ph = 0;
  add(t0, SR * len, (t) => {
    ph += f / SR; const saw = 2 * (ph % 1) - 1;
    const e = Math.min(1, t / .005) * Math.min(1, (len - t) / .03) * Math.exp(-t / .5);
    return Math.tanh(lp(saw) * 1.8 + Math.sin(TAU * f * t) * .8) * e;
  }, { gain: g });
}
function pad(t0, t1, freqs, g = .12) {
  const len = t1 - t0, lp = [biquad('lp', 1800), biquad('lp', 1800)];
  const ph = freqs.map(() => [rnd(), rnd()]);
  add(t0, SR * len, (t) => {
    let s = 0;
    freqs.forEach((f, i) => {
      for (let d = 0; d < 2; d++) { ph[i][d] += f * (d ? 1.004 : .997) / SR; s += (2 * (ph[i][d] % 1) - 1); }
    });
    const e = Math.min(1, t / .04) * Math.pow(1 - t / len, 1.6);
    lp[0].set(700 + 2200 * Math.exp(-t / .7));
    return lp[0](s / freqs.length) * e;
  }, { gain: g, send: .7 });
}
function wind(t0, t1, g = .25) {
  const bp = biquad('bp', 600, .9), len = t1 - t0;
  add(t0, SR * len, (t) => {
    const k = t / len; bp.set(500 + 900 * Math.sin(t * 3.1) ** 2 + 1400 * Math.exp(-t * 2));
    return bp(noise()) * Math.min(1, t / .02) * (1 - k) ** 1.4 * 2;
  }, { gain: g, send: .4 });
}
function reverseSwell(t0, t1, g = .3, f = 2500) {
  const bp = biquad('bp', f, 1.2), len = t1 - t0;
  add(t0, SR * len, (t) => bp(noise()) * Math.pow(t / len, 3) * 2.5, { gain: g, send: .5 });
}

// ---------- score ----------
// 01 ORIGIN
add(0, SR * 1.5, (t) => Math.sin(TAU * 55 * t) * Math.pow(t / 1.5, 2) * .8, { gain: .25 });
ping(.5, 1318.5, .16, -.3); ping(1.0, 1760, .16, .3);
riser(1.0, 1.5, .3);
// 02 TYPE
impact(1.5, .9);
add(1.5, SR * .35, (t) => Math.sin(TAU * (600 + 3200 * t / .35) * t) * env(t, .001, .08), { gain: .12, send: .3 }); // line zip
for (let b = 2.0; b < 4.0; b += .5) kick(b, .75);
for (const w of [1.56, 2.0, 2.5, 2.75, 3.25]) click(w, .3, 2600);
for (let i = 0; i < 16; i++) click(1.75 + i * (1.35 / 16), .06, 3800, (i % 2 ? .4 : -.4)); // subtitle typing
snare(2.75, .55);
reverseSwell(3.55, 4.0, .35);
// 03 FORM
impact(4.0, .9);
for (let b = 4.5; b < 6.5; b += .5) kick(b, .8);
for (let b = 4.25; b < 6.5; b += .5) hat(b, .1, .25);
for (let b = 4.0; b < 6.4; b += .5) bass(b + .25, 73.42, .22, .22);
whoosh(4.95 + .15, .6, .3, 250, 4500); whoosh(5.75 + .15, .6, .3, 250, 4500);
riser(6.0, 6.5, .45);
// 04 FLOW
impact(6.5, 1.25);
wind(6.5, 8.6, .35);
for (let b = 7.5; b < 9; b += 1) kick(b, .6);
reverseSwell(7.9, 8.55, .3, 3200);
bell(8.55, .22);
// 05 SYSTEM
impact(9.0, 1.0);
for (let b = 9.5; b < 11.5; b += .5) kick(b, .8);
for (let b = 9.25; b < 11.5; b += .25) hat(b, b % .5 ? .1 : .05, b % .5 ? .3 : -.3);
for (let b = 9.0; b < 11.4; b += .5) bass(b + .25, [73.42, 73.42, 87.31, 65.41, 73.42][Math.floor((b - 9) / .5)], .22, .24);
for (const s of [9.0, 9.5, 10.0, 10.5, 11.0]) for (let i = 0; i < 6; i++) click(s + i * .035, .1, 3000 + i * 180, (i - 3) * .15);
// 06 STATEMENT
for (const s of [11.5, 12.0, 12.5]) { kick(s, 1.0); snare(s, .45); }
whoosh(11.55, .3, .3, 600, 7000);
reverseSwell(12.72, 13.05, .45, 1800);
impact(13.05, 1.0);
pad(13.05, 15.0, [146.83, 220.0, 261.63, 329.63, 349.23], .16);
ping(13.55, 2349.3, .07, .2);
reverseSwell(14.3, 14.82, .18, 1200);

// ---------- reverb (Schroeder) ----------
function comb(buf, d, fb, damp) { const o = new Float32Array(buf.length); let lp = 0; for (let i = 0; i < buf.length; i++) { const y = i >= d ? o[i - d] : 0; lp = y * (1 - damp) + lp * damp; o[i] = buf[i] + lp * fb; } return o; }
function allpass(buf, d, g) { const o = new Float32Array(buf.length); for (let i = 0; i < buf.length; i++) { const bd = i >= d ? buf[i - d] : 0, od = i >= d ? o[i - d] : 0; o[i] = -g * buf[i] + bd + g * od; } return o; }
function verb(inp, off) {
  const ds = [1557, 1617, 1491, 1422].map(d => Math.round(d * 1.09) + off);
  const sum = new Float32Array(inp.length);
  for (const d of ds) { const c = comb(inp, d, .83, .3); for (let i = 0; i < sum.length; i++) sum[i] += c[i] * .25; }
  return allpass(allpass(sum, 225 + off, .5), 556 + off, .5);
}
const rl = verb(VL, 0), rr = verb(VR, 23);

// ---------- master ----------
const outL = new Float32Array(LEN), outR = new Float32Array(LEN);
const hpL = biquad('hp', 28), hpR = biquad('hp', 28);
let peak = 0;
for (let i = 0; i < LEN; i++) {
  const t = i / SR, edge = Math.min(1, t / .01, (DUR - t) / .03); // seamless-loop friendly edges
  outL[i] = hpL(L[i] + rl[i] * .35) * edge; outR[i] = hpR(R[i] + rr[i] * .35) * edge;
  outL[i] = Math.tanh(outL[i] * 1.1); outR[i] = Math.tanh(outR[i] * 1.1);
  peak = Math.max(peak, Math.abs(outL[i]), Math.abs(outR[i]));
}
const norm = .89 / peak; // ≈ −1 dBFS
const buf = Buffer.alloc(44 + LEN * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + LEN * 4, 4); buf.write('WAVEfmt ', 8);
buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(LEN * 4, 40);
for (let i = 0; i < LEN; i++) {
  buf.writeInt16LE(Math.round(clampS(outL[i] * norm) * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(clampS(outR[i] * norm) * 32767), 46 + i * 4);
}
function clampS(x) { return Math.max(-1, Math.min(1, x)); }
const dir = path.dirname(fileURLToPath(import.meta.url));
mkdirSync(path.join(dir, 'out'), { recursive: true });
writeFileSync(path.join(dir, 'out', 'reel.wav'), buf);
console.log('peak before norm', peak.toFixed(3));
