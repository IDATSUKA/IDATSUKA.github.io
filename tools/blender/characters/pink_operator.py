"""ピンク×ホワイトのタクティカル衣装キャラクター「Pink Operator」と剣を
プロシージャルに生成し、GLB とレンダリング画像を書き出す。

    tools/blender/blender.sh tools/blender/characters/pink_operator.py [--quick]

出力: models/pink-operator/{pink-operator.glb, pink-operator-sword.glb, *.png, pink-operator.blend}
座標系: Z up、キャラクターは -Y を向く（カメラ側）。単位はメートル。
"""
from __future__ import annotations

import math
import random
import sys

import bpy
import bmesh
from mathutils import Vector, Euler

import idk_blender as ib

QUICK = "--quick" in sys.argv
OUT = "models/pink-operator"
random.seed(7)
scene = ib.reset_scene()

# ----------------------------------------------------------------- palette --
WHITE = ib.hex_color("#f6f4f6")
WHITE_SOFT = ib.hex_color("#ece8ec")
PINK = ib.hex_color("#f4a3c7")
PINK_DEEP = ib.hex_color("#ef8fbb")
GREY = ib.hex_color("#7a7a80")
DARK = ib.hex_color("#3a3a40")
SKIN = ib.hex_color("#f3cdb6")
HAIR_BLONDE = ib.hex_color("#ecd2b4")
HAIR_PINK = ib.hex_color("#f79fcf")
EYE_PINK = ib.hex_color("#e26aa8")
LIP = ib.hex_color("#e8a0b4")

MATS: dict[str, bpy.types.Material] = {}


def mat(name, color, metallic=0.0, roughness=0.5, emission=None, strength=1.0):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = color
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Roughness"].default_value = roughness
    if emission is not None:
        b.inputs["Emission Color"].default_value = emission
        b.inputs["Emission Strength"].default_value = strength
    MATS[name] = m
    return m


M_WHITE = mat("Fabric White", WHITE, roughness=0.6)
M_WHITE_GLOSS = mat("Armor White", WHITE, roughness=0.3)
M_KNIT = mat("Knit White", WHITE_SOFT, roughness=0.85)
M_PINK = mat("Fabric Pink", PINK, roughness=0.55)
M_PINK_GLOSS = mat("Armor Pink", PINK_DEEP, roughness=0.3)
M_GREY = mat("Metal Grey", ib.hex_color("#9a9aa2"), metallic=0.9, roughness=0.35)
M_SILVER = mat("Metal Silver", ib.hex_color("#d8d8de"), metallic=1.0, roughness=0.25)
M_DARK = mat("Rubber Dark", DARK, roughness=0.8)
M_SKIN = mat("Skin", SKIN, roughness=0.55)
M_EYE_W = mat("Eye White", ib.hex_color("#ffffff"), roughness=0.2)
M_EYE = mat("Eye Pink", EYE_PINK, roughness=0.2)
M_PUPIL = mat("Pupil", ib.hex_color("#2a1a24"), roughness=0.3)
M_LIP = mat("Lip", LIP, roughness=0.4)
M_BROW = mat("Brow", ib.hex_color("#b58a6a"), roughness=0.8)
M_GLOW = mat("Pink Glow", PINK, emission=ib.hex_color("#ff7fc8"), strength=12.0)
M_CORE = mat("Core Glow", ib.hex_color("#ffd6ec"), emission=ib.hex_color("#ff8ad0"), strength=10.0)

# ------------------------------------------------------------ collections --
COL_CHAR = bpy.data.collections.new("PinkOperator")
COL_SWORD = bpy.data.collections.new("Sword")
scene.collection.children.link(COL_CHAR)
scene.collection.children.link(COL_SWORD)
COL = COL_CHAR


def _link(obj):
    COL.objects.link(obj)
    return obj


def _finish(obj, name, loc, rot, scale, material, bevel, subsurf, smooth):
    obj.name = name
    obj.location = loc
    obj.rotation_euler = Euler(rot)
    obj.scale = scale
    if material is not None:
        obj.data.materials.append(material)
    if bevel:
        b = obj.modifiers.new("Bevel", "BEVEL")
        b.width = bevel
        b.segments = 3
        b.limit_method = "ANGLE"
    if subsurf:
        s = obj.modifiers.new("Subdiv", "SUBSURF")
        s.levels = s.render_levels = subsurf
    if smooth:
        for p in obj.data.polygons:
            p.use_smooth = True
    return obj


def cube(name, loc, size=(1, 1, 1), rot=(0, 0, 0), material=M_WHITE, bevel=0.0, subsurf=0, smooth=False):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bm.to_mesh(me)
    bm.free()
    obj = _link(bpy.data.objects.new(name, me))
    return _finish(obj, name, loc, rot, size, material, bevel, subsurf, smooth)


def sphere(name, loc, radius=1.0, scale=(1, 1, 1), rot=(0, 0, 0), material=M_WHITE, segments=32, rings=16):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings, radius=radius)
    bm.to_mesh(me)
    bm.free()
    obj = _link(bpy.data.objects.new(name, me))
    return _finish(obj, name, loc, rot, scale, material, 0, 0, True)


def cyl(name, loc, radius=1.0, depth=1.0, rot=(0, 0, 0), scale=(1, 1, 1), material=M_WHITE,
        segments=32, radius2=None, bevel=0.0, smooth=True, cap=True):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=cap, cap_tris=False, segments=segments,
                          radius1=radius, radius2=radius if radius2 is None else radius2, depth=depth)
    bm.to_mesh(me)
    bm.free()
    obj = _link(bpy.data.objects.new(name, me))
    return _finish(obj, name, loc, rot, scale, material, bevel, 0, smooth)


def torus(name, loc, major=1.0, minor=0.1, rot=(0, 0, 0), scale=(1, 1, 1), material=M_WHITE, segments=48, rings=12):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    # 手動トーラス
    verts = []
    for i in range(segments):
        a = math.tau * i / segments
        ring = []
        for j in range(rings):
            b = math.tau * j / rings
            r = major + minor * math.cos(b)
            ring.append(bm.verts.new((r * math.cos(a), r * math.sin(a), minor * math.sin(b))))
        verts.append(ring)
    for i in range(segments):
        for j in range(rings):
            v1 = verts[i][j]
            v2 = verts[(i + 1) % segments][j]
            v3 = verts[(i + 1) % segments][(j + 1) % rings]
            v4 = verts[i][(j + 1) % rings]
            bm.faces.new((v1, v2, v3, v4))
    bm.to_mesh(me)
    bm.free()
    obj = _link(bpy.data.objects.new(name, me))
    return _finish(obj, name, loc, rot, scale, material, 0, 0, True)


