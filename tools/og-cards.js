/* Build the link-preview cards for every page.
 *
 * A card is the page's own hero, dimmed, with the page's label and title set
 * over it in the site's own type — so the picture someone sees in a timeline
 * is the picture they land on.
 *
 * Fonts: the pages ask Google for Space Grotesk / Space Mono / Zen Kaku
 * Gothic New. This box cannot reach Google, so the run serves the same
 * families locally and answers the stylesheet request with them. Without
 * that, every card ships in a substitute typeface — which is worse than no
 * card, because it is the wrong brand in front of the most people.
 *
 *   node tools/og-cards.js            # all pages
 *   node tools/og-cards.js store biz  # just these
 *
 * Needs, from the repo root:
 *   python3 -m http.server 8899                    (the site)
 *   python3 tools-cors-server        in a font dir  (woff2 + fonts.css, port 8897)
 * See tools/og-cards.md for how the font directory is assembled.
 */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const SITE = 'http://127.0.0.1:8899';
const FONTS = 'http://127.0.0.1:8897';
const OUT = path.join(ROOT, 'img/og');
const TMP = '/tmp/og-shots';

/* label / title / where to aim the camera. The label and title are the
 * page's own — kept here rather than scraped so a card never changes
 * silently when someone edits a heading. */
const PAGES = [
  ['index',            'Designer & Creator — Tokyo', 'IDATSUKA',              0],
  ['about',            'Profile / Tokyo, Japan',     'Profile.',              0],
  ['works',            'Portfolio',                  'Works.',                760],
  ['work-01',          'Spec · 01 — Branding',       'KUROMOJI',              640],
  ['work-02',          'Spec · 02 — UI / UX Design', 'Neon District',         640],
  ['work-03',          'Spec · 03 — Web Design',     'SORA Architecture',     640],
  ['work-04',          'Spec · 04 — Motion Design',  'Pulse',                 640],
  ['work-05',          'Spec · 05 — UI / UX Design', 'Mono',                  640],
  ['work-06',          'Spec · 06 — Branding',       'KADO',                  640],
  ['art',              'Creative',                   'Art.',                  620],
  ['play',             'Hobby & Creative',           'Play.',                 520],
  ['games',            'Interactive',                'Games.',                620],
  ['game-stack',       'Precision Tower',            'Stack',               260],
  ['game-orbit',       'Two-Lane Ring Runner',       'Orbit',               260],
  ['game-signal',      'Audio-Reactive Puzzle',      'Signal',              260],
  ['game-lattice',     'Generative Art Toy',         'Lattice',             260],
  ['game-void-runner', 'Procedural Endless Runner',  'Void Runner',         260],
  ['ranking',          'Leaderboard',                'Ranking.',              420],
  ['biz',              'Professional',               'Business.',             760],
  ['business',         'Services',                   'Services.',             620],
  ['store',            'Digital Products',           'Store.',                820],
  ['blog',             'Blog / Notes',               'Writing.',              520],
  ['blog-01',          'Process',   'デザインシステムを0から構築する',            300],
  ['blog-02',          'Culture',   'Tokyo Underground',                       300],
  ['blog-03',          'Design',    'タイポグラフィは感情だ',                    300],
  ['blog-04',          'Process',   'クライアントとのコミュニケーション',          300],
  ['blog-05',          'Design',    'ブランキングの美学 — 余白が語るもの',        300],
  ['contact',          'Contact',                    "Let's Talk.",           420],
  ['404',              'Error',                      '404',                   0],
];

/* Long Japanese titles need to step down or they wrap into the logo. */
function titleSize(t) {
  const w = [...t].reduce((n, c) => n + (/[\x00-\xff]/.test(c) ? 1 : 1.9), 0);
  if (w <= 12) return 104;
  if (w <= 20) return 84;
  if (w <= 30) return 64;
  return 52;
}

