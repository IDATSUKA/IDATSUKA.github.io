#!/bin/bash
# SessionStart: make the Codex CLI available and logged in.
# Credentials never live in this repo; they come from environment variables:
#   CODEX_AUTH_JSON_B64  base64 of ~/.codex/auth.json (ChatGPT login)
#   OPENAI_API_KEY       fallback API-key login
# Never fails the session: every step is best-effort.

if ! command -v codex >/dev/null 2>&1; then
  npm install -g @openai/codex >/dev/null 2>&1 || {
    echo "codex-setup: npm install failed; Codex CLI unavailable" >&2
    exit 0
  }
fi

if codex login status >/dev/null 2>&1; then
  exit 0
fi

if [ -n "$CODEX_AUTH_JSON_B64" ]; then
  mkdir -p "$HOME/.codex"
  if printf '%s' "$CODEX_AUTH_JSON_B64" | base64 -d > "$HOME/.codex/auth.json" 2>/dev/null; then
    chmod 600 "$HOME/.codex/auth.json"
  else
    rm -f "$HOME/.codex/auth.json"
    echo "codex-setup: CODEX_AUTH_JSON_B64 is not valid base64" >&2
  fi
fi

if ! codex login status >/dev/null 2>&1 && [ -n "$OPENAI_API_KEY" ]; then
  printenv OPENAI_API_KEY | codex login --with-api-key >/dev/null 2>&1
fi

codex login status 2>&1 | tail -1
exit 0
