#!/usr/bin/env python3
"""VEIL — the four image plates, rendered here rather than fetched.

No photograph was reachable (the host the HF spaces serve images from is
refused by the egress proxy, and no other generation API is both open and
funded), so these are authored: light, cloth, haze and grain, in the
template's own four stage colours.

They are abstract on purpose. A drawn scene at this size reads as clip art,
and the hero carries a large lockup, a data panel and two bubbles on top of
it — what that wants underneath is a field, not a picture. The name is the
brief: a lit scrim, and light falling through things.

Everything is replaceable; the buyer drops their own photograph in at the
same four file names.
"""
import os
import numpy as np
from PIL import Image, ImageFilter

# the template's --stage1..4 and --glow-color
S1 = np.array([0x07, 0x08, 0x0a], np.float32) / 255
S2 = np.array([0x15, 0x19, 0x2a], np.float32) / 255
S3 = np.array([0x3a, 0x2c, 0x43], np.float32) / 255
S4 = np.array([0x8a, 0x55, 0x39], np.float32) / 255
GLOW = np.array([255, 192, 112], np.float32) / 255
WHITE = np.ones(3, np.float32)


# ── fields ───────────────────────────────────────────────────────────────
def fbm(h, w, octaves=6, base=4, gain=.52, seed=0, aniso=1.0):
    """Value-noise fBm. `aniso` > 1 stretches the lattice horizontally, which
    is what turns a cloud into a drift."""
    rng = np.random.default_rng(seed)
    out = np.zeros((h, w), np.float32)
    amp, tot, res = 1.0, 0.0, base
    for _ in range(octaves):
        gw = max(2, int(res * aniso))
        gh = max(2, int(res * h / w))
        g = rng.random((gh, gw)).astype(np.float32)
        layer = np.asarray(Image.fromarray((g * 255).astype(np.uint8))
                           .resize((w, h), Image.BICUBIC), np.float32) / 255
        out += layer * amp
        tot += amp
        amp *= gain
        res *= 2
    return out / tot


def speckle(h, w, seed=0, blur=.7):
    """Near-native-resolution detail — the thing a Gaussian blur can't fake."""
    rng = np.random.default_rng(seed)
    g = rng.random((h, w)).astype(np.float32)
    if blur:
        g = np.asarray(Image.fromarray((g * 255).astype(np.uint8))
                       .filter(ImageFilter.GaussianBlur(blur)), np.float32) / 255
    return g


def grad_v(h, w, stops):
    ys = np.linspace(0, 1, h, dtype=np.float32)
    out = np.zeros((h, 3), np.float32)
    for i in range(len(stops) - 1):
        (p0, c0), (p1, c1) = stops[i], stops[i + 1]
        m = (ys >= p0) & (ys <= p1)
        t = ((ys[m] - p0) / max(p1 - p0, 1e-6))[:, None]
        t = t * t * (3 - 2 * t)                       # smoothstep, no banding seams
        out[m] = c0 * (1 - t) + c1 * t
    out[ys < stops[0][0]] = stops[0][1]
    out[ys > stops[-1][0]] = stops[-1][1]
    return np.repeat(out[:, None, :], w, axis=1)


def radial(h, w, cx, cy, rx, ry, falloff=2.0):
    x = (np.arange(w, dtype=np.float32)[None, :] / w - cx) / rx
    y = (np.arange(h, dtype=np.float32)[:, None] / h - cy) / ry
    return np.clip(1 - np.sqrt(x * x + y * y), 0, 1) ** falloff


def blur(field, px):
    return np.asarray(Image.fromarray((np.clip(field, 0, 1) * 255).astype(np.uint8))
                      .filter(ImageFilter.GaussianBlur(px)), np.float32) / 255


def lit(img, field, colour, strength):
    """Screen-blend: light adds, it never replaces what is under it."""
    return 1 - (1 - img) * (1 - np.clip(field * strength, 0, 1)[:, :, None] * colour)


def finish(img, grain=.020, vignette=.34, seed=1):
    h, w = img.shape[:2]
    v = radial(h, w, .5, .5, .80, .86, 1.4)
    img = img * (1 - vignette + vignette * v[:, :, None])
    g = speckle(h, w, seed=seed * 977, blur=.55) - .5
    # grain belongs in the shadows; a clean highlight is what sells the rest
    img = img + g[:, :, None] * grain * (0.30 + 0.70 * (1 - img))
    return np.clip(img, 0, 1)