def capsule(name, p0, p1, r0, r1=None, material=M_WHITE, segments=24):
    """p0→p1 を結ぶテーパー付きカプセル（脚・腕用）。"""
    r1 = r0 if r1 is None else r1
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    length = d.length
    rot = d.to_track_quat("Z", "Y").to_euler()
    body = cyl(name, (p0 + p1) / 2, radius=r0, depth=length, rot=rot, radius2=r1,
               material=material, segments=segments, cap=False)
    s0 = sphere(name + ".cap0", p0, radius=r0, material=material, segments=segments, rings=12)
    s1 = sphere(name + ".cap1", p1, radius=r1, material=material, segments=segments, rings=12)
    return body, s0, s1


def mirrored(fn, name, loc, *args, rot=(0, 0, 0), **kw):
    """x を反転して左右対称に 2 つ作る。"""
    a = fn(name + ".R", loc, *args, rot=rot, **kw)
    rl = (rot[0], -rot[1], -rot[2])
    b = fn(name + ".L", (-loc[0], loc[1], loc[2]), *args, rot=rl, **kw)
    return a, b


def curve_strand(name, points, radius, material, taper=(1.0, 0.35), resolution=12):
    """点列に沿ったチューブ（髪・紐）。先端は細くなる。"""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = radius
    cu.bevel_resolution = 4
    cu.resolution_u = resolution
    cu.use_fill_caps = True
    sp = cu.splines.new("NURBS")
    sp.points.add(len(points) - 1)
    n = len(points)
    for i, p in enumerate(points):
        t = i / max(n - 1, 1)
        w = taper[0] + (taper[1] - taper[0]) * t
        sp.points[i].co = (*p, 1.0)
        sp.points[i].radius = w
    sp.use_endpoint_u = True
    sp.order_u = min(4, n)
    obj = _link(bpy.data.objects.new(name, cu))
    cu.materials.append(material)
    return obj


def curve_to_mesh(obj):
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(obj.evaluated_get(dg))
    for p in me.polygons:
        p.use_smooth = True
    new = bpy.data.objects.new(obj.name, me)
    new.matrix_world = obj.matrix_world
    for m in obj.data.materials:
        me.materials.append(m)
    for c in obj.users_collection:
        c.objects.link(new)
        c.objects.unlink(obj)
    bpy.data.objects.remove(obj)
    return new


def arc_shell(name, center, rx, ry, height, open_angle, thickness, material=M_WHITE,
              segments=40, flare=1.0, bevel=0.006, subsurf=1):
    """前が開いた楕円筒シェル（ジャケット身頃用）。open_angle は前面の開き角（rad）。
    flare>1 で裾を外側へ広げる。"""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    a0 = -math.pi / 2 + open_angle / 2   # 前面 (-Y) を中心に開ける
    a1 = 3 * math.pi / 2 - open_angle / 2
    rows = []
    for zi, (z, f) in enumerate(((-height / 2, flare), (height / 2, 1.0))):
        row = []
        for i in range(segments + 1):
            a = a0 + (a1 - a0) * i / segments
            row.append(bm.verts.new((rx * f * math.cos(a), ry * f * math.sin(a), z)))
        rows.append(row)
    for i in range(segments):
        bm.faces.new((rows[0][i], rows[0][i + 1], rows[1][i + 1], rows[1][i]))
    bm.to_mesh(me)
    bm.free()
    obj = _link(bpy.data.objects.new(name, me))
    obj.location = center
    me.materials.append(material)
    so = obj.modifiers.new("Solidify", "SOLIDIFY")
    so.thickness = thickness
    so.offset = 0.0
    so.use_even_offset = True
    if bevel:
        b = obj.modifiers.new("Bevel", "BEVEL")
        b.width = bevel
        b.segments = 3
    if subsurf:
        sm = obj.modifiers.new("Subdiv", "SUBSURF")
        sm.levels = sm.render_levels = subsurf
    for p_ in me.polygons:
        p_.use_smooth = True
    return obj


def ribbon(name, points, width, thickness, material, taper=(1.0, 0.3), tilt=0.0, resolution=12):
    """平たい毛束（リボン状カーブ）。"""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.extrude = width / 2
    cu.bevel_depth = thickness
    cu.bevel_resolution = 2
    cu.resolution_u = resolution
    cu.use_fill_caps = True
    cu.twist_mode = "MINIMUM"
    sp = cu.splines.new("NURBS")
    sp.points.add(len(points) - 1)
    n = len(points)
    for i, p_ in enumerate(points):
        t = i / max(n - 1, 1)
        sp.points[i].co = (*p_, 1.0)
        sp.points[i].radius = taper[0] + (taper[1] - taper[0]) * t
        sp.points[i].tilt = tilt
    sp.use_endpoint_u = True
    sp.order_u = min(4, n)
    obj = _link(bpy.data.objects.new(name, cu))
    cu.materials.append(material)
    return obj


# ================================================================== BODY ====
# 主要な高さ（m）
Z_SOLE, Z_KNEE, Z_HIP, Z_WAIST, Z_CHEST, Z_SHOULDER, Z_CHIN, Z_HEAD = 0.05, 0.56, 0.96, 1.12, 1.33, 1.47, 1.53, 1.64
HIP_X, SHOULDER_X = 0.09, 0.2

# --- 頭部 ---
head = sphere("Head", (0, 0, Z_HEAD), 0.105, scale=(0.92, 1.0, 1.12), material=M_SKIN)
jaw = sphere("Jaw", (0, -0.01, Z_HEAD - 0.06), 0.08, scale=(0.9, 0.9, 0.75), material=M_SKIN)
neck = cyl("Neck", (0, 0.01, Z_CHIN - 0.03), 0.045, 0.12, material=M_SKIN)
mirrored(sphere, "Ear", (0.098, 0.005, Z_HEAD - 0.01), 0.022, scale=(0.5, 0.8, 1.0), material=M_SKIN)
# 目
mirrored(sphere, "EyeWhite", (0.04, -0.088, Z_HEAD + 0.005), 0.02, scale=(1.0, 0.6, 0.75), material=M_EYE_W)
mirrored(sphere, "Iris", (0.04, -0.101, Z_HEAD + 0.005), 0.0115, scale=(1.0, 0.35, 1.15), material=M_EYE)
mirrored(sphere, "Pupil", (0.04, -0.1045, Z_HEAD + 0.005), 0.006, scale=(1.0, 0.35, 1.2), material=M_PUPIL)
mirrored(cube, "Lash", (0.04, -0.097, Z_HEAD + 0.023), size=(0.045, 0.01, 0.006), rot=(0.3, 0, 0), material=M_PUPIL)
mirrored(cube, "Brow", (0.042, -0.096, Z_HEAD + 0.045), size=(0.042, 0.008, 0.006), rot=(0.2, 0, 0.15), material=M_BROW)
sphere("Nose", (0, -0.107, Z_HEAD - 0.025), 0.012, scale=(0.8, 0.8, 1.3), material=M_SKIN)
sphere("Lips", (0, -0.1, Z_HEAD - 0.058), 0.017, scale=(1.3, 0.6, 0.55), material=M_LIP)
mirrored(torus, "Earring", (0.105, 0.005, Z_HEAD - 0.06), major=0.03, minor=0.003, rot=(0, math.pi / 2, 0), material=M_SILVER)

