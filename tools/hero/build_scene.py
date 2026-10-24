"""Builds the night reading-room scene and its camera move for the home page film.

Run headless from tools/hero:
  Blender -b --factory-startup -P build_scene.py -- --save hero.blend
  Blender -b --factory-startup -P build_scene.py -- --preview 1,50,95,125,150   (quick EEVEE stills)

Everything on the desk is Aaryav's real work: his two textbooks (covers built from their
cover art), an open book set with real chapter text, and a laptop showing EDAN's county map.
Models, textures and HDRI are CC0 from Poly Haven (see fetch_assets.py).
"""
import bpy, bmesh, math, os, sys, random
from mathutils import Vector, Matrix, noise

HERE = os.path.dirname(os.path.abspath(__file__))
A = os.path.join(HERE, 'assets')
TEX = os.path.join(HERE, 'tex')
OUT = os.path.join(HERE, 'out')
random.seed(7)

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(name, default=None):
    return args[args.index(name) + 1] if name in args else default

FRAMES = 200
PORTRAIT_FRAMES = 150
DESK = Vector((0.15, 1.38, 0.0))      # desk centre on the floor
TOP = 0.80                            # desk top height
BOOK = Vector((0.12, 1.24, TOP))      # open book centre (spine) on the desk
# The lamp's shade sits about 0.24 m out along its local +Y and 0.66 m up, opening forward and down
# (checked in a side render); turn the lamp so the shade faces the book.
LAMP_BASE = Vector((DESK.x + 0.5, DESK.y + 0.24, TOP))
_to_book = (BOOK - LAMP_BASE).normalized()
LAMP_ROT = math.atan2(-_to_book.x, _to_book.y)
LAMP_HEAD = LAMP_BASE + Vector((_to_book.x * 0.24, _to_book.y * 0.24, 0.62))


# ---------------------------------------------------------------- helpers
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.unit_settings.system = 'METRIC'
    return sc


