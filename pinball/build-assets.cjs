// Extract operating objects from the reference photo as transparent sprites,
// and produce a clean board (photo with moving parts erased).
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');
const OUT = '/home/user/IDATSUKA.github.io/pinball';

// object geometry in PHOTO pixels (measured from the reference)
const FLIP_L = { piv:[340,1011], tip:[450,1035], r:16 };
const FLIP_R = { piv:[618,1011], tip:[508,1035], r:16 };
const BUMPS  = [ [538,246], [426,319], [649,327] ]; const BR_PH = 60;
const PLUNGE = { x0:950, x1:1015, y0:995, y1:1345 };

(async () => {
  const img = await loadImage(OUT + '/reference.png');
  const W = img.width, H = img.height;

  // sample average colour of a small patch (for inpainting)
  function sample(px, py, n){
    const c = createCanvas(n, n), x = c.getContext('2d');
    x.drawImage(img, px-n/2, py-n/2, n, n, 0, 0, n, n);
    const d = x.getImageData(0,0,n,n).data; let r=0,g=0,b=0,k=0;
    for (let i=0;i<d.length;i+=4){ r+=d[i]; g+=d[i+1]; b+=d[i+2]; k++; }
    return [r/k|0, g/k|0, b/k|0];
  }

  // capsule path helper
  function capsule(ctx, a, b, r){
    const dx=b[0]-a[0], dy=b[1]-a[1], len=Math.hypot(dx,dy), nx=-dy/len*r, ny=dx/len*r;
    const ang=Math.atan2(dy,dx);
    ctx.beginPath();
    ctx.arc(a[0],a[1],r,ang+Math.PI/2,ang-Math.PI/2);
    ctx.arc(b[0],b[1],r,ang-Math.PI/2,ang+Math.PI/2);
    ctx.closePath();
  }

  // ── board: copy photo, erase flippers + plunger ──
  const bd = createCanvas(W,H), b = bd.getContext('2d');
  b.drawImage(img,0,0);
  // erase flippers with sampled cream
  // erase flippers: fill rest area with clean cream sampled from the funnel,
  // plus a faint socket outline (only briefly visible when a flipper is raised)
  [[FLIP_L,[380,952]], [FLIP_R,[610,952]]].forEach(([f,sp])=>{
    const col = sample(sp[0], sp[1], 20);
    b.save(); capsule(b, f.piv, f.tip, f.r+12); b.clip();
    b.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`; b.fillRect(0,0,W,H);
    for(let i=0;i<2000;i++){const rx=f.piv[0]-140+Math.random()*280, ry=f.piv[1]-45+Math.random()*100;
      b.fillStyle=`rgba(120,104,62,${Math.random()*0.04})`; b.fillRect(rx,ry,1.4,1.4);}
    b.restore();
    // socket shadow
    b.save(); capsule(b, f.piv, f.tip, f.r+4); b.strokeStyle='rgba(40,34,20,0.28)'; b.lineWidth=3; b.stroke(); b.restore();
  });
  // erase plunger lane assembly with sampled dark lane colour
  {
    const col = sample(PLUNGE.x0-6, (PLUNGE.y0+PLUNGE.y1)/2, 8);
    b.save(); b.beginPath(); b.rect(PLUNGE.x0, PLUNGE.y0, PLUNGE.x1-PLUNGE.x0, PLUNGE.y1-PLUNGE.y0); b.clip();
    b.fillStyle=`rgb(${col[0]},${col[1]},${col[2]})`; b.fillRect(0,0,W,H);
    for(let i=0;i<3000;i++){const rx=PLUNGE.x0+Math.random()*(PLUNGE.x1-PLUNGE.x0), ry=PLUNGE.y0+Math.random()*(PLUNGE.y1-PLUNGE.y0);
      b.fillStyle=`rgba(255,255,255,${Math.random()*0.03})`; b.fillRect(rx,ry,1,1);}
    b.restore();
  }
  fs.writeFileSync(OUT+'/board.png', bd.toBuffer('image/png'));

  // ── flipper sprites (square, pivot-centred, tapered bat mask) ──
  function cutFlipper(f, name){
    const len = Math.hypot(f.tip[0]-f.piv[0], f.tip[1]-f.piv[1]);
    const S = Math.ceil((len + f.r + 10) * 2); const c = S/2;
    const cv = createCanvas(S,S), x = cv.getContext('2d');
    x.drawImage(img, f.piv[0]-c, f.piv[1]-c, S, S, 0,0,S,S);
    const tipL = [c + (f.tip[0]-f.piv[0]), c + (f.tip[1]-f.piv[1])];
    // tighter tapered-bat mask (excludes the flipper's cast shadow / neighbours)
    const r1 = f.r - 1, r2 = f.r * 0.55, N = 40;
    x.globalCompositeOperation = 'destination-in';
    x.beginPath();
    for (let i=0;i<=N;i++){
      const u=i/N, cx=c+(tipL[0]-c)*u, cy=c+(tipL[1]-c)*u, r=r1+(r2-r1)*u;
      x.moveTo(cx+r, cy); x.arc(cx, cy, r, 0, Math.PI*2);
    }
    x.fillStyle='#fff'; x.fill();
    fs.writeFileSync(OUT+'/'+name+'.png', cv.toBuffer('image/png'));
    return { S, restAng: Math.atan2(f.tip[1]-f.piv[1], f.tip[0]-f.piv[0]) };
  }
  const mL = cutFlipper(FLIP_L,'flipperL');
  const mR = cutFlipper(FLIP_R,'flipperR');

  // ── bumper cap sprites (circle mask) ──
  BUMPS.forEach((p,i)=>{
    const S = (BR_PH+6)*2, c=S/2;
    const cv=createCanvas(S,S), x=cv.getContext('2d');
    x.drawImage(img, p[0]-c, p[1]-c, S,S, 0,0,S,S);
    x.globalCompositeOperation='destination-in';
    x.beginPath(); x.arc(c,c,BR_PH,0,7); x.fillStyle='#fff'; x.fill();
    fs.writeFileSync(OUT+'/bump'+i+'.png', cv.toBuffer('image/png'));
  });

  // ── plunger sprite (the moving rod+spring+knob) ──
  {
    const pw=PLUNGE.x1-PLUNGE.x0, ph=PLUNGE.y1-PLUNGE.y0;
    const cv=createCanvas(pw,ph), x=cv.getContext('2d');
    x.drawImage(img, PLUNGE.x0, PLUNGE.y0, pw, ph, 0,0,pw,ph);
    fs.writeFileSync(OUT+'/plunger.png', cv.toBuffer('image/png'));
  }

  const meta = {
    k: 390/W, IMG_Y: 230,
    flipL: { piv:[FLIP_L.piv[0],FLIP_L.piv[1]], S:mL.S, restAng:mL.restAng },
    flipR: { piv:[FLIP_R.piv[0],FLIP_R.piv[1]], S:mR.S, restAng:mR.restAng },
    bumps: BUMPS.map(p=>({c:p, S:(BR_PH+6)*2})),
    plunger: { x0:PLUNGE.x0, y0:PLUNGE.y0, w:PLUNGE.x1-PLUNGE.x0, h:PLUNGE.y1-PLUNGE.y0 },
  };
  fs.writeFileSync(OUT+'/sprites.json', JSON.stringify(meta,null,1));
  console.log('assets built. flip restAng L=',mL.restAng.toFixed(3),'R=',mR.restAng.toFixed(3),'flipS',mL.S);
})();
