#!/bin/bash
# Claude Code on the web のセッション開始時に Blender (bpy) 環境を用意する。
# ローカル環境では何もしない（ローカルでは手動で tools/blender/setup.sh を実行）。
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
BLENDER_VENV="${BLENDER_VENV:-$HOME/.cache/idatsuka-blender/venv}"
export BLENDER_VENV

if bash "$ROOT/tools/blender/setup.sh"; then
  if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
    {
      echo "export BLENDER_VENV=\"$BLENDER_VENV\""
      echo "export BLENDER_PY=\"$BLENDER_VENV/bin/python\""
      echo "export PATH=\"$ROOT/tools/blender:\$PATH\""
    } >> "$CLAUDE_ENV_FILE"
  fi
else
  echo "[session-start] Blender setup failed; run 'bash tools/blender/setup.sh' manually" >&2
fi
