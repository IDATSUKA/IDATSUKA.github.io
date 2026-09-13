/* Short motion clips of the site and the templates, for posting.
 *
 * The still ads in promo/ads already say what the products are. What they
 * cannot show is the thing these templates are actually made of — cloth in
 * the wind, lights coming up one by one, a whole site turning from night to
 * paper. That only survives as video, and video is what a timeline rewards.
 *
 *   node tools/promo-clips.js            # all clips
 *   node tools/promo-clips.js theme      # just one
 *
 * Output: promo/clips/x-<name>.mp4 — 1280x720, H.264, no audio, silent-safe.
 * Twitter/X, LinkedIn and Slack all take that as-is.
 *
 * Needs the same two local servers as tools/og-cards.js (site on 8899,
 * fonts with CORS on 8897) — see tools/og-cards.md. Fonts matter here for
 * the same reason: a clip in a substitute typeface is the wrong brand,
 * moving.
 */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE = 'http://127.0.0.1:8899';
const FONTS = 'http://127.0.0.1:8897';
const OUT = path.join(ROOT, 'promo/clips');
const TMP = '/tmp/promo-clips';
const W = 1280, H = 720;

/* A clip is a page plus a list of beats. Beats:
 *   ['wait',   ms]
 *   ['scroll', toPx, overMs]      linear, so it reads as a camera move
 *   ['click',  selector]     a real click — the pointer scrolls it into view
 *   ['jsclick',selector]     fires the handler without moving the page
 *   ['eval',   fnString]                                                  */
const CLIPS = {
  /* The one genuinely new thing on the site: the whole of it changing side. */
  theme: {
    url: '/index.html',
    beats: [
      ['wait', 2600],
      ['scroll', 1020, 2400],
      ['wait', 700],
      ['scroll', 950, 420],        // nav hides on the way down; bring it back
      ['wait', 600],
      ['click', '#themeToggle'],
      ['wait', 2800],
      ['scroll', 2280, 2600],
      ['wait', 700],
      ['scroll', 2210, 420],
      ['wait', 600],
      ['click', '#themeToggle'],
      ['wait', 2400],
    ],
  },

  /* Cloth. The gust model settles for 1.5-4.5s before the first wind, so
     the opening hold is long enough to catch one. */
  noren: {
    url: '/products/template-noren/index.html',
    beats: [
      ['wait', 5200],
      ['scroll', 900, 2600],
      ['wait', 1000],
      ['scroll', 2100, 2800],
      ['wait', 1200],
    ],
  },

  /* Lights coming up in the windows, then the same photograph by day. */
  veil: {
    url: '/products/template-veil/index.html',
    beats: [
      ['wait', 4200],
      ['eval', "document.documentElement.setAttribute('data-theme','studio')"],
      ['wait', 2600],
      ['eval', "document.documentElement.setAttribute('data-theme','cinema')"],
      ['wait', 1600],
      ['scroll', 2200, 3400],
      ['wait', 1900],
    ],
  },

  /* Five canvas scenes behind the front page, switched in turn. */
  scenes: {
    url: '/index.html?scene=ring',
    beats: [
      ['wait', 3200],
      ['jsclick', '.hero-switch'], ['wait', 2800],
      ['jsclick', '.hero-switch'], ['wait', 2800],
      ['jsclick', '.hero-switch'], ['wait', 2800],
      ['jsclick', '.hero-switch'], ['wait', 3000],
    ],
  },
};

const SCROLL_TO = `(to, ms) => new Promise(done => {
  const from = window.scrollY, t0 = performance.now();
  (function step(t) {
    const k = Math.min((t - t0) / ms, 1);
    window.scrollTo(0, from + (to - from) * k);
    k < 1 ? requestAnimationFrame(step) : done();
  })(t0);
})`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });

  const only = process.argv.slice(2);
  const names = only.length ? only.filter(n => CLIPS[n]) : Object.keys(CLIPS);
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });

  for (const name of names) {
    const clip = CLIPS[name];
    const dir = path.join(TMP, name);
    const ctx = await browser.newContext({
      viewport: { width: W, height: H },
      recordVideo: { dir, size: { width: W, height: H } },
    });
    await ctx.route('**://fonts.googleapis.com/**', async route => {
      const r = await fetch(FONTS + '/fonts.css');
      route.fulfill({ status: 200, contentType: 'text/css', body: await r.text() });
    });
    const pg = await ctx.newPage();
    await pg.goto(SITE + clip.url, { waitUntil: 'load' });
    await pg.evaluate(() => document.fonts.ready);

    for (const [op, a, b] of clip.beats) {
      if (op === 'wait') await pg.waitForTimeout(a);
      else if (op === 'scroll') await pg.evaluate(([f, to, ms]) => eval(f)(to, ms), [SCROLL_TO, a, b]);
      else if (op === 'click') {
        try { await pg.click(a, { timeout: 5000 }); }
        catch (e) { throw new Error(`clip "${name}": could not click ${a} — ` + e.message.split('\n')[0]); }
      }
      else if (op === 'jsclick') await pg.$eval(a, el => el.click());
      else if (op === 'eval') await pg.evaluate(a);
    }
    await ctx.close();                       // flushes the recording

    const webm = fs.readdirSync(dir).find(f => f.endsWith('.webm'));
    const mp4 = path.join(OUT, `x-${name}.mp4`);
    execFileSync('ffmpeg', [
      '-y', '-loglevel', 'error', '-i', path.join(dir, webm),
      '-vf', `scale=${W}:${H}:flags=lanczos,format=yuv420p`,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '20',
      '-profile:v', 'high', '-level', '4.0',
      '-movflags', '+faststart', '-an', '-r', '30',
      mp4,
    ]);
    const secs = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
      '-of', 'default=nw=1:nk=1', mp4]).toString().trim();
    console.log(`x-${name}.mp4  ${(fs.statSync(mp4).size / 1048576).toFixed(1)} MB  ${(+secs).toFixed(1)}s`);
  }

  await browser.close();
})();
