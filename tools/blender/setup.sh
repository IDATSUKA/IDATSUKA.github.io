#!/bin/bash
# Blender (bpy) ヘッドレス環境のセットアップ。何度実行しても安全（冪等）。
#
#   bash tools/blender/setup.sh
#
# - Python 3.11 の venv に PyPI の `bpy` (Blender as a Python module) を入れる
# - レンダリングに必要な EGL/GL ランタイムを apt で入れる（root の場合のみ）
# - 成功すると $BLENDER_VENV/bin/python で `import bpy` できる
set -euo pipefail

BLENDER_VENV="${BLENDER_VENV:-$HOME/.cache/idatsuka-blender/venv}"
BPY_VERSION="${BPY_VERSION:-5.0.1}"

log() { echo "[blender-setup] $*" >&2; }

# ---- 1. Python 3.11 を探す（bpy 4.2+ / 5.x は 3.11 専用ホイール） ----
find_python() {
  for c in python3.11 python3; do
    if command -v "$c" >/dev/null 2>&1; then
      if "$c" -c 'import sys; sys.exit(0 if sys.version_info[:2]==(3,11) else 1)'; then
        command -v "$c"; return 0
      fi
    fi
  done
  return 1
}

# ---- 2. venv + bpy ----
if [ -x "$BLENDER_VENV/bin/python" ] && "$BLENDER_VENV/bin/python" -c 'import bpy' >/dev/null 2>&1; then
  log "bpy already installed in $BLENDER_VENV"
else
  PY="$(find_python)" || { log "Python 3.11 が見つかりません（bpy $BPY_VERSION は 3.11 が必要）"; exit 1; }
  log "creating venv at $BLENDER_VENV with $PY"
  mkdir -p "$(dirname "$BLENDER_VENV")"
  "$PY" -m venv "$BLENDER_VENV"
  log "installing bpy==$BPY_VERSION (約 300MB、初回のみ数分かかります)"
  "$BLENDER_VENV/bin/pip" install --quiet --disable-pip-version-check "bpy==$BPY_VERSION"
fi

# ---- 3. GL/EGL ランタイム（Workbench/EEVEE レンダリングとglTF出力に必要） ----
if [ ! -e /usr/lib/x86_64-linux-gnu/libEGL.so.1 ] && [ "$(id -u)" = "0" ] && command -v apt-get >/dev/null 2>&1; then
  log "installing EGL/GL runtime libraries via apt"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -q >/dev/null 2>&1 || true
  apt-get install -y -q libegl1 libgl1 libxi6 libxrender1 libxfixes3 libxkbcommon0 libsm6 libxxf86vm1 >/dev/null 2>&1 \
    || log "warning: apt install failed; CYCLES 以外のレンダリングが失敗するかもしれません"
fi

# ---- 4. 動作確認 ----
"$BLENDER_VENV/bin/python" - <<'PY'
import bpy
print(f"[blender-setup] OK: Blender {bpy.app.version_string} (bpy) ready")
PY