def save(img, path, quality=88):
    Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).save(
        path, "JPEG", quality=quality, optimize=True, progressive=True)
    return path


# ── 01 · hero — a lit scrim ──────────────────────────────────────────────
def hero(w=2400, h=1600):
    img = grad_v(h, w, [(0, S1), (.26, S1 * .55 + S2 * .45), (.54, S2),
                        (.74, S2 * .35 + S3 * .65), (.90, S3 * .40 + S4 * .60),
                        (1, S4 * .82 + GLOW * .10)])

    x = np.arange(w, dtype=np.float32)[None, :] / w
    y = np.arange(h, dtype=np.float32)[:, None] / h

    # cloth: folds that wander down the frame instead of running dead straight
    wander = (fbm(h, w, 4, 3, seed=21, aniso=.35) - .5) * .10
    u = x + wander + y * .035
    folds = (np.sin(u * np.pi * 2 * 9.0 + 1.1) * .5 + .5) ** 2.1 * .62 \
          + (np.sin(u * np.pi * 2 * 21.0 + 4.0) * .5 + .5) ** 2.6 * .26 \
          + (np.sin(u * np.pi * 2 * 46.0) * .5 + .5) ** 3.0 * .12
    weave = speckle(h, w, seed=404, blur=.9)
    folds = folds * (0.86 + 0.14 * weave)

    # the light behind it: low, right of centre, wide
    back = radial(h, w, .64, .88, .78, .62, 1.9) * .85 + radial(h, w, .30, .92, .55, .45, 2.2) * .35
    back = np.clip(back, 0, 1)

    img = lit(img, folds * back, GLOW * .90 + WHITE * .10, .80)   # folds catching it
    img = lit(img, blur(back, 90), GLOW * .75 + S4 * .25, .48)    # the source bleeding through
    img = lit(img, blur(folds * back, 26) * back, GLOW, .26)      # halation

    # air in front: haze drifting across the lower half
    haze = fbm(h, w, 5, 3, seed=77, aniso=2.6)
    haze *= np.clip(1 - np.abs(y - .72) / .46, 0, 1) ** 1.6
    img = lit(img, haze, S4 * .55 + GLOW * .45, .30)

    # a few motes, caught in the light
    rng = np.random.default_rng(9)
    motes = np.zeros((h, w), np.float32)
    for _ in range(190):
        my, mx = rng.uniform(.42, .95), rng.uniform(0, 1)
        r = int(rng.integers(2, 6))
        yy, xx = int(my * h), int(mx * w)
        motes[yy:yy + r, xx:xx + r] = rng.uniform(.35, 1.0) * float(back[yy, xx])
    img = lit(img, blur(motes, 2.2), GLOW * .6 + WHITE * .4, .75)
    img = lit(img, blur(motes, 14), GLOW, .22)

    return finish(img, grain=.019, vignette=.36, seed=2)


# ── 02 · showcase — a window thrown across a wall ────────────────────────
def showcase(w=2400, h=1600):
    surf = (fbm(h, w, 7, 3, .58, seed=101) * .74
            + speckle(h, w, seed=102, blur=1.4) * .26)
    img = (S2 * .70 + S3 * .30)[None, None, :] * (0.34 + 0.66 * surf[:, :, None])

    x = np.arange(w, dtype=np.float32)[None, :] / w
    y = np.arange(h, dtype=np.float32)[:, None] / h

    # four panes, sheared, with a real mullion between them
    shear = (y - .5) * .20
    cast = np.zeros((h, w), np.float32)
    for x0, x1 in [(.26, .425), (.452, .617), (.644, .809), (.836, 1.02)]:
        u = x + shear
        cast += ((u > x0) & (u < x1)).astype(np.float32)
    # a transom cuts the panes once, horizontally
    cast *= 1 - 0.78 * ((y > .455) & (y < .485)).astype(np.float32)
    cast *= np.clip(1 - np.abs(y - .50) / .46, 0, 1) ** 1.3
    cast = blur(cast, 7) * (0.55 + 0.45 * surf)

    img = lit(img, cast, GLOW * .80 + WHITE * .20, .74)
    img = lit(img, blur(cast, 34), GLOW * .9 + S4 * .1, .30)
    img = lit(img, blur(cast, 130), GLOW, .13)

    # the floor takes the bottom fifth, and a little of the light with it
    fl = np.clip((y - .80) / .20, 0, 1)
    img = img * (1 - fl[:, :, None] * .55) + (S1 * 1.7)[None, None, :] * (fl * .55)[:, :, None]
    img = lit(img, blur(cast, 60) * fl, GLOW * .8 + S4 * .2, .22)

    return finish(img, grain=.022, vignette=.42, seed=3)


