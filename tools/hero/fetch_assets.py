"""Download the CC0 Poly Haven models, textures and HDRI the reading-room scene uses."""
import json, os, sys, urllib.request

OUT = os.path.join(os.path.dirname(__file__), 'assets')
MODELS = {  # slug: resolution
    'wooden_table_02': '2k', 'desk_lamp_arm_01': '2k', 'dining_chair_02': '1k',
    'wooden_bookshelf_worn': '1k', 'book_encyclopedia_set_01': '1k', 'potted_plant_04': '1k',
    'tea_set_01': '1k', 'stationery_supplies': '1k', 'office_notepads': '1k', 'alarm_clock_01': '1k',
    'binder_notebook': '2k', 'round_spectacles': '1k', 'postcard_set_01': '1k', 'hanging_picture_frame_02': '1k', 'clipboard': '1k',
}
TEXTURES = {'plastered_wall_04': '2k', 'wood_floor_worn': '2k', 'dark_wooden_planks': '2k', 'fabric_pattern_07': '1k'}
HDRI = {'unfinished_office_night': '2k'}

def get(url, dest):
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return
    req = urllib.request.Request(url, headers={'User-Agent': 'portfolio-hero-build'})
    with urllib.request.urlopen(req) as r, open(dest, 'wb') as f:
        f.write(r.read())

def files(slug):
    req = urllib.request.Request(f'https://api.polyhaven.com/files/{slug}', headers={'User-Agent': 'portfolio-hero-build'})
    return json.load(urllib.request.urlopen(req))

for slug, res in MODELS.items():
    g = files(slug)['gltf'][res]['gltf']
    base = os.path.join(OUT, 'models', slug)
    get(g['url'], os.path.join(base, os.path.basename(g['url'])))
    for rel, inc in g.get('include', {}).items():
        get(inc['url'], os.path.join(base, rel))
    print('model', slug, res)

for slug, res in TEXTURES.items():
    f = files(slug)
    for kind in ('Diffuse', 'nor_gl', 'Rough', 'Displacement', 'AO'):
        if kind in f and res in f[kind]:
            e = f[kind][res].get('jpg') or f[kind][res].get('png')
            get(e['url'], os.path.join(OUT, 'textures', slug, os.path.basename(e['url'])))
    print('texture', slug)

for slug, res in HDRI.items():
    e = files(slug)['hdri'][res]['hdr']
    get(e['url'], os.path.join(OUT, 'hdri', os.path.basename(e['url'])))
    print('hdri', slug)
