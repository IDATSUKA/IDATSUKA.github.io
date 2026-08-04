# AGENTS.md

Context for coding agents (Codex reads this file automatically; Claude Code
reads `CLAUDE.md`, which points here).

## What this repo is

The source of **https://idatsuka.com** — a personal portfolio site for
Idatsuka (designer/creator, Tokyo), served by GitHub Pages from the `main`
branch of `IDATSUKA/IDATSUKA.github.io`.

It is a **hand-written static site**. There is no framework, no bundler, no
package manager, no build step, and no test suite. What is in the repo is
exactly what is served. `CNAME` pins the custom domain.

## Layout

```
*.html              every page, hand-written, one file per page
style.css           the entire shared stylesheet (design tokens in :root)
js/leaderboard.js   shared leaderboard helper for the games
img/                site images and SVGs
game-*.html         self-contained browser games (Void Runner, Signal, Lattice)
pinball/            a larger pinball game: Matter.js + three.js, own assets
PinballGame/        source/working files for the pinball game
products/           downloadable digital products (zip + unpacked template)
404.html            GitHub Pages 404 page
MONETIZATION.md     notes on the store / monetization plan
```

## Conventions — follow these

- **Language**: pages are `<html lang="ja">`; UI copy is Japanese, code and
  identifiers are English.
- **Styling**: use the CSS custom properties in `style.css` (`--bg`, `--bg2`,
  `--bg3`, `--fg`, `--fg-dim`, `--muted`, `--dim`, `--accent`, `--border`,
  `--mono`). Do not hard-code hex colours that duplicate a token.
- **Page-specific CSS** goes in a `<style>` block in that page's `<head>`.
  Only genuinely shared rules belong in `style.css`.
- **No dependencies.** Do not add npm packages, a build step, or a CDN
  `<script>`. Fonts come from Google Fonts (already wired up) and the pinball
  game vendors its libraries as local files — that is the whole allowance.
- **Head block**: every page carries `<title>`, `<meta name="description">`,
  `<link rel="canonical">`, `og:title`, `og:description`, `og:image`, and
  `twitter:card`. New pages must too. Canonical and OG URLs are absolute
  `https://idatsuka.com/...`.
- **Links are relative** (`about.html`, not `/about.html`).
- Match the indentation and structure of the file you are editing (2 spaces).

## Verifying a change

There is nothing to compile and nothing to lint by default. Verify by
serving the site and looking at it:

```bash
npx --yes http-server -p 8080 -c-1 .     # then open http://localhost:8080
```

Check the page you changed at both desktop and mobile widths, and check the
browser console for errors when touching anything under `js/`, `game-*.html`,
or `pinball/`.

## Ground rules

- Do not commit or push. Leave changes in the working tree for the
  orchestrating agent or the human to review.
- Do not touch `CNAME` — it controls the live domain.
- Do not rewrite `style.css` wholesale; it is shared by every page.
- Do not add tracking, analytics, or third-party scripts.
- `products/*.zip` are release artifacts; regenerate rather than hand-edit.