# --- 髪 ---
M_HAIR = mat("Hair", HAIR_BLONDE, roughness=0.4)
nt = M_HAIR.node_tree
attr = nt.nodes.new("ShaderNodeVertexColor")
attr.layer_name = "Col"
nt.links.new(attr.outputs["Color"], nt.nodes["Principled BSDF"].inputs["Base Color"])

hair_objs = []
skull = sphere("HairCap", (0, 0.012, Z_HEAD + 0.012), 0.114, scale=(0.97, 1.02, 1.08), material=M_HAIR)
hair_objs.append(skull)
# 前髪：センター分けで左右に流れる薄い毛束
for side in (-1, 1):
    for k in range(4):
        t0 = k / 3
        x_end = side * (0.03 + 0.07 * t0)
        z_end = Z_HEAD + 0.05 - 0.03 * t0 - (0.035 if k == 3 else 0)
        pts = [(side * 0.004, -0.03, Z_HEAD + 0.118),
               (side * (0.012 + 0.02 * t0), -0.092, Z_HEAD + 0.1),
               (x_end * 0.85, -0.108, Z_HEAD + 0.078),
               (x_end, -0.1 + 0.012 * t0, z_end)]
        hair_objs.append(ribbon(f"Bang{side}{k}", pts, 0.028, 0.004, M_HAIR, taper=(1.0, 0.5), tilt=side * 0.6))
# 顔横〜胸元までのウェーブ毛束（リボン）
for side in (-1, 1):
    for k in range(5):
        base_x = side * (0.08 + 0.012 * k)
        base_y = -0.05 + 0.025 * k
        ph = random.random() * math.tau
        length = random.uniform(0.5, 0.66)
        amp = random.uniform(0.02, 0.035)
        pts = [(base_x * 0.9, base_y, Z_HEAD + 0.1)]
        for j in range(10):
            t = j / 9
            z = Z_HEAD + 0.05 - t * length
            wob = amp * math.sin(t * 9 + ph)
            x = base_x + side * (0.03 + 0.05 * t) + wob * 0.7
            y = base_y + 0.02 + t * 0.03 + wob
            pts.append((x, y, z))
        hair_objs.append(ribbon(f"SideStrand{side}{k}", pts, random.uniform(0.028, 0.04), 0.006, M_HAIR, taper=(1.0, 0.35), tilt=random.uniform(-0.5, 0.5)))
# ポニーテール（高い位置で結び、背中へ大きなウェーブで落ちる）
PONY = Vector((0, 0.095, Z_HEAD + 0.095))
torus("Scrunchie", PONY + Vector((0, 0.01, 0.0)), major=0.024, minor=0.009, rot=(math.pi / 2 - 0.9, 0, 0), material=M_PINK)
for k in range(40):
    a = random.random() * math.tau
    r = random.uniform(0.004, 0.026)
    ph = random.random() * math.tau
    length = random.uniform(0.66, 0.82)
    amp = random.uniform(0.02, 0.04)
    pts = []
    for j in range(13):
        t = j / 12
        z = PONY.z + 0.06 * math.sin(t * math.pi * 0.7) - t * length
        y = PONY.y + 0.03 + t * 0.06 + amp * math.sin(t * 8 + ph)
        x = math.cos(a) * r * (1 + 4.5 * t) + amp * 1.3 * math.sin(t * 7 + ph * 1.3)
        pts.append((x, y + math.sin(a) * r * (1 + t), z))
    hair_objs.append(ribbon(f"Pony{k}", pts, random.uniform(0.035, 0.055), 0.007, M_HAIR, taper=(1.0, 0.45), tilt=random.uniform(-1, 1)))
cube("HairClipA", (-0.07, -0.075, Z_HEAD + 0.085), size=(0.03, 0.006, 0.008), rot=(0, 0.4, 0.5), material=M_PINK_GLOSS)
cube("HairClipB", (-0.082, -0.06, Z_HEAD + 0.07), size=(0.03, 0.006, 0.008), rot=(0, 0.4, 0.6), material=M_PINK_GLOSS)



def paint_hair_gradient(obj, z_top, z_bot):
    me = obj.data
    if "Col" not in me.color_attributes:
        me.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
    col = me.color_attributes["Col"]
    mw = obj.matrix_world
    for i, v in enumerate(me.vertices):
        z = (mw @ v.co).z
        t = min(1.0, max(0.0, (z_top - z) / (z_top - z_bot)))
        t = math.sqrt(t)
        c = [HAIR_BLONDE[i] * (1 - t) + HAIR_PINK[i] * t for i in range(3)] + [1.0]
        col.data[i].color = c


bpy.context.view_layer.update()
hair_meshes = []
for o in hair_objs:
    if o.type == "CURVE":
        o = curve_to_mesh(o)
    paint_hair_gradient(o, Z_SHOULDER - 0.05, Z_CHEST - 0.13)
    hair_meshes.append(o)

# --- 胴体（白いリブニット） ---
# リブ表現（レンダ用バンプ。GLB には出ない）
knt = M_KNIT.node_tree
wave = knt.nodes.new("ShaderNodeTexWave")
wave.inputs["Scale"].default_value = 90.0
wave.bands_direction = "Z"
bump = knt.nodes.new("ShaderNodeBump")
bump.inputs["Strength"].default_value = 0.25
knt.links.new(wave.outputs["Fac"], bump.inputs["Height"])
knt.links.new(bump.outputs["Normal"], knt.nodes["Principled BSDF"].inputs["Normal"])

chest = sphere("Chest", (0, 0.005, Z_CHEST), 0.135, scale=(1.05, 0.7, 0.95), material=M_KNIT)
mirrored(sphere, "Bust", (0.062, -0.07, Z_CHEST - 0.01), 0.064, scale=(1.0, 0.8, 0.95), material=M_KNIT)
waist = cyl("Waist", (0, 0, (Z_WAIST + Z_CHEST) / 2 - 0.02), 0.112, 0.24, scale=(1.0, 0.72, 1.0),
            radius2=0.135, material=M_KNIT)
hips = sphere("Hips", (0, 0, Z_HIP + 0.04), 0.14, scale=(1.05, 0.8, 0.7), material=M_WHITE)
turtle = cyl("Turtleneck", (0, 0.005, Z_CHIN - 0.04), 0.056, 0.09, material=M_KNIT)
# ペンダント
cube("PendantChain", (0, -0.07, Z_SHOULDER - 0.02), size=(0.09, 0.002, 0.002), material=M_SILVER)
cube("Pendant", (0, -0.08, Z_SHOULDER - 0.05), size=(0.02, 0.006, 0.02), rot=(0, 0, math.pi / 4), material=M_PINK_GLOSS, bevel=0.003)

