"""サンプル: .blend ファイルを読み込んで GLB に変換する（three.js 用）。

    tools/blender/blender.sh tools/blender/examples/export_glb.py input.blend output.glb
"""
import sys

import idk_blender as ib

if len(sys.argv) != 3:
    sys.exit("usage: export_glb.py input.blend output.glb")

ib.open_blend(sys.argv[1])
print("wrote", ib.export_glb(sys.argv[2]))
