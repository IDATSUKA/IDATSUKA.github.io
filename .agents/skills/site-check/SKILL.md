---
name: site-check
description: Verify the idatsuka.com static site after a change — head blocks, nav consistency, broken links, and (with --browser) console errors and horizontal overflow at five viewport widths. Use before reporting any page edit as done, and when asked to check, audit, or QA the site.
---

# Site check

One zero-dependency script covers the checks this project cares about. Run it
from the repo root.

```bash
node .agents/skills/site-check/check.mjs            # static pass, ~1 s
node .agents/skills/site-check/check.mjs --browser  # + headless Chromium pass
```

## What the static pass checks

- Every root `*.html` and `tools/**/*.html` has `<html lang="ja">`,
  `<title>`, `meta description`, `og:title`, `og:description`, and an absolute
  `https://idatsuka.com/...` canonical.
- Every page's `<ul class="nav-links">` lists the same links, in the same
  order, as `index.html`.
- Every relative `href`/`src` points at a file that exists.
- No root-absolute links except the logo's `href="/"`.

Missing `og:image` / `twitter:card` is reported once as a warning; it does not
fail the run.

## What `--browser` adds

Serves the repo on a local port, opens every page in headless Chromium, and
reports console errors, uncaught exceptions, failed local requests, and
horizontal overflow at 1440 / 1100 / 950 / 768 / 390 px. Needs Playwright
(`npm i -g playwright` plus a Chromium build); when it is absent the script
prints a warning and exits with the static result only. In that case verify
by hand with `npx --yes http-server -p 8080 -c-1 .`.

## Reading the result

- Exit 0 and `site-check: OK` — clean.
- Exit 1 — every `ERROR` line names the page and the problem. Fix them; do
  not report the change as done while any remain.
- Warnings are informational.

## Scope

Root pages and `tools/` only. `pinball/`, `products/template-zen/` and
`PinballGame/` are separate apps with their own structure and are skipped.