# --- ジャケット（白、ショート丈、前開き、丸みのあるシルエット） ---
JZ = Z_CHEST + 0.03
JH = 0.23
arc_shell("JacketBody", (0, 0.01, JZ), 0.165, 0.125, JH, open_angle=0.75, thickness=0.03, material=M_WHITE, flare=1.06)
arc_shell("JacketHem", (0, 0.01, JZ - JH / 2 + 0.005), 0.168, 0.128, 0.022, open_angle=0.75, thickness=0.034, material=M_PINK, flare=1.06, bevel=0.003, subsurf=0)
arc_shell("Collar", (0, 0.02, Z_SHOULDER + 0.005), 0.1, 0.075, 0.035, open_angle=0.5, thickness=0.03, material=M_WHITE, bevel=0.004)
arc_shell("CollarTrim", (0, 0.02, Z_SHOULDER + 0.024), 0.1, 0.075, 0.006, open_angle=0.5, thickness=0.032, material=M_PINK, bevel=0.0, subsurf=0)
for sx in (-1, 1):
    # 前立て（ピンクのパイピング＋ジッパー）
    a = -math.pi / 2 + sx * 0.375
    fx, fy = 0.165 * math.cos(a), 0.01 + 0.125 * math.sin(a)
    cube(f"JacketTrim{sx}", (fx * 1.03, fy, JZ), size=(0.014, 0.036, JH), rot=(0, 0, a + math.pi / 2), material=M_PINK, bevel=0.003)
    cube(f"Zipper{sx}", (fx * 1.03, fy - 0.019, JZ), size=(0.005, 0.005, JH - 0.02), rot=(0, 0, a + math.pi / 2), material=M_SILVER)
    # 胸ポケット
    cube(f"ChestPocket{sx}", (sx * 0.125, -0.108, JZ + 0.04), size=(0.035, 0.008, 0.03), rot=(0, 0, sx * 0.55), material=M_WHITE_GLOSS, bevel=0.003)
    cube(f"ChestPocketTrim{sx}", (sx * 0.125, -0.112, JZ + 0.052), size=(0.036, 0.006, 0.008), rot=(0, 0, sx * 0.55), material=M_PINK)
cube("JacketBackPanel", (0, 0.152, JZ + 0.02), size=(0.19, 0.01, 0.15), material=M_WHITE_GLOSS, bevel=0.004)
cube("JacketBackPanelTrim", (0, 0.158, JZ + 0.02), size=(0.16, 0.004, 0.12), material=M_PINK)
# ハーネスストラップ（胸）
for sx in (-1, 1):
    cube(f"ChestStrap{sx}", (sx * 0.05, -0.108, Z_CHEST - 0.06), size=(0.026, 0.006, 0.34), rot=(0.12, 0, sx * 0.05), material=M_PINK)
    cube(f"ChestStrapBuckle{sx}", (sx * 0.05, -0.116, Z_CHEST + 0.03), size=(0.032, 0.006, 0.02), material=M_SILVER)
    cube(f"BackStrap{sx}", (sx * 0.055, 0.152, Z_CHEST - 0.02), size=(0.026, 0.006, 0.3), material=M_PINK)
# 肩アーマー
for sx in (-1, 1):
    base = (sx * 0.225, 0.0, Z_SHOULDER + 0.005)
    rot = (0, sx * 1.1, 0)
    cyl(f"ShoulderPlate{sx}", base, 0.062, 0.03, rot=rot, material=M_WHITE_GLOSS, segments=8, bevel=0.005)
    cyl(f"ShoulderRing{sx}", (sx * 0.242, 0.0, Z_SHOULDER + 0.014), 0.045, 0.012, rot=rot, material=M_PINK_GLOSS, segments=32)
    cyl(f"ShoulderCore{sx}", (sx * 0.25, 0.0, Z_SHOULDER + 0.018), 0.022, 0.01, rot=rot, material=M_GREY, segments=24)
    for i in range(6):
        a = math.tau * i / 6
        cyl(f"ShoulderBolt{sx}{i}", (sx * 0.243, 0.05 * math.sin(a), Z_SHOULDER + 0.015 + 0.05 * math.cos(a) * 0.45), 0.004, 0.006, rot=rot, material=M_SILVER, segments=8)

# --- 腕 ---
for sx in (-1, 1):
    sh = Vector((sx * SHOULDER_X, 0.0, Z_SHOULDER - 0.02))
    elbow = Vector((sx * 0.27, 0.02, 1.17))
    wrist = Vector((sx * 0.31, 0.0, 0.86))
    # 上腕：パフスリーブ
    capsule(f"Sleeve{sx}", sh, elbow + Vector((0, 0, 0.02)), 0.068, 0.066, material=M_WHITE)
    cyl(f"Cuff{sx}", elbow + Vector((sx * 0.004, 0, -0.02)), 0.055, 0.05, rot=(elbow - sh).to_track_quat("Z", "Y").to_euler(), material=M_PINK)
    cyl(f"CuffTrim{sx}", elbow + Vector((sx * 0.006, 0, -0.04)), 0.052, 0.012, rot=(elbow - sh).to_track_quat("Z", "Y").to_euler(), material=M_WHITE)
    # 前腕：素肌 + ガントレット
    rot = (wrist - elbow).to_track_quat("Z", "Y").to_euler()
    capsule(f"Forearm{sx}", elbow, wrist, 0.045, 0.036, material=M_SKIN)
    mid = (elbow + wrist) / 2
    cyl(f"Gauntlet{sx}", mid + Vector((0, 0, 0.02)), 0.052, 0.2, rot=rot, radius2=0.046, material=M_WHITE_GLOSS, bevel=0.004)
    cube(f"GauntletPlate{sx}", mid + Vector((sx * 0.048, 0.0, 0.03)), size=(0.012, 0.03, 0.11), rot=rot, material=M_GREY, bevel=0.004)
    cube(f"GauntletPlatePink{sx}", mid + Vector((sx * 0.055, 0.0, 0.03)), size=(0.006, 0.028, 0.1), rot=rot, material=M_PINK_GLOSS)
    for dz in (-0.075, 0.09):
        cyl(f"GauntletRing{sx}{dz}", mid + Vector((0, 0, dz + 0.02)), 0.05 if dz < 0 else 0.056, 0.018, rot=rot, material=M_PINK, segments=32)
    # 手（フィンガーレスグローブ）
    hand_c = wrist + Vector((sx * 0.01, 0, -0.045))
    cube(f"Glove{sx}", hand_c, size=(0.075, 0.03, 0.08), rot=(0.05, 0, 0), material=M_WHITE_GLOSS, bevel=0.012, subsurf=1)
    cube(f"GloveTrim{sx}", hand_c + Vector((0, 0, 0.038)), size=(0.078, 0.033, 0.014), material=M_PINK, bevel=0.005)
    cube(f"Knuckle{sx}", hand_c + Vector((0, -0.017, -0.02)), size=(0.06, 0.006, 0.02), material=M_PINK_GLOSS, bevel=0.002)
    for i in range(4):
        fx = hand_c.x + (i - 1.5) * 0.017
        capsule(f"Finger{sx}{i}", (fx, hand_c.y, hand_c.z - 0.035), (fx, hand_c.y - 0.005, hand_c.z - 0.085 - (0.01 if i in (1, 2) else 0)), 0.007, 0.0065, material=M_SKIN, segments=10)
    capsule(f"Thumb{sx}", hand_c + Vector((sx * -0.035, -0.01, -0.01)), hand_c + Vector((sx * -0.05, -0.025, -0.045)), 0.008, 0.007, material=M_SKIN, segments=10)