def mat_image(name, path, rough=0.5, normal=None, rough_map=None, scale=None, emission=0.0, coat=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    img = nt.nodes.new('ShaderNodeTexImage')
    img.image = bpy.data.images.load(path)
    img.interpolation = 'Cubic'
    mp = None
    if scale:
        tc = nt.nodes.new('ShaderNodeTexCoord')
        mp = nt.nodes.new('ShaderNodeMapping')
        mp.inputs['Scale'].default_value = scale
        nt.links.new(tc.outputs['UV'], mp.inputs['Vector'])
        nt.links.new(mp.outputs['Vector'], img.inputs['Vector'])
    nt.links.new(img.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = rough
    if rough_map:
        r = nt.nodes.new('ShaderNodeTexImage'); r.image = bpy.data.images.load(rough_map)
        r.image.colorspace_settings.name = 'Non-Color'
        if mp: nt.links.new(mp.outputs['Vector'], r.inputs['Vector'])
        nt.links.new(r.outputs['Color'], bsdf.inputs['Roughness'])
    if normal:
        n = nt.nodes.new('ShaderNodeTexImage'); n.image = bpy.data.images.load(normal)
        n.image.colorspace_settings.name = 'Non-Color'
        if mp: nt.links.new(mp.outputs['Vector'], n.inputs['Vector'])
        nm = nt.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = 0.8
        nt.links.new(n.outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
    if emission:
        nt.links.new(img.outputs['Color'], bsdf.inputs['Emission Color'])
        bsdf.inputs['Emission Strength'].default_value = emission
    if coat:
        bsdf.inputs['Coat Weight'].default_value = coat
        bsdf.inputs['Coat Roughness'].default_value = 0.08
    return m


def mat_flat(name, color, rough=0.5, metal=0.0, emission=None, strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emission:
        b.inputs['Emission Color'].default_value = (*emission, 1)
        b.inputs['Emission Strength'].default_value = strength
    return m


def box(name, size, loc, mat=None, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        mod = o.modifiers.new('bevel', 'BEVEL'); mod.width = bevel; mod.segments = 3
    if mat:
        o.data.materials.append(mat)
    return o


def import_gltf(slug, res, loc=(0, 0, 0), rot_z=0.0, keep=None, scale=1.0):
    path = os.path.join(A, 'models', slug, f'{slug}_{res}.gltf')
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    if keep:
        for o in list(new):
            if o.type == 'MESH' and not any(k in o.name for k in keep):
                new.remove(o)
                bpy.data.objects.remove(o, do_unlink=True)
    roots = [o for o in new if o.parent is None]
    holder = bpy.data.objects.new(slug, None)
    bpy.context.scene.collection.objects.link(holder)
    for r in roots:
        r.parent = holder
    holder.location = loc
    holder.rotation_euler = (0, 0, rot_z)
    holder.scale = (scale, scale, scale)
    return holder, [o for o in new if o.type == 'MESH']


def uv_grid(name, nu, nv, fn, mat):
    """A smooth curved surface from fn(u, v) -> Vector, with 0..1 UVs."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    verts = [[bm.verts.new(fn(i / nu, j / nv)) for j in range(nv + 1)] for i in range(nu + 1)]
    uv = bm.loops.layers.uv.new()
    for i in range(nu):
        for j in range(nv):
            f = bm.faces.new((verts[i][j], verts[i + 1][j], verts[i + 1][j + 1], verts[i][j + 1]))
            for loop, (a, b) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                loop[uv].uv = (a / nu, b / nv)
    bm.normal_update()
    bm.to_mesh(me); bm.free()
    for p in me.polygons:
        p.use_smooth = True
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(mat)
    return o


# ---------------------------------------------------------------- scene
def build():
    sc = reset()
    t = lambda slug, f: os.path.join(A, 'textures', slug, f)

    # Room: plaster walls, worn plank floor, dark ceiling. The camera starts inside it.
    plaster = mat_image('plaster', t('plastered_wall_04', 'plastered_wall_04_diff_2k.jpg'), rough=0.9,
                        normal=t('plastered_wall_04', 'plastered_wall_04_nor_gl_2k.jpg'), scale=(2.2, 2.2, 1))
    floor = mat_image('floor', t('wood_floor_worn', 'wood_floor_worn_diff_2k.jpg'), rough=0.6,
                      rough_map=t('wood_floor_worn', 'wood_floor_worn_rough_2k.jpg'),
                      normal=t('wood_floor_worn', 'wood_floor_worn_nor_gl_2k.jpg'), scale=(2.5, 3.2, 1))
    X0, X1, Y0, Y1, Z1 = -2.1, 2.1, -3.6, 1.8, 2.7
    bpy.ops.mesh.primitive_plane_add(size=1, location=((X0 + X1) / 2, (Y0 + Y1) / 2, 0))
    fl = bpy.context.active_object; fl.scale = (X1 - X0, Y1 - Y0, 1); bpy.ops.object.transform_apply(scale=True)
    fl.data.materials.append(floor)
    box('ceiling', (X1 - X0, Y1 - Y0, 0.05), ((X0 + X1) / 2, (Y0 + Y1) / 2, Z1), mat_flat('ceil', (0.18, 0.17, 0.16), 0.9))
    box('wall_left', (0.1, Y1 - Y0, Z1), (X0 - 0.05, (Y0 + Y1) / 2, Z1 / 2), plaster)
    box('wall_right', (0.1, Y1 - Y0, Z1), (X1 + 0.05, (Y0 + Y1) / 2, Z1 / 2), plaster)
    box('wall_front', (X1 - X0, 0.1, Z1), ((X0 + X1) / 2, Y0 - 0.05, Z1 / 2), plaster)
    # back wall with a window above the desk
    wx0, wx1, wz0, wz1 = -0.45, 0.85, 1.12, 2.18
    box('wall_back_l', (wx0 - X0, 0.12, Z1), ((X0 + wx0) / 2, Y1 + 0.06, Z1 / 2), plaster)
    box('wall_back_r', (X1 - wx1, 0.12, Z1), ((wx1 + X1) / 2, Y1 + 0.06, Z1 / 2), plaster)
    box('wall_back_b', (wx1 - wx0, 0.12, wz0), ((wx0 + wx1) / 2, Y1 + 0.06, wz0 / 2), plaster)
    box('wall_back_t', (wx1 - wx0, 0.12, Z1 - wz1), ((wx0 + wx1) / 2, Y1 + 0.06, (wz1 + Z1) / 2), plaster)
    frame = mat_flat('window_frame', (0.55, 0.53, 0.5), 0.5)
    for x in (wx0, wx1, (wx0 + wx1) / 2):
        box('mullion', (0.04, 0.06, wz1 - wz0), (x, Y1 + 0.02, (wz0 + wz1) / 2), frame, 0.004)
    for z in (wz0, wz1, (wz0 + wz1) / 2):
        box('transom', (wx1 - wx0 + 0.04, 0.06, 0.04), ((wx0 + wx1) / 2, Y1 + 0.02, z), frame, 0.004)
    box('sill', (wx1 - wx0 + 0.16, 0.2, 0.035), ((wx0 + wx1) / 2, Y1 - 0.05, wz0 - 0.02), frame, 0.005)
    night = mat_flat('night', (0.01, 0.015, 0.03), 1.0, emission=(0.18, 0.26, 0.5), strength=0.05)
    bpy.ops.mesh.primitive_plane_add(size=1, location=((wx0 + wx1) / 2, Y1 + 0.6, (wz0 + wz1) / 2), rotation=(math.pi / 2, 0, 0))
    sky = bpy.context.active_object; sky.scale = (3, 2.4, 1); sky.data.materials.append(night)
    # a few far-off lights in the window, out of focus
    for _ in range(9):
        lx = random.uniform(wx0 + 0.05, wx1 - 0.05); lz = random.uniform(wz0 + 0.05, wz0 + 0.35)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.006, location=(lx, Y1 + 0.55, lz))
        s = bpy.context.active_object
        s.data.materials.append(mat_flat('citylight', (1, 0.8, 0.5), emission=(1, 0.75, 0.45), strength=random.uniform(3, 9)))
    base = mat_flat('baseboard', (0.75, 0.72, 0.67), 0.5)
    box('base_l', (0.02, Y1 - Y0, 0.12), (X0 + 0.01, (Y0 + Y1) / 2, 0.06), base, 0.003)
    box('base_b', (X1 - X0, 0.02, 0.12), ((X0 + X1) / 2, Y1 - 0.01, 0.06), base, 0.003)

    # Furniture
    desk, _ = import_gltf('wooden_table_02', '2k', loc=(DESK.x, DESK.y, 0))
    desk.scale = (1.35, 1.08, 1.0)  # a real student desk is about 1.5 m wide
    import_gltf('dining_chair_02', '1k', loc=(DESK.x + 0.05, DESK.y - 0.78, 0), rot_z=math.radians(180 + 18))
    SX, SY = X0 + 0.3, 0.55
    import_gltf('wooden_bookshelf_worn', '1k', loc=(SX, SY, 0), rot_z=math.radians(-90))
    # shelf board tops measured from the model: 0.108, 0.392, 0.672, 0.960, 1.277, 1.663 m
    for z, off, size in ((0.392, -0.33, 1.0), (0.392, 0.31, 0.95), (0.672, -0.05, 1.0), (0.96, -0.36, 0.97), (0.96, 0.3, 1.0), (1.277, 0.0, 1.02), (0.108, -0.2, 1.05)):
        import_gltf('book_encyclopedia_set_01', '1k', loc=(SX, SY + off, z), rot_z=math.radians(90), scale=size)
    import_gltf('potted_plant_04', '1k', loc=(SX, SY + 0.42, 1.663), scale=1.5)
    import_gltf('alarm_clock_01', '1k', loc=(SX, SY - 0.4, 1.663), rot_z=math.radians(80))

    # Desk lamp and props
    import_gltf('desk_lamp_arm_01', '2k', loc=(LAMP_BASE.x, LAMP_BASE.y, TOP), rot_z=LAMP_ROT)
    import_gltf('tea_set_01', '1k', loc=(DESK.x + 0.62, DESK.y - 0.24, TOP), keep=['cup_small_01', 'saucer_circular_03'])
    # the saucer comes out of the set offset from the cup; put it under the cup
    cup, sau = bpy.data.objects['tea_set_01_cup_small_01'], bpy.data.objects['tea_set_01_saucer_circular_03']
    bpy.context.view_layer.update()
    def _centre(o):
        cs = [o.matrix_world @ Vector(c) for c in o.bound_box]
        return Vector((sum(c.x for c in cs) / 8, sum(c.y for c in cs) / 8, max(c.z for c in cs)))
    d = _centre(cup) - _centre(sau)
    sau.matrix_world.translation += Vector((d.x, d.y, 0))
    cup.matrix_world.translation += Vector((0, 0, 0.012))
    import_gltf('stationery_supplies', '1k', loc=(DESK.x + 0.15, DESK.y + 0.25, TOP), rot_z=math.radians(-8), keep=['pencilcup', 'pencil_new_a', 'pencil_used', 'pen_fancy'])
    import_gltf('office_notepads', '1k', loc=(DESK.x - 0.27, DESK.y - 0.02, TOP), rot_z=math.radians(-14), keep=['yellow_pad'])

    build_open_book()
    build_textbooks()
    build_clutter()
    build_laptop()
    lights()
    world()
    return sc


def pencil(loc, rot, color=(0.85, 0.62, 0.08)):
    """A hexagonal pencil lying on the desk: painted body, ferrule, eraser, sharpened wood and graphite."""
    L, r = 0.165, 0.0037
    paint = mat_flat(f'pencil_paint', color, 0.35)
    parts = []
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=r, depth=L * 0.82, location=(0, 0, 0), rotation=(0, math.pi / 2, 0))
    body = bpy.context.active_object; body.data.materials.append(paint); parts.append(body)
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=r * 1.02, depth=0.011, location=(-L * 0.41 - 0.005, 0, 0), rotation=(0, math.pi / 2, 0))
    o = bpy.context.active_object; o.data.materials.append(mat_flat('ferrule', (0.75, 0.72, 0.6), 0.3, metal=1.0)); parts.append(o)
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=r * 0.98, depth=0.008, location=(-L * 0.41 - 0.0145, 0, 0), rotation=(0, math.pi / 2, 0))
    o = bpy.context.active_object; o.data.materials.append(mat_flat('eraser', (0.86, 0.45, 0.45), 0.7)); parts.append(o)
    bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=r, radius2=0.0006, depth=0.022, location=(L * 0.41 + 0.011, 0, 0), rotation=(0, math.pi / 2, 0))
    o = bpy.context.active_object; o.data.materials.append(mat_flat('wood', (0.82, 0.66, 0.46), 0.8)); parts.append(o)
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    body.location = (loc[0], loc[1], TOP + r * 0.87)
    body.rotation_euler = (0, 0, math.radians(rot))
    return body


def build_clutter():
    """What a real student's desk looks like at night."""
    paper = mat_flat('crumpled', (0.88, 0.86, 0.8), 0.92)
    tex_paper = mat_image('notes_print', os.path.join(TEX, 'page_left.jpg'), rough=0.7)
    # loose printed notes fanned under the open book
    for i, (dx, dy, rz) in enumerate(((-0.06, 0.04, 8), (0.05, 0.06, -6), (0.0, -0.02, 3))):
        bpy.ops.mesh.primitive_plane_add(size=1, location=(BOOK.x + dx, BOOK.y + dy, TOP + 0.0004 + i * 0.0003))
        sh = bpy.context.active_object; sh.scale = (0.21, 0.297, 1); bpy.ops.object.transform_apply(scale=True)
        sh.rotation_euler = (0, 0, math.radians(90 + rz)); sh.data.materials.append(tex_paper)
    # a stack of hardcovers in the back left corner
    cloth = [(0.42, 0.12, 0.1), (0.1, 0.2, 0.3), (0.15, 0.3, 0.2), (0.6, 0.5, 0.35), (0.2, 0.2, 0.22)]
    z = TOP
    for i, col in enumerate(cloth):
        t = random.uniform(0.022, 0.034)
        w, h = random.uniform(0.15, 0.19), random.uniform(0.21, 0.25)
        b = box(f'stack_{i}', (w, h, t), (DESK.x - 0.64, DESK.y + 0.2, z + t / 2), mat_flat(f'cloth_{i}', col, 0.7), 0.0012)
        b.rotation_euler = (0, 0, math.radians(random.uniform(-5, 5)))
        z += t
    # pencils and a pen scattered around
    pencil((BOOK.x + 0.21, BOOK.y - 0.12), 74)
    pencil((BOOK.x - 0.24, BOOK.y - 0.04), -18, (0.1, 0.32, 0.18))
    pencil((DESK.x + 0.2, DESK.y + 0.07), 151)
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.0048, depth=0.14, location=(BOOK.x - 0.02, BOOK.y - 0.16, TOP + 0.0048), rotation=(0, math.pi / 2, math.radians(12)))
    bpy.context.active_object.data.materials.append(mat_flat('pen', (0.03, 0.03, 0.04), 0.25))
    # open notebook with glasses on it
    import_gltf('binder_notebook', '2k', loc=(DESK.x - 0.6, DESK.y - 0.22, TOP), rot_z=math.radians(-8), keep=['binder_notebook'])
    import_gltf('round_spectacles', '1k', loc=(DESK.x - 0.56, DESK.y - 0.2, TOP + 0.012), rot_z=math.radians(25))
    # steel water bottle (lathe profile), powder-coated sage green with a steel cap
    prof = [(0.0, 0.0), (0.036, 0.0), (0.037, 0.004), (0.037, 0.2), (0.033, 0.225), (0.022, 0.238), (0.022, 0.25)]
    me = bpy.data.meshes.new('bottle'); bm = bmesh.new()
    rings = []
    for (r, zz) in prof:
        rings.append([bm.verts.new((r * math.cos(a), r * math.sin(a), zz)) for a in [k * 2 * math.pi / 48 for k in range(48)]])
    for a_, b_ in zip(rings, rings[1:]):
        for k in range(48):
            bm.faces.new((a_[k], a_[(k + 1) % 48], b_[(k + 1) % 48], b_[k]))
    bm.to_mesh(me); bm.free()
    for poly in me.polygons: poly.use_smooth = True
    bo = bpy.data.objects.new('bottle', me); bpy.context.scene.collection.objects.link(bo)
    coat = mat_flat('bottle_coat', (0.32, 0.42, 0.36), 0.42); bo.data.materials.append(coat)
    bo.location = (DESK.x + 0.66, DESK.y + 0.06, TOP)
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.025, depth=0.03, location=(DESK.x + 0.66, DESK.y + 0.06, TOP + 0.265))
    cap = bpy.context.active_object; cap.data.materials.append(mat_flat('steel', (0.7, 0.7, 0.72), 0.22, metal=1.0))
    cap.modifiers.new('bevel', 'BEVEL').width = 0.003
    # phone, face up, screen off
    ph = box('phone', (0.072, 0.152, 0.0078), (BOOK.x - 0.27, BOOK.y - 0.2, TOP + 0.0039), mat_flat('phone_body', (0.05, 0.05, 0.06), 0.3, metal=0.6), 0.004)
    ph.rotation_euler = (0, 0, math.radians(22))
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0.004))
    scr = bpy.context.active_object; scr.scale = (0.066, 0.146, 1); bpy.ops.object.transform_apply(scale=True)
    m = mat_flat('phone_glass', (0.005, 0.005, 0.008), 0.04); m.node_tree.nodes['Principled BSDF'].inputs['Coat Weight'].default_value = 1.0
    scr.data.materials.append(m); scr.parent = ph
    # crumpled paper: three on the desk, one on the floor
    for i, (x, y, zz, r) in enumerate(((DESK.x + 0.3, DESK.y + 0.3, TOP, 0.03), (DESK.x + 0.37, DESK.y + 0.34, TOP, 0.025), (DESK.x - 0.02, DESK.y + 0.32, TOP, 0.027), (DESK.x + 0.65, DESK.y - 0.55, 0.0, 0.032))):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=r, location=(x, y, zz + r * 0.8))
        ball = bpy.context.active_object
        ball.scale = (1.0, 0.92, 0.85)
        tx = bpy.data.textures.new(f'crumple_{i}', 'VORONOI'); tx.noise_scale = 0.018
        dm = ball.modifiers.new('crumple', 'DISPLACE'); dm.texture = tx; dm.strength = r * 0.32
        ball.modifiers.new('soft', 'SUBSURF').levels = 1
        ball.data.materials.append(paper)
    # sticky notes on the wall under the window and on the desk
    for i, (x, z, col, rz) in enumerate(((-0.3, 1.02, (0.98, 0.86, 0.3), 4), (-0.18, 1.0, (0.98, 0.6, 0.65), -6), (0.62, 1.04, (0.6, 0.85, 0.95), 7), (0.73, 0.99, (0.98, 0.86, 0.3), -3))):
        bpy.ops.mesh.primitive_plane_add(size=0.076, location=(x, 1.795, z), rotation=(math.pi / 2, math.radians(rz), 0))
        bpy.context.active_object.data.materials.append(mat_flat(f'sticky_{i}', col, 0.8))
    # postcards pinned to the wall right of the window, a frame to the left
    import_gltf('postcard_set_01', '1k', loc=(1.25, 1.785, 1.25), rot_z=math.radians(180), keep=['postcard_01', 'postcard_03', 'postcard_05'], scale=0.75)
    import_gltf('hanging_picture_frame_02', '1k', loc=(-1.05, 1.775, 1.45), rot_z=math.radians(180), scale=0.8)
    # laptop charging cable running off the back of the desk
    cu = bpy.data.curves.new('cable', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 0.0022; cu.bevel_resolution = 4
    sp = cu.splines.new('BEZIER'); sp.bezier_points.add(3)
    pts = [(DESK.x - 0.5, DESK.y + 0.08, TOP + 0.004), (DESK.x - 0.56, DESK.y + 0.22, TOP + 0.003), (DESK.x - 0.58, DESK.y + 0.33, TOP - 0.05), (DESK.x - 0.6, DESK.y + 0.34, 0.25)]
    for bp, co in zip(sp.bezier_points, pts):
        bp.co = co; bp.handle_left_type = bp.handle_right_type = 'AUTO'
    cob = bpy.data.objects.new('cable', cu); bpy.context.scene.collection.objects.link(cob)
    cob.data.materials.append(mat_flat('cable', (0.85, 0.85, 0.84), 0.5))


def build_open_book():
    page_l = mat_image('page_left', os.path.join(TEX, 'page_left.jpg'), rough=0.6)
    page_r = mat_image('page_right', os.path.join(TEX, 'page_right.jpg'), rough=0.6)
    edge = mat_image('page_edge', os.path.join(TEX, 'page_edges.jpg'), rough=0.8)
    cloth = mat_flat('book_cloth', (0.09, 0.12, 0.2), 0.75)
    W, H = 0.152, 0.225
    def page_z(u):
        return 0.016 * (1 - (1 - u) ** 2.2) - 0.006 * math.exp(-u / 0.04) + 0.012
    for side, mat in ((-1, page_l), (1, page_r)):
        def fn(u, v, side=side):
            return Vector((BOOK.x + side * u * W, BOOK.y + (v - 0.5) * H, TOP + page_z(u)))
        o = uv_grid(f'page_{side}', 64, 40, fn, mat)
        if side < 0:  # the left page's outer edge is at u = 1, so mirror U
            for loop in o.data.uv_layers.active.data:
                loop.uv.x = 1 - loop.uv.x
        o.modifiers.new('solid', 'SOLIDIFY').thickness = 0.0004
        box(f'block_{side}', (W * 0.96, H * 0.985, 0.012), (BOOK.x + side * W * 0.5, BOOK.y, TOP + 0.0075), edge, 0.002)
        box(f'board_{side}', (W + 0.006, H + 0.01, 0.003), (BOOK.x + side * (W + 0.006) * 0.5, BOOK.y, TOP + 0.0016), cloth, 0.0008)


def build_textbooks():
    """His two textbooks, closed and stacked off to the right."""
    for i, (name, tex, rot, off) in enumerate((('neuro', 'cover_neuro.jpg', 14, (0.0, 0.0)), ('roots', 'cover_roots.jpg', 4, (-0.035, -0.04)), ('gut', 'cover_gut.jpg', -7, (-0.01, -0.075)))):
        cover = mat_image(f'cover_{name}', os.path.join(TEX, tex), rough=0.35, coat=0.25)
        side = mat_image(f'edge_{name}', os.path.join(TEX, 'page_edges.jpg'), rough=0.8)
        W, H, T = 0.17, 0.245, 0.024
        z = TOP + T / 2 + i * T
        o = box(f'textbook_{name}', (W, H, T), (0, 0, 0), side, 0.0012)
        bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, T / 2 + 0.0003))
        top = bpy.context.active_object; top.scale = (W - 0.002, H - 0.002, 1); bpy.ops.object.transform_apply(scale=True)
        top.data.materials.append(cover); top.parent = o
        o.location = (DESK.x + 0.36 + off[0], DESK.y - 0.12 + off[1], z)
        o.rotation_euler = (0, 0, math.radians(rot))


