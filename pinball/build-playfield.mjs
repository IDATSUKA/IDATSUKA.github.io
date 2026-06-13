/* Bakes a high-fidelity AURORA playfield image (top-down) from the
   reference render. Output: pinball/playfield-art.png, logical 390x844. */
import { createCanvas } from '@napi-rs/canvas';
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);
const T = require('./table.js');

const W = 390, H = 844, S = 3;
const PL = T.PL, PR = T.PR, PT = T.PT, PB = T.PB, PCX = T.PCX;
const ACX = T.ACX, ACY = T.ACY, ARX = T.ARX, ARY = T.ARY;
const CMX = T.CMX, CMY0 = T.CMY0, CMDY = T.CMDY;
const LANE_L = PR + 10, LANE_R = W - 14;          // shooter lane bounds
const APRON_Y = PB + 2;

const cv = createCanvas(W * S, H * S);
const c = cv.getContext('2d');
c.scale(S, S);

const sh = (ox, oy, bl, col) => { c.shadowOffsetX = ox; c.shadowOffsetY = oy; c.shadowBlur = bl; c.shadowColor = col || 'rgba(0,0,0,0.55)'; };
const ns = () => { c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetX = c.shadowOffsetY = 0; };
function rr(x, y, w, h, r){ c.beginPath(); c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r); c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath(); }

// metallic brushed-steel helper
function brushed(x, y, w, h, base, lines){
  const g = c.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, base[0]); g.addColorStop(0.5, base[1]); g.addColorStop(1, base[2]);
  c.fillStyle = g; c.fillRect(x, y, w, h);
  if (lines){
    for (let i = 0; i < h; i += 1.5){
      c.fillStyle = `rgba(255,255,255,${0.02 + Math.random() * 0.03})`;
      c.fillRect(x, y + i, w, 0.6);
    }
  }
}

// ════════ 1. CABINET (near-black, rounded) ════════
c.fillStyle = '#040404'; c.fillRect(0, 0, W, H);
// outer cabinet body
let g = c.createLinearGradient(0, 0, W, 0);
g.addColorStop(0, '#1a1a1d'); g.addColorStop(0.5, '#2a2a2e'); g.addColorStop(1, '#161618');
c.fillStyle = g;
rr(4, 4, W - 8, H - 8, 16); c.fill();
// inner bevel
c.strokeStyle = 'rgba(0,0,0,0.7)'; c.lineWidth = 2; rr(4, 4, W - 8, H - 8, 16); c.stroke();

// ════════ 2. SIDE RAILS (brushed metal) ════════
brushed(8, 24, 16, H - 48, ['#0c0c0d', '#4a4a50', '#222226'], true);   // left
brushed(W - 24, 24, 16, H - 48, ['#222226', '#4a4a50', '#0c0c0d'], true); // right
// rail top highlight
c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(8, 24, 16, 1.5); c.fillRect(W - 24, 24, 16, 1.5);
// phillips screws
function screw(x, y){
  const sg = c.createRadialGradient(x - 1.5, y - 1.5, 0.5, x, y, 5.5);
  sg.addColorStop(0, '#6a6a70'); sg.addColorStop(0.6, '#3a3a40'); sg.addColorStop(1, '#141418');
  c.beginPath(); c.arc(x, y, 5.5, 0, Math.PI * 2); c.fillStyle = sg; c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 0.8; c.stroke();
  c.strokeStyle = 'rgba(10,10,10,0.85)'; c.lineWidth = 1.4;
  c.beginPath(); c.moveTo(x - 3, y); c.lineTo(x + 3, y); c.stroke();
  c.beginPath(); c.moveTo(x, y - 3); c.lineTo(x, y + 3); c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.25)'; c.beginPath(); c.arc(x - 1.8, y - 1.8, 1.2, 0, Math.PI * 2); c.fill();
}
for (let i = 0; i < 6; i++){ const y = 40 + i * (H - 90) / 5; screw(16, y); screw(W - 16, y); }