# --- ベルト ---
belt = torus("Belt", (0, 0.0, Z_HIP + 0.075), major=0.145, minor=0.02, scale=(1.0, 0.82, 1.0), material=M_WHITE)
torus("BeltPinkA", (0, 0.0, Z_HIP + 0.09), major=0.147, minor=0.007, scale=(1.0, 0.82, 1.0), material=M_PINK)
torus("BeltPinkB", (0, 0.0, Z_HIP + 0.06), major=0.147, minor=0.007, scale=(1.0, 0.82, 1.0), material=M_PINK)
cube("Buckle", (0, -0.13, Z_HIP + 0.075), size=(0.05, 0.012, 0.045), material=M_SILVER, bevel=0.004)
cube("BuckleInner", (0, -0.137, Z_HIP + 0.075), size=(0.03, 0.006, 0.026), material=M_PINK_GLOSS)
for i, a in enumerate((0.55, 0.95, -0.55, -0.95, 2.4, -2.4, 2.9, -2.9)):
    x, y = 0.142 * math.sin(a), -0.118 * math.cos(a)
    cube(f"BeltPouch{i}", (x, y, Z_HIP + 0.05), size=(0.045, 0.03, 0.06), rot=(0, 0, -a), material=M_WHITE, bevel=0.006)
    cube(f"BeltPouchFlap{i}", (x * 1.06, y * 1.06, Z_HIP + 0.072), size=(0.047, 0.032, 0.016), rot=(0, 0, -a), material=M_PINK, bevel=0.003)
    cube(f"BeltPouchSnap{i}", (x * 1.12, y * 1.12, Z_HIP + 0.05), size=(0.006, 0.004, 0.006), rot=(0, 0, -a), material=M_SILVER)

# --- 脚（パンツ） ---
for sx in (-1, 1):
    hip = Vector((sx * HIP_X, 0.0, Z_HIP))
    knee = Vector((sx * 0.1, -0.01, Z_KNEE))
    ankle = Vector((sx * 0.1, 0.0, 0.16))
    capsule(f"Thigh{sx}", hip + Vector((0, 0, 0.03)), knee, 0.084, 0.072, material=M_WHITE)
    # ふくらはぎはパフ状に膨らむ
    capsule(f"Shin{sx}", knee - Vector((0, 0, 0.02)), ankle + Vector((0, 0, 0.1)), 0.082, 0.08, material=M_WHITE)
    cyl(f"ShinBand{sx}", ankle + Vector((0, 0, 0.11)), 0.078, 0.03, material=M_PINK, segments=32)
    # 外側のピンクライン
    cube(f"ThighStripe{sx}", (sx * 0.172, -0.01, (Z_HIP + Z_KNEE) / 2 + 0.02), size=(0.02, 0.05, 0.34), rot=(0, sx * 0.02, 0), material=M_PINK, bevel=0.004)
    cube(f"ShinStripe{sx}", (sx * 0.172, 0.0, (Z_KNEE + 0.26) / 2 - 0.02), size=(0.018, 0.05, 0.28), material=M_PINK, bevel=0.004)
    cube(f"FrontStripe{sx}", (sx * 0.09, -0.078, (Z_HIP + Z_KNEE) / 2 + 0.04), size=(0.025, 0.02, 0.33), material=M_PINK, bevel=0.004)
    # 太ももストラップ
    for z in (Z_HIP - 0.08, Z_HIP - 0.19):
        torus(f"ThighStrap{sx}{z}", (sx * HIP_X, 0.0, z), major=0.082, minor=0.009, material=M_PINK)
        cube(f"ThighStrapBuckle{sx}{z}", (sx * 0.176, 0.0, z), size=(0.012, 0.025, 0.022), material=M_SILVER, bevel=0.002)
    # 膝パッド（六角形、ピンク縁＋グレー芯）
    kn = knee + Vector((0, -0.075, 0.0))
    krot = (math.pi / 2, 0, 0)
    cyl(f"KneePad{sx}", kn, 0.078, 0.035, rot=krot, material=M_WHITE_GLOSS, segments=6, bevel=0.006)
    cyl(f"KneePadRing{sx}", kn + Vector((0, -0.017, 0)), 0.062, 0.01, rot=krot, material=M_PINK_GLOSS, segments=6)
    cyl(f"KneePadCore{sx}", kn + Vector((0, -0.024, 0)), 0.04, 0.008, rot=krot, material=M_GREY, segments=6)
    cyl(f"KneePadTop{sx}", kn + Vector((0, -0.03, 0)), 0.02, 0.006, rot=krot, material=M_WHITE_GLOSS, segments=6)
    cube(f"KneeStrapU{sx}", knee + Vector((0, -0.02, 0.06)), size=(0.16, 0.14, 0.014), material=M_PINK)
    cube(f"KneeStrapL{sx}", knee + Vector((0, -0.02, -0.055)), size=(0.16, 0.14, 0.014), material=M_PINK)

# サイドポーチ（キャラクター左脚 = +X）
cube("ThighPouch", (0.19, -0.05, Z_HIP - 0.15), size=(0.06, 0.045, 0.09), rot=(0, 0, 0.2), material=M_WHITE, bevel=0.008)
cube("ThighPouchFlap", (0.19, -0.05, Z_HIP - 0.115), size=(0.064, 0.05, 0.028), rot=(0, 0, 0.2), material=M_PINK, bevel=0.004)
cube("ThighPouchSnap", (0.195, -0.078, Z_HIP - 0.13), size=(0.008, 0.005, 0.008), rot=(0, 0, 0.2), material=M_SILVER)
# ホルスター＋ピストル（キャラクター右脚 = -X）
cube("Holster", (-0.195, -0.01, Z_HIP - 0.14), size=(0.03, 0.06, 0.15), material=M_WHITE, bevel=0.006)
cube("HolsterStrap", (-0.195, -0.01, Z_HIP - 0.1), size=(0.034, 0.064, 0.02), material=M_PINK)
cube("PistolSlide", (-0.205, -0.03, Z_HIP - 0.04), size=(0.03, 0.045, 0.16), rot=(0.25, 0, 0), material=M_WHITE_GLOSS, bevel=0.004)
cube("PistolGrip", (-0.205, -0.005, Z_HIP - 0.0), size=(0.026, 0.09, 0.04), rot=(0.45, 0, 0), material=M_PINK_GLOSS, bevel=0.004)
cube("PistolTrigger", (-0.205, -0.045, Z_HIP - 0.02), size=(0.02, 0.03, 0.02), material=M_GREY, bevel=0.002)