def build_laptop():
    alu = mat_flat('aluminium', (0.62, 0.62, 0.64), 0.28, metal=1.0)
    keys = mat_flat('keys', (0.05, 0.05, 0.055), 0.6)
    screen = mat_image('screen', os.path.join(TEX, 'screen_gut.png'), rough=0.08, emission=0.8, coat=0.35)
    W, D = 0.312, 0.221
    base = box('laptop_base', (W, D, 0.009), (0, 0, 0.0045), alu, 0.0015)
    kb = box('keyboard', (W * 0.86, D * 0.42, 0.001), (0, D * 0.12, 0.0095), keys)
    kb.parent = base
    lid = box('laptop_lid', (W, 0.005, D), (0, 0, D / 2), alu, 0.0015)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, -0.0028, D / 2), rotation=(math.pi / 2, 0, 0))
    disp = bpy.context.active_object; disp.scale = (W * 0.93, D * 0.88, 1); bpy.ops.object.transform_apply(scale=True)
    disp.data.materials.append(screen); disp.parent = lid
    lid.parent = base
    lid.location = (0, D / 2, 0.009)
    lid.rotation_euler = (math.radians(-18), 0, 0)
    base.location = (DESK.x - 0.35, DESK.y + 0.10, TOP)
    base.rotation_euler = (0, 0, math.radians(14))


