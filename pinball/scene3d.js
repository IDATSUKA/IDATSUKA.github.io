/* AURORA INDUSTRIES — 3D scene builder (Three.js).
   Pure scene-graph construction + per-frame sync; no renderer/DOM here,
   so the whole module is testable headlessly in node. */

export const CONF = {
  TILT: 0.115,                       // playfield incline (rad)
  CAM: { fov: 50, pos: [0, 990, -330], look: [0, 40, -460] },
};

const LX = x => x - 195;             // table x  -> local X
const LZ = y => y - 844;             // table y  -> local Z (player end = 0)

// ── small canvas-texture helpers ──────────────────────
function texFromPaint(THREE, makeCanvas, w, h, paint) {
  const cv = makeCanvas(w * 2, h * 2);
  const c = cv.getContext('2d');
  c.scale(2, 2);
  paint(c, w, h);
  const t = new THREE.CanvasTexture(cv);
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function roundRectPath(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

// ── playfield art ─────────────────────────────────────
function paintPlayfield(c, T) {
  const W = 390, H = 658;
  const g = c.createRadialGradient(195, 210, 30, 195, 250, 330);
  g.addColorStop(0, '#F9F3E5'); g.addColorStop(0.5, '#EDE8D8'); g.addColorStop(1, '#D8D2C2');
  c.fillStyle = g; c.fillRect(0, 0, W, H);

  // felt specks
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
    if (Math.random() > 0.8) { c.fillStyle = `rgba(115,98,50,${0.03 + Math.random() * 0.04})`; c.fillRect(x, y, 1, 1); }
  }
  // dot matrix
  c.fillStyle = 'rgba(122,105,52,0.20)';
  for (let y = 40; y < H; y += 22) for (let x = 38; x < 370; x += 22) {
    c.beginPath(); c.arc(x, y, 0.95, 0, Math.PI * 2); c.fill();
  }
  // circuit traces
  c.strokeStyle = 'rgba(115,96,45,0.10)'; c.lineWidth = 0.7;
  for (let y = 83; y < H; y += 48) { c.beginPath(); c.moveTo(34, y); c.lineTo(310, y); c.stroke(); }
  [[50, 103, 150, 203], [190, 203, 290, 103], [42, 223, 80, 323], [262, 323, 298, 223],
   [58, 400, 140, 450], [200, 450, 282, 400]].forEach(([x1, y1, x2, y2]) => {
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
  });
  c.fillStyle = 'rgba(115,96,45,0.20)';
  T.BUMPERS.forEach(p => { c.beginPath(); c.arc(p.x, p.y, 26, 0, Math.PI * 2); c.stroke(); });

  // arch rings
  c.strokeStyle = 'rgba(132,112,55,0.12)'; c.lineWidth = 0.9;
  for (let i = 1; i <= 5; i++) {
    c.beginPath(); c.ellipse(T.ACX, T.ACY, T.ARX - i * 13, T.ARY - i * 7, 0, Math.PI, 0); c.stroke();
  }
  // header
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = 'rgba(26,22,12,0.9)'; c.font = 'bold 16px "Helvetica Neue",Arial,sans-serif';
  c.fillText('AURORA', T.ACX, T.ACY - 26);
  c.fillStyle = 'rgba(46,40,24,0.7)'; c.font = '7px "Helvetica Neue",Arial,sans-serif';
  c.fillText('I N D U S T R I E S', T.ACX, T.ACY - 9);
  c.strokeStyle = 'rgba(55,48,26,0.3)'; c.lineWidth = 0.7;
  c.beginPath(); c.moveTo(T.ACX - 30, T.ACY - 1); c.lineTo(T.ACX + 30, T.ACY - 1); c.stroke();

  // bank labels
  c.fillStyle = 'rgba(28,24,14,0.72)'; c.font = 'bold 8px "Helvetica Neue"';
  c.fillText('VECTOR BANK', 80, 390);
  c.fillText('SYSTEMS BANK', 260, 390);
  // CORE MODES header
  c.fillText('◆  CORE MODES  ◆', T.CMX, T.CMY0 - 22);
  // lane labels
  [['▲ INLANE', 81, 548, -Math.PI / 2], ['▲ OUTLANE', 42, 552, -Math.PI / 2], ['OUTLANE ▲', 297, 552, Math.PI / 2]].forEach(([t, x, y, a]) => {
    c.save(); c.translate(x, y); c.rotate(a);
    c.fillStyle = 'rgba(55,50,32,0.55)'; c.font = 'bold 6.5px "Helvetica Neue"';
    c.fillText(t, 0, 0); c.restore();
  });
  // shooter lane: darker wood strip
  c.fillStyle = 'rgba(20,18,12,0.55)'; c.fillRect(326, 0, 56, H);
  c.fillStyle = 'rgba(238,230,210,0.10)'; c.fillRect(328, 0, 2, H);
  // drain shadow
  const dg = c.createRadialGradient(195, H, 4, 195, H, 46);
  dg.addColorStop(0, 'rgba(0,0,0,0.85)'); dg.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = dg; c.beginPath(); c.ellipse(195, H, 46, 20, 0, 0, Math.PI * 2); c.fill();
  // apron lead-in wedges
  c.fillStyle = 'rgba(14,14,16,0.8)';
  c.beginPath(); c.moveTo(64, 600); c.lineTo(101, 634); c.lineTo(101, H); c.lineTo(64, H); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(326 - 50, 600); c.lineTo(239, 634); c.lineTo(239, H); c.lineTo(326 - 50, H); c.closePath(); c.fill();
  // dark cabinet floor outside the top arch
  c.fillStyle = '#0d0d0f';
  c.beginPath();
  c.moveTo(0, 0); c.lineTo(0, T.ACY); c.lineTo(T.PL, T.ACY);
  c.ellipse(T.ACX, T.ACY, T.ARX, T.ARY, 0, Math.PI, 0, false);
  c.lineTo(W, T.ACY); c.lineTo(W, 0); c.closePath();
  c.fill();
  // faint gold border along the arch
  c.strokeStyle = 'rgba(178,150,68,0.35)'; c.lineWidth = 1.5;
  c.beginPath(); c.ellipse(T.ACX, T.ACY, T.ARX, T.ARY, 0, Math.PI, 0, false); c.stroke();
}

function paintApron(c, W, H) {
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1b1b1e'); g.addColorStop(1, '#101013');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.strokeStyle = '#B8903A'; c.lineWidth = 2;
  c.strokeRect(6, 6, W - 12, H - 12);
  // logo
  c.save(); c.translate(W / 2, H * 0.46);
  c.strokeStyle = '#D4AA50'; c.lineWidth = 3;
  c.beginPath(); c.moveTo(0, -30); c.lineTo(28, 19); c.lineTo(-28, 19); c.closePath(); c.stroke();
  c.beginPath(); c.moveTo(-12, 5); c.lineTo(12, 5); c.stroke();
  c.restore();
  c.textBaseline = 'middle';
  c.fillStyle = '#D4AA50'; c.font = 'bold 13px "Helvetica Neue"'; c.textAlign = 'left';
  c.fillText('AURORA INDUSTRIES', 22, 28);
  c.fillStyle = 'rgba(170,152,102,0.9)'; c.font = 'bold 11px "Helvetica Neue"'; c.textAlign = 'right';
  c.fillText('MINIMAL SYSTEMS.', W - 22, 22);
  c.fillText('MAXIMUM IMPACT.', W - 22, 38);
  c.fillStyle = 'rgba(150,134,92,0.85)'; c.font = '10px "Helvetica Neue"'; c.textAlign = 'left';
  ['LIGHT CORE MODES — progress the ladder', 'COMPLETE BANKS — build value',
   'ORBIT ×3 — MULTIBALL', '3X SCORING at ELEVATE'].forEach((l, i) => c.fillText(l, 22, 56 + i * 17));
  c.textAlign = 'right';
  ['1–4 PLAYERS', 'DESIGNED & BUILT', 'FOR PRECISION PLAY'].forEach((l, i) => c.fillText(l, W - 22, 64 + i * 17));
}

function paintPill(c, w, h, name, state) {
  // state: 0 off, 1 active, 2 done
  c.clearRect(0, 0, w, h);
  roundRectPath(c, 1, 1, w - 2, h - 2, h / 2 - 1);
  c.fillStyle = state === 2 ? '#8a6a14' : state === 1 ? '#3a2c08' : '#0d0d0b';
  c.fill();
  c.lineWidth = 1.6;
  c.strokeStyle = state === 1 ? '#D4AA50' : state === 2 ? '#b8903a' : '#39342a';
  c.stroke();
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = 'bold 10px "Helvetica Neue",Arial,sans-serif';
  c.fillStyle = state === 0 ? 'rgba(140,128,90,0.9)' : '#EFCF7E';
  c.fillText(name, w / 2, h / 2 + 0.5);
  if (state === 2) { c.fillStyle = '#FFE9A8'; c.font = 'bold 11px Arial'; c.fillText('✓', w - 14, h / 2); }
}

function paintSA(c, w, h, lit) {
  c.clearRect(0, 0, w, h);
  c.save(); c.translate(w / 2, h / 2);
  c.beginPath(); c.moveTo(0, -h / 2 + 2); c.lineTo(w / 2 - 4, 0); c.lineTo(0, h / 2 - 2); c.lineTo(-w / 2 + 4, 0); c.closePath();
  c.fillStyle = lit ? 'rgba(212,170,80,0.85)' : '#141416';
  c.fill();
  c.strokeStyle = lit ? '#FFE9A8' : '#B8903A'; c.lineWidth = 2; c.stroke();
  c.fillStyle = lit ? '#1a1408' : 'rgba(172,150,82,0.95)';
  c.font = 'bold 7.5px "Helvetica Neue",Arial,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('SHOOT', 0, -5); c.fillText('AGAIN', 0, 5);
  c.restore();
}

// ── scene construction ────────────────────────────────
export function buildScene(THREE, T, makeCanvas) {
  const root = new THREE.Group();
  const tableG = new THREE.Group();
  tableG.rotation.x = CONF.TILT;
  root.add(tableG);

  // environment cube (simple studio gradient)
  const envFaces = [];
  for (let i = 0; i < 6; i++) {
    const cv = makeCanvas(64, 64); const c = cv.getContext('2d');
    let g;
    if (i === 2) { g = c.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, '#fff6e0'); g.addColorStop(1, '#776a4a'); } // +Y bright warm
    else if (i === 3) { g = c.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, '#16140f'); g.addColorStop(1, '#050505'); }
    else { g = c.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, '#8a8070'); g.addColorStop(0.55, '#2c2820'); g.addColorStop(1, '#0a0908'); }
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    envFaces.push(cv);
  }
  const envTex = new THREE.CubeTexture(envFaces);
  envTex.needsUpdate = true;
  envTex.colorSpace = THREE.SRGBColorSpace;

  // materials
  const M = {
    wall: new THREE.MeshStandardMaterial({ color: 0x1d1d21, roughness: 0.5, metalness: 0.45 }),
    cab: new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.55, metalness: 0.35 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xb8903a, roughness: 0.32, metalness: 0.85 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xeeeef4, roughness: 0.12, metalness: 1.0 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xb4b4be, roughness: 0.3, metalness: 0.9 }),
    ivory: new THREE.MeshStandardMaterial({ color: 0xf2ead6, roughness: 0.5, metalness: 0.05 }),
    housing: new THREE.MeshStandardMaterial({ color: 0x232326, roughness: 0.6, metalness: 0.35 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.92, metalness: 0.0 }),
    dome: new THREE.MeshStandardMaterial({ color: 0xe8e8ea, roughness: 0.25, metalness: 0.55 }),
  };

  const add = (mesh, x, y, z, opts) => {
    mesh.position.set(x, y, z);
    if (opts && opts.ry !== undefined) mesh.rotation.y = opts.ry;
    if (opts && opts.cast) mesh.castShadow = true;
    if (opts && opts.recv) mesh.receiveShadow = true;
    tableG.add(mesh);
    return mesh;
  };

  // ── playfield ──
  const pfTex = texFromPaint(THREE, makeCanvas, 390, 658, c => paintPlayfield(c, T));
  const pf = new THREE.Mesh(
    new THREE.PlaneGeometry(390, 658),
    new THREE.MeshStandardMaterial({ map: pfTex, roughness: 0.82, metalness: 0.04 })
  );
  pf.rotation.x = -Math.PI / 2;
  pf.position.set(0, 0, LZ(329));
  pf.receiveShadow = true;
  tableG.add(pf);

  // ── apron (front panel, slightly raked; leaves the shooter lane open) ──
  const apTex = texFromPaint(THREE, makeCanvas, 326, 128, paintApron);
  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(326, 130),
    new THREE.MeshStandardMaterial({ map: apTex, roughness: 0.6, metalness: 0.25 })
  );
  apron.rotation.x = -Math.PI / 2 + 0.14;
  apron.position.set(-32, 9, LZ(723));
  apron.receiveShadow = true;
  tableG.add(apron);
  // shooter-lane floor continuation beside the apron
  const laneFloor = new THREE.Mesh(new THREE.BoxGeometry(60, 5, 190), M.cab);
  laneFloor.position.set(LX(354), 1.5, LZ(750));
  laneFloor.receiveShadow = true;
  tableG.add(laneFloor);

  // ── arch + walls ──
  T.archSegs(28).forEach(s => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(s.len, 26, 16), M.wall);
    add(m, LX(s.x), 13, LZ(s.y), { ry: -s.angle, cast: true });
  });
  add(new THREE.Mesh(new THREE.BoxGeometry(12, 26, 740), M.wall), LX(T.PL - 6), 13, LZ(478), { cast: true });
  add(new THREE.Mesh(new THREE.BoxGeometry(12, 26, 740), M.wall), LX(T.PR + 4), 13, LZ(478), { cast: true });
  add(new THREE.Mesh(new THREE.BoxGeometry(12, 26, 830), M.wall), LX(T.W - 6), 13, LZ(430), { cast: true });
  // cabinet sides + back
  add(new THREE.Mesh(new THREE.BoxGeometry(18, 46, 900), M.cab), -212, 14, LZ(400));
  add(new THREE.Mesh(new THREE.BoxGeometry(18, 46, 900), M.cab), 212, 14, LZ(400));
  add(new THREE.Mesh(new THREE.BoxGeometry(450, 70, 18), M.cab), 0, 22, LZ(-12));
  // gold side trims
  add(new THREE.Mesh(new THREE.BoxGeometry(4, 3, 900), M.gold), -212, 38, LZ(400));
  add(new THREE.Mesh(new THREE.BoxGeometry(4, 3, 900), M.gold), 212, 38, LZ(400));

  // ── rails + guides ──
  [T.RAIL_L, T.RAIL_R].forEach(r => {
    const len = r.bot - r.top;
    const cap = new THREE.CapsuleGeometry(3.5, len, 4, 10);
    cap.rotateX(Math.PI / 2);
    add(new THREE.Mesh(cap, M.steel), LX(r.x), 9, LZ((r.top + r.bot) / 2), { cast: true });
    const post = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 18, 12), M.chrome);
    add(post, LX(r.x), 9, LZ(r.top), { cast: true });
  });
  [T.GUIDE_L, T.GUIDE_R].forEach(gd => {
    const len = Math.hypot(gd.x2 - gd.x1, gd.y2 - gd.y1);
    const cap = new THREE.CapsuleGeometry(3.5, len, 4, 10);
    cap.rotateX(Math.PI / 2);
    const m = new THREE.Mesh(cap, M.steel);
    add(m, LX((gd.x1 + gd.x2) / 2), 8, LZ((gd.y1 + gd.y2) / 2),
      { ry: Math.atan2(gd.x2 - gd.x1, gd.y2 - gd.y1), cast: true });
  });

  // ── slingshots ──
  const slingFaces = [];
  [[T.SLING_L, T.SLING_NL], [T.SLING_R, T.SLING_NR]].forEach(([vts, n]) => {
    const shape = new THREE.Shape();
    shape.moveTo(LX(vts[0][0]), LZ(vts[0][1]));
    shape.lineTo(LX(vts[1][0]), LZ(vts[1][1]));
    shape.lineTo(LX(vts[2][0]), LZ(vts[2][1]));
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 18, bevelEnabled: true, bevelThickness: 1.5, bevelSize: 1.5, bevelSegments: 1 });
    geo.rotateX(Math.PI / 2);          // shape XY -> XZ, extrude -Y
    geo.translate(0, 18, 0);           // lift so body sits on the field
    const prism = new THREE.Mesh(geo, M.housing);
    prism.castShadow = true;
    tableG.add(prism);
    // lit rubber strip along the kicking face
    const fx = (vts[0][0] + vts[1][0]) / 2, fy = (vts[0][1] + vts[1][1]) / 2;
    const flen = Math.hypot(vts[1][0] - vts[0][0], vts[1][1] - vts[0][1]);
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(3, 13, flen + 4),
      new THREE.MeshStandardMaterial({ color: 0x3a3a40, roughness: 0.85, emissive: 0xfff2cc, emissiveIntensity: 0 })
    );
    add(strip, LX(fx) + n.x * 2.2, 9, LZ(fy) + n.y * 2.2,
      { ry: Math.atan2(vts[1][0] - vts[0][0], vts[1][1] - vts[0][1]) });
    slingFaces.push(strip);
    // gold trim line on top
    const trim = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, flen - 8), M.gold);
    add(trim, LX(fx) + n.x * 5.5, 19.4, LZ(fy) + n.y * 5.5,
      { ry: Math.atan2(vts[1][0] - vts[0][0], vts[1][1] - vts[0][1]) });
  });

  // ── pop bumpers ──
  const bumpers = [];
  T.BUMPERS.forEach(p => {
    const grp = new THREE.Group();
    grp.position.set(LX(p.x), 0, LZ(p.y));
    const base = new THREE.Mesh(new THREE.CylinderGeometry(21, 22.5, 7, 24), M.housing);
    base.position.y = 3.5; base.castShadow = true; grp.add(base);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(20.5, 3.2, 12, 28), M.chrome);
    ring.rotation.x = Math.PI / 2; ring.position.y = 12; ring.castShadow = true; grp.add(ring);
    const glowMat = new THREE.MeshStandardMaterial({ color: 0x6a5520, roughness: 0.4, metalness: 0.3, emissive: 0xE0B850, emissiveIntensity: 0.25 });
    const glow = new THREE.Mesh(new THREE.CylinderGeometry(16.5, 18.5, 7, 24), glowMat);
    glow.position.y = 14; grp.add(glow);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(13.5, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.dome);
    dome.position.y = 14; dome.scale.y = 0.8; dome.castShadow = true; grp.add(dome);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 8, 10), M.steel);
    post.position.y = 24; grp.add(post);
    const light = new THREE.PointLight(0xE0B850, 0, 130, 2);
    light.position.y = 26; grp.add(light);
    tableG.add(grp);
    bumpers.push({ grp, glowMat, light });
  });

  // ── scatter posts ──
  T.POSTS.forEach(p => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 15, 12), M.chrome);
    add(post, LX(p.x), 7.5, LZ(p.y), { cast: true });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.8, 1.6, 8, 14), M.rubber);
    ring.rotation.x = Math.PI / 2;
    add(ring, LX(p.x), 8, LZ(p.y));
  });

  // ── drop targets ──
  const mkTargets = (defs, angle) => defs.map(p => {
    const grp = new THREE.Group();
    grp.position.set(LX(p.x), 0, LZ(p.y));
    grp.rotation.y = -angle;
    const housing = new THREE.Mesh(new THREE.BoxGeometry(40, 7, 12), M.housing);
    housing.position.y = 3.5; grp.add(housing);
    const faceMat = new THREE.MeshStandardMaterial({ color: 0x1e1c16, roughness: 0.5, metalness: 0.2, emissive: 0xE8A828, emissiveIntensity: 0 });
    const target = new THREE.Mesh(new THREE.BoxGeometry(26, 17, 5), faceMat);
    target.position.set(0, 13, 0); target.castShadow = true; grp.add(target);
    tableG.add(grp);
    return { grp, target, faceMat };
  });
  const vbT3 = mkTargets(T.VB, T.VBA);
  const sbT3 = mkTargets(T.SB, T.SBA);

  // ── bank indicator triangles ──
  const mkTris = sideX => [0, 1, 2].map(i => {
    const mat = new THREE.MeshStandardMaterial({ color: 0x3a341f, roughness: 0.5, emissive: 0xD4AA50, emissiveIntensity: 0 });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(9, 7, 3), mat);
    cone.position.set(LX(sideX), 3.5, LZ(410 + i * 32));
    cone.rotation.y = Math.PI;
    tableG.add(cone);
    return { cone, mat };
  });

  const bankTriL = mkTris(T.PL + 40);
  const bankTriR = mkTris(T.PR - 40);

  // ── core mode pills ──
  const MODES = ['INITIATE', 'ASSEMBLE', 'CALIBRATE', 'INNOVATE', 'ELEVATE'];
  const pillStates = [];
  const pills = MODES.map((name, i) => {
    const texs = [0, 1, 2].map(st => texFromPaint(THREE, makeCanvas, 104, 22, c => paintPill(c, 104, 22, name, st)));
    const mat = new THREE.MeshStandardMaterial({
      map: texs[0], transparent: true, roughness: 0.5, metalness: 0.1,
      emissive: 0xD4AA50, emissiveMap: texs[0], emissiveIntensity: 0,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(104, 22), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(LX(T.CMX), 1.0 + i * 0.01, LZ(T.CMY0 + i * T.CMDY));
    tableG.add(m);
    // LED dome beside the pill
    const ledMat = new THREE.MeshStandardMaterial({ color: 0x2a2618, roughness: 0.35, emissive: 0xD4AA50, emissiveIntensity: 0 });
    const led = new THREE.Mesh(new THREE.SphereGeometry(4.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), ledMat);
    led.position.set(LX(T.CMX - 64), 0.6, LZ(T.CMY0 + i * T.CMDY));
    tableG.add(led);
    pillStates.push(-1);
    return { mesh: m, mat, texs, ledMat };
  });
  // progress dots (under the active pill)
  const progDots = [0, 1, 2].map(d => {
    const mat = new THREE.MeshStandardMaterial({ color: 0x262214, roughness: 0.4, emissive: 0xFFE9A8, emissiveIntensity: 0 });
    const s = new THREE.Mesh(new THREE.SphereGeometry(3.4, 10, 8), mat);
    s.position.set(LX(T.CMX - 8 + d * 8), 1.5, LZ(T.CMY0 + 14));
    tableG.add(s);
    return { s, mat };
  });

  // ── SHOOT AGAIN lamp ──
  const saTexs = [0, 1].map(st => texFromPaint(THREE, makeCanvas, 52, 42, c => paintSA(c, 52, 42, st === 1)));
  const saMat = new THREE.MeshStandardMaterial({
    map: saTexs[0], transparent: true, roughness: 0.5,
    emissive: 0xFFD970, emissiveMap: saTexs[0], emissiveIntensity: 0,
  });
  const saLamp = new THREE.Mesh(new THREE.PlaneGeometry(52, 42), saMat);
  saLamp.rotation.x = -Math.PI / 2;
  saLamp.position.set(LX(T.SAX), 1.0, LZ(T.SAY));
  tableG.add(saLamp);

  // ── ORBIT panel + lock dots ──
  const orbPlate = new THREE.Mesh(new THREE.BoxGeometry(38, 5, 92), M.housing);
  add(orbPlate, LX(T.PR + 31), 2.5, LZ(T.PT + 91));
  const lockDots = [0, 1, 2].map(i => {
    const mat = new THREE.MeshStandardMaterial({ color: 0x262214, roughness: 0.4, emissive: 0xD4AA50, emissiveIntensity: 0 });
    const s = new THREE.Mesh(new THREE.SphereGeometry(3.6, 10, 8), mat);
    s.position.set(LX(T.PR + 20 + i * 9), 6.5, LZ(T.PT + 126));
    tableG.add(s);
    return { s, mat };
  });

  // ── wire ramp (two parallel rails along the launch path) ──
  const rampPts = [];
  rampPts.push({ x: T.LANE_X, y: 170, h: 2 });
  rampPts.push({ x: T.LANE_X, y: 130, h: 4 });
  for (let i = 0; i <= 24; i++) {
    const t = i / 24, p = T.bez(t);
    rampPts.push({ x: p.x, y: p.y, h: 6 + 22 * Math.sin(Math.PI * Math.min(1, t * 1.15)) });
  }
  const mkRail = off => {
    const v = [];
    for (let i = 0; i < rampPts.length; i++) {
      const p = rampPts[i];
      const q = rampPts[Math.min(i + 1, rampPts.length - 1)];
      const dx = q.x - p.x, dy = q.y - p.y, l = Math.hypot(dx, dy) || 1;
      const nx = -dy / l, ny = dx / l;
      v.push(new THREE.Vector3(LX(p.x + nx * off), p.h, LZ(p.y + ny * off)));
    }
    const curve = new THREE.CatmullRomCurve3(v);
    return new THREE.Mesh(new THREE.TubeGeometry(curve, 60, 1.6, 6), M.steel);
  };
  tableG.add(mkRail(-4.2));
  tableG.add(mkRail(4.2));

  // ── flippers ──
  const mkFlip = () => {
    const geo = new THREE.CapsuleGeometry(6.5, T.FLEN - 13, 4, 12);
    geo.rotateZ(Math.PI / 2); // axis along X, like the physics body
    const m = new THREE.Mesh(geo, M.ivory);
    m.castShadow = true;
    tableG.add(m);
    return m;
  };
  const flipL = mkFlip(), flipR = mkFlip();
  // pivot caps
  [T.LFPX, T.RFPX].forEach(px => {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 7, 16, 14), M.housing);
    add(cap, LX(px), 8, LZ(T.FLY), { cast: true });
  });

  // ── plunger ──
  const plunger = new THREE.Group();
  plunger.position.set(LX(T.LANE_X), 0, 0);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 122, 10), M.steel);
  rod.geometry.rotateX(Math.PI / 2);
  rod.position.set(0, 9, LZ(706));
  plunger.add(rod);
  const tip = new THREE.Mesh(new THREE.BoxGeometry(22, 14, 8), M.steel);
  tip.position.set(0, 9, LZ(647)); tip.castShadow = true;
  plunger.add(tip);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(11, 16, 12), M.chrome);
  knob.position.set(0, 10, LZ(770)); knob.castShadow = true;
  plunger.add(knob);
  // spring helix
  const helixPts = [];
  const COILS = 9, springLen = 92;
  for (let i = 0; i <= COILS * 10; i++) {
    const t = i / (COILS * 10);
    helixPts.push(new THREE.Vector3(Math.cos(t * COILS * Math.PI * 2) * 8, 9 + Math.sin(t * COILS * Math.PI * 2) * 8, -springLen * t));
  }
  const springG = new THREE.Group();
  springG.position.set(0, 0, LZ(655 + springLen));
  const spring = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(helixPts), 120, 1.1, 6),
    new THREE.MeshStandardMaterial({ color: 0x9a9270, roughness: 0.45, metalness: 0.8 }));
  springG.add(spring);
  plunger.add(springG);
  tableG.add(plunger);

  // ── lights ──
  const hemi = new THREE.HemisphereLight(0xfff2dd, 0x14100c, 0.85);
  root.add(hemi);
  const key = new THREE.DirectionalLight(0xffeecc, 2.4);
  key.position.set(140, 760, 240);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -260; key.shadow.camera.right = 260;
  key.shadow.camera.top = 300; key.shadow.camera.bottom = -560;
  key.shadow.camera.near = 200; key.shadow.camera.far = 1600;
  key.shadow.bias = -0.0006;
  const keyTgt = new THREE.Object3D(); keyTgt.position.set(0, 0, -420);
  root.add(keyTgt); key.target = keyTgt;
  root.add(key);
  const fill = new THREE.DirectionalLight(0x96a4c0, 0.5);
  fill.position.set(-260, 260, 420);
  root.add(fill);

  // ── camera ──
  const camera = new THREE.PerspectiveCamera(CONF.CAM.fov, 390 / 844, 10, 4000);
  camera.position.set(...CONF.CAM.pos);
  camera.lookAt(new THREE.Vector3(...CONF.CAM.look));

  // ── ball pool ──
  const ballGeo = new THREE.SphereGeometry(T.BALL_R, 28, 20);
  const ballMat = new THREE.MeshStandardMaterial({ color: 0xf4f4f8, roughness: 0.07, metalness: 1.0, envMap: envTex, envMapIntensity: 1.4 });
  const ballPool = [];
  function ballMesh(i) {
    while (ballPool.length <= i) {
      const m = new THREE.Mesh(ballGeo, ballMat);
      m.castShadow = true;
      m.visible = false;
      tableG.add(m);
      ballPool.push(m);
    }
    return ballPool[i];
  }

  const s = {
    root, tableG, camera, envTex, pf, apron,
    bumpers, slingFaces, vbT3, sbT3, pills, pillStates, progDots,
    saLamp, saMat, saTexs, lockDots, bankTriL, bankTriR,
    flipL, flipR, plunger, springG, ballPool, ballMesh, key, hemi,
    M,
  };
  return s;
}