# --- ブーツ ---
for sx in (-1, 1):
    bx = sx * 0.1
    cube(f"Sole{sx}", (bx, -0.02, 0.028), size=(0.13, 0.31, 0.055), material=M_PINK_GLOSS, bevel=0.012)
    cube(f"SoleTread{sx}", (bx, -0.02, 0.008), size=(0.135, 0.315, 0.016), material=M_PINK_GLOSS, bevel=0.004)
    cube(f"BootFoot{sx}", (bx, -0.045, 0.09), size=(0.115, 0.26, 0.08), material=M_WHITE_GLOSS, bevel=0.02, subsurf=1)
    cube(f"BootToe{sx}", (bx, -0.14, 0.08), size=(0.11, 0.07, 0.06), material=M_WHITE_GLOSS, bevel=0.02, subsurf=1)
    cube(f"BootShaft{sx}", (bx, 0.005, 0.22), size=(0.13, 0.15, 0.2), material=M_WHITE_GLOSS, bevel=0.02, subsurf=1)
    cube(f"BootTongue{sx}", (bx, -0.06, 0.2), size=(0.06, 0.03, 0.2), material=M_WHITE, bevel=0.008)
    # レース（ピンク）
    for i in range(5):
        z = 0.12 + i * 0.045
        cube(f"Lace{sx}{i}a", (bx, -0.078, z), size=(0.07, 0.006, 0.006), rot=(0, 0.35, 0), material=M_PINK)
        cube(f"Lace{sx}{i}b", (bx, -0.078, z), size=(0.07, 0.006, 0.006), rot=(0, -0.35, 0), material=M_PINK)
        mirrored(cyl, f"Eyelet{sx}{i}", (bx + 0.035, -0.075, z), 0.006, 0.006, rot=(math.pi / 2, 0, 0), material=M_SILVER, segments=10)
    # バックルストラップ
    for z in (0.25, 0.3):
        cube(f"BootStrap{sx}{z}", (bx, 0.005, z), size=(0.137, 0.157, 0.016), material=M_WHITE, bevel=0.003)
        cube(f"BootStrapPink{sx}{z}", (bx, 0.005, z), size=(0.139, 0.159, 0.006), material=M_PINK)
        cube(f"BootBuckle{sx}{z}", (bx + sx * 0.07, -0.02, z), size=(0.012, 0.03, 0.024), material=M_SILVER, bevel=0.002)

# ================================================================= SWORD ====
COL = COL_SWORD
SW = Vector((0.85, 0.0, 0.0))   # 剣の根元（刃先）を置く位置。垂直に立てる
BL = 0.88   # 刃の長さ
sword_root = bpy.data.objects.new("SwordRoot", None)
sword_root.empty_display_type = "PLAIN_AXES"
sword_root.location = SW
COL_SWORD.objects.link(sword_root)


def sword_part(*a, **k):
    return cube(*a, **k)


blade = cube("Blade", SW + Vector((0, 0, BL / 2 + 0.03)), size=(0.055, 0.012, BL), material=M_WHITE_GLOSS, bevel=0.002)
# 刃先をテーパー
me = blade.data
for v in me.vertices:
    if v.co.z < 0:
        v.co.x *= 0.15
        v.co.y *= 0.4
cube("BladeSpine", SW + Vector((-0.005, 0.0, BL / 2 + 0.1)), size=(0.018, 0.016, BL - 0.15), material=M_GREY, bevel=0.002)
edge = cube("BladeEdge", SW + Vector((0.027, 0.0, BL / 2 + 0.03)), size=(0.01, 0.014, BL - 0.02), material=M_GLOW)
for v in edge.data.vertices:
    if v.co.z < 0:
        v.co.y *= 0.3
for i, z in enumerate((0.2, 0.34, 0.5)):
    cube(f"BladeInlay{i}", SW + Vector((-0.008, -0.006, z)), size=(0.02, 0.004, 0.05), material=M_PINK_GLOSS)
cube("BladeSlot", SW + Vector((0.0, -0.006, 0.66)), size=(0.012, 0.004, 0.09), material=M_DARK)
# 鍔（メカ）
GZ = BL + 0.06
cube("GuardBase", SW + Vector((0, 0, GZ)), size=(0.12, 0.045, 0.08), material=M_WHITE_GLOSS, bevel=0.006)
cube("GuardPlateL", SW + Vector((-0.085, 0, GZ + 0.02)), size=(0.06, 0.03, 0.05), rot=(0, -0.45, 0), material=M_WHITE_GLOSS, bevel=0.005)
cube("GuardPlateR", SW + Vector((0.085, 0, GZ + 0.02)), size=(0.06, 0.03, 0.05), rot=(0, 0.45, 0), material=M_WHITE_GLOSS, bevel=0.005)
cube("GuardPinkL", SW + Vector((-0.092, -0.017, GZ + 0.025)), size=(0.035, 0.004, 0.03), rot=(0, -0.45, 0), material=M_PINK_GLOSS)
cube("GuardPinkR", SW + Vector((0.092, -0.017, GZ + 0.025)), size=(0.035, 0.004, 0.03), rot=(0, 0.45, 0), material=M_PINK_GLOSS)
torus("GuardRing", SW + Vector((0, 0, GZ + 0.005)), major=0.036, minor=0.011, rot=(math.pi / 2, 0, 0), material=M_PINK_GLOSS)
torus("GuardRingInner", SW + Vector((0, 0, GZ + 0.005)), major=0.028, minor=0.006, rot=(math.pi / 2, 0, 0), material=M_GREY)
sphere("Core", SW + Vector((0, 0, GZ + 0.005)), 0.024, material=M_CORE)
cube("GuardTopL", SW + Vector((-0.045, 0, GZ + 0.07)), size=(0.03, 0.03, 0.05), material=M_GREY, bevel=0.004)
cube("GuardTopR", SW + Vector((0.045, 0, GZ + 0.07)), size=(0.03, 0.03, 0.05), material=M_GREY, bevel=0.004)
cyl("GuardCollar", SW + Vector((0, 0, GZ + 0.09)), 0.028, 0.03, material=M_PINK_GLOSS, segments=32)
cyl("GuardCollar2", SW + Vector((0, 0, GZ + 0.11)), 0.024, 0.014, material=M_SILVER, segments=32)
# 柄（白×ピンクの巻き）
HZ = GZ + 0.12
cyl("Grip", SW + Vector((0, 0, HZ + 0.11)), 0.018, 0.22, material=M_WHITE, segments=24)
for i in range(7):
    torus(f"GripWrap{i}", SW + Vector((0, 0, HZ + 0.03 + i * 0.03)), major=0.018, minor=0.006, rot=(0.35, 0, 0), material=M_PINK)