// ════════ 3. PLAYFIELD (cream, engraved) ════════
function pfPath(){
  c.beginPath();
  c.moveTo(PL, ACY);
  c.ellipse(ACX, ACY, ARX, ARY, 0, Math.PI, 0);
  c.lineTo(PR, PB); c.lineTo(PL, PB); c.closePath();
}
c.save();
pfPath();
g = c.createRadialGradient(PCX, PT + 170, 30, PCX, PT + 240, 360);
g.addColorStop(0, '#FBF6EA'); g.addColorStop(0.45, '#F0EBDB'); g.addColorStop(0.8, '#E2DBC9'); g.addColorStop(1, '#CFC7B4');
c.fillStyle = g; c.fill(); c.clip();

// subtle vignette toward edges
g = c.createRadialGradient(PCX, PT + 250, 120, PCX, PT + 250, 380);
g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(40,34,20,0.22)');
c.fillStyle = g; c.fillRect(PL, PT, PR - PL, PB - PT);

// felt micro-noise
for (let y = PT; y < PB; y += 2) for (let x = PL; x < PR; x += 2){
  if (Math.random() > 0.82){ c.fillStyle = `rgba(120,104,60,${0.02 + Math.random() * 0.035})`; c.fillRect(x, y, 1, 1); }
}

// ── fine engraved line-art (the signature look) ──
c.strokeStyle = 'rgba(70,60,34,0.16)'; c.lineWidth = 0.5;
// concentric geometric frame around centre modes
for (let i = 0; i < 4; i++){
  const r = 70 + i * 9;
  c.beginPath();
  for (let a = 0; a <= 6; a++){
    const ang = -Math.PI / 2 + a * Math.PI / 3;
    const px = PCX + Math.cos(ang) * r, py = (CMY0 + 2 * CMDY) + Math.sin(ang) * r * 1.15;
    a === 0 ? c.moveTo(px, py) : c.lineTo(px, py);
  }
  c.closePath(); c.stroke();
}
// radiating dotted guides
c.fillStyle = 'rgba(70,60,34,0.18)';
for (let yy = PT + 20; yy < PB - 20; yy += 9) for (let xx = PL + 14; xx < PR - 8; xx += 9){
  // skip a centre band to leave room for modes
  if (Math.abs(xx - PCX) < 56 && yy > CMY0 - 30 && yy < CMY0 + 5 * CMDY) continue;
  c.fillRect(xx, yy, 0.8, 0.8);
}
// long sweeping arcs (left & right symmetric)
c.strokeStyle = 'rgba(70,60,34,0.14)'; c.lineWidth = 0.7;
[[-1], [1]].forEach(([s2]) => {
  c.beginPath();
  c.moveTo(PCX + s2 * 8, PT + 90);
  c.bezierCurveTo(PCX + s2 * 120, PT + 140, PCX + s2 * 140, PT + 380, PCX + s2 * 30, PB - 40);
  c.stroke();
});
// dense dot-matrix block under CORE MODES (like the photo)
c.fillStyle = 'rgba(70,60,34,0.20)';
for (let yy = CMY0 - 6; yy < CMY0 + 5 * CMDY + 4; yy += 3) for (let xx = PCX - 84; xx < PCX - 56; xx += 3){
  c.fillRect(xx, yy, 1, 1);
}

// inset edge shadow
g = c.createLinearGradient(PL, 0, PL + 20, 0);
g.addColorStop(0, 'rgba(0,0,0,0.28)'); g.addColorStop(1, 'rgba(0,0,0,0)');
c.fillStyle = g; c.fillRect(PL, PT, 20, PB - PT);
g = c.createLinearGradient(PR - 20, 0, PR, 0);
g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.28)');
c.fillStyle = g; c.fillRect(PR - 20, PT, 20, PB - PT);
c.restore();

// playfield rim (metal edge)
pfPath(); c.strokeStyle = 'rgba(20,16,8,0.7)'; c.lineWidth = 3; c.stroke();
pfPath(); c.strokeStyle = 'rgba(190,162,80,0.35)'; c.lineWidth = 1; c.stroke();