// ── per-frame sync from physics/game state ────────────
export function syncScene(s, T, view) {
  const { tb, balls } = view;

  // flippers follow physics bodies exactly
  [[s.flipL, tb.LF], [s.flipR, tb.RF]].forEach(([mesh, f]) => {
    mesh.position.set(LX(f.body.position.x), 8, LZ(f.body.position.y));
    mesh.rotation.y = -f.body.angle;
  });

  // balls
  for (let i = 0; i < balls.length; i++) {
    const m = s.ballMesh(i);
    m.visible = true;
    const b = balls[i];
    let h = T.BALL_R;
    if (b.plugin.guide) {
      const t = b.plugin.guide.t;
      h = T.BALL_R + 22 * Math.sin(Math.PI * Math.min(1, t * 1.15));
    }
    m.position.set(LX(b.position.x), h, LZ(b.position.y));
    m.rotation.z -= b.velocity.x * 0.04;
    m.rotation.x += b.velocity.y * 0.04;
  }
  for (let i = balls.length; i < s.ballPool.length; i++) s.ballPool[i].visible = false;

  // bumpers
  s.bumpers.forEach((bp, i) => {
    const fl = tb.bumps[i].plugin.fl / 64;
    bp.glowMat.emissiveIntensity = 0.25 + fl * 2.6 + (view.sysBoost ? 0.35 : 0);
    bp.light.intensity = fl * 5.5;
  });

  // slings
  s.slingFaces.forEach((strip, i) => {
    const fl = (i === 0 ? tb.slingL : tb.slingR).plugin.fl / 44;
    strip.material.emissiveIntensity = fl * 2.2;
  });

  // drop targets
  [[s.vbT3, tb.vbT], [s.sbT3, tb.sbT]].forEach(([m3, tbT]) => {
    m3.forEach((t3, i) => {
      const pl = tbT[i].plugin;
      t3.target.position.y = 13 - pl.sink * 15;
      t3.faceMat.emissiveIntensity = (pl.fl / 52) * 1.8;
    });
  });

  // bank triangles (lit while target dropped)
  [[s.bankTriL, tb.vbT], [s.bankTriR, tb.sbT]].forEach(([tris, tbT]) => {
    tris.forEach((tr, i) => { tr.mat.emissiveIntensity = tbT[i].plugin.dropped ? 1.6 : 0; });
  });

  // mode pills
  for (let i = 0; i < 5; i++) {
    const st = i < view.mode ? 2 : i === view.mode ? 1 : 0;
    if (s.pillStates[i] !== st) {
      s.pillStates[i] = st;
      const p = s.pills[i];
      p.mat.map = p.texs[st];
      p.mat.emissiveMap = p.texs[st];
      p.mat.needsUpdate = true;
    }
    const p = s.pills[i];
    const fl = view.cmFl[i] / 64;
    p.mat.emissiveIntensity = st === 1 ? 0.35 + fl * 1.6 : st === 2 ? 0.3 : 0;
    p.ledMat.emissiveIntensity = st === 2 ? 0.9 : st === 1 ? 0.4 + fl * 1.4 : 0;
  }
  // progress dots under active pill
  s.progDots.forEach((d, di) => {
    d.s.position.z = LZ(T.CMY0 + view.mode * T.CMDY + 14);
    d.mat.emissiveIntensity = di < view.mhits ? 1.4 : 0;
  });

  // SHOOT AGAIN lamp
  const saOn = view.saveLit ? 1 : 0;
  if (s.saMat.map !== s.saTexs[saOn]) {
    s.saMat.map = s.saTexs[saOn];
    s.saMat.emissiveMap = s.saTexs[saOn];
    s.saMat.needsUpdate = true;
  }
  s.saMat.emissiveIntensity = saOn ? 0.8 + 0.5 * Math.sin(view.tNow * 0.012) : 0;

  // lock dots
  s.lockDots.forEach((d, i) => { d.mat.emissiveIntensity = i < view.locks ? 1.3 : 0; });

  // plunger
  s.plunger.position.z = view.pull * T.PULL_MAX;
  s.springG.scale.z = 1 - view.pull * T.PULL_MAX / 100;
}

// project table point to screen px (for HUD anchoring)
export function projToScreen(THREE, s, xt, yt, h, w, hpx) {
  const v = new THREE.Vector3(LX(xt), h || 0, LZ(yt));
  s.tableG.localToWorld(v);
  v.project(s.camera);
  return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * hpx };
}
