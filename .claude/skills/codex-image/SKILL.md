---
name: codex-image
description: Generate or edit an image with the Codex CLI's built-in image generation tool (ChatGPT login, no extra API cost). Use when the user asks for an image, illustration, photo-style picture, logo variation or an edit of an existing image, or types /codex-image. Works in cloud sessions, Cowork and the terminal, in any repository.
argument-hint: "[--ref <path>]... [--edit <path>] <prompt, in any language>"
---

Generate the image by handing the prompt to Codex. Codex drives its own `image_gen` tool and writes the PNG to disk; you only make sure Codex is ready, prepare the prompt, run it, and show the result.

## 1. Make sure Codex is ready

1. `codex --version`. If it is missing, install it with `npm install -g @openai/codex` (Node.js 18.18+ is needed; if npm is missing, tell the user how to install Node.js and stop).
2. `codex login status`. If it does not say "Logged in":
   - If the environment variable `CODEX_AUTH_JSON_B64` is set, restore it (never print its value):
     `mkdir -p ~/.codex && printf '%s' "$CODEX_AUTH_JSON_B64" | base64 -d > ~/.codex/auth.json && chmod 600 ~/.codex/auth.json`, then check again.
   - On the user's own computer (Cowork, terminal): run `codex login`; a browser opens and the user signs in to ChatGPT. Wait for it.
   - In a cloud container with no browser: run `codex login --device-auth` in the background, show the user the URL and one-time code from its output (it expires in 15 minutes), and wait for the command to finish.
   - Never ask the user to paste a token, key or auth file into the chat.

## 2. Build the prompt

- Write the prompt in English, expanding the user's request into subject, styling, setting, light, composition and aspect (portrait 1024x1536, landscape 1536x1024, square 1024x1024).
- People are always adults, fully clothed, non-sexual.
- Ask for no real brand logos, store names or readable signage unless the user wants them.
- End the prompt with: `Save the result as <file>.png in the current directory, then print a line: SAVED: <absolute path>`. Use a short descriptive filename.

## 3. Run it

Output folder:
- Inside a git repository: `codex-images/` at the repo root. Add `codex-images/` to `.gitignore` if it is not there, so generated files are never committed or published by accident.
- Anywhere else (Cowork, a plain folder): `~/Pictures/codex-images/`.

Run from the output folder, with stdin closed — without it `codex exec` waits on stdin and hangs until the timeout:

```bash
# macOS / Linux / cloud
mkdir -p "$OUT" && cd "$OUT" && \
codex exec --skip-git-repo-check --sandbox workspace-write "<prompt>" </dev/null > codex-image.log 2>&1; \
grep '^SAVED:' codex-image.log
```

```powershell
# Windows PowerShell
New-Item -ItemType Directory -Force $OUT | Out-Null; Set-Location $OUT
$null | codex exec --skip-git-repo-check --sandbox workspace-write "<prompt>" *> codex-image.log
Select-String '^SAVED:' codex-image.log
```

- A generation takes 2–4 minutes. Run it in the background or with a timeout of at least 15 minutes.
- References or an edit target: add `--image <path>` once per file (up to 5) before the prompt, and say in the prompt whether each one is a style reference or the image to edit.
- If there is no `SAVED:` line, read the end of `codex-image.log` and report the real error (quota and rate-limit messages appear there).

## 4. Show it

Look at the PNG to check it matches the request, then show it to the user (in Claude Code, send it with SendUserFile and `display: "render"`). Mention anything off, such as stray text or logos, and offer one revision. Do not commit the image; move it into the project only when the user asks.