const card = (label, title, shot, logo) => `<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="${FONTS}/fonts.css">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:1200px;height:630px;overflow:hidden}
  body{position:relative;background:#060607;color:#f4f5f7;
       font-family:'Space Grotesk','Zen Kaku Gothic New',sans-serif}
  /* the page itself, far back and out of focus — atmosphere, not content */
  .haze{position:absolute;inset:-6%;background:url("${shot}") center/cover no-repeat;
        filter:blur(34px) saturate(.85) brightness(.5);opacity:.55}
  .veil{position:absolute;inset:0;background:
    linear-gradient(100deg,rgba(6,6,7,.97) 0%,rgba(6,6,7,.93) 46%,rgba(6,6,7,.72) 100%)}
  .glow{position:absolute;left:-10%;top:-26%;width:66%;height:130%;
        background:radial-gradient(ellipse,rgba(159,214,236,.10) 0%,transparent 66%)}
  .grain{position:absolute;inset:0;opacity:.035;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E")}

  /* and the page again, sharp, standing on the right like a print on a wall */
  .panel{position:absolute;right:-34px;top:50%;transform:translateY(-50%);
         width:520px;height:452px;overflow:hidden;
         border:1px solid rgba(255,255,255,.11);
         box-shadow:0 40px 90px -20px rgba(0,0,0,.85), 0 0 0 1px rgba(6,6,7,.6)}
  .panel i{position:absolute;inset:0;display:block;
           background:url("${shot}") left top/cover no-repeat}
  .panel::after{content:"";position:absolute;inset:0;
    background:linear-gradient(100deg,rgba(6,6,7,.55) 0%,rgba(6,6,7,.10) 34%,rgba(6,6,7,0) 100%)}

  .wrap{position:relative;height:100%;width:660px;padding:60px 0 60px 72px;
        display:flex;flex-direction:column;justify-content:space-between}
  .logo{height:13px;width:auto;align-self:flex-start;opacity:.95}
  .label{font-family:'Space Mono',monospace;font-size:15px;letter-spacing:.32em;
         text-transform:uppercase;color:#9fd6ec;opacity:.94;margin-bottom:20px}
  h1{font-size:${titleSize(title)}px;font-weight:500;letter-spacing:-.035em;
     line-height:1.04;max-width:12ch;text-wrap:balance}
  .foot{display:flex;align-items:center;gap:18px}
  .rule{height:1px;width:84px;background:linear-gradient(to right,#9fd6ec,transparent)}
  .dom{font-family:'Space Mono',monospace;font-size:15px;letter-spacing:.24em;
       text-transform:uppercase;color:#70767f}
</style>
<div class="haze"></div><div class="veil"></div><div class="glow"></div>
<div class="panel"><i></i></div>
<div class="grain"></div>
<div class="wrap">
  <img class="logo" src="${logo}" alt="">
  <div>
    <p class="label">${label}</p>
    <h1>${title}</h1>
  </div>
  <div class="foot"><span class="rule"></span><span class="dom">idatsuka.com</span></div>
</div>`;

/* A page built with setContent has no file:// access, so the shots have to
   come over http. One throwaway server, closed on the way out. */
function serveShots() {
  const srv = http.createServer((req, res) => {
    const f = path.join(TMP, path.basename(decodeURIComponent(req.url)));
    fs.readFile(f, (err, buf) => {
      if (err) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(buf);
    });
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r({ srv, port: srv.address().port })));
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(TMP, { recursive: true });
  const { srv, port } = await serveShots();
  const SHOTS = `http://127.0.0.1:${port}`;
  const only = process.argv.slice(2);
  const jobs = only.length ? PAGES.filter(p => only.includes(p[0])) : PAGES;
  const logo = 'data:image/svg+xml;base64,' +
    fs.readFileSync(path.join(ROOT, 'img/logo.svg')).toString('base64');

  const browser = await chromium.launch();

  /* Answer the pages' Google Fonts request with the same families, served
     locally. Everything downstream then renders in the real type. */
  async function useRealFonts(ctx) {
    await ctx.route('**://fonts.googleapis.com/**', async route => {
      const r = await fetch(FONTS + '/fonts.css');
      route.fulfill({ status: 200, contentType: 'text/css', body: await r.text() });
    });
  }

  // pass 1 — photograph each page
  const shots = {};
  const sctx = await browser.newContext({ viewport: { width: 1400, height: 735 }, deviceScaleFactor: 1.4 });
  await useRealFonts(sctx);
  const spg = await sctx.newPage();
  for (const [slug, , , scroll] of jobs) {
    await spg.goto(`${SITE}/${slug}.html`, { waitUntil: 'load' });
    await spg.evaluate(() => document.fonts.ready);
    await spg.waitForTimeout(2400);
    if (scroll) {
      await spg.evaluate(v => window.scrollTo({ top: +v, behavior: 'instant' }), scroll);
      await spg.waitForTimeout(1200);
    }
    await spg.screenshot({ path: path.join(TMP, slug + '.png') });
    shots[slug] = `${SHOTS}/${slug}.png`;
    process.stdout.write(`  shot ${slug}\n`);
  }
  await sctx.close();

  // pass 2 — compose the card
  const cctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await useRealFonts(cctx);
  const cpg = await cctx.newPage();
  await cpg.goto(`${SHOTS}/`, { waitUntil: 'commit' }).catch(() => {});
  for (const [slug, label, title] of jobs) {
    await cpg.setContent(card(label, title, shots[slug], logo), { waitUntil: 'load' });
    await cpg.waitForFunction(() => {
      const el = document.querySelector('.panel i');
      return el && getComputedStyle(el).backgroundImage !== 'none';
    });
    await cpg.evaluate(() => document.fonts.ready);
    await cpg.waitForTimeout(350);
    const dst = path.join(OUT, slug + '.jpg');
    await cpg.screenshot({ path: dst, type: 'jpeg', quality: 88 });
    console.log(`${slug.padEnd(18)} ${(fs.statSync(dst).size / 1024).toFixed(0).padStart(4)} KB`);
  }
  await cctx.close();
  await browser.close();
  srv.close();
})();