// ════════ 4. HEADER BRANDING ════════
c.textAlign = 'center'; c.textBaseline = 'middle';
c.fillStyle = 'rgba(30,26,16,0.92)'; c.font = '300 17px "Helvetica Neue",Arial';
// letter-spaced AURORA
(() => {
  const t = 'AURORA', ls = 5; let tw = 0;
  c.font = '300 17px "Helvetica Neue",Arial';
  for (const ch of t) tw += c.measureText(ch).width + ls;
  tw -= ls; let x = ACX - tw / 2;
  for (const ch of t){ const w = c.measureText(ch).width; c.fillText(ch, x + w / 2, ACY - 24); x += w + ls; }
})();
c.fillStyle = 'rgba(60,52,30,0.7)'; c.font = '7px "Helvetica Neue",Arial';
(() => { const t = 'INDUSTRIES', ls = 3; let tw = 0; for (const ch of t) tw += c.measureText(ch).width + ls; tw -= ls; let x = ACX - tw / 2; for (const ch of t){ const w = c.measureText(ch).width; c.fillText(ch, x + w / 2, ACY - 9); x += w + ls; } })();
c.strokeStyle = 'rgba(150,128,64,0.5)'; c.lineWidth = 0.6;
c.beginPath(); c.moveTo(ACX - 26, ACY - 1); c.lineTo(ACX + 26, ACY - 1); c.stroke();

// ════════ 5. TOP-LEFT "5 POINTS" PLAQUE ════════
c.save();
c.translate(PL + 36, PT + 28); c.rotate(-0.12);
g = c.createLinearGradient(0, -22, 0, 22); g.addColorStop(0, '#2e2e34'); g.addColorStop(1, '#16161a');
rr(-40, -22, 80, 44, 6); c.fillStyle = g; c.fill();
c.strokeStyle = 'rgba(150,128,64,0.45)'; c.lineWidth = 1; c.stroke();
c.fillStyle = '#d8cba0'; c.font = 'bold 12px "Helvetica Neue"'; c.textAlign = 'center';
c.fillText('5', 0, -4); c.font = '6px "Helvetica Neue"'; c.fillText('P O I N T S', 0, 8);
c.restore();
// gold arrow icon on upper-left
c.save(); c.translate(PL + 22, PT + 70); c.fillStyle = '#C49A44';
c.beginPath(); c.moveTo(0, -7); c.lineTo(6, 4); c.lineTo(2, 4); c.lineTo(2, 10); c.lineTo(-2, 10); c.lineTo(-2, 4); c.lineTo(-6, 4); c.closePath(); c.fill();
c.restore();

// ════════ 6. CIRCUIT NODES under bumpers ════════
c.fillStyle = 'rgba(70,60,34,0.4)';
T.BUMPERS.forEach(p => { c.beginPath(); c.arc(p.x, p.y, 2, 0, Math.PI * 2); c.fill(); });

