"""90 BPM soundtrack for kt.html — every hit sits on the same beat grid as the cuts.
python3 score.py out.wav   (numpy only; deterministic)"""
import sys, wave, numpy as np
SR, DUR, B = 48000, 15.0, 2 / 3
N = int(SR * DUR); t = np.arange(N) / SR
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(7)

def add(sig, at, gain=1.0, pan=0.0):
    i = int(at * SR); n = min(len(sig), N - i)
    if n <= 0: return
    L[i:i+n] += sig[:n] * gain * (1 - max(pan, 0)); R[i:i+n] += sig[:n] * gain * (1 + min(pan, 0))

def env(n, a, d):  # attack/decay in seconds
    x = np.arange(n) / SR
    return np.minimum(x / max(a, 1e-4), 1) * np.exp(-x / d)

def kick(d=.42):
    n = int(SR * d); x = np.arange(n) / SR
    f = 46 + 110 * np.exp(-x * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, .002, .16)

def hat(d=.06):
    n = int(SR * d); s = rng.standard_normal(n)
    s = np.diff(np.concatenate([[0], s]))  # crude high-pass
    return s * env(n, .001, .018)

def tick():
    n = int(SR * .05); x = np.arange(n) / SR
    return np.sin(2 * np.pi * 2400 * x) * env(n, .0005, .012)

def whoosh(d=.5):
    n = int(SR * d); s = rng.standard_normal(n)
    k = np.ones(24) / 24; s = s - np.convolve(s, k, 'same')
    x = np.linspace(0, 1, n); return s * (x ** 2) * (1 - x) ** .4 * 1.6

def tone(f, d, a=.01, dec=.5, parts=(1, .5, .25)):
    n = int(SR * d); x = np.arange(n) / SR
    s = sum(p * np.sin(2 * np.pi * f * (i + 1) * x) for i, p in enumerate(parts))
    fade = np.minimum(1, (d - x) / .05)
    return s * env(n, a, dec) * fade

# drums: kick on every beat until the end card, hats on the off-beat
for b in range(20):
    at = b * B
    if b in (14,):  # breath before the tagline lands
        continue
    add(kick(), at, .9)
    add(hat(), at + B / 2, .22, pan=.3)
    if b >= 6: add(hat(), at + B * .75, .1, pan=-.3)

# bass: A – F – C – G, two beats each
roots = [55.0, 43.65, 65.41, 49.0]
for i in range(10):
    add(tone(roots[i % 4], 2 * B, a=.005, dec=.35, parts=(1, .35)), i * 2 * B, .45)

# pad (Am9 → Fmaj7) under everything
for at, chord in [(0, [220, 261.6, 329.6, 493.9]), (8 * B, [174.6, 220, 261.6, 329.6]), (15 * B, [220, 261.6, 329.6, 392])]:
    d = (8 * B if at < 15 * B else 15 - at)
    for j, f in enumerate(chord):
        add(tone(f, d, a=.4, dec=4, parts=(1, .2)), at, .045, pan=(j - 1.5) * .3)

# ticks on every cut, whooshes into the slash wipes
for c in [B/2, 2*B, 3*B, 4*B, 5*B, 6*B, 8*B, 10*B, 12*B, 14*B, 15*B, 17*B]:
    add(tick(), c, .12)
for w in [3 * B, 15 * B, 17 * B]:
    s = whoosh(); add(s, w - len(s) / SR * .8, .35)

# end card: one hit, then let it ring
add(kick(.9), 20 * B, 1.0)
add(tone(110, 1.66, a=.003, dec=.9, parts=(1, .6, .3, .15)), 20 * B, .35)
add(tone(659.3, 1.66, a=.003, dec=.6), 20 * B + .02, .08, pan=.2)

mix = np.stack([L, R], 1)
mix = np.tanh(mix * 1.3)  # soft clip glue
mix *= .89 / np.abs(mix).max()
fade = np.minimum(1, (DUR - t) / .35)[:, None]; mix *= fade
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype('<i2').tobytes())