def lights():
    warm = (1.0, 0.66, 0.38)
    head = LAMP_HEAD
    sl = bpy.data.lights.new('lamp_spot', 'SPOT')
    sl.energy = 34; sl.color = warm; sl.spot_size = math.radians(78); sl.spot_blend = 0.6; sl.shadow_soft_size = 0.018
    # warm spill that lifts the wall and the desk edges a little
    fill = bpy.data.lights.new('lamp_spill', 'POINT')
    fill.energy = 9; fill.color = warm; fill.shadow_soft_size = 0.2
    fo = bpy.data.objects.new('lamp_spill', fill); bpy.context.scene.collection.objects.link(fo)
    fo.location = head + Vector((0, 0.05, 0.12))
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.016, location=head + Vector((0, 0, 0.012)))
    bulb = bpy.context.active_object
    bulb.data.materials.append(mat_flat('bulb', (1, 0.8, 0.55), emission=(1, 0.72, 0.42), strength=35))
    bulb.visible_shadow = False
    so = bpy.data.objects.new('lamp_spot', sl); bpy.context.scene.collection.objects.link(so)
    so.location = head
    d = (BOOK + Vector((0.03, 0, 0)) - head).normalized()
    so.rotation_mode = 'QUATERNION'; so.rotation_quaternion = d.to_track_quat('-Z', 'Y')
    pt = bpy.data.lights.new('lamp_bulb', 'POINT')
    pt.energy = 3; pt.color = warm; pt.shadow_soft_size = 0.02
    po = bpy.data.objects.new('lamp_bulb', pt); bpy.context.scene.collection.objects.link(po)
    po.location = head + Vector((0, 0, 0.03))
    ar = bpy.data.lights.new('window', 'AREA')
    ar.energy = 6; ar.color = (0.55, 0.68, 1.0); ar.shape = 'RECTANGLE'; ar.size = 1.2; ar.size_y = 1.0
    ao = bpy.data.objects.new('window', ar); bpy.context.scene.collection.objects.link(ao)
    ao.location = (0.2, 1.95, 1.65); ao.rotation_euler = (math.radians(-80), 0, 0)
    sp = bpy.data.lights.new('screen_spill', 'AREA')
    sp.energy = 1.2; sp.color = (0.6, 0.5, 1.0); sp.size = 0.28; sp.size_y = 0.18
    spo = bpy.data.objects.new('screen_spill', sp); bpy.context.scene.collection.objects.link(spo)
    spo.location = (DESK.x - 0.35, DESK.y + 0.09, TOP + 0.13); spo.rotation_euler = (math.radians(75), 0, math.radians(14))