// ════════ 6b. POP BUMPERS (tall chrome+white mushrooms) ════════
function bumper(x, y, R){
  // drop shadow (offset down-right, soft)
  sh(4, 7, 14, 'rgba(0,0,0,0.5)');
  c.beginPath(); c.arc(x, y, R, 0, Math.PI * 2); c.fillStyle = 'rgba(0,0,0,0.5)'; c.fill(); ns();
  // base skirt ring (machined metal)
  let bg = c.createRadialGradient(x - R*0.35, y - R*0.4, 2, x, y, R);
  bg.addColorStop(0, '#f4f4f8'); bg.addColorStop(0.35, '#d2d2da'); bg.addColorStop(0.62, '#a6a6b0'); bg.addColorStop(0.85, '#7c7c86'); bg.addColorStop(1, '#54545e');
  c.beginPath(); c.arc(x, y, R, 0, Math.PI * 2); c.fillStyle = bg; c.fill();
  c.strokeStyle = 'rgba(40,40,48,0.8)'; c.lineWidth = 1.4; c.stroke();
  // lower-right shading arc for roundness
  c.beginPath(); c.arc(x, y, R - 1.5, Math.PI * 0.18, Math.PI * 0.92); c.strokeStyle = 'rgba(20,20,28,0.35)'; c.lineWidth = 3; c.stroke();
  // mid chrome ring
  let mg = c.createRadialGradient(x - R*0.3, y - R*0.3, 1, x, y, R*0.72);
  mg.addColorStop(0, '#ffffff'); mg.addColorStop(0.4, '#c8c8d2'); mg.addColorStop(0.8, '#8e8e98'); mg.addColorStop(1, '#bcbcc6');
  c.beginPath(); c.arc(x, y, R * 0.72, 0, Math.PI * 2); c.fillStyle = mg; c.fill();
  c.strokeStyle = 'rgba(60,60,70,0.5)'; c.lineWidth = 1; c.stroke();
  // white plastic dome cap
  let dg = c.createRadialGradient(x - R*0.28, y - R*0.34, 1, x, y, R*0.5);
  dg.addColorStop(0, '#ffffff'); dg.addColorStop(0.55, '#f0f0f2'); dg.addColorStop(0.85, '#d2d2d8'); dg.addColorStop(1, '#aeaeb6');
  c.beginPath(); c.arc(x, y, R * 0.5, 0, Math.PI * 2); c.fillStyle = dg; c.fill();
  c.strokeStyle = 'rgba(150,150,158,0.6)'; c.lineWidth = 0.8; c.stroke();
  // centre cap + screw
  c.beginPath(); c.arc(x, y, R * 0.16, 0, Math.PI * 2); c.fillStyle = '#9a9aa2'; c.fill();
  c.beginPath(); c.arc(x, y, R * 0.07, 0, Math.PI * 2); c.fillStyle = '#5a5a62'; c.fill();
  // specular highlights
  let hg = c.createRadialGradient(x - R*0.42, y - R*0.46, 0, x - R*0.32, y - R*0.36, R*0.42);
  hg.addColorStop(0, 'rgba(255,255,255,0.95)'); hg.addColorStop(0.5, 'rgba(255,255,255,0.35)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
  c.beginPath(); c.arc(x - R*0.3, y - R*0.34, R*0.42, 0, Math.PI * 2); c.fillStyle = hg; c.fill();
  c.beginPath(); c.arc(x + R*0.28, y - R*0.5, R*0.1, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,0.4)'; c.fill();
  // faint gold accent ring at the skirt (matches photo's warm trim)
  c.beginPath(); c.arc(x, y, R * 0.86, 0, Math.PI * 2); c.strokeStyle = 'rgba(190,158,86,0.35)'; c.lineWidth = 1.4; c.stroke();
}
// (bumpers, drop targets, slingshots, mode pills, shoot-again, lock dots
//  are drawn dynamically at runtime so they can show hit/lit state —
//  only their labels/surrounds are baked here.)

// ════════ 7. DROP TARGETS at physics positions (housings; faces drawn at runtime) ════════
function targetHousing(p, ang){
  c.save(); c.translate(p.x, p.y); c.rotate(ang);
  sh(2, 3, 6, 'rgba(0,0,0,0.4)');
  g = c.createLinearGradient(0, -10, 0, 10); g.addColorStop(0, '#34343a'); g.addColorStop(0.5, '#242428'); g.addColorStop(1, '#16161a');
  rr(-22, -10, 44, 20, 4); c.fillStyle = g; c.fill(); ns();
  c.strokeStyle = 'rgba(150,128,64,0.4)'; c.lineWidth = 1.1; c.stroke();
  // mounting pins
  [-17, 17].forEach(px => { c.beginPath(); c.arc(px, 0, 2, 0, Math.PI*2); c.fillStyle = 'rgba(30,28,20,0.9)'; c.fill(); });
  // lit rounded-square window (default lit; runtime covers it when dropped)
  sh(0, 0, 8, 'rgba(255,236,180,0.65)');
  g = c.createLinearGradient(-8, -7, 8, 7); g.addColorStop(0, '#fff6dc'); g.addColorStop(1, '#e6cd8c');
  rr(-8, -7, 16, 14, 3); c.fillStyle = g; c.fill(); ns();
  c.strokeStyle = 'rgba(206,176,108,0.9)'; c.lineWidth = 1.1; rr(-8, -7, 16, 14, 3); c.stroke();
  c.restore();
}
void targetHousing; // (drawn at runtime)
// bank labels beside each diagonal group
c.fillStyle = 'rgba(40,34,20,0.72)'; c.font = 'bold 7px "Helvetica Neue"'; c.textAlign = 'center';
c.save(); c.translate(58, 392); c.fillText('VECTOR BANK', 0, 0); c.restore();
c.save(); c.translate(286, 392); c.fillText('SYSTEMS BANK', 0, 0); c.restore();

// ════════ 8. CORE MODES ════════
c.fillStyle = 'rgba(40,34,20,0.72)'; c.font = 'bold 8px "Helvetica Neue"'; c.textAlign = 'center';
c.fillText('◆  CORE MODES  ◆', CMX, CMY0 - 22);
c.strokeStyle = 'rgba(80,68,40,0.3)'; c.lineWidth = 0.7;
c.beginPath(); c.moveTo(CMX - 46, CMY0 - 14); c.lineTo(CMX + 46, CMY0 - 14); c.stroke();
// (mode pills + LEDs drawn at runtime)

// ════════ 9. GOLD TRIANGLE TARGETS (left & right mid) ════════
function goldTri(cx, cy){
  c.save(); c.translate(cx, cy);
  sh(2, 4, 8); g = c.createLinearGradient(0, -26, 0, 26); g.addColorStop(0, '#2a2a30'); g.addColorStop(1, '#141418');
  c.beginPath(); c.moveTo(0, -26); c.lineTo(22, 22); c.lineTo(-22, 22); c.closePath(); c.fillStyle = g; c.fill(); ns();
  c.strokeStyle = '#C49A44'; c.lineWidth = 2.2; c.stroke();
  c.strokeStyle = 'rgba(196,154,68,0.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -18); c.lineTo(15, 16); c.lineTo(-15, 16); c.closePath(); c.stroke();
  // little A
  c.fillStyle = '#D4AA50'; c.font = 'bold 14px "Helvetica Neue"'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('▲', 0, 4);
  c.restore();
}
// (gold triangles omitted — they overlapped the VECTOR/SYSTEMS target banks)

// ════════ 10. SLINGSHOTS (constellation pattern) ════════
function slingArt(verts){
  const [a, b, d] = verts;
  c.save();
  sh(3, 5, 9);
  c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(d[0], d[1]); c.closePath();
  const cx = (a[0]+b[0]+d[0])/3, cy = (a[1]+b[1]+d[1])/3;
  g = c.createRadialGradient(cx, cy, 4, cx, cy, 60); g.addColorStop(0, '#2c2c32'); g.addColorStop(1, '#141418');
  c.fillStyle = g; c.fill(); ns();
  c.strokeStyle = 'rgba(30,28,18,0.9)'; c.lineWidth = 2; c.stroke();
  // constellation: dots + connecting lines
  const pts = [[cx-14,cy-8],[cx+10,cy-12],[cx+16,cy+6],[cx-6,cy+10],[cx,cy-2]];
  c.strokeStyle = 'rgba(150,128,64,0.4)'; c.lineWidth = 0.6;
  c.beginPath(); pts.forEach((p,i)=> i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1])); c.stroke();
  c.fillStyle = 'rgba(180,150,80,0.6)';
  pts.forEach(p=>{ c.beginPath(); c.arc(p[0],p[1],1.4,0,Math.PI*2); c.fill(); });
  // white round lamps at the two outer corners
  [a, b].forEach(p => {
    sh(0,0,9,'rgba(255,240,200,0.8)');
    const lg = c.createRadialGradient(p[0]-1.5,p[1]-1.5,0.5,p[0],p[1],5.5);
    lg.addColorStop(0,'#ffffff'); lg.addColorStop(0.6,'#f0e3b8'); lg.addColorStop(1,'#c8b27a');
    c.beginPath(); c.arc(p[0],p[1],5.5,0,Math.PI*2); c.fillStyle=lg; c.fill(); ns();
    c.strokeStyle='rgba(190,160,90,0.7)'; c.lineWidth=1; c.stroke();
  });
  c.restore();
}
void slingArt; // (slingshots + SHOOT AGAIN drawn at runtime)

