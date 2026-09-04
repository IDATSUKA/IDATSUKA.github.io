#!/usr/bin/env node
// Site check for idatsuka.com — zero dependencies, runs with plain Node 18+.
//
//   node .agents/skills/site-check/check.mjs            static checks only
//   node .agents/skills/site-check/check.mjs --browser  + headless Chromium pass
//
// Static pass (always):
//   * every root *.html and tools/**/*.html has the required head block
//   * every page's <nav> lists the same links as index.html
//   * every relative href/src points at a file that exists
//   * no root-absolute links except href="/" (GitHub Pages + custom domain)
// Browser pass (--browser, needs Playwright + Chromium on this machine):
//   * no console errors / uncaught exceptions / failed local requests on load
//   * no horizontal overflow at 1440 / 1100 / 950 / 768 / 390 px
//   (external requests such as Google Fonts are blocked during the pass, so
//   text renders in fallback fonts — layout checks are about containers,
//   not glyph widths)
//
// Exit code 0 = clean, 1 = at least one error. Warnings never fail the run.

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const SITE = 'https://idatsuka.com';
const WIDTHS = [1440, 1100, 950, 768, 390];
const wantBrowser = process.argv.includes('--browser');

const errors = [];
const warnings = [];
const err = (page, msg) => errors.push(`${page}: ${msg}`);
const warn = (page, msg) => warnings.push(`${page}: ${msg}`);

