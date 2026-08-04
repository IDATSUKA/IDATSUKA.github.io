#!/bin/bash
# SessionStart hook: make the Codex CLI available so Claude can delegate to it.
#
# This repo is a static site with no build step, so there are no project
# dependencies to install. The only thing a fresh remote container is missing
# is the `codex` binary itself.
set -uo pipefail

# Local machines are expected to manage their own Codex install; only bootstrap
# the ephemeral remote containers.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

if ! command -v codex >/dev/null 2>&1; then
  echo "session-start: installing @openai/codex ..."
  if ! npm install -g @openai/codex >/dev/null 2>&1; then
    echo "session-start: WARNING - could not install @openai/codex (npm registry unreachable?)." >&2
    echo "session-start: Codex delegation will be unavailable this session." >&2
    exit 0
  fi
fi

echo "session-start: codex $(codex --version 2>/dev/null || echo '(version unknown)')"

if [ -z "${OPENAI_API_KEY:-}" ] && ! codex login status >/dev/null 2>&1; then
  echo "session-start: NOTE - Codex has no credentials; set OPENAI_API_KEY as an"
  echo "session-start: environment secret to enable delegation. See docs/CODEX.md."
fi

exit 0