// ════════ 12. LANE GUIDES / RAILS (lower third metal) ════════
function metalCap(x1, y1, x2, y2, w){
  c.lineCap = 'round';
  c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = w + 2;
  c.beginPath(); c.moveTo(x1+1.5, y1+2.5); c.lineTo(x2+1.5, y2+2.5); c.stroke();
  const mg = c.createLinearGradient(x1, y1, x2, y2);
  mg.addColorStop(0, '#8a8a92'); mg.addColorStop(0.5, '#e0e0e8'); mg.addColorStop(1, '#888890');
  c.strokeStyle = mg; c.lineWidth = w; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = w * 0.3; c.beginPath(); c.moveTo(x1, y1-1.5); c.lineTo(x2, y2-1.5); c.stroke();
}
metalCap(T.RAIL_L.x, T.RAIL_L.top, T.RAIL_L.x, T.RAIL_L.bot, 6);
metalCap(T.RAIL_R.x, T.RAIL_R.top, T.RAIL_R.x, T.RAIL_R.bot, 6);
metalCap(T.GUIDE_L.x1, T.GUIDE_L.y1, T.GUIDE_L.x2, T.GUIDE_L.y2, 6);
metalCap(T.GUIDE_R.x1, T.GUIDE_R.y1, T.GUIDE_R.x2, T.GUIDE_R.y2, 6);
// posts
[...T.POSTS, {x:T.RAIL_L.x,y:T.RAIL_L.top}, {x:T.RAIL_R.x,y:T.RAIL_R.top}].forEach(p => {
  sh(1, 2, 3); const pg = c.createRadialGradient(p.x-1.5,p.y-1.5,0.5,p.x,p.y,5);
  pg.addColorStop(0,'#eef0f4'); pg.addColorStop(0.5,'#b0b2ba'); pg.addColorStop(1,'#6a6c72');
  c.beginPath(); c.arc(p.x,p.y,5,0,Math.PI*2); c.fillStyle=pg; c.fill(); ns();
  c.strokeStyle='rgba(60,58,44,0.7)'; c.lineWidth=0.8; c.stroke();
});

