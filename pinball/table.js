/* AURORA INDUSTRIES — pinball physics table definition.
   Shared by the game (index.html) and headless physics tests (node). */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.PinTable = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const T = {};

  // ── Frame / playfield ─────────────────────────────
  T.W = 390; T.H = 844;
  T.PL = 22; T.PR = 318; T.PT = 28; T.PB = 658;
  T.PCX = 170;
  T.ACX = 170; T.ACY = 115; T.ARX = 148; T.ARY = 88;
  T.INFO_Y = 660;

  // ── Shooter lane / plunger ────────────────────────
  T.LANE_X = 352;          // ball x while in shooter lane
  T.PH_Y = 646;            // plunger head (static floor) centre y
  T.PULL_MAX = 18;         // visual plunger travel px
  T.BALL_R = 10;
  T.LAUNCH_MIN = 13;       // launch velocity = -(LAUNCH_MIN + power*LAUNCH_RNG)
  T.LAUNCH_RNG = 19;
  T.GUIDE_Y = 109;         // lane y at which the wire ramp takes over

  // ── Flippers ──────────────────────────────────────
  T.FLY = 630; T.LFPX = 101; T.RFPX = 239; T.FLEN = 62;
  T.F_REST = 0.50; T.F_UP = -0.42;

  // ── Upper features ────────────────────────────────
  T.BR = 22;
  T.BUMPERS = [{ x: 170, y: 176 }, { x: 112, y: 240 }, { x: 228, y: 240 }];
  T.POSTS = [{ x: 82, y: 156 }, { x: 258, y: 156 }, { x: 62, y: 196 }, { x: 278, y: 196 }];
  T.VB = [{ x: 82, y: 375 }, { x: 112, y: 353 }, { x: 142, y: 331 }]; T.VBA = -0.38;
  T.SB = [{ x: 198, y: 331 }, { x: 228, y: 353 }, { x: 258, y: 375 }]; T.SBA = 0.38;
  T.CMX = 170; T.CMY0 = 394; T.CMDY = 28; T.NMODES = 5;
  T.ORBIT = { x: 300, y: 134, a: -0.22, w: 12, h: 78 };
  T.SAX = 170; T.SAY = 608;   // SHOOT AGAIN lamp (visual only)

  // ── Lower third ───────────────────────────────────
  T.RAIL_L = { x: 64, top: 506, bot: 592 };
  T.RAIL_R = { x: 276, top: 506, bot: 592 };
  T.GUIDE_L = { x1: 64, y1: 596, x2: 101, y2: 630 };
  T.GUIDE_R = { x1: 276, y1: 596, x2: 239, y2: 630 };
  T.SLING_L = [[98, 512], [146, 588], [98, 588]];
  T.SLING_R = [[242, 512], [194, 588], [242, 588]];
  T.SLING_NL = { x: 0.845, y: -0.534 };   // kick direction (into playfield)
  T.SLING_NR = { x: -0.845, y: -0.534 };

  // ── Wire ramp: shooter lane → playfield (cubic bezier) ──
  T.RAMP = [[352, 109], [356, 14], [322, 2], [268, 100]];
  T.MAXV = 26;

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

  // ── Build the Matter.js world ─────────────────────
  T.build = function (Matter) {
    const { Engine, World, Bodies, Body, Constraint } = Matter;
    const eng = Engine.create();
    eng.gravity.y = 1.9;
    eng.positionIterations = 8;
    eng.velocityIterations = 6;

    const FF = { category: 2, mask: 1 };   // flippers
    const FW = { category: 4, mask: 1 };   // walls/features
    const SO = { isStatic: true, friction: 0.03, restitution: 0.45, collisionFilter: FW };
    const mkR = (x, y, w, h, ex) => Bodies.rectangle(x, y, w, h, Object.assign({}, SO, ex || {}));
    const mkC = (x, y, r, ex) => Bodies.circle(x, y, r, Object.assign({}, SO, ex || {}));
    const st = [];

    // Top arch (full half-ellipse — also seals lane re-entry)
    for (let i = 0; i < 28; i++) {
      const a1 = Math.PI + i / 28 * Math.PI, a2 = Math.PI + (i + 1) / 28 * Math.PI;
      const x1 = T.ACX + T.ARX * Math.cos(a1), y1 = T.ACY + T.ARY * Math.sin(a1);
      const x2 = T.ACX + T.ARX * Math.cos(a2), y2 = T.ACY + T.ARY * Math.sin(a2);
      st.push(mkR((x1 + x2) / 2, (y1 + y2) / 2, Math.hypot(x2 - x1, y2 - y1) + 4, 16,
        { angle: Math.atan2(y2 - y1, x2 - x1) }));
    }
    // Walls: left, lane divider (= playfield right), outer right, lane top cap
    st.push(mkR(T.PL - 6, (T.PT + T.PB) / 2, 12, T.PB - T.PT + 60));
    st.push(mkR(T.PR + 4, (T.PT + T.PB) / 2, 12, T.PB - T.PT + 60));
    st.push(mkR(T.W - 6, T.H / 2, 12, T.H + 80));
    st.push(mkR(T.LANE_X, -4, 76, 14));

    // Outlane/inlane rails (capsules) + top posts
    [T.RAIL_L, T.RAIL_R].forEach(r => {
      st.push(mkR(r.x, (r.top + r.bot) / 2, 7, r.bot - r.top, { restitution: 0.3 }));
      st.push(mkC(r.x, r.top, 4.5, { restitution: 0.7 }));
      st.push(mkC(r.x, r.bot, 4, { restitution: 0.3 }));
    });
    // Inlane guides down to flipper pivots
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
    const slingL = mkSling(T.SLING_L), slingR = mkSling(T.SLING_R);
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
          Body.setVelocity(ball, { x: dx / d * 9.5 + v.x * 0.25, y: dy / d * 9.5 + v.y * 0.25 });
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
          const kp = 6.5 + Math.random() * 2.5;
          Body.setVelocity(ball, { x: v.x * 0.25 + kx * kp, y: v.y * 0.25 + ky * kp });
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