// ---------- collect pages ----------
function htmlFilesIn(dir, recursive) {
  const abs = path.join(ROOT, dir);
  if (!existsSync(abs)) return [];
  const out = [];
  for (const name of readdirSync(abs)) {
    const rel = path.join(dir, name);
    const st = statSync(path.join(ROOT, rel));
    if (st.isDirectory()) { if (recursive) out.push(...htmlFilesIn(rel, true)); }
    else if (name.endsWith('.html')) out.push(rel);
  }
  return out.sort();
}
const pages = [...htmlFilesIn('.', false), ...htmlFilesIn('tools', true)]
  .map(p => p.replace(/^\.\//, ''));

// ---------- static checks ----------
const attr = (tag, name) => {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, 'i'));
  return m ? m[1] : null;
};
const navLinks = html => {
  const m = html.match(/<ul class="nav-links">([\s\S]*?)<\/ul>/);
  if (!m) return null;
  return [...m[1].matchAll(/<a\s[^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/g)]
    .map(x => `${x[1]}|${x[2].trim()}`);
};

const indexHtml = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const referenceNav = navLinks(indexHtml);
if (!referenceNav) err('index.html', 'no <ul class="nav-links"> found; cannot compare navs');
const noSocialMeta = [];

for (const page of pages) {
  const html = readFileSync(path.join(ROOT, page), 'utf8');
  const head = (html.match(/<head>([\s\S]*?)<\/head>/) || [, ''])[1];
  const dir = path.dirname(page);

  if (!/<html lang="ja">/.test(html)) err(page, 'missing <html lang="ja">');
  if (!/<title>[^<]+<\/title>/.test(head)) err(page, 'missing <title>');
  if (!/<meta name="description" content="[^"]+"/.test(head)) err(page, 'missing <meta name="description">');
  if (!/<meta property="og:title" content="[^"]+"/.test(head)) err(page, 'missing og:title');
  if (!/<meta property="og:description" content="[^"]+"/.test(head)) err(page, 'missing og:description');
  const canon = (head.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
  if (!canon) err(page, 'missing <link rel="canonical">');
  else if (!canon.startsWith(SITE + '/')) err(page, `canonical is not absolute ${SITE}/...: ${canon}`);
  if (!/property="og:image"/.test(head) || !/name="twitter:card"/.test(head)) noSocialMeta.push(page);

  const nav = navLinks(html);
  if (!nav) err(page, 'no <ul class="nav-links">');
  else if (referenceNav) {
    // Compare hrefs resolved against the page's own directory, so tools/ pages may use ../.
    const norm = list => list.map(s => {
      const [href, label] = s.split('|');
      return `${path.posix.normalize(path.posix.join(dir === '.' ? '' : dir, href))}|${label}`;
    }).join(', ');
    if (norm(nav) !== norm(referenceNav)) err(page, `nav differs from index.html: [${nav.join(', ')}]`);
  }

  // Links and assets.
  const refs = [...html.matchAll(/\s(?:href|src)="([^"]+)"/g)].map(m => m[1]);
  for (const ref of refs) {
    if (/^(https?:|mailto:|tel:|data:|javascript:|#)/.test(ref)) continue;
    if (ref === '/') continue;
    if (ref.startsWith('/')) { err(page, `root-absolute link (use a relative path): ${ref}`); continue; }
    const target = ref.split(/[?#]/)[0];
    if (!target) continue;
    const abs = path.join(ROOT, dir, target);
    const exists = existsSync(abs) || (target.endsWith('/') && existsSync(path.join(abs, 'index.html')));
    if (!exists) err(page, `broken link: ${ref}`);
  }
}

if (noSocialMeta.length) warn('meta', `${noSocialMeta.length} page(s) without og:image / twitter:card (optional; index.html has both)`);

// ---------- browser checks ----------
async function browserPass() {
  let playwright;
  try {
    const req = createRequire(import.meta.url);
    let globalRoot = '';
    try { globalRoot = execSync('npm root -g', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch {}
    const candidates = ['playwright', 'playwright-core',
      ...(globalRoot ? [path.join(globalRoot, 'playwright'), path.join(globalRoot, 'playwright-core')] : [])];
    for (const c of candidates) { try { playwright = req(c); break; } catch {} }
    if (!playwright) throw new Error('not installed');
  } catch {
    warn('browser', 'Playwright not found; skipped browser pass (npm i -g playwright, or open the site by hand)');
    return;
  }

  const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
    '.mjs': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.json': 'application/json', '.zip': 'application/zip', '.ico': 'image/x-icon' };
  const server = createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const abs = path.join(ROOT, p);
    if (!abs.startsWith(ROOT) || !existsSync(abs) || statSync(abs).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': mime[path.extname(abs)] || 'application/octet-stream' });
    res.end(readFileSync(abs));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/`;

  const browser = await playwright.chromium.launch();
  try {
    for (const page of pages) {
      const tab = await browser.newPage();
      // Only the site's own files matter here; block Google Fonts and anything
      // else external so a slow or offline network cannot stall the run.
      await tab.route('**/*', r => r.request().url().startsWith(base) ? r.continue() : r.abort());
      const problems = [];
      tab.on('console', m => {
        if (m.type() !== 'error') return;
        const src = m.location()?.url || '';
        if (src && !src.startsWith(base)) return; // blocked external resource, not a site bug
        problems.push(`console: ${m.text()}`);
      });
      tab.on('pageerror', e => problems.push(`exception: ${e.message}`));
      tab.on('requestfailed', r => {
        if (r.url().startsWith(base)) problems.push(`request failed: ${r.url().slice(base.length)}`);
      });
      for (const w of WIDTHS) {
        await tab.setViewportSize({ width: w, height: 900 });
        if (w === WIDTHS[0]) await tab.goto(base + page, { waitUntil: 'domcontentloaded' });
        await tab.waitForTimeout(250);
        const over = await tab.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (over > 1) problems.push(`horizontal overflow at ${w}px (+${over}px)`);
      }
      await tab.close();
      for (const p of [...new Set(problems)]) err(page, p);
    }
  } finally {
    await browser.close();
    server.close();
  }
}

if (wantBrowser) await browserPass();

// ---------- report ----------
console.log(`site-check: ${pages.length} pages${wantBrowser ? `, browser pass at ${WIDTHS.join('/')}px` : ' (static only; add --browser for Chromium checks)'}`);
for (const w of warnings) console.log(`  warn  ${w}`);
for (const e of errors) console.log(`  ERROR ${e}`);
console.log(errors.length ? `site-check: ${errors.length} error(s)` : 'site-check: OK');
process.exit(errors.length ? 1 : 0);