# ── 03 · showcase-2 — plaster, and one shaft ─────────────────────────────
def showcase2(w=1800, h=1200):
    coarse = fbm(h, w, 8, 3, .55, seed=201)
    mid = fbm(h, w, 5, 26, .5, seed=202)
    fine = speckle(h, w, seed=203, blur=.85)
    tex = np.clip(coarse * .52 + mid * .28 + fine * .20, 0, 1)
    # relief: light from the upper left catches the tops of the grain
    dx = np.gradient(tex, axis=1) * 26
    dy = np.gradient(tex, axis=0) * 26
    relief = np.clip(.5 + (dx * .7 + dy * .7), 0, 1)

    base = S2 * .48 + S3 * .52
    img = base[None, None, :] * (0.40 + 0.60 * tex[:, :, None])
    img = img * (0.80 + 0.40 * relief[:, :, None])

    x = np.arange(w, dtype=np.float32)[None, :] / w
    y = np.arange(h, dtype=np.float32)[:, None] / h
    band = np.clip(1 - np.abs((x - y * .58) - .26) / .26, 0, 1) ** 1.7
    band *= np.clip(1 - np.abs(y - .44) / .70, 0, 1)
    band = blur(band, 9) * (0.52 + 0.48 * tex) * (0.75 + 0.50 * relief)

    img = lit(img, band, GLOW * .88 + WHITE * .12, .88)
    img = lit(img, blur(band, 44), GLOW, .22)
    return finish(img, grain=.026, vignette=.36, seed=4)


# ── 04 · showcase-3 — a lamp in fog ──────────────────────────────────────
# The other two bands are geometry (panes) and a hard diagonal, so this one
# is the round, soft, weightless member of the set. All three share the
# palette; none of them repeats another's gesture.
def showcase3(w=1800, h=1200):
    img = grad_v(h, w, [(0, S1 * 1.5 + S2 * .12), (.40, S2 * .70),
                        (.72, S2 * .45 + S3 * .30), (1, S1 * 1.15)])

    x = np.arange(w, dtype=np.float32)[None, :] / w
    y = np.arange(h, dtype=np.float32)[:, None] / h
    cx, cy = .38, .52

    # layered fog: three drifts at different scales, thickest around the lamp
    for i, (oct_, base, a, amp, sd) in enumerate([(6, 3, 3.4, .30, 401),
                                                  (5, 7, 2.0, .22, 402),
                                                  (4, 15, 1.3, .14, 403)]):
        f = fbm(h, w, oct_, base, seed=sd, aniso=a)
        f = f * np.clip(1 - np.abs(y - (cy + .06 * i)) / .58, 0, 1) ** 1.2
        img = lit(img, f, S3 * (1 - .3 * i) + GLOW * (.25 + .18 * i), amp)

    # the lamp: a small bright core, then halo on halo
    core = radial(h, w, cx, cy, .038, .055, 1.0)
    img = lit(img, radial(h, w, cx, cy, .52, .60, 2.6), GLOW * .92 + WHITE * .08, .40)
    img = lit(img, radial(h, w, cx, cy, .22, .26, 2.0), GLOW * .85 + WHITE * .15, .52)
    img = lit(img, blur(core, 16), GLOW * .55 + WHITE * .45, .95)
    img = lit(img, core, WHITE * .85 + GLOW * .15, 1.0)

    # rays: the fog picking the light up in streaks
    ang = np.arctan2((y - cy) * h / w, x - cx)
    rays = (np.sin(ang * 9.0 + 0.6) * .5 + .5) ** 3.0
    rays = rays * radial(h, w, cx, cy, .46, .52, 1.8) * (0.5 + 0.5 * fbm(h, w, 4, 6, seed=404))
    img = lit(img, blur(rays, 12), GLOW, .26)

    return finish(img, grain=.024, vignette=.44, seed=5)


if __name__ == "__main__":
    import sys
    out = sys.argv[1]
    for name, fn, q in [("hero", hero, 86), ("showcase", showcase, 88),
                        ("showcase-2", showcase2, 88), ("showcase-3", showcase3, 88)]:
        p = save(fn(), f"{out}/{name}.jpg", q)
        print(f"{name:12} {os.path.getsize(p)//1024:>5} KB  {p}")
