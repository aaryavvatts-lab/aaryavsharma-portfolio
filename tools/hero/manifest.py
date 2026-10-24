"""Writes src/content/film.json (frame sets, focal points, page colour) and the posters.
Run after post.sh has encoded both jobs:  python3 manifest.py"""
import json, os, subprocess
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PUB = os.path.join(HERE, '..', '..', 'public')
V = os.path.join(PUB, 'hero', 'v1')
OUT = os.path.join(HERE, 'out')
GRADE = open(os.path.join(HERE, 'post.sh')).read().split('GRADE="', 1)[1].split('"\n', 1)[0]

def count(d):
    return len([f for f in os.listdir(os.path.join(V, d)) if f.endswith('.avif')])

def poster(src, dst_base, widths):
    out = []
    for w in widths:
        for ext, codec in (('avif', ['-c:v', 'libaom-av1', '-still-picture', '1', '-crf', '24', '-cpu-used', '5', '-pix_fmt', 'yuv420p10le']),
                           ('jpg', ['-q:v', '3'])):
            dst = f'{dst_base}-{w}.{ext}'
            subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', src, '-filter_complex', f'[0:v]{GRADE},scale={w}:-2:flags=lanczos[v]', '-map', '[v]', *codec, dst], check=True)
        out.append({'src': '/hero/v1/' + os.path.basename(dst_base) + f'-{w}.jpg', 'avif': '/hero/v1/' + os.path.basename(dst_base) + f'-{w}.avif', 'w': w})
    return out

land_first = os.path.join(OUT, 'land', 'f_0001.png')
big = os.path.join(OUT, 'poster4k', 'f_0001.png')
land = poster(big if os.path.exists(big) else land_first, os.path.join(V, 'poster'), [1280, 1920] + ([2560, 3840] if os.path.exists(big) else []))
port = poster(os.path.join(OUT, 'port', 'f_0001.png'), os.path.join(V, 'poster-port'), [1080])[0]

# page colour at the end of the film, sampled from the graded last frame
last = sorted(f for f in os.listdir(os.path.join(V, 'land-1280')) if f.endswith('.avif'))[-1]
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', os.path.join(V, 'land-1280', last), '/tmp/claude-501/last.png'], check=True)
im = Image.open('/tmp/claude-501/last.png').convert('RGB')
w, h = im.size
px = [im.getpixel((x, y)) for x in range(int(w * 0.35), int(w * 0.65), 8) for y in range(int(h * 0.05), int(h * 0.2), 8)]
px.sort(key=sum)
r, g, b = px[int(len(px) * 0.8)]  # paper, not ink: take a bright percentile
paper = '#%02x%02x%02x' % (r, g, b)

film = {
    'poster': {'land': land, 'port': port},
    'sets': {
        'land-1920': {'dir': '/hero/v1/land-1920/', 'count': count('land-1920'), 'w': 1920, 'h': 1080, 'ext': 'avif'},
        'land-1280': {'dir': '/hero/v1/land-1280/', 'count': count('land-1280'), 'w': 1280, 'h': 720, 'ext': 'avif'},
        'port-1080': {'dir': '/hero/v1/port-1080/', 'count': count('port-1080'), 'w': 1080, 'h': 1920, 'ext': 'avif'},
    },
    # The camera is always aimed at what matters, so crop around the frame centre on every screen.
    'focal': {'land': [[0.5, 0.5]] * count('land-1920'), 'port': [[0.5, 0.5]] * count('port-1080')},
    'paper': paper,
}
json.dump(film, open(os.path.join(HERE, '..', '..', 'src', 'content', 'film.json'), 'w'))
print('film.json written; paper', paper, {k: v['count'] for k, v in film['sets'].items()})
