# AGENTS.md

Shared context for every coding agent that works on this repo. Codex reads this
file automatically; Claude Code reads `CLAUDE.md`, which imports it. **Both
agents get the same information from here — keep it the single source of
truth.** If you learn something about the project that the next agent should
know, put it in this file (rules) or in `docs/HANDOFF.md` (state and history),
not in a chat reply.

## What this repo is

The source of **https://idatsuka.com** — a personal portfolio site for
Idatsuka (designer/creator, Tokyo), served by GitHub Pages from the `main`
branch of `IDATSUKA/IDATSUKA.github.io`.

It is a **hand-written static site**. There is no framework, no bundler, no
package manager, no build step. What is in the repo is exactly what is served.
`CNAME` pins the custom domain.

## Before you start

1. Read `docs/HANDOFF.md` — the running log of what was done, what is
   unfinished, and which branches hold work that is not on `main` yet.
2. Skills live in `.agents/skills/<name>/SKILL.md` and are shared by Codex and
   Claude (`.claude/skills/<name>` is a symlink to the same directory). Check
   there before inventing a procedure.

## Layout

```
*.html              every page, hand-written, one file per page
style.css           the entire shared stylesheet (design tokens in :root)
js/leaderboard.js   shared leaderboard helper for the games
img/                site images and SVGs (logo.svg is the wordmark, og.svg the share image)
game-*.html         self-contained browser games (Void Runner, Signal, Lattice)
pinball/            a larger pinball game: Matter.js + three.js, own assets
PinballGame/        source/working files for the pinball game
products/           downloadable digital products (zip + unpacked template)
404.html            GitHub Pages 404 page
MONETIZATION.md     notes on the store / monetization plan
docs/               agent-facing docs: HANDOFF.md (log), CODEX.md (Codex setup)
.agents/skills/     shared skills (Codex + Claude)
.claude/            Claude Code hooks, settings, subagents, skill symlinks
```

Navigation is the same six links on every page, in this order:
`about.html` Profile · `play.html` Play · `biz.html` Business ·
`store.html` Store · `blog.html` Blog · `contact.html` Contact.
The logo links to `/` (the one permitted root-absolute link).

## Conventions — follow these

- **Language**: pages are `<html lang="ja">`; UI copy is Japanese, code and
  identifiers are English.
- **Styling**: use the CSS custom properties in `style.css` (`--bg`, `--bg2`,
  `--bg3`, `--fg`, `--fg-dim`, `--muted`, `--dim`, `--accent`,
  `--accent-soft`, `--border`, `--border-strong`, `--mono`, `--ease-out`,
  `--ease-soft`). Do not hard-code hex colours that duplicate a token.
  Fonts are Space Grotesk / Zen Kaku Gothic New / Space Mono via Google Fonts.
- **Page-specific CSS** goes in a `<style>` block in that page's `<head>`.
  Only genuinely shared rules belong in `style.css`.
- **No dependencies.** Do not add npm packages, a build step, or a CDN
  `<script>`. Google Fonts (already wired up) and the pinball game's vendored
  local libraries are the whole allowance.
- **Head block**: every page carries `<title>`, `<meta name="description">`,
  `<link rel="canonical">`, `og:title` and `og:description`. Canonical and OG
  URLs are absolute `https://idatsuka.com/...`. `index.html` also carries
  `og:image` and `twitter:card`; adding them to other pages is welcome but
  not required.
- **Links are relative** (`about.html`, not `/about.html`), except the logo's
  `href="/"`.
- Match the indentation and structure of the file you are editing (2 spaces).

## Verifying a change

There is nothing to compile. Run the shared checker (details in
`.agents/skills/site-check/SKILL.md`):

```bash
node .agents/skills/site-check/check.mjs            # head blocks, nav, links
node .agents/skills/site-check/check.mjs --browser  # + console errors, overflow at 5 widths
```

The browser pass needs Playwright and Chromium; if they are missing it says
so and you verify by hand instead:

```bash
npx --yes http-server -p 8080 -c-1 .     # then open http://localhost:8080
```

Check the page you changed at desktop and mobile widths, and check the
browser console when touching anything under `js/`, `game-*.html`, or
`pinball/`.

## When you finish

Append an entry to `docs/HANDOFF.md`: date, which agent, what changed, what
is left, and the branch name if the work is not on `main`. That file is how
Codex and Claude hand work to each other — a change that is not logged there
is invisible to the next session.

## Ground rules

- Do not commit or push unless the orchestrating agent or the human asked
  for it. Otherwise leave changes in the working tree for review.
- Do not touch `CNAME` — it controls the live domain.
- Do not rewrite `style.css` wholesale; it is shared by every page.
- Do not add tracking, analytics, or third-party scripts.
- `products/*.zip` are release artifacts; regenerate rather than hand-edit.
- Never write API keys or secrets into the repo, including `docs/HANDOFF.md`.