def world():
    w = bpy.data.worlds.new('night'); bpy.context.scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    env = nt.nodes.new('ShaderNodeTexEnvironment')
    env.image = bpy.data.images.load(os.path.join(A, 'hdri', 'unfinished_office_night_2k.hdr'))
    nt.links.new(env.outputs['Color'], nt.nodes['Background'].inputs['Color'])
    nt.nodes['Background'].inputs['Strength'].default_value = 0.035


# ---------------------------------------------------------------- camera
def catmull(points, t):
    n = len(points) - 1
    s = min(max(t, 0), 1) * n
    i = min(int(s), n - 1)
    f = s - i
    p0 = points[max(i - 1, 0)]; p1 = points[i]; p2 = points[i + 1]; p3 = points[min(i + 2, n)]
    return 0.5 * ((2 * p1) + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (-p0 + 3 * p1 - 3 * p2 + p3) * f ** 3)


def ease(t):
    """Short ease at both ends, near-constant speed in between (the scroll is the clock)."""
    k = 0.12
    if t < k: return (t * t) / (2 * k * (1 - k))
    if t > 1 - k: return 1 - ((1 - t) ** 2) / (2 * k * (1 - k))
    return (t - k / 2) / (1 - k)


def camera_path(portrait=False):
    right_page = BOOK + Vector((0.076, 0.0, 0.026))
    pos = [Vector(p) for p in (
        (1.55, -2.85, 1.62),
        (1.05, -1.05, 1.42),
        (0.55, 0.30, 1.38),
        (0.27, 0.86, 1.32),
        (BOOK.x + 0.01, BOOK.y - 0.02, TOP + 0.50),
        (right_page.x, right_page.y + 0.035, TOP + 0.24),
    )]
    look = [Vector(p) for p in (
        (DESK.x - 0.1, DESK.y, 1.0),
        (DESK.x - 0.02, DESK.y, 0.92),
        (BOOK.x, BOOK.y + 0.05, TOP),
        (BOOK.x, BOOK.y, TOP),
        (BOOK.x + 0.01, BOOK.y, TOP),
        (right_page.x, right_page.y + 0.035, TOP),
    )]
    lens = [28, 30, 34, 38, 42, 50] if not portrait else [22, 24, 28, 32, 36, 42]
    if portrait:  # narrower frame: end a little higher and centred on the title column
        end = Vector((right_page.x - 0.022, right_page.y + 0.03, TOP))
        pos[-1] = Vector((end.x, end.y, TOP + 0.36))
        look[-1] = end
    return pos, look, lens


