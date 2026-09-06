#!/bin/bash
# ヘッドレス Blender (bpy) でスクリプトを実行するラッパー。
#
#   tools/blender/blender.sh script.py [args...]      # スクリプト実行
#   tools/blender/blender.sh -c "import bpy; ..."     # ワンライナー
#   tools/blender/blender.sh                          # 対話 Python (bpy 入り)
#
# スクリプト内では `import idk_blender` でヘルパー (tools/blender/idk_blender.py) が使える。
# 未セットアップなら自動で setup.sh を実行する。
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BLENDER_VENV="${BLENDER_VENV:-$HOME/.cache/idatsuka-blender/venv}"
export BLENDER_VENV

if ! [ -x "$BLENDER_VENV/bin/python" ] || ! "$BLENDER_VENV/bin/python" -c 'import bpy' >/dev/null 2>&1; then
  bash "$HERE/setup.sh"
fi

export PYTHONPATH="$HERE${PYTHONPATH:+:$PYTHONPATH}"
exec "$BLENDER_VENV/bin/python" "$@"
