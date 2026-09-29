#!/bin/bash
# Delegate a task to the Codex CLI and print its final answer.
#
# Usage:
#   .claude/scripts/codex-run.sh [--write] [--model M] [--cd DIR] "<prompt>"
#   echo "<prompt>" | .claude/scripts/codex-run.sh [--write]
#
# Modes:
#   default   read-only  — Codex may read and search, but cannot modify files
#   --write   workspace-write — Codex may edit files inside the repo
#
# Exit codes:
#   0   Codex finished, final message printed on stdout
#   2   codex CLI is not installed
#   3   codex has no usable credentials
#   4   api.openai.com is blocked by the network policy
#   *   whatever codex itself returned

set -uo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
SANDBOX="read-only"
MODEL=""
WORKDIR="$PROJECT_DIR"
PROMPT=""

while [ $# -gt 0 ]; do
  case "$1" in
    --write)  SANDBOX="workspace-write"; shift ;;
    --model)  MODEL="${2:-}"
              [ -z "$MODEL" ] && { echo "codex-run: --model needs a value" >&2; exit 64; }
              shift 2 ;;
    --cd)     WORKDIR="${2:-}"
              [ -z "$WORKDIR" ] && { echo "codex-run: --cd needs a value" >&2; exit 64; }
              shift 2 ;;
    --)       shift; PROMPT="$*"; break ;;
    -*)       echo "codex-run: unknown option: $1" >&2; exit 64 ;;
    *)        PROMPT="$*"; break ;;
  esac
done

if [ -z "$PROMPT" ] && [ ! -t 0 ]; then
  PROMPT="$(cat)"
fi

if [ -z "$PROMPT" ]; then
  echo "codex-run: no prompt given" >&2
  exit 64
fi

if ! command -v codex >/dev/null 2>&1; then
  cat >&2 <<'MSG'
codex-run: the `codex` CLI is not installed.
Install it with:  npm install -g @openai/codex
(the session-start hook does this automatically in Claude Code on the web)
MSG
  exit 2
fi

# Credentials live in $CODEX_HOME/auth.json (default ~/.codex). Codex does NOT
# read OPENAI_API_KEY on its own — an API key only reaches the API once it has
# been materialised into auth.json by `codex login --with-api-key`. So if a key
# is in the environment and there is no stored login yet, do that login here.
if ! codex login status >/dev/null 2>&1 && [ -n "${OPENAI_API_KEY:-}" ]; then
  printenv OPENAI_API_KEY | codex login --with-api-key >/dev/null 2>&1 || true
fi

# `codex login status` is the authoritative check.
if ! codex login status >/dev/null 2>&1; then
  cat >&2 <<'MSG'
codex-run: Codex has no credentials.
Provide one of:
  * OPENAI_API_KEY in the environment (Claude Code on the web: add it as an
    environment secret on the environment this session runs in), or
  * an interactive login on your own machine:  codex login
See docs/CODEX.md for details.
MSG
  exit 3
fi

# Preflight the API host. Codex retries a blocked host ~10 times across both
# its WebSocket and HTTPS transports, which turns an instant policy denial
# into minutes of noise. Fail fast instead. A non-403/407 result (including a
# 401 from the probe having no key) means the host is reachable — good enough.
PROBE="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 \
  https://api.openai.com/v1/models 2>&1)"
case "$PROBE" in
  ""|000|*403*|*407*)
    cat >&2 <<'MSG'
codex-run: api.openai.com is not reachable from this session.
The egress policy is denying it (403/407 at the proxy), so Codex cannot run.

  * Claude Code on the web: allow `api.openai.com` (and `chatgpt.com` if you
    authenticate with a ChatGPT account) in this environment's network policy.
  * Confirm with:  curl -sS "$HTTPS_PROXY/__agentproxy/status"

See docs/CODEX.md. Do not retry — this is a policy denial, not a blip.
MSG
    exit 4
    ;;
esac

LAST_MSG="$(mktemp)"
trap 'rm -f "$LAST_MSG"' EXIT

set -- exec --sandbox "$SANDBOX" --cd "$WORKDIR" --color never \
  --output-last-message "$LAST_MSG"
[ -n "$MODEL" ] && set -- "$@" --model "$MODEL"

codex "$@" "$PROMPT"
STATUS=$?

# codex streams its whole reasoning transcript as it runs; --output-last-message
# captures just the closing answer, which is the part the calling agent needs.
# Echo it at the end so it is not buried in the transcript above.
if [ -s "$LAST_MSG" ]; then
  echo "----- codex final message -----"
  cat "$LAST_MSG"
fi

exit $STATUS