def key_camera(cam, frames, portrait=False):
    pos, look, lens = camera_path(portrait)
    cam.rotation_mode = 'QUATERNION'
    prev = None
    focus = []
    for f in range(1, frames + 1):
        t = ease((f - 1) / (frames - 1))
        p = catmull(pos, t)
        l = catmull(look, t)
        p = p + Vector((noise.noise(Vector((f * 0.035, 1.3, 0.0))), noise.noise(Vector((f * 0.035, 7.1, 0.0))),
                        noise.noise(Vector((f * 0.035, 3.7, 0.0))))) * 0.0025
        fwd = (l - p).normalized()
        down = max(0.0, min(1.0, (-fwd.z - 0.75) / 0.2))
        up = (Vector((0, 0, 1)) * (1 - down) + Vector((0, 1, 0)) * down).normalized()
        right = fwd.cross(up).normalized()
        up2 = right.cross(fwd)
        q = Matrix((right, up2, -fwd)).transposed().to_quaternion()
        if prev is not None and prev.dot(q) < 0:
            q.negate()
        prev = q
        cam.location = p
        cam.rotation_quaternion = q
        cam.keyframe_insert('location', frame=f)
        cam.keyframe_insert('rotation_quaternion', frame=f)
        cam.data.lens = catmull([Vector((x, 0, 0)) for x in lens], t).x
        cam.data.keyframe_insert('lens', frame=f)
        cam.data.dof.focus_distance = max(0.08, (l - p).length)
        cam.data.dof.keyframe_insert('focus_distance', frame=f)
        cam.data.dof.aperture_fstop = 4.0 if t < 0.5 else 4.0 + (t - 0.5) / 0.5 * 7.0
        cam.data.dof.keyframe_insert('aperture_fstop', frame=f)
        focus.append(l)
    return focus


