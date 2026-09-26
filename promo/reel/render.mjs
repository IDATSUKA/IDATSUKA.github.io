// Deterministic frame renderer for reel.html.
//   node render.mjs stills 0.5 2.9 5.2 ...   → out/still-<t>.png
//   node render.mjs frames [fps=180] [workers=4] → out/frames/f%05d.png
// Frames are rendered by calling window.__R.seek(t) for each t = i / fps, never recorded in real time.
import { createRequire } from 'module';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }

const dir = path.dirname(fileURLToPath(import.meta.url));
const url = 'file://' + path.join(dir, 'reel.html');
const out = process.env.OUT || path.join(dir, 'out');
const [mode, ...args] = process.argv.slice(2);

async function open(browser) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('console', m => { if (m.type() === 'error') console.error('[page]', m.text()); });
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  await page.goto(url);
  await page.evaluate(() => window.__R.ready);
  return page;
}

const browser = await pw.chromium.launch({ args: ['--font-render-hinting=none', '--disable-lcd-text'] });
if (mode === 'stills') {
  mkdirSync(out, { recursive: true });
  const page = await open(browser);
  for (const a of args) {
    await page.evaluate(t => window.__R.seek(t), parseFloat(a));
    await page.screenshot({ path: path.join(out, `still-${a}.png`) });
  }
} else if (mode === 'frames') {
  const fps = parseInt(args[0] || '180'), workers = parseInt(args[1] || '4');
  const total = fps * 15, fdir = path.join(out, 'frames');
  mkdirSync(fdir, { recursive: true });
  let next = 0, done = 0; const t0 = Date.now();
  await Promise.all([...Array(workers)].map(async () => {
    const page = await open(browser);
    while (next < total) {
      const i = next++;
      await page.evaluate(t => window.__R.seek(t), i / fps);
      await page.screenshot({ path: path.join(fdir, `f${String(i).padStart(5, '0')}.png`) });
      if (++done % 150 === 0) console.log(`${done}/${total}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
  }));
}
await browser.close();