cyl("PommelNeck", SW + Vector((0, 0, HZ + 0.235)), 0.02, 0.02, material=M_PINK_GLOSS, segments=24)
cyl("Pommel", SW + Vector((0, 0, HZ + 0.26)), 0.026, 0.03, material=M_SILVER, segments=24, bevel=0.003)
cyl("PommelCap", SW + Vector((0, 0, HZ + 0.28)), 0.022, 0.012, material=M_PINK_GLOSS, segments=24)

# ============================================================== SWORD ROOT ==
bpy.context.view_layer.update()
for o in list(COL_SWORD.objects):
    if o is not sword_root:
        o.parent = sword_root
        o.matrix_parent_inverse = sword_root.matrix_world.inverted()

# ================================================================== RIG =====
COL = COL_CHAR
arm_data = bpy.data.armatures.new("PinkOperatorRig")
arm = bpy.data.objects.new("PinkOperatorRig", arm_data)
COL_CHAR.objects.link(arm)
arm_data.display_type = "OCTAHEDRAL"
bpy.context.view_layer.objects.active = arm
arm.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")

PONY_BONES = 4


def pony_path(t):
    return PONY + Vector((0, 0.03 + 0.06 * t, 0.06 * math.sin(t * math.pi * 0.7) - 0.74 * t))


BONES = {
    "root": ((0, 0, 0), (0, 0.15, 0), None),
    "hips": ((0, 0, Z_HIP), (0, 0, Z_WAIST), "root"),
    "spine": ((0, 0, Z_WAIST), (0, 0, Z_CHEST), "hips"),
    "chest": ((0, 0, Z_CHEST), (0, 0, Z_SHOULDER), "spine"),
    "neck": ((0, 0, Z_SHOULDER), (0, 0.005, Z_CHIN + 0.02), "chest"),
    "head": ((0, 0.005, Z_CHIN + 0.02), (0, 0.01, Z_HEAD + 0.13), "neck"),
}
for i in range(PONY_BONES):
    BONES[f"ponytail.{i:03d}"] = (tuple(pony_path(i / PONY_BONES)), tuple(pony_path((i + 1) / PONY_BONES)), "head" if i == 0 else f"ponytail.{i - 1:03d}")
for sx, suf in ((1, ".L"), (-1, ".R")):
    sh = (sx * SHOULDER_X, 0.0, Z_SHOULDER - 0.02)
    elbow = (sx * 0.27, 0.02, 1.17)
    wrist = (sx * 0.31, 0.0, 0.86)
    hip = (sx * HIP_X, 0.0, Z_HIP)
    knee = (sx * 0.1, -0.01, Z_KNEE)
    ankle = (sx * 0.1, 0.0, 0.16)
    BONES["shoulder" + suf] = ((sx * 0.03, 0.0, Z_SHOULDER - 0.02), sh, "chest")
    BONES["upper_arm" + suf] = (sh, elbow, "shoulder" + suf)
    BONES["forearm" + suf] = (elbow, wrist, "upper_arm" + suf)
    BONES["hand" + suf] = (wrist, (sx * 0.32, -0.005, 0.76), "forearm" + suf)
    BONES["thigh" + suf] = (hip, knee, "hips")
    BONES["shin" + suf] = (knee, ankle, "thigh" + suf)
    BONES["foot" + suf] = (ankle, (sx * 0.1, -0.13, 0.04), "shin" + suf)
    BONES["toe" + suf] = ((sx * 0.1, -0.13, 0.04), (sx * 0.1, -0.19, 0.03), "foot" + suf)

for name, (h, t, parent) in BONES.items():
    eb = arm_data.edit_bones.new(name)
    eb.head, eb.tail = h, t
    if parent:
        eb.parent = arm_data.edit_bones[parent]
        eb.use_connect = Vector(h) == Vector(BONES[parent][1])
bpy.ops.object.mode_set(mode="OBJECT")
arm.select_set(False)

BONE_SEG = {n: (Vector(h), Vector(t)) for n, (h, t, _) in BONES.items()}


def seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
    return (p - (a + ab * t)).length


def side(obj):
    return ".L" if obj.matrix_world.translation.x > 0.02 else ".R" if obj.matrix_world.translation.x < -0.02 else ""


def candidates(obj):
    """オブジェクト名から割り当て候補ボーンを決める。"""
    n = obj.name
    sd = side(obj)
    starts = lambda *ps: any(n.startswith(p_) for p_ in ps)
    if starts("Pony"):
        return [f"ponytail.{i:03d}" for i in range(PONY_BONES)] + ["head"]
    if starts("Scrunchie"):
        return ["head"]
    if starts("Head", "Jaw", "Ear", "Eye", "Iris", "Pupil", "Lash", "Brow", "Nose", "Lips", "HairCap", "Bang", "SideStrand", "HairClip"):
        return ["head"]
    if starts("Neck", "Turtleneck"):
        return ["neck"]
    if starts("Shoulder"):
        return ["shoulder" + (".L" if obj.matrix_world.translation.x > 0 else ".R")]
    if starts("Sleeve", "Cuff"):
        return ["upper_arm" + sd, "forearm" + sd]
    if starts("Forearm", "Gauntlet"):
        return ["forearm" + sd]
    if starts("Glove", "Knuckle", "Finger", "Thumb"):
        return ["hand" + sd]
    if starts("Chest", "Bust", "Jacket", "Zipper", "Collar", "Pendant", "BackStrap"):
        return ["spine", "chest"]
    if starts("Waist"):
        return ["hips", "spine", "chest"]
    if starts("Hips", "Belt", "Buckle"):
        return ["hips"]
    if starts("Thigh", "FrontStripe", "Holster", "Pistol"):
        return ["thigh" + sd, "shin" + sd] if n.startswith("Thigh.") or n.startswith("Thigh-") else ["thigh" + sd]
    if starts("Knee"):
        return ["thigh" + sd, "shin" + sd]
    if starts("Shin"):
        return ["shin" + sd]
    if starts("Boot", "Sole", "Lace", "Eyelet"):
        return ["shin" + sd, "foot" + sd, "toe" + sd]
    return ["hips"]


