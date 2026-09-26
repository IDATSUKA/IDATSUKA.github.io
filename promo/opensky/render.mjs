// Deterministic frame renderer for opensky.html.
//   node render.mjs stills 0.5 2.9 5.2 ...   → out/still-<t>.png
//   node render.mjs frames [fps=180] [workers=4] → out/frames/f%05d.png
// Frames are rendered by calling window.__R.seek(t) for each t = i / fps, never recorded in real time.
import { createRequire } from 'module';
import { mkdirSync, readFileSync } from 'fs';
import http from 'http';
import { fileURLToPath } from 'url';
import path from 'path';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }

const dir = path.dirname(fileURLToPath(import.meta.url));
// served over http so the canvas can read image pixels (file:// taints it)
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.woff2': 'font/woff2', '.webp': 'image/webp' };
const server = http.createServer((q, s) => {
  try { const f = path.join(dir, decodeURIComponent(q.url.split('?')[0])); s.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); s.end(readFileSync(f)); }
  catch { s.writeHead(404); s.end(); }
}).listen(0, '127.0.0.1');
await new Promise(r => server.once('listening', r));
const url = `http://127.0.0.1:${server.address().port}/opensky.html`;
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
  // optional partial re-render: FROM=<frame> TO=<frame>
  mkdirSync(fdir, { recursive: true });
  let next = parseInt(process.env.FROM || '0'), done = 0; const t0 = Date.now();
  await Promise.all([...Array(workers)].map(async () => {
    const page = await open(browser);
    const end = Math.min(total, parseInt(process.env.TO || String(total)));
    while (next < end) {
      const i = next++;
      await page.evaluate(t => window.__R.seek(t), i / fps);
      await page.screenshot({ path: path.join(fdir, `f${String(i).padStart(5, '0')}.png`) });
      if (++done % 150 === 0) console.log(`${done}/${total}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
  }));
}
await browser.close();
server.close();