def cameras(sc):
    for name, frames, portrait in (('cam_land', FRAMES, False), ('cam_port', PORTRAIT_FRAMES, True)):
        cd = bpy.data.cameras.new(name)
        cd.sensor_width = 36
        cd.sensor_fit = 'VERTICAL' if portrait else 'HORIZONTAL'
        cd.dof.use_dof = True
        cd.dof.aperture_blades = 7
        cd.clip_start = 0.01
        co = bpy.data.objects.new(name, cd)
        sc.collection.objects.link(co)
        key_camera(co, frames, portrait)
    sc.camera = bpy.data.objects['cam_land']


def render_settings(sc, engine='CYCLES', w=2560, h=1440, samples=40):
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = w, h, 100
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_depth = '16'
    sc.render.fps = 30
    try:
        sc.view_settings.view_transform = 'AgX'
        looks = [i.identifier for i in sc.view_settings.bl_rna.properties['look'].enum_items]
        for want in ('AgX - Medium High Contrast', 'Medium High Contrast'):
            if want in looks:
                sc.view_settings.look = want; break
    except Exception as e:
        print('color management:', e)
    eng = [i.identifier for i in sc.render.bl_rna.properties['engine'].enum_items]
    if engine == 'CYCLES':
        sc.render.engine = 'CYCLES'
        prefs = bpy.context.preferences.addons['cycles'].preferences
        prefs.compute_device_type = 'METAL'
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
        sc.cycles.device = 'GPU'
        sc.cycles.samples = samples
        sc.cycles.use_adaptive_sampling = True
        sc.cycles.adaptive_threshold = 0.04
        sc.cycles.adaptive_min_samples = 16
        sc.cycles.use_denoising = True
        sc.cycles.denoiser = 'OPENIMAGEDENOISE'
        try: sc.cycles.denoising_use_gpu = True
        except Exception: pass
        sc.cycles.max_bounces = 6; sc.cycles.diffuse_bounces = 3; sc.cycles.glossy_bounces = 3
        sc.cycles.transmission_bounces = 6; sc.cycles.volume_bounces = 0; sc.cycles.transparent_max_bounces = 8
        sc.cycles.caustics_reflective = False; sc.cycles.caustics_refractive = False
        sc.cycles.blur_glossy = 1.0; sc.cycles.sample_clamp_indirect = 5
        sc.render.use_persistent_data = True
    else:
        sc.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in eng else 'BLENDER_EEVEE'
        try:
            sc.eevee.taa_render_samples = 32
            sc.eevee.use_raytracing = True
        except Exception as e:
            print('eevee:', e)


