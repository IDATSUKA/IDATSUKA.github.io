---
name: codex-image
description: Generate or edit an image with the Codex CLI's built-in image generation tool (ChatGPT login, no extra API cost). Use when the user asks for an image, illustration, photo-style picture, logo variation or an edit of an existing image, or types /codex-image. Works in cloud sessions, where repo-declared plugins such as codex-image-in-cc are not loaded.
argument-hint: "[--ref <path>]... [--edit <path>] <prompt, in any language>"
---

Generate the image by handing the prompt to Codex. Codex drives its own `image_gen` tool and writes the PNG to disk; you only prepare the prompt, run it, and show the result.

## 1. Check Codex

Run `codex login status`. If it does not say "Logged in", the SessionStart hook (`.claude/hooks/codex-setup.sh`) did not find credentials — tell the user to set `CODEX_AUTH_JSON_B64` in the environment settings, or offer `codex login --device-auth` and stop.

## 2. Build the prompt

- Write the prompt in English, expanding the user's request into subject, styling, setting, light, composition and aspect (portrait 1024x1536, landscape 1536x1024, square 1024x1024).
- People are always adults, fully clothed, non-sexual.
- Ask for no real brand logos, store names or readable signage unless the user wants them — this site sells its images, and real marks are a problem there.
- End the prompt with: `Save the result as <file> in the current directory, then print a line: SAVED: <absolute path>`.

## 3. Run it

Output goes to `codex-images/` at the repo root (git-ignored, so nothing is published by accident). Use a short descriptive filename.

```bash
mkdir -p codex-images && cd codex-images && \
codex exec --skip-git-repo-check --sandbox workspace-write "<prompt>" </dev/null > /tmp/codex-image.log 2>&1; \
grep '^SAVED:' /tmp/codex-image.log
```

- `</dev/null` is required. Without it `codex exec` waits on stdin and hangs until the timeout.
- Run it in the background (`run_in_background: true`, timeout 900000). A generation takes 2–4 minutes.
- References or an edit target: add `--image <path>` once per file (up to 5) before the prompt, and say in the prompt whether each one is a style reference or the image to edit.
- If there is no `SAVED:` line, read the tail of the log and report the real error (quota and rate-limit messages appear there).

## 4. Show it

Read the PNG to check it matches the request, then send it with SendUserFile (`display: "render"`). Mention anything off, such as stray text or logos, and offer one revision. Do not commit the image; if it should go on the site, move it into the right `img/` or `products/*/assets/` folder only when the user asks.
