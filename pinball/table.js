/* AURORA INDUSTRIES — pinball physics table definition.
   Shared by the game (index.html) and headless physics tests (node).

   All geometry is authored in PHOTO pixels (the 1086x1448 reference render
   the board image is cut from) and converted to screen units once, so every
   collider can be checked directly against the picture. The playfield's
   centre line in the photo is x = 527 (drain, flippers, SHOOT AGAIN). */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.PinTable = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const T = {};

  // ── Screen / photo mapping ─────────────────────────
  T.W = 390; T.H = 844;
  T.PHOTO_W = 1086; T.PHOTO_H = 1448;
  T.IMG_Y = 230; T.IMG_K = 390 / 1086;           // board drawn full-width at y = IMG_Y
  const K = T.IMG_K, OY = T.IMG_Y;
  const px = x => x * K;                          // photo x  -> screen x
  const py = y => OY + y * K;                     // photo y  -> screen y
  const P = (x, y) => ({ x: px(x), y: py(y) });
  const L = v => v * K;                           // photo length -> screen length
  T.fromPhoto = P; T.len = L;

  // ── Ball / physics scale ───────────────────────────
  // The render's inlanes/outlanes are sized for a ball ~38 px across in the
  // photo (a little smaller than a strict 27 mm : 3" flipper ratio).
  T.BALL_R = L(19);
  // Matter: 1 gravity unit = 1000 px/s²; velocities are px per 16.7 ms.
  // Real pinball pairs a floaty roll (~1.1 m/s² down the 6.5° slope) with
  // very fast flipper shots (~4 m/s); keep that contrast.
  T.GRAVITY = 0.48;                               // ~480 px/s² on screen
  T.MAXV = 24;                                    // speed cap (px per 16.7 ms)
  T.VUNIT = 60;                                   // velocity unit -> px/s

  // ── Measured features (photo px) ───────────────────
  const G = T.G = {
    CL: 527,
    // flippers: pivot, tip, radius at pivot / tip (rest pose, from the photo)
    flipL: { piv: [352, 1004], tip: [452, 1060], r1: 17, r2: 11 },
    flipR: { piv: [704, 1004], tip: [602, 1060], r1: 17, r2: 11 },
    flipTravel: 0.93,                             // ~53° swing
    // shooter lane
    laneX: 945, laneL: 916, laneR: 974, plungerTip: 997, laneTop: 150,
    // static walls: polylines [ [x,y], ... ] with thickness
    walls: [
      { pts: [[262, 300], [200, 300], [192, 371], [182, 420], [252, 716]], t: 12 }, // orbit channel cap + outer rail + wire
      { pts: [[108, 750], [250, 712]], t: 12 },                              // seals the far-left channel
      { pts: [[214, 560], [258, 574]], t: 8 },                               // hands the wire onto the standup (no pocket)
      { pts: [[108, 750], [108, 1040]], t: 12 },                             // left outlane outer wall
      { pts: [[160, 768], [160, 935], [183, 952], [345, 986]], t: 12 },     // left rail + inlane guide
      { pts: [[256, 426], [254, 371], [262, 300], [288, 238], [354, 152], [450, 110],
              [592, 95], [690, 101], [736, 138], [752, 220], [762, 320], [772, 420],
              [786, 500], [800, 714]], t: 14 },                              // inner rail + right boundary
      { pts: [[804, 712], [916, 748]], t: 12 },                              // seals the far-right channel
      { pts: [[872, 768], [872, 935], [851, 952], [709, 986]], t: 12 },     // right rail + inlane guide
      { pts: [[916, 1040], [916, 60]], t: 10 },                              // lane left wall / outlane wall
      { pts: [[974, 1040], [974, 40]], t: 10 },                              // lane right wall
      { pts: [[944, 22], [990, 22]], t: 10 },                                // lane cap
    ],
    posts: [
      [252, 722, 12], [802, 722, 12],            // inlane lamp posts
      [160, 768, 9], [872, 768, 9],              // rail tops
      [270, 386, 13],                            // orbit post
      [415, 221, 10], [655, 223, 10],
      [437, 425, 11], [617, 425, 11],
      [361, 470, 9], [693, 470, 9],
      [264, 636, 11], [790, 636, 11],
    ],
    // pop bumpers: footprint ellipse (the base ring as seen in the photo)
    bumpers: [
      { c: [530, 281], rx: 52, ry: 32 },
      { c: [404, 345], rx: 54, ry: 32 },
      { c: [650, 343], rx: 52, ry: 32 },
    ],
    // slingshots: capsule a->b, kicking face on the inner side
    slings: [
      { a: [262, 798], b: [330, 906], r: 24, n: [0.852, -0.523] },
      { a: [792, 798], b: [724, 906], r: 24, n: [-0.852, -0.523] },
    ],
    // drop targets (the lit windows of VECTOR / SYSTEMS BANK)
    targets: [
      { c: [400, 484], a: 0.30, bank: 0 }, { c: [446, 498], a: 0.30, bank: 0 },
      { c: [608, 498], a: -0.30, bank: 1 }, { c: [654, 484], a: -0.30, bank: 1 },
    ],
    targetSize: [44, 42],
    // gold-triangle standup targets
    standups: [
      [[258, 572], [324, 584], [306, 664], [268, 644]],
      [[796, 572], [730, 584], [748, 664], [786, 644]],
    ],
    scoop: [252, 522], scoopR: 15,
    rollover: [296, 458],
    // lamps
    modeLED: { x: 472, ys: [637, 671, 707, 744, 781], r: 15 },
    modePill: { x: 551, hw: 54, hh: 11 },
    shootAgain: [530, 950],
    lockBox: { c: [843, 364], words: [349, 365, 380] },
    inlaneLamps: [[206, 762], [848, 762]],
    slingLamps: [[262, 798], [340, 925], [792, 798], [714, 925]],
    bankArrows: [[[332, 510], [338, 530], [342, 548]], [[722, 510], [716, 530], [712, 548]]],
    drainY: 1112,
    // sprite cut-outs (photo px) shared by build-assets.cjs and the game
    sprites: {
      flipS: 300,                                  // square flipper sprite, centred on the pivot
      flipSide: [2, 23],                           // the flipper's side face shows below its cap
      plunger: { x: 912, y: 975, w: 100, h: 410 },
      caps: [{ c: [531, 238], r: 58 }, { c: [404, 314], r: 60 }, { c: [650, 316], r: 58 }],
    },
  };

  // ── Derived screen values used by the game ─────────
  T.PCX = px(G.CL);
  T.LANE_X = px(G.laneX);
  T.BALL_START = P(G.laneX, G.plungerTip - 21 - 1);
  T.PH_Y = py(G.plungerTip) + L(12);              // plunger head body centre
  T.GUIDE_Y = py(G.laneTop);
  T.DRAIN_Y = py(G.drainY);
  T.PULL_MAX = 15;                                // visual plunger travel (screen px)
  T.LAUNCH_MIN = 7; T.LAUNCH_RNG = 11;            // launch speed = MIN + pull*RNG (px/step); a
                                                  // very soft pull falls back down the lane
  T.PR = px(G.laneL);                             // x beyond which a ball is in the shooter lane
  T.FLY = py(G.flipL.piv[1]);
  T.LFPX = px(G.flipL.piv[0]); T.RFPX = px(G.flipR.piv[0]);
  T.CMX = px(G.modePill.x);
  T.MODE_Y = G.modeLED.ys.map(py);
  T.SAX = px(G.shootAgain[0]); T.SAY = py(G.shootAgain[1]);

  // ── Guided paths (orbits, ramp, plunger loop) ──────
  // Elevated / enclosed routes the flat physics can't model are ridden along a
  // smoothed polyline. Speed follows gravity along the path, so a weak shot
  // rolls back out of the entrance just like a real rejected ramp.
  function catmull(pts, seg) {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let s = 0; s < seg; s++) {
        const t = s / seg, t2 = t * t, t3 = t2 * t;
        out.push([
          0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
        ]);
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }
  function mkPath(photoPts, name) {
    const pts = catmull(photoPts, 8).map(([x, y]) => [px(x), py(y)]);
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return { name, pts, cum, len: cum[cum.length - 1] };
  }
  T.PATHS = {
    // plunger: up the lane, round the top-right corner, along the top orbit and
    // down the left orbit, released into the upper-left playfield
    plunge: mkPath([[945, 150], [945, 92], [936, 60], [906, 44], [846, 38], [744, 42], [640, 52],
      [540, 64], [444, 80], [364, 110], [304, 156], [262, 218], [238, 290], [228, 362], [226, 420], [228, 470]], 'plunge'),
    // left orbit (shot up from the right flipper): around the top, down the
    // right-hand wire into the right inlane
    orbit: mkPath([[226, 420], [228, 362], [238, 290], [262, 218], [304, 156], [364, 110], [444, 80],
      [540, 64], [640, 52], [744, 44], [836, 58], [880, 108], [890, 200], [884, 320], [872, 440],
      [860, 560], [846, 660], [836, 740], [836, 790]], 'orbit'),
    // clear ramp (shot up from the left flipper): up the S-ramp, over the top
    // and back down the left wire into the left inlane
    ramp: mkPath([[766, 488], [786, 420], [806, 330], [798, 240], [812, 150], [846, 76], [800, 40],
      [700, 46], [590, 60], [480, 74], [380, 104], [300, 160], [248, 250], [214, 380], [196, 520],
      [196, 640], [204, 740], [210, 792]], 'ramp'),
  };
  // entrance boxes (screen) and minimum entry speed for a guided shot
  T.MOUTHS = {
    orbit: { x0: px(194), x1: px(266), y0: py(410), y1: py(505), minV: 6.2, up: 2.4 },
    ramp:  { x0: px(712), x1: px(794), y0: py(455), y1: py(540), minV: 6.8, up: 3.0 },
  };

  // ── Build the Matter.js world ──────────────────────
  T.build = function (Matter) {
    const { Engine, World, Bodies, Body, Constraint, Vertices } = Matter;
    const eng = Engine.create();
    eng.gravity.y = T.GRAVITY;
    eng.positionIterations = 10;
    eng.velocityIterations = 8;

    const FF = { category: 2, mask: 1 };          // flippers
    const FW = { category: 4, mask: 1 };          // walls / features
    const SO = { isStatic: true, friction: 0.02, frictionStatic: 0, restitution: 0.4, collisionFilter: FW };
    const st = [];
    const seg = (a, b, t, ex) => {
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, len = Math.hypot(b.x - a.x, b.y - a.y);
      return Bodies.rectangle(cx, cy, len, t, Object.assign({}, SO, { angle: Math.atan2(b.y - a.y, b.x - a.x) }, ex || {}));
    };
    const circ = (c, r, ex) => Bodies.circle(c.x, c.y, r, Object.assign({}, SO, ex || {}));

    // walls: segments + a round joint at every vertex (no gaps / sharp snags)
    const wallSegs = [];
    G.walls.forEach(w => {
      const t = L(w.t);
      const pts = w.pts.map(p => P(p[0], p[1]));
      for (let i = 0; i < pts.length - 1; i++) { st.push(seg(pts[i], pts[i + 1], t)); wallSegs.push([pts[i], pts[i + 1]]); }
      pts.forEach(p => st.push(circ(p, t / 2)));
    });
    const posts = G.posts.map(([x, y, r]) => circ(P(x, y), L(r), { restitution: 0.55 }));
    st.push.apply(st, posts);

    // pop bumpers (elliptical footprint)
    const bumps = G.bumpers.map((d, i) => {
      const c = P(d.c[0], d.c[1]);
      const b = Bodies.circle(c.x, c.y, L(d.rx), Object.assign({}, SO, { restitution: 0.5, friction: 0, label: 'bump' + i }), 28);
      Body.scale(b, 1, d.ry / d.rx);
      b.plugin = { cd: 0, fl: 0, rx: L(d.rx), ry: L(d.ry), cx: c.x, cy: c.y };
      return b;
    });
    st.push.apply(st, bumps);

    // slingshots: solid capsule, the kicker is applied by the scan
    const slings = G.slings.map((s, i) => {
      const a = P(s.a[0], s.a[1]), b = P(s.b[0], s.b[1]), r = L(s.r);
      const parts = [seg(a, b, 2 * r, { restitution: 0.3 }), circ(a, r, { restitution: 0.3 }), circ(b, r, { restitution: 0.3 })];
      const body = Body.create({ parts, isStatic: true, collisionFilter: FW, restitution: 0.3, friction: 0.02, label: 'sling' + i });
      body.plugin = { cd: 0, fl: 0, a, b, r, n: { x: s.n[0], y: s.n[1] } };
      return body;
    });
    st.push.apply(st, slings);

    // drop targets
    const tw = L(G.targetSize[0]), th = L(G.targetSize[1]);
    const targets = G.targets.map((d, i) => {
      const c = P(d.c[0], d.c[1]);
      const b = Bodies.rectangle(c.x, c.y, tw, th, Object.assign({}, SO, { angle: d.a, restitution: 0.25, label: 'tgt' + i }));
      b.plugin = { cd: 0, fl: 0, dropped: false, sink: 0, bank: d.bank, idx: i };
      return b;
    });
    st.push.apply(st, targets);

    // standup targets (gold triangles)
    const standups = G.standups.map((poly, i) => {
      const vs = poly.map(p => P(p[0], p[1]));
      const c = Vertices.centre(vs);
      const b = Bodies.fromVertices(c.x, c.y, [vs], Object.assign({}, SO, { restitution: 0.45, label: 'stand' + i }));
      Body.setPosition(b, { x: b.position.x + (c.x - Vertices.centre(b.vertices).x), y: b.position.y + (c.y - Vertices.centre(b.vertices).y) });
      b.plugin = { cd: 0, fl: 0, c };
      return b;
    });
    st.push.apply(st, standups);

    // plunger head (the floor the lane ball rests on)
    const plungerHead = Bodies.rectangle(px(G.laneX), T.PH_Y, L(44), L(24), Object.assign({}, SO, { friction: 0.2, restitution: 0.02 }));
    st.push(plungerHead);

    World.add(eng.world, st);

    // flippers: tapered polygon authored at its rest pose (body angle 0 = rest)
    function mkFlip(d, left) {
      const piv = P(d.piv[0], d.piv[1]), tip = P(d.tip[0], d.tip[1]);
      const ang = Math.atan2(tip.y - piv.y, tip.x - piv.x);
      const len = Math.hypot(tip.x - piv.x, tip.y - piv.y), r1 = L(d.r1), r2 = L(d.r2);
      const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
      const vs = [];
      for (let i = 0; i <= 8; i++) {                 // rounded pivot end
        const a = ang + Math.PI / 2 + i / 8 * Math.PI;
        vs.push({ x: piv.x + Math.cos(a) * r1, y: piv.y + Math.sin(a) * r1 });
      }
      for (let i = 0; i <= 8; i++) {                 // rounded tip end
        const a = ang - Math.PI / 2 + i / 8 * Math.PI;
        vs.push({ x: tip.x + Math.cos(a) * r2, y: tip.y + Math.sin(a) * r2 });
      }
      void nx; void ny;
      const c = Vertices.centre(vs);
      const b = Bodies.fromVertices(c.x, c.y, [vs], {
        isStatic: false, density: 0.08, friction: 0.03, restitution: 0.45,  // lively rubber
        collisionFilter: FF, label: 'flip',
      });
      // place so the polygon sits exactly where it was authored
      const bc = Vertices.centre(b.vertices);
      Body.setPosition(b, { x: b.position.x + (c.x - bc.x), y: b.position.y + (c.y - bc.y) });
      const pv = Bodies.circle(piv.x, piv.y, 2, { isStatic: true, collisionFilter: { mask: 0 } });
      const con = Constraint.create({
        bodyA: b, pointA: { x: piv.x - b.position.x, y: piv.y - b.position.y },
        bodyB: pv, length: 0, stiffness: 1,
      });
      World.add(eng.world, [b, pv, con]);
      const up = left ? -G.flipTravel : G.flipTravel;
      return { body: b, pivX: piv.x, y: piv.y, left, rest: 0, up, on: false, len, restAng: ang, r1, r2 };
    }
    const LF = mkFlip(G.flipL, true);
    const RF = mkFlip(G.flipR, false);

    const tb = {
      M: Matter, eng, world: eng.world,
      bumps, posts, slings, targets, standups, plungerHead, LF, RF, wallSegs,
      modeCd: [0, 0, 0, 0, 0], rollCd: 0,
    };
    // compatibility aliases for older callers
    tb.slingL = slings[0]; tb.slingR = slings[1];
    tb.vbT = targets.filter(t => t.plugin.bank === 0);
    tb.sbT = targets.filter(t => t.plugin.bank === 1);
    tb.addBall = function (x, y) {
      const b = Bodies.circle(x, y, T.BALL_R, {
        restitution: 0.2, friction: 0, frictionStatic: 0, frictionAir: 0.0012, density: 0.004,
        collisionFilter: { category: 1, mask: 0xFFFF }, label: 'ball',
      }, 20);
      b.plugin = {};
      World.add(eng.world, b);
      return b;
    };
    tb.removeBall = function (b) { World.remove(eng.world, b); };
    return tb;
  };

  // ── Flipper drive (call every physics substep) ─────
  T.stepFlippers = function (tb, tilted, balls) {
    const { Body } = tb.M;
    [tb.LF, tb.RF].forEach(f => {
      f.w = 0;
      const on = f.on && !tilted;
      // keep the bat inside its travel first (gravity/contacts nudge it a hair
      // past the stops), THEN drive it — clamping after the drive used to zero
      // the solenoid's velocity every step and the flipper never fired.
      const lo = Math.min(f.rest, f.up), hi = Math.max(f.rest, f.up);
      if (f.body.angle < lo) Body.setAngle(f.body, lo);
      if (f.body.angle > hi) Body.setAngle(f.body, hi);
      const tgt = on ? f.up : f.rest, d = tgt - f.body.angle;
      if (Math.abs(d) < 0.01) {
        Body.setAngle(f.body, tgt); Body.setAngularVelocity(f.body, 0);
      } else {
        // solenoid stroke: full speed until the stop (~30 ms for the whole
        // swing, like a real flipper); the return spring is gentler
        const lim = on ? 0.6 : 0.2;
        f.w = Math.sign(d) * Math.min(lim, Math.abs(d) * 1.2);
        Body.setAngularVelocity(f.body, f.w);
        // a rising bat strikes the ball itself (see strike below)
        if (on && balls) for (const b of balls) strike(tb, f, b);
      }
    });
  };

  // Flipper strike. A rigid-body solver resolves a fast bat against a light
  // ball as a slow shove (the ball rides the rubber round the swing and leaves
  // weak and nearly straight up), and at the tip the bat moves further per
  // substep than the ball is wide. A real flipper *hits* the ball: it leaves
  // along the bat's normal at the moment of impact with (1+e)× the rubber's
  // surface speed at that point — slow near the pivot, fast at the tip, early
  // flips go across the table, late flips go straight.
  const FLIP_E = 0.55;
  function strike(tb, f, b) {
    const pl = b.plugin;
    if (pl.guide || pl.held || pl.inLane) return;
    const { Body } = tb.M;
    const th0 = f.restAng + f.body.angle, th1 = th0 + f.w * 0.5;   // this substep's sweep
    const dx = b.position.x - f.pivX, dy = b.position.y - f.y;
    const R = T.BALL_R, sg = Math.sign(f.w);
    const side = (th) => {                   // along-bat t, signed distance on the leading side
      const ux = Math.cos(th), uy = Math.sin(th), nx = -uy * sg, ny = ux * sg;
      return { t: dx * ux + dy * uy, n: dx * nx + dy * ny, ux, uy, nx, ny };
    };
    const a = side(th0), e = side(th1);
    const t = Math.max(0, Math.min(f.len, e.t));
    if (a.t < -f.r1 || a.t > f.len + f.r2 + R * 0.6) return;
    const rad = f.r1 + (f.r2 - f.r1) * (t / f.len) + R;
    // ahead of the bat at the start of the substep, overlapping (or passed) at the end
    if (a.n < -rad * 0.5 || e.n > rad + 0.5) return;
    // the bat turns up to ~17° per substep, so take the normal at the moment
    // of contact, not at the end of the sweep
    const frac = a.n <= rad ? 0 : Math.min(1, (a.n - rad) / (a.n - e.n));
    const c = side(th0 + (th1 - th0) * frac);
    const vs = f.w * Math.max(0, c.t) * sg;  // surface speed along the leading normal
    const vn = b.velocity.x * c.nx + b.velocity.y * c.ny;
    if (vn >= vs) return;                     // already leaving faster than the bat
    const nv = vs * (1 + FLIP_E) - FLIP_E * vn, dv = nv - vn;
    const vt = b.velocity.x * c.ux + b.velocity.y * c.uy;
    Body.setVelocity(b, { x: c.nx * nv + c.ux * vt * 0.92, y: c.ny * nv + c.uy * vt * 0.92 });
    // sit the ball on the bat's face at the end of the substep
    const push = rad + 0.6 - e.n;
    if (push > 0) Body.setPosition(b, { x: b.position.x + e.nx * push, y: b.position.y + e.ny * push });
    pl.flipHit = dv;
  }

  // ── Speed clamp / escape failsafe ──────────────────
  T.clampBall = function (tb, b) {
    const { Body } = tb.M;
    const v = b.velocity, s = Math.hypot(v.x, v.y);
    if (s > T.MAXV) Body.setVelocity(b, { x: v.x / s * T.MAXV, y: v.y / s * T.MAXV });
    const p = b.position;
    if (!isFinite(p.x) || !isFinite(p.y)) return false;
    if (p.x < 4 || p.x > T.W - 2 || p.y < T.IMG_Y - 20) return false;
    return true;
  };

  // Continuous-collision guard. The rails are only ~5 px thick and a hard
  // shot moves up to 12 px per substep, so the solver can let a ball straight
  // through one. If this substep's motion crossed a rail's centre line, put
  // the ball back on its own side and bounce it off the rail.
  const cross = (p, q, a, b) => {
    const d = (q.x - p.x) * (b.y - a.y) - (q.y - p.y) * (b.x - a.x);
    if (Math.abs(d) < 1e-9) return false;
    const u = ((a.x - p.x) * (b.y - a.y) - (a.y - p.y) * (b.x - a.x)) / d;
    const v = ((a.x - p.x) * (q.y - p.y) - (a.y - p.y) * (q.x - p.x)) / d;
    return u >= 0 && u <= 1 && v >= 0 && v <= 1;
  };
  T.unTunnel = function (tb, b, prev) {
    const q = b.position;
    if (Math.abs(q.x - prev.x) + Math.abs(q.y - prev.y) < T.BALL_R * 0.6) return false;
    for (const [a, c] of tb.wallSegs) {
      if (!cross(prev, q, a, c)) continue;
      const { Body } = tb.M;
      const lx = c.x - a.x, ly = c.y - a.y, l = Math.hypot(lx, ly);
      let nx = -ly / l, ny = lx / l;
      if ((prev.x - a.x) * nx + (prev.y - a.y) * ny < 0) { nx = -nx; ny = -ny; }
      const v = b.velocity, vn = v.x * nx + v.y * ny;
      Body.setPosition(b, { x: prev.x, y: prev.y });
      if (vn < 0) Body.setVelocity(b, { x: v.x - 1.4 * vn * nx, y: v.y - 1.4 * vn * ny });
      return true;
    }
    return false;
  };

  // A top-down playfield has no tilt, so a ball can come to rest on a ledge.
  // If a ball loiters almost still above the flipper zone, nudge it downhill.
  T.antiStuck = function (tb, b) {
    const { Body } = tb.M;
    const pl = b.plugin;
    if (pl.inLane || pl.guide || pl.held) { pl.slow = 0; return; }
    const v = Math.hypot(b.velocity.x, b.velocity.y);
    if (v < 0.35 && b.position.y < T.FLY - 18) {
      // like a player bumping the cabinet: a small shove in a random direction,
      // repeated until the ball is rolling again
      if ((pl.slow = (pl.slow || 0) + 1) > 80) {
        const a = Math.random() * Math.PI * 2;
        Body.setVelocity(b, { x: Math.cos(a) * 2.4, y: Math.sin(a) * 2.4 });
        pl.slow = 0;
      }
    } else pl.slow = 0;
  };

  // ── Guided-path riding ─────────────────────────────
  function pathAt(path, s) {
    const cum = path.cum, pts = path.pts;
    s = Math.max(0, Math.min(path.len, s));
    let lo = 0, hi = cum.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
    const segLen = cum[hi] - cum[lo] || 1, t = (s - cum[lo]) / segLen;
    const a = pts[lo], b = pts[hi];
    const tx = (b[0] - a[0]) / segLen, ty = (b[1] - a[1]) / segLen;
    return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, tx, ty };
  }
  T.pathAt = pathAt;
  T.startGuide = function (tb, b, name, speed) {
    b.plugin.guide = { name, s: 0, v: Math.max(1.5, speed) };
    b.collisionFilter = { category: 1, mask: 0 };
  };
  // returns 'exit' when the ball leaves the end, 'back' when it rolls back out
  T.stepGuide = function (tb, b) {
    const { Body } = tb.M;
    const gd = b.plugin.guide, path = T.PATHS[gd.name];
    const here = pathAt(path, gd.s);
    // gd.v is in Matter velocity units; per 120 Hz substep the ball moves v/2 px
    // and gravity along the path adds g·ty. dv = g·ty is right in both
    // directions: forward-downhill speeds up, a ball rolling back slows on the
    // uphill-forward segments.
    gd.v += T.GRAVITY * (1000 / 120 / T.VUNIT) * here.ty;
    gd.v *= 0.9994;
    gd.s += gd.v * 0.5;
    if (gd.s >= path.len) {
      const e = pathAt(path, path.len), sp = Math.max(2, Math.min(gd.v, 12));
      Body.setPosition(b, { x: e.x, y: e.y });
      Body.setVelocity(b, { x: e.tx * sp, y: e.ty * sp });
      b.collisionFilter = { category: 1, mask: 0xFFFF };
      b.plugin.guide = null;
      return 'exit';
    }
    if (gd.s <= 0 && gd.v <= 0) {
      const e = pathAt(path, 0), sp = Math.max(1.5, Math.min(-gd.v, 10));
      Body.setPosition(b, { x: e.x, y: e.y });
      Body.setVelocity(b, { x: -e.tx * sp, y: -e.ty * sp });
      b.collisionFilter = { category: 1, mask: 0xFFFF };
      b.plugin.guide = null;
      return 'back';
    }
    const p = pathAt(path, gd.s);
    Body.setPosition(b, { x: p.x, y: p.y });
    Body.setVelocity(b, { x: 0, y: 0 });
    return null;
  };

  const inRect = (x, y, rx, ry, hw, hh, a) => {
    const ca = Math.cos(-a), sa = Math.sin(-a), dx = x - rx, dy = y - ry;
    const lx = dx * ca - dy * sa, ly = dx * sa + dy * ca;
    return Math.abs(lx) < hw && Math.abs(ly) < hh;
  };
  const segDist = (x, y, a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    let t = ((x - a.x) * dx + (y - a.y) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(x - (a.x + dx * t), y - (a.y + dy * t));
  };

  // ── Feature scan (per substep, before the solver) ──
  // cb(type, data, pos) — the game maps events to rules, lamps and sound.
  T.scan = function (tb, balls, cb) {
    const { Body } = tb.M;
    const R = T.BALL_R;
    tb.bumps.forEach(b => { if (b.plugin.cd > 0) b.plugin.cd--; });
    tb.slings.forEach(s => { if (s.plugin.cd > 0) s.plugin.cd--; });
    tb.targets.forEach(t => { if (t.plugin.cd > 0) t.plugin.cd--; });
    tb.standups.forEach(t => { if (t.plugin.cd > 0) t.plugin.cd--; });
    tb.modeCd.forEach((c, i) => { if (c > 0) tb.modeCd[i]--; });
    if (tb.rollCd > 0) tb.rollCd--;

    for (const ball of balls) {
      const pl = ball.plugin;
      if (pl.guide || pl.held) continue;
      const bx = ball.position.x, by = ball.position.y, v = ball.velocity;

      if (pl.inLane) {
        // shooter lane: reaching the top rides the orbit into the playfield
        if (v.y < 0 && by < T.GUIDE_Y) { cb('launch', Math.hypot(v.x, v.y), ball); }
        continue;
      }

      // pop bumpers — active kick along the ellipse normal
      tb.bumps.forEach((b, i) => {
        const q = b.plugin; if (q.cd > 0) return;
        const dx = bx - q.cx, dy = by - q.cy, ax = q.rx + R + 1.5, ay = q.ry + R + 1.5;
        if ((dx * dx) / (ax * ax) + (dy * dy) / (ay * ay) < 1) {
          q.cd = 36; q.fl = 1;
          let nx = dx / (ax * ax), ny = dy / (ay * ay);
          const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
          const ja = (Math.random() - 0.5) * 0.5, ca = Math.cos(ja), sa = Math.sin(ja);
          const kx = nx * ca - ny * sa, ky = nx * sa + ny * ca, kp = 6.2 + Math.random() * 1.6;
          Body.setVelocity(ball, { x: kx * kp + v.x * 0.15, y: ky * kp + v.y * 0.15 });
          cb('bumper', i, { x: q.cx, y: q.cy });
        }
      });

      // slingshots — kick when the ball strikes the inner face
      tb.slings.forEach((s, i) => {
        const q = s.plugin; if (q.cd > 0) return;
        const fa = { x: q.a.x + q.n.x * q.r, y: q.a.y + q.n.y * q.r }, fb = { x: q.b.x + q.n.x * q.r, y: q.b.y + q.n.y * q.r };
        const d = segDist(bx, by, fa, fb);
        if (d < R + 2.5 && (v.x * q.n.x + v.y * q.n.y) < -0.9) {
          q.cd = 34; q.fl = 1;
          const ja = (Math.random() - 0.5) * 0.4, ca = Math.cos(ja), sa = Math.sin(ja);
          const kx = q.n.x * ca - q.n.y * sa, ky = q.n.x * sa + q.n.y * ca, kp = 5.4 + Math.random() * 1.2;
          Body.setVelocity(ball, { x: v.x * 0.12 + kx * kp, y: v.y * 0.12 + ky * kp });
          cb('sling', i, { x: bx, y: by });
        }
      });

      // drop targets
      tb.targets.forEach(t => {
        const q = t.plugin; if (q.dropped || q.cd > 0) return;
        const hw = L(G.targetSize[0]) / 2 + R + 1, hh = L(G.targetSize[1]) / 2 + R + 1;
        if (inRect(bx, by, t.position.x, t.position.y, hw, hh, t.angle)) {
          q.cd = 50; cb('target', q.idx, t.position);
        }
      });

      // standups
      tb.standups.forEach((t, i) => {
        const q = t.plugin; if (q.cd > 0) return;
        const vs = t.vertices; let inside = true, near = Infinity;
        for (let k = 0; k < vs.length; k++) {
          const a = vs[k], b2 = vs[(k + 1) % vs.length];
          near = Math.min(near, segDist(bx, by, a, b2));
          if ((b2.x - a.x) * (by - a.y) - (b2.y - a.y) * (bx - a.x) < 0) inside = false;
        }
        if (inside || near < R + 2) { q.cd = 40; q.fl = 1; cb('standup', i, q.c); }
      });

      // CORE MODES rollovers (the printed pills)
      const mp = G.modePill;
      for (let i = 0; i < 5; i++) {
        if (tb.modeCd[i] > 0) continue;
        if (Math.abs(bx - px(mp.x)) < L(mp.hw) && Math.abs(by - T.MODE_Y[i]) < L(mp.hh) + R * 0.6) {
          tb.modeCd[i] = 60; cb('mode', i, { x: px(mp.x), y: T.MODE_Y[i] });
        }
      }
      // rollover ring
      const ro = P(G.rollover[0], G.rollover[1]);
      if (tb.rollCd <= 0 && Math.hypot(bx - ro.x, by - ro.y) < L(16)) { tb.rollCd = 60; cb('rollover', 0, ro); }

      // scoop: a slow-enough ball over the hole drops in
      const sc = P(G.scoop[0], G.scoop[1]);
      if (!(ball.plugin.scoopCd > 0) && Math.hypot(bx - sc.x, by - sc.y) < L(G.scoopR) && Math.hypot(v.x, v.y) < 7) { cb('scoop', 0, ball); continue; }

      // orbit / ramp entrances
      for (const k of ['orbit', 'ramp']) {
        const m = T.MOUTHS[k];
        // heading into the mouth: rising, and not skimming across it sideways
        if (bx > m.x0 && bx < m.x1 && by > m.y0 && by < m.y1 && v.y < 0 && Math.abs(v.x) < -v.y * m.up) {
          const sp = Math.hypot(v.x, v.y);
          if (sp >= m.minV) { cb(k, sp, ball); break; }
        }
      }
    }
  };

  // ── One physics substep (shared by the game and the headless tests) ──
  // Handles mechanics only; scoring/lamps/sound live in the game via emit():
  //   emit(type, data, ball) with type in
  //   bumper sling target standup mode rollover | launch plungeExit
  //   orbit orbitExit orbitBack | ramp rampExit rampBack | scoop scoopEject | drain
  T.STEP_MS = 1000 / 120;
  T.SCOOP_HOLD = 110;                              // substeps a ball is held in the scoop
  T.sim = function (tb, balls, emit, opts) {
    const { Engine, Body } = tb.M;
    opts = opts || {};
    T.stepFlippers(tb, opts.tilted, balls);
    for (const b of balls.slice()) {
      const pl = b.plugin;
      if (pl.held) {
        if (--pl.held.t <= 0) {
          const sc = P(G.scoop[0], G.scoop[1]);
          pl.held = null;
          b.collisionFilter = { category: 1, mask: 0xFFFF };
          // kicked out across the bank toward the centre of the playfield,
          // clear of the standup below the hole
          Body.setPosition(b, { x: sc.x + L(10), y: sc.y });
          Body.setVelocity(b, { x: 7.2 + Math.random() * 0.8, y: -0.6 + Math.random() * 0.8 });
          pl.scoopCd = 90;
          emit('scoopEject', 0, b);
        } else {
          const sc = P(G.scoop[0], G.scoop[1]);
          Body.setPosition(b, sc); Body.setVelocity(b, { x: 0, y: 0 });
        }
        continue;
      }
      if (pl.scoopCd > 0) pl.scoopCd--;
      if (pl.guide) {
        const name = pl.guide.name, r = T.stepGuide(tb, b);
        if (r === 'exit') emit(name + 'Exit', 0, b);
        else if (r === 'back') emit(name + 'Back', 0, b);
      }
    }
    T.scan(tb, balls, (type, d, pos) => {
      if (type === 'launch') {                     // d = speed, pos = ball
        const b = pos; b.plugin.inLane = false;
        T.startGuide(tb, b, 'plunge', Math.max(2.5, d));
        emit('launch', d, b);
      } else if (type === 'orbit' || type === 'ramp') {
        const b = pos; T.startGuide(tb, b, type, d * 0.95);
        emit(type, d, b);
      } else if (type === 'scoop') {
        const b = pos; b.plugin.held = { t: opts.scoopHold || T.SCOOP_HOLD };
        b.collisionFilter = { category: 1, mask: 0 };
        emit('scoop', 0, b);
      } else emit(type, d, pos);
    });
    for (const b of balls) b.plugin.prev = { x: b.position.x, y: b.position.y };
    Engine.update(tb.eng, T.STEP_MS);
    for (const b of balls.slice()) {
      if (b.plugin.guide || b.plugin.held) continue;
      T.unTunnel(tb, b, b.plugin.prev);
      if (!T.clampBall(tb, b)) { emit('drain', 'lost', b); continue; }
      T.antiStuck(tb, b);
      if (b.position.y > T.DRAIN_Y && !b.plugin.inLane) emit('drain', 0, b);
    }
    // lamp/animation timers
    tb.bumps.forEach(q => { if (q.plugin.fl > 0) q.plugin.fl = Math.max(0, q.plugin.fl - 0.035); });
    tb.slings.forEach(q => { if (q.plugin.fl > 0) q.plugin.fl = Math.max(0, q.plugin.fl - 0.05); });
    tb.standups.forEach(q => { if (q.plugin.fl > 0) q.plugin.fl = Math.max(0, q.plugin.fl - 0.04); });
    tb.targets.forEach(t => {
      if (t.plugin.fl > 0) t.plugin.fl = Math.max(0, t.plugin.fl - 0.03);
      t.plugin.sink += ((t.plugin.dropped ? 1 : 0) - t.plugin.sink) * 0.2;
    });
  };

  // helpers for the game
  T.dropTarget = function (t, down) {
    t.plugin.dropped = down;
    t.collisionFilter = { category: 4, mask: down ? 0 : 1 };
  };

  return T;
});
