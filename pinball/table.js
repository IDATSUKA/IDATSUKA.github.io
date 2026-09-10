/* AURORA INDUSTRIES — pinball physics table definition.
   Shared by the game (index.html) and headless physics tests (node). */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.PinTable = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const T = {};

  // ── Frame / playfield ─────────────────────────────
  T.W = 390; T.H = 844;
  T.PL = 46; T.PR = 306; T.PT = 246; T.PB = 620;
  T.PCX = 176;
  T.ACX = 176; T.ACY = 350; T.ARX = 130; T.ARY = 104;
  // ── Reference photo placement (logical 390x844 screen) ───
  // The photo is 1086x1448; drawn full-width (k=390/1086) at y=IMG_Y.
  T.IMG_Y = 230; T.IMG_K = 390 / 1086;        // photo top offset & scale
  // photo-pixel -> screen helper
  T.fromPhoto = (px, py) => ({ x: px * T.IMG_K, y: T.IMG_Y + py * T.IMG_K });
  T.INFO_Y = 626;

  // ── Shooter lane / plunger ────────────────────────
  T.LANE_X = 363;          // ball x while in shooter lane
  T.PH_Y = 606;            // plunger head (static floor) centre y
  T.PULL_MAX = 16;         // visual plunger travel px
  T.BALL_R = 9;
  T.LAUNCH_MIN = 12;       // launch velocity = -(LAUNCH_MIN + power*LAUNCH_RNG)
  T.LAUNCH_RNG = 18;
  T.GUIDE_Y = 312;         // lane y at which the wire ramp takes over

  // ── Flippers ──────────────────────────────────────
  T.FLY = 596; T.LFPX = 120, T.RFPX = 228; T.FLEN = 42;
  T.F_REST = 0.228; T.F_UP = -0.55;   // rest angle matches the photo's flippers

  // ── Upper features (positions traced from the photo) ─────
  T.BR = 20;
  T.BUMPERS = [{ x: 176, y: 300 }, { x: 140, y: 340 }, { x: 214, y: 340 }];
  T.POSTS = [{ x: 104, y: 326 }, { x: 248, y: 326 }, { x: 92, y: 372 }, { x: 260, y: 372 }];
  T.VB = [{ x: 110, y: 388 }, { x: 126, y: 388 }, { x: 142, y: 388 }]; T.VBA = 0;
  T.SB = [{ x: 210, y: 388 }, { x: 226, y: 388 }, { x: 242, y: 388 }]; T.SBA = 0;
  T.CMX = 176; T.CMY0 = 446; T.CMDY = 14; T.NMODES = 5;
  T.ORBIT = { x: 258, y: 330, a: -0.30, w: 12, h: 60 };
  T.SAX = 176; T.SAY = 540;   // SHOOT AGAIN lamp (visual only)

  // ── Lower third ───────────────────────────────────
  T.RAIL_L = { x: 72, top: 470, bot: 545 };
  T.RAIL_R = { x: 280, top: 470, bot: 545 };
  T.GUIDE_L = { x1: 72, y1: 545, x2: 120, y2: 592 };
  T.GUIDE_R = { x1: 280, y1: 545, x2: 228, y2: 592 };
  T.SLING_L = [[110, 500], [152, 556], [110, 556]];
  T.SLING_R = [[242, 500], [200, 556], [242, 556]];
  T.SLING_NL = { x: 0.8, y: -0.6 };   // kick direction (into playfield)
  T.SLING_NR = { x: -0.8, y: -0.6 };

  // ── Wire ramp: shooter lane → playfield (cubic bezier) ──
  T.RAMP = [[363, 312], [380, 232], [300, 224], [188, 262]];
  T.MAXV = 24;

  T.bez = function (t) {
    const [p0, p1, p2, p3] = T.RAMP, u = 1 - t;
    return {
      x: u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      y: u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    };
  };
  T.bezTan = function (t) {
    const [p0, p1, p2, p3] = T.RAMP, u = 1 - t;
    const x = 3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0]);
    const y = 3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1]);
    const l = Math.hypot(x, y) || 1;
    return { x: x / l, y: y / l };
  };
  T.RAMP_LEN = (function () {
    let l = 0, p = T.bez(0);
    for (let i = 1; i <= 48; i++) { const q = T.bez(i / 48); l += Math.hypot(q.x - p.x, q.y - p.y); p = q; }
    return l;
  })();

  // Arch wall segments (shared by physics build and 3D rendering)
  T.archSegs = function (n) {
    n = n || 28;
    const out = [];
    for (let i = 0; i < n; i++) {
      const a1 = Math.PI + i / n * Math.PI, a2 = Math.PI + (i + 1) / n * Math.PI;
      const x1 = T.ACX + T.ARX * Math.cos(a1), y1 = T.ACY + T.ARY * Math.sin(a1);
      const x2 = T.ACX + T.ARX * Math.cos(a2), y2 = T.ACY + T.ARY * Math.sin(a2);
      out.push({
        x: (x1 + x2) / 2, y: (y1 + y2) / 2,
        len: Math.hypot(x2 - x1, y2 - y1) + 4,
        angle: Math.atan2(y2 - y1, x2 - x1),
      });
    }
    return out;
  };

  // ── Build the Matter.js world ─────────────────────
  T.build = function (Matter) {
    const { Engine, World, Bodies, Body, Constraint } = Matter;
    const eng = Engine.create();
    eng.gravity.y = 1.85;
    eng.positionIterations = 8;
    eng.velocityIterations = 6;

    const FF = { category: 2, mask: 1 };   // flippers
    const FW = { category: 4, mask: 1 };   // walls/features
    const SO = { isStatic: true, friction: 0.03, restitution: 0.45, collisionFilter: FW };
    const mkR = (x, y, w, h, ex) => Bodies.rectangle(x, y, w, h, Object.assign({}, SO, ex || {}));
    const mkC = (x, y, r, ex) => Bodies.circle(x, y, r, Object.assign({}, SO, ex || {}));
    const st = [];

    // Top arch (full half-ellipse — also seals lane re-entry)
    T.archSegs(28).forEach(s => {
      st.push(mkR(s.x, s.y, s.len, 16, { angle: s.angle }));
    });
    // Walls: left, lane divider (= playfield right), outer right, lane top cap
    st.push(mkR(T.PL - 6, (T.PT + T.PB) / 2, 12, T.PB - T.PT + 60));
    st.push(mkR(T.PR + 4, (T.PT + T.PB) / 2, 12, T.PB - T.PT + 60));
    st.push(mkR(T.W - 6, T.H / 2, 12, T.H + 80));
    st.push(mkR(T.LANE_X, -4, 76, 14));

    // Lower funnel walls — the playfield narrows toward the flippers (as in the
    // photo), so every ball is guided down onto a flipper instead of slipping
    // past down the sides. The drain is the centre gap between the flipper tips.
    T.FUNNEL = [
      [[T.PL - 4, 452], [118, 586]],   // left wall -> just outside L flipper (sealed, no corner pocket)
      [[T.PR + 4, 452], [234, 586]],   // right wall -> just outside R flipper
    ];
    T.FUNNEL.forEach(([a, c2]) => {
      const cx = (a[0] + c2[0]) / 2, cy = (a[1] + c2[1]) / 2;
      const len = Math.hypot(c2[0] - a[0], c2[1] - a[1]);
      st.push(mkR(cx, cy, len, 9, { angle: Math.atan2(c2[1] - a[1], c2[0] - a[0]), restitution: 0.25 }));
    });
    // small inlane guides just inside the funnel, feeding the flipper bases
    [T.GUIDE_L, T.GUIDE_R].forEach(gd => {
      const cx = (gd.x1 + gd.x2) / 2, cy = (gd.y1 + gd.y2) / 2;
      const len = Math.hypot(gd.x2 - gd.x1, gd.y2 - gd.y1);
      st.push(mkR(cx, cy, len + 8, 8, { angle: Math.atan2(gd.y2 - gd.y1, gd.x2 - gd.x1), restitution: 0.2 }));
    });

    // Slingshots (convex triangles)
    const mkSling = verts => {
      const cx = (verts[0][0] + verts[1][0] + verts[2][0]) / 3;
      const cy = (verts[0][1] + verts[1][1] + verts[2][1]) / 3;
      return Bodies.fromVertices(cx, cy, [verts.map(v => ({ x: v[0], y: v[1] }))],
        Object.assign({}, SO, { restitution: 0.2 }));
    };
    // Slingshots: kick via the geometric scan only (no solid body), so they
    // don't form a basin that traps the ball above the flippers.
    const slingL = mkSling(T.SLING_L), slingR = mkSling(T.SLING_R);
    slingL.collisionFilter = { category: 4, mask: 0 };
    slingR.collisionFilter = { category: 4, mask: 0 };
    slingL.plugin = { cd: 0 }; slingR.plugin = { cd: 0 };
    st.push(slingL, slingR);

    // Pop bumpers + scatter posts
    const bumps = T.BUMPERS.map((p, i) => {
      const b = mkC(p.x, p.y, T.BR, { restitution: 0.6, friction: 0, label: 'bump' + i });
      b.plugin = { cd: 0, fl: 0 }; return b;
    });
    const posts = T.POSTS.map(p => mkC(p.x, p.y, 4.5, { restitution: 0.75 }));
    st.push.apply(st, bumps); st.push.apply(st, posts);

    // Drop target banks
    const mkT = (p, a, lb) => {
      const b = mkR(p.x, p.y, 36, 11, { angle: a, restitution: 0.3, label: lb });
      b.plugin = { cd: 0, fl: 0, dropped: false, sink: 0 }; return b;
    };
    const vbT = T.VB.map((p, i) => mkT(p, T.VBA, 'vb' + i));
    const sbT = T.SB.map((p, i) => mkT(p, T.SBA, 'sb' + i));
    st.push.apply(st, vbT); st.push.apply(st, sbT);

    // Plunger head (static floor the lane ball rests on)
    const plungerHead = mkR(T.LANE_X, T.PH_Y, 38, 14, { friction: 0.1, restitution: 0.05 });
    st.push(plungerHead);

    World.add(eng.world, st);

    // Flippers
    function mkFlip(pivX, y, left) {
      const cx2 = left ? pivX + T.FLEN / 2 : pivX - T.FLEN / 2;
      const b = Bodies.rectangle(cx2, y, T.FLEN, 13, {
        isStatic: false, density: 0.06, friction: 0.05, restitution: 0.1,
        collisionFilter: FF, label: 'flip',
      });
      const pv = Bodies.circle(pivX, y, 2, { isStatic: true, collisionFilter: { mask: 0 } });
      const c = Constraint.create({
        bodyA: b, pointA: { x: left ? -T.FLEN / 2 : T.FLEN / 2, y: 0 },
        bodyB: pv, length: 0, stiffness: 1,
      });
      World.add(eng.world, [b, pv, c]);
      const rest = left ? T.F_REST : -T.F_REST, up = left ? T.F_UP : -T.F_UP;
      Body.setAngle(b, rest);
      return { body: b, pivX, y, left, rest, up, on: false };
    }
    const LF = mkFlip(T.LFPX, T.FLY, true);
    const RF = mkFlip(T.RFPX, T.FLY, false);

    const tb = {
      M: Matter, eng, world: eng.world,
      bumps, posts, vbT, sbT, slingL, slingR, plungerHead, LF, RF,
      cmCd: [0, 0, 0, 0, 0], orCd: 0,
    };
    tb.addBall = function (x, y) {
      const b = Bodies.circle(x, y, T.BALL_R, {
        restitution: 0.12, friction: 0.008, frictionAir: 0.0045, density: 0.0045,
        collisionFilter: { category: 1, mask: 0xFFFF }, label: 'ball',
      });
      b.plugin = {};
      World.add(eng.world, b);
      return b;
    };
    tb.removeBall = function (b) { World.remove(eng.world, b); };
    return tb;
  };

  // ── Flipper drive (call every physics substep) ────
  T.stepFlippers = function (tb, tilted) {
    const { Body } = tb.M;
    [tb.LF, tb.RF].forEach(f => {
      const on = f.on && !tilted;
      const tgt = on ? f.up : f.rest, d = tgt - f.body.angle;
      if (Math.abs(d) < 0.015) {
        Body.setAngle(f.body, tgt); Body.setAngularVelocity(f.body, 0);
      } else {
        Body.setAngularVelocity(f.body, Math.max(-0.9, Math.min(0.9, d * 0.65)));
      }
      // never drift past limits
      const lo = Math.min(f.rest, f.up), hi = Math.max(f.rest, f.up);
      if (f.body.angle < lo) Body.setAngle(f.body, lo);
      if (f.body.angle > hi) Body.setAngle(f.body, hi);
    });
  };

  // ── Speed clamp / escape failsafe ─────────────────
  T.clampBall = function (tb, b) {
    const { Body } = tb.M;
    const v = b.velocity, s = Math.hypot(v.x, v.y);
    if (s > T.MAXV) Body.setVelocity(b, { x: v.x / s * T.MAXV, y: v.y / s * T.MAXV });
    const p = b.position;
    if (!isFinite(p.x) || !isFinite(p.y)) return false;
    if (p.x < 8 || p.x > T.W - 4 || p.y < -40) return false;
    return true;
  };

  // Anti-stuck: a top-down playfield has no tilt, so a ball can rest on a flat
  // ledge (drop-target bank, sling) forever. If a ball sits nearly still above
  // the flipper zone, give it a small downward nudge to free it. Call once per
  // physics substep, after the solver. Balls resting on the flippers (which is
  // legitimate) and the lane ball are left alone.
  T.antiStuck = function (tb, b) {
    const { Body } = tb.M;
    const pl = b.plugin;
    if (pl.inLane || pl.guide) { pl.slow = 0; return; }
    const v = Math.hypot(b.velocity.x, b.velocity.y);
    // upper playfield: a ball loitering (slowly circling on a ledge/basin) above
    // the flippers is pushed down so it can be played or drain the centre.
    if (v < 0.6 && b.position.y < T.FLY - 26) {
      if ((pl.slow = (pl.slow || 0) + 1) > 72) {        // ~0.6s at 120 Hz
        Body.setVelocity(b, { x: (Math.random() - 0.5) * 2.4, y: 2.8 + Math.random() * 1.4 });
        pl.slow = 0;
      }
      return;
    }
    // flipper pivot pockets: a ball can wedge in the dead corner BESIDE a
    // flipper's pivot (the outer end), where flips never reach it. Those corners
    // sit outboard of the flipper tips, so a legit cradle (ball held on the
    // tip/centre face) is never in them — we can free a pivot-pocket ball even
    // while that flipper is held up, without ever disturbing a cradle.
    if (v < 0.5 && b.position.y >= T.FLY - 30) {
      const inL = b.position.x < T.LFPX + 18;   // outer corner by the left pivot
      const inR = b.position.x > T.RFPX - 18;   // outer corner by the right pivot
      if (inL || inR) {
        if ((pl.slow = (pl.slow || 0) + 1) > 144) {   // ~1.2s at 120 Hz
          const dir = inL ? 1 : -1;                    // kick inward toward play/centre
          Body.setVelocity(b, { x: dir * (1.6 + Math.random() * 1.4), y: 2.2 + Math.random() });
          pl.slow = 0;
        }
        return;
      }
    }
    pl.slow = 0;
  };

  const inRect = (px, py, rx, ry, hw, hh, a) => {
    const ca = Math.cos(-a), sa = Math.sin(-a), dx = px - rx, dy = py - ry;
    const lx = dx * ca - dy * sa, ly = dx * sa + dy * ca;
    return Math.abs(lx) < hw && Math.abs(ly) < hh;
  };
  const segDist = (px, py, x1, y1, x2, y2) => {
    const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy;
    let t = ((px - x1) * dx + (py - y1) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
  };

  // ── Feature scan: pops, slings, targets, lanes (per substep) ──
  // cb(type, data, pos) — game layer maps events to scoring/fx/sound.
  T.scan = function (tb, balls, cb) {
    const { Body } = tb.M;
    const R = T.BALL_R;
    // cooldown ticks (120 Hz substeps)
    tb.bumps.forEach(b => { if (b.plugin.cd > 0) b.plugin.cd--; });
    [tb.slingL, tb.slingR].forEach(s => { if (s.plugin.cd > 0) s.plugin.cd--; });
    [...tb.vbT, ...tb.sbT].forEach(t => { if (t.plugin.cd > 0) t.plugin.cd--; });
    tb.cmCd.forEach((c, i) => { if (c > 0) tb.cmCd[i]--; });
    if (tb.orCd > 0) tb.orCd--;

    for (const ball of balls) {
      if (ball.plugin.guide || ball.plugin.inLane) continue;
      const bx = ball.position.x, by = ball.position.y;
      const v = ball.velocity;

      // pop bumpers: active solenoid kick
      tb.bumps.forEach((b, i) => {
        if (b.plugin.cd > 0) return;
        const dx = bx - b.position.x, dy = by - b.position.y;
        const rr = T.BR + R + 2;
        if (dx * dx + dy * dy < rr * rr) {
          b.plugin.cd = 40; b.plugin.fl = 64;
          const d = Math.hypot(dx, dy) || 1;
          // kick away from centre, with a little randomness so play varies
          const ja = (Math.random() - 0.5) * 0.7, ca = Math.cos(ja), sa = Math.sin(ja);
          let nx = dx / d, ny = dy / d;
          const rx = nx * ca - ny * sa, ry = nx * sa + ny * ca;
          const kp = 8.5 + Math.random() * 2;
          Body.setVelocity(ball, { x: rx * kp + v.x * 0.2, y: ry * kp + v.y * 0.2 });
          cb('bumper', i, b.position);
        }
      });

      // slingshots: kick along face normal
      [[tb.slingL, T.SLING_L, T.SLING_NL, 0], [tb.slingR, T.SLING_R, T.SLING_NR, 1]].forEach(([s, vts, n, side]) => {
        if (s.plugin.cd > 0) return;
        const d = segDist(bx, by, vts[0][0], vts[0][1], vts[1][0], vts[1][1]);
        // only a solid impact trips the kicker — slow rolls bounce passively
        if (d < R + 4 && (v.x * n.x + v.y * n.y) < -1.6) {
          s.plugin.cd = 50; s.plugin.fl = 44;
          // real slings are noisy — jitter breaks symmetric ping-pong traps
          const ja = (Math.random() - 0.5) * 0.6, ca = Math.cos(ja), sa = Math.sin(ja);
          const kx = n.x * ca - n.y * sa, ky = n.x * sa + n.y * ca;
          const kp = 3.4 + Math.random() * 1.4;
          Body.setVelocity(ball, { x: v.x * 0.18 + kx * kp, y: v.y * 0.18 + ky * kp });
          cb('sling', side, { x: bx, y: by });
        }
      });

      // drop targets
      tb.vbT.forEach((t, i) => {
        if (t.plugin.dropped || t.plugin.cd > 0) return;
        if (inRect(bx, by, t.position.x, t.position.y, 18 + R, 5.5 + R, t.angle)) {
          t.plugin.cd = 56; cb('target', { bank: 0, i }, t.position);
        }
      });
      tb.sbT.forEach((t, i) => {
        if (t.plugin.dropped || t.plugin.cd > 0) return;
        if (inRect(bx, by, t.position.x, t.position.y, 18 + R, 5.5 + R, t.angle)) {
          t.plugin.cd = 56; cb('target', { bank: 1, i }, t.position);
        }
      });

      // core-mode rollover lamps
      for (let i = 0; i < T.NMODES; i++) {
        if (tb.cmCd[i] > 0) continue;
        const y = T.CMY0 + i * T.CMDY;
        if (Math.abs(bx - T.CMX) < 50 && Math.abs(by - y) < 9 + R) {
          tb.cmCd[i] = 64; cb('mode', i, { x: T.CMX, y });
        }
      }

      // orbit lane
      if (tb.orCd <= 0 && inRect(bx, by, T.ORBIT.x, T.ORBIT.y, T.ORBIT.w / 2 + R, T.ORBIT.h / 2 + R, T.ORBIT.a)) {
        tb.orCd = 130; cb('orbit', 0, { x: T.ORBIT.x, y: T.ORBIT.y });
      }
    }
  };

  return T;
});
