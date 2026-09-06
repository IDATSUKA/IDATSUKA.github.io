"""IDATSUKA.github.io 用の Blender (bpy) ヘルパー。

使い方（tools/blender/blender.sh 経由で実行すると自動で import できる）:

    import bpy
    import idk_blender as ib

    ib.reset_scene()
    bpy.ops.mesh.primitive_monkey_add()
    ib.add_camera(location=(0, -6, 2), look_at=(0, 0, 0))
    ib.add_sun()
    ib.setup_render(width=800, height=600, samples=32, transparent=True)
    ib.render("img/preview.png")
    ib.export_glb("pinball/model.glb")

サイトのパスは ib.site_path("img/x.png") のようにリポジトリルート基準で解決できる。
"""
from __future__ import annotations

import math
import os
from pathlib import Path

import bpy
from mathutils import Vector

REPO_ROOT = Path(__file__).resolve().parents[2]


def site_path(rel: str | os.PathLike) -> str:
    """リポジトリルート基準の相対パスを絶対パスにする（親ディレクトリも作成）。"""
    p = Path(rel)
    if not p.is_absolute():
        p = REPO_ROOT / p
    p.parent.mkdir(parents=True, exist_ok=True)
    return str(p)


# ---------------------------------------------------------------- scene ----
def reset_scene() -> bpy.types.Scene:
    """空のシーンから始める（既定のキューブ・ライト・カメラを消す）。"""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    return bpy.context.scene


def link(obj: bpy.types.Object) -> bpy.types.Object:
    bpy.context.scene.collection.objects.link(obj)
    return obj


def look_at(obj: bpy.types.Object, target) -> None:
    """obj の -Z 軸（カメラ/ライトの向き）を target に向ける。"""
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def add_camera(location=(0, -8, 4), look_at_point=(0, 0, 0), lens=50.0,
               name="Camera", look_at=None) -> bpy.types.Object:
    target = look_at if look_at is not None else look_at_point
    cam_data = bpy.data.cameras.new(name)
    cam_data.lens = lens
    cam = link(bpy.data.objects.new(name, cam_data))
    cam.location = location
    globals()["look_at"](cam, target)
    bpy.context.scene.camera = cam
    return cam


def add_sun(direction=(0.6, 0.3, -1.0), energy=3.0, name="Sun") -> bpy.types.Object:
    data = bpy.data.lights.new(name, "SUN")
    data.energy = energy
    sun = link(bpy.data.objects.new(name, data))
    sun.location = (0, 0, 10)
    d = Vector(direction)
    sun.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    return sun


def add_point_light(location=(4, -4, 6), energy=1000.0, name="Point") -> bpy.types.Object:
    data = bpy.data.lights.new(name, "POINT")
    data.energy = energy
    light = link(bpy.data.objects.new(name, data))
    light.location = location
    return light


def add_material(obj: bpy.types.Object, color=(0.8, 0.8, 0.8, 1.0), metallic=0.0,
                 roughness=0.5, emission=None, name="Material") -> bpy.types.Material:
    """Principled BSDF のシンプルなマテリアルを付ける。color は RGBA (0-1)。"""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if emission is not None:
        bsdf.inputs["Emission Color"].default_value = emission
        bsdf.inputs["Emission Strength"].default_value = 1.0
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)
    return mat


def hex_color(hex_str: str, alpha: float = 1.0):
    """'#RRGGBB' → リニア RGBA。style.css の色をそのまま使うのに便利。"""
    h = hex_str.lstrip("#")
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]

    def to_linear(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    return (*(to_linear(c) for c in srgb), alpha)


# --------------------------------------------------------------- render ----
def setup_render(width=1280, height=720, engine="CYCLES", samples=32,
                 transparent=False, denoise=True) -> bpy.types.Scene:
    """ヘッドレス向けの安全なレンダリング設定。engine は CYCLES / BLENDER_EEVEE / BLENDER_WORKBENCH。"""
    scene = bpy.context.scene
    scene.render.engine = engine
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = transparent
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA" if transparent else "RGB"
    if engine == "CYCLES":
        scene.cycles.device = "CPU"
        scene.cycles.samples = samples
        scene.cycles.use_denoising = denoise
    elif engine == "BLENDER_EEVEE":
        scene.eevee.taa_render_samples = samples
    return scene


def render(path: str, animation: bool = False) -> str:
    """静止画（または animation=True で連番）を path に書き出す。"""
    out = site_path(path)
    scene = bpy.context.scene
    scene.render.filepath = out
    bpy.ops.render.render(write_still=not animation, animation=animation)
    return out


# --------------------------------------------------------------- export ----
def export_glb(path: str, selected_only: bool = False, draco: bool = False) -> str:
    """three.js (pinball/ など) で読める glTF Binary を書き出す。"""
    out = site_path(path)
    kwargs = dict(filepath=out, export_format="GLB", use_selection=selected_only,
                  export_apply=True, export_yup=True)
    if draco:
        kwargs["export_draco_mesh_compression_enable"] = True
    bpy.ops.export_scene.gltf(**kwargs)
    return out


def export_obj(path: str, selected_only: bool = False) -> str:
    out = site_path(path)
    bpy.ops.wm.obj_export(filepath=out, export_selected_objects=selected_only)
    return out


def save_blend(path: str) -> str:
    out = site_path(path)
    bpy.ops.wm.save_as_mainfile(filepath=out)
    return out


def open_blend(path: str) -> None:
    bpy.ops.wm.open_mainfile(filepath=site_path(path))


def turntable(obj: bpy.types.Object, frames: int = 60) -> None:
    """obj を frames フレームで 1 回転させるキーフレームを打つ（連番レンダ用）。"""
    scene = bpy.context.scene
    scene.frame_start, scene.frame_end = 1, frames
    obj.rotation_euler = (0, 0, 0)
    obj.keyframe_insert("rotation_euler", frame=1)
    obj.rotation_euler = (0, 0, math.tau)
    obj.keyframe_insert("rotation_euler", frame=frames + 1)
    for fc in obj.animation_data.action.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = "LINEAR"