if __name__ == '__main__':
    sc = build()
    cameras(sc)
    sc.frame_start, sc.frame_end = 1, FRAMES
    prev = arg('--preview')
    if prev:
        render_settings(sc, arg('--engine', 'EEVEE'), int(arg('--w', 960)), int(arg('--h', 540)), int(arg('--samples', 24)))
        os.makedirs(os.path.join(OUT, 'preview'), exist_ok=True)
        cam = arg('--cam', 'cam_land')
        sc.camera = bpy.data.objects[cam]
        if cam == 'cam_port':
            sc.render.resolution_x, sc.render.resolution_y = int(arg('--h', 540)) * 9 // 16, int(arg('--h', 540))
        for f in [int(x) for x in prev.split(',')]:
            sc.frame_set(f)
            sc.render.filepath = os.path.join(OUT, 'preview', f'{cam}_{f:04d}.png')
            bpy.ops.render.render(write_still=True)
            print('PREVIEW', sc.render.filepath)
    job = arg('--render')
    if job:
        import json
        from bpy_extras.object_utils import world_to_camera_view
        land = job in ('land', 'poster4k')
        cam = bpy.data.objects['cam_land' if land else 'cam_port']
        w, h = (3840, 2160) if job == 'poster4k' else (2560, 1440) if land else (1080, 1920)
        render_settings(sc, 'CYCLES', w, h, int(arg('--samples', 32)))
        sc.cycles.adaptive_threshold = 0.035
        sc.camera = cam
        n = FRAMES if land else PORTRAIT_FRAMES
        sc.frame_start, sc.frame_end = int(arg('--from', 1)), int(arg('--to', 1 if job == 'poster4k' else n))
        # where the open book sits on screen each frame, so the site can crop around it
        focal = []
        for f in range(1, n + 1):
            sc.frame_set(f)
            v = world_to_camera_view(sc, cam, BOOK + Vector((0.04, 0, 0)))
            focal.append([round(min(max(v.x, 0), 1), 3), round(1 - min(max(v.y, 0), 1), 3)])
        os.makedirs(os.path.join(OUT, job), exist_ok=True)
        json.dump(focal, open(os.path.join(OUT, job, 'focal.json'), 'w'))
        sc.render.filepath = os.path.join(OUT, job, 'f_####')
        bpy.ops.render.render(animation=True)
        print('RENDERED', job)
    save = arg('--save')
    if save:
        render_settings(sc, 'CYCLES')
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, save))
        print('SAVED', save)