def skin(obj):
    cands = candidates(obj)
    for c in cands:
        if c not in obj.vertex_groups:
            obj.vertex_groups.new(name=c)
    mw = obj.matrix_world
    if len(cands) == 1:
        obj.vertex_groups[cands[0]].add(list(range(len(obj.data.vertices))), 1.0, "REPLACE")
    else:
        for v in obj.data.vertices:
            p = mw @ v.co
            ds = sorted(((seg_dist(p, *BONE_SEG[c]), c) for c in cands))[:2]
            (d1, c1), (d2, c2) = ds
            w1 = 1.0 / (d1 + 1e-4) ** 3
            w2 = 1.0 / (d2 + 1e-4) ** 3
            tot = w1 + w2
            obj.vertex_groups[c1].add([v.index], w1 / tot, "REPLACE")
            obj.vertex_groups[c2].add([v.index], w2 / tot, "REPLACE")
    obj.parent = arm
    obj.matrix_parent_inverse = arm.matrix_world.inverted()
    mod = obj.modifiers.new("Armature", "ARMATURE")
    mod.object = arm


# 名前の衝突を避けるため Thigh カプセル本体を判別しやすくする
for o in list(COL_CHAR.objects):
    if o.type == "MESH" and o.name.startswith("Thigh") and not o.name.startswith(("ThighStripe", "ThighStrap", "ThighPouch")):
        o.name = "Thigh." + o.name[len("Thigh"):]
for o in list(COL_CHAR.objects):
    if o.type == "MESH":
        skin(o)
bpy.context.view_layer.update()


def pose_bone_world_rot(name, axis, degrees):
    """ボーンをレスト姿勢基準のワールド軸まわりに回転させる。"""
    pb = arm.pose.bones[name]
    pb.rotation_mode = "QUATERNION"
    R = (arm.matrix_world @ arm.data.bones[name].matrix_local).to_3x3()
    Q = Euler([math.radians(degrees) if a == axis else 0 for a in "XYZ"]).to_matrix()
    pb.rotation_quaternion = (R.inverted() @ Q @ R).to_quaternion() @ pb.rotation_quaternion


def reset_pose():
    for pb in arm.pose.bones:
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)

# =============================================================== RENDER =====
world = bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs["Color"].default_value = (0.9, 0.9, 0.92, 1.0)
bg.inputs["Strength"].default_value = 0.35

ib.add_sun(direction=(0.4, 0.5, -1.0), energy=1.6)
key = ib.add_point_light((-1.8, -2.5, 2.4), energy=350, name="Key")
fill = ib.add_point_light((2.2, -2.0, 1.4), energy=120, name="Fill")
rim = ib.add_point_light((0.5, 2.5, 2.2), energy=250, name="Rim")
for l in (key, fill, rim):
    l.data.shadow_soft_size = 0.6

samples = 8 if QUICK else 48
size = (400, 600) if QUICK else (800, 1200)
ib.setup_render(width=size[0], height=size[1], samples=samples, transparent=True)
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"


def composite_white(path, bg=(0.94, 0.94, 0.95)):
    """透過 PNG を白系背景に合成して上書き保存する。"""
    import numpy as np
    img = bpy.data.images.load(path)
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(-1, 4)
    a = px[:, 3:4]
    rgb = px[:, :3] * a + np.array(bg, dtype=np.float32) * (1 - a)
    out = np.concatenate([rgb, np.ones_like(a)], axis=1).ravel()
    img.pixels.foreach_set(out)
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)

CENTER = Vector((0, 0, 0.9))
SWORD_HIDE = list(COL_SWORD.objects)
CHAR_HIDE = list(COL_CHAR.objects)


def shot(name, cam_loc, target=CENTER, lens=70, hide_sword=True, hide_char=None):
    cam = ib.add_camera(location=cam_loc, look_at=target, lens=lens, name=f"Cam.{name}")
    for o in SWORD_HIDE:
        o.hide_render = hide_sword
    for o in CHAR_HIDE:
        o.hide_render = (not hide_sword) if hide_char is None else hide_char
    composite_white(ib.render(f"{OUT}/{name}.png"))
    bpy.data.objects.remove(cam)


D = 4.2
shot("front", (0, -D, 0.95))
shot("back", (0, D, 0.95))
shot("side", (-D, 0, 0.95))
shot("three-quarter", (-3.2, -3.3, 1.3))
shot("sword", (0.85, -2.8, 0.75), target=Vector((0.85, 0, 0.72)), lens=70, hide_sword=False)

# --- ポーズテスト（剣を構える） ---
pose_bone_world_rot("spine", "Z", 10)
pose_bone_world_rot("head", "Z", 18)
pose_bone_world_rot("head", "X", -6)
pose_bone_world_rot("upper_arm.R", "X", -65)
pose_bone_world_rot("upper_arm.R", "Y", 20)
pose_bone_world_rot("forearm.R", "X", -55)
pose_bone_world_rot("upper_arm.L", "Y", -30)
pose_bone_world_rot("forearm.L", "X", -25)
pose_bone_world_rot("thigh.L", "X", -25)
pose_bone_world_rot("shin.L", "X", 30)
pose_bone_world_rot("thigh.R", "X", 8)
for i in range(PONY_BONES):
    pose_bone_world_rot(f"ponytail.{i:03d}", "X", 12)
bpy.context.view_layer.update()
# 剣を右手に持たせる
pb = arm.pose.bones["hand.R"]
hand_m = arm.matrix_world @ pb.matrix
hand_c = hand_m @ Vector((0, 0.04, 0))
blade_dir = Vector((-0.25, -0.25, 1.0)).normalized()
rot = (-blade_dir).to_track_quat("Z", "Y")
sword_root.rotation_euler = rot.to_euler()
sword_root.location = hand_c - rot.to_matrix() @ Vector((0, 0, HZ + 0.11))
bpy.context.view_layer.update()
shot("pose", (-3.0, -4.3, 1.7), target=Vector((0, 0, 1.05)), lens=55, hide_sword=False, hide_char=False)
reset_pose()
sword_root.rotation_euler = (0, 0, 0)
sword_root.location = SW
bpy.context.view_layer.update()
for o in SWORD_HIDE + CHAR_HIDE:
    o.hide_render = False

# =============================================================== EXPORT =====
def export_collection(col, path):
    for o in bpy.data.objects:
        o.select_set(o.name in col.objects)
    bpy.context.view_layer.update()
    ib.export_glb(path, selected_only=True)


export_collection(COL_CHAR, f"{OUT}/pink-operator.glb")
sword_root.location = (0, 0, 0)
bpy.context.view_layer.update()
export_collection(COL_SWORD, f"{OUT}/pink-operator-sword.glb")
sword_root.location = SW
if not QUICK:
    ib.save_blend(f"{OUT}/pink-operator.blend")
print("DONE")