// ════════ 13. lane labels ════════
function vlabel(t, x, y, a){ c.save(); c.translate(x, y); c.rotate(a); c.fillStyle='rgba(50,44,28,0.6)'; c.font='bold 6.5px "Helvetica Neue"'; c.textAlign='center'; c.textBaseline='middle'; c.fillText(t,0,0); c.restore(); }
vlabel('▲ INLANE', 81, 548, -Math.PI/2);
vlabel('◀ OUTLANE', 42, 552, -Math.PI/2);
vlabel('OUTLANE ▶', 297, 552, Math.PI/2);

// ════════ 14. ORBIT GLASS HABITRAIL (right side) ════════
(() => {
  // path roughly following the photo: from lower-right up to top arch
  const path = () => {
    c.beginPath();
    c.moveTo(PR - 6, PB - 120);
    c.bezierCurveTo(PR + 30, PB - 200, PR + 6, PT + 260, PR + 24, PT + 150);
    c.bezierCurveTo(PR + 34, PT + 70, PR - 10, PT + 30, ACX + 60, PT + 18);
  };
  // outer soft shadow
  c.lineCap = 'round';
  path(); c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 26; c.stroke();
  // glass body (translucent)
  path(); c.strokeStyle = 'rgba(200,206,225,0.16)'; c.lineWidth = 22; c.stroke();
  path(); c.strokeStyle = 'rgba(220,228,245,0.10)'; c.lineWidth = 16; c.stroke();
  // glass highlights (edges)
  path(); c.strokeStyle = 'rgba(245,250,255,0.35)'; c.lineWidth = 2.5; c.stroke();
  c.save();
  c.translate(2, 3); path(); c.strokeStyle = 'rgba(160,168,190,0.25)'; c.lineWidth = 2; c.stroke();
  c.restore();
})();
// ORBIT LIGHT LOCK box (upper right) — lock dots drawn at runtime
(() => {
  const bx = PR + 12, by = PT + 46;
  sh(2, 3, 6); g = c.createLinearGradient(bx, by, bx, by + 90); g.addColorStop(0, '#26262c'); g.addColorStop(1, '#101014');
  rr(bx, by, 38, 90, 4); c.fillStyle = g; c.fill(); ns();
  c.strokeStyle = 'rgba(150,128,64,0.4)'; c.lineWidth = 1; c.stroke();
  c.save(); c.translate(bx + 19, by + 45); c.fillStyle = '#888'; c.font = 'bold 6px "Helvetica Neue"'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('ORBIT', 0, -12); c.fillText('LIGHT', 0, -3); c.fillText('LOCK', 0, 6); c.restore();
})();

