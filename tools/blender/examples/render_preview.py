"""サンプル: 立方体を並べたロゴ風オブジェクトを作り、PNG と GLB を出力する。

    tools/blender/blender.sh tools/blender/examples/render_preview.py [出力ディレクトリ]
"""
import sys

import bpy
import idk_blender as ib

out_dir = sys.argv[1] if len(sys.argv) > 1 else "tools/blender/out"

ib.reset_scene()

# 3x3 のキューブグリッド（中央は少し高く）
for x in range(-1, 2):
    for y in range(-1, 2):
        bpy.ops.mesh.primitive_cube_add(size=0.9, location=(x, y, 0.6 if (x, y) == (0, 0) else 0))
        cube = bpy.context.active_object
        ib.add_material(cube, color=ib.hex_color("#111111") if (x + y) % 2 else ib.hex_color("#f5f5f5"),
                        roughness=0.35)

# 床
bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, -0.45))
ib.add_material(bpy.context.active_object, color=ib.hex_color("#e9e9e9"), roughness=0.9)

ib.add_camera(location=(5, -6, 4.5), look_at=(0, 0, 0), lens=45)
ib.add_sun(direction=(0.5, 0.4, -1.0), energy=4)
ib.add_point_light(location=(-4, -3, 5), energy=600)

ib.setup_render(width=800, height=600, samples=32)
png = ib.render(f"{out_dir}/preview.png")
glb = ib.export_glb(f"{out_dir}/preview.glb")
print("wrote", png, glb)