// ════════ 15. SHOOTER LANE (right channel) ════════
g = c.createLinearGradient(LANE_L, 0, LANE_R, 0);
g.addColorStop(0, '#0f0f12'); g.addColorStop(0.5, '#17171b'); g.addColorStop(1, '#0c0c0f');
c.fillStyle = g; c.fillRect(LANE_L, PT, LANE_R - LANE_L, H - 60 - PT);
c.strokeStyle = 'rgba(120,128,140,0.25)'; c.lineWidth = 1; c.beginPath(); c.moveTo(LANE_L, PT); c.lineTo(LANE_L, H - 60); c.stroke();

// ════════ 16. APRON (bottom info panel) ════════
(() => {
  const ax = PL, ay = APRON_Y, aw = PR - PL, ah = H - 40 - APRON_Y;
  // drain hole above apron
  sh(0, 0, 14, 'rgba(0,0,0,0.9)'); c.beginPath(); c.ellipse(PCX, APRON_Y - 4, 26, 13, 0, 0, Math.PI*2); c.fillStyle = '#000'; c.fill(); ns();
  c.strokeStyle = 'rgba(140,120,70,0.4)'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(PCX, APRON_Y - 4, 26, 13, 0, 0, Math.PI*2); c.stroke();
  // apron panel
  g = c.createLinearGradient(0, ay, 0, ay + ah); g.addColorStop(0, '#1b1b1f'); g.addColorStop(1, '#101013');
  c.fillStyle = g; c.fillRect(0, ay, W, ah);
  c.strokeStyle = '#C49A44'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(8, ay + 6); c.lineTo(W - 8, ay + 6); c.stroke();
  // big gold A logo centre
  c.save(); c.translate(W/2, ay + ah * 0.6); sh(0,0,12,'rgba(212,170,80,0.5)'); c.strokeStyle = '#C49A44'; c.lineWidth = 3;
  c.beginPath(); c.moveTo(0, -34); c.lineTo(30, 22); c.lineTo(-30, 22); c.closePath(); c.stroke();
  c.beginPath(); c.moveTo(-13, 4); c.lineTo(13, 4); c.stroke(); ns(); c.restore();
  // left text
  c.textAlign = 'left'; c.textBaseline = 'middle';
  c.fillStyle = '#D4AA50'; c.font = 'bold 9px "Helvetica Neue"'; c.fillText('AURORA INDUSTRIES', ax + 8, ay + 22);
  [['LIGHT CORE MODES','Progress up the ladder'],['COMPLETE BANKS','Build modes & earn value'],['ORBIT SHOTS','Light Lock for Bonus'],['3X MODE STARTS','At ELEVATE']].forEach(([r, s], i) => {
    const ly = ay + 38 + i * 18;
    c.fillStyle = '#C49A44'; c.font = '7px "Helvetica Neue"'; c.fillText('◈', ax + 6, ly);
    c.fillStyle = 'rgba(180,162,108,0.92)'; c.font = 'bold 7px "Helvetica Neue"'; c.fillText(r, ax + 16, ly - 3);
    c.fillStyle = 'rgba(120,108,70,0.8)'; c.font = '6px "Helvetica Neue"'; c.fillText(s, ax + 16, ly + 5);
  });
  // right text
  c.textAlign = 'right';
  c.fillStyle = 'rgba(180,162,108,0.92)'; c.font = 'bold 8px "Helvetica Neue"';
  c.fillText('MINIMAL SYSTEMS.', PR - 8, ay + 20); c.fillText('MAXIMUM IMPACT.', PR - 8, ay + 31);
  c.fillStyle = 'rgba(150,134,92,0.85)'; c.font = '7px "Helvetica Neue"';
  ['1–4 PLAYERS', 'HOLD FLIPPER FOR INFO', 'DESIGNED & BUILT', 'FOR PRECISION PLAY'].forEach((l, i) => c.fillText(l, PR - 8, ay + 48 + i * 13));
})();

fs.writeFileSync('./playfield-art.png', cv.toBuffer('image/png'));
console.log('baked', W * S, 'x', H * S);
