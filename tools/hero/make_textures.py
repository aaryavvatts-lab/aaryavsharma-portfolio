"""Builds the textures for the reading-room scene from Aaryav's real work:
book covers from the two textbooks' cover art, book pages set with real chapter text,
page-edge stripes, and paper noise. Run with the system python3 (Pillow)."""
import os, re, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'tex')
NEURO = os.path.expanduser('~/Textbook Making/neuroscience-textbook/docs')
ROOTS = os.path.expanduser('~/Eastview Indian Club Idea/south-asian-culture-textbook/docs')
SERIF = '/System/Library/Fonts/Supplemental/Iowan Old Style.ttc'
SERIF_IT = '/System/Library/Fonts/NewYorkItalic.ttf'
random.seed(4)
PAPER = (238, 229, 209)
INK = (43, 38, 34)


def font(path, size, index=0):
    try:
        return ImageFont.truetype(path, size, index=index)
    except OSError:
        return ImageFont.truetype('/System/Library/Fonts/Supplemental/Georgia.ttf', size)


def paper(w, h, base=PAPER, amp=6):
    """Warm paper with faint fibres."""
    noise = Image.effect_noise((w // 4, h // 4), 18).resize((w, h), Image.BICUBIC)
    img = Image.new('RGB', (w, h), base)
    tint = Image.merge('RGB', [noise.point(lambda v, c=c: max(0, min(255, c + (v - 128) * amp // 64))) for c in base])
    return Image.blend(img, tint, 0.55)


def clean_md(md):
    md = re.sub(r'^---.*?---', '', md, flags=re.S)
    md = re.sub(r'```.*?```|<[^>]+>|!\[[^\]]*\]\([^)]*\)', '', md, flags=re.S)
    md = re.sub(r'\[([^\]]+)\]\([^)]*\)', r'\1', md)
    md = re.sub(r'[*_`]+', '', md)
    paras = []
    for block in md.split('\n\n'):
        b = block.strip()
        if not b or b.startswith(('#', '|', '-', '1.', '!!!', '???', '>')):
            continue
        paras.append(' '.join(b.split()))
    return paras


def wrap(draw, text, f, width):
    words, lines, cur = text.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if draw.textlength(t, font=f) <= width:
            cur = t
        else:
            lines.append(cur); cur = w
    if cur:
        lines.append(cur)
    return lines


def justify(draw, line, f, x, y, width, last):
    words = line.split()
    if last or len(words) < 2:
        draw.text((x, y), line, font=f, fill=INK); return
    total = sum(draw.textlength(w, font=f) for w in words)
    gap = (width - total) / (len(words) - 1)
    for w in words:
        draw.text((x, y), w, font=f, fill=INK)
        x += draw.textlength(w, font=f) + gap


def page(paras, title=None, head='', folio='', mirror=False, W=3600, H=5000):
    img = paper(W, H)
    d = ImageDraw.Draw(img)
    m_in, m_out, top = 430, 360, 470
    left = m_out if not mirror else m_in
    width = W - m_in - m_out
    small = font(SERIF, 62)
    d.text((left, 250), head.upper(), font=small, fill=(110, 98, 86))
    d.text((left + width - d.textlength(folio, font=small), 250), folio, font=small, fill=(110, 98, 86))
    y = top
    if title:
        y += 520
        tf = font(SERIF, 190)
        for ln in wrap(d, title, tf, width):
            d.text((left, y), ln, font=tf, fill=INK); y += 225
        y += 120
        d.line((left, y, left + 420, y), fill=(150, 90, 40), width=10)
        y += 170
    body = font(SERIF, 96)
    lh = 140
    first = True
    for p in paras:
        lines = wrap(d, p, body, width - (0 if not first else 0))
        for i, ln in enumerate(lines):
            if y > H - 470:
                break
            justify(d, ln, body, left + (120 if i == 0 and not first else 0), y, width - (120 if i == 0 and not first else 0), i == len(lines) - 1)
            y += lh
        first = False
        if y > H - 470:
            break
    return img.filter(ImageFilter.GaussianBlur(0.6))


def feather(img, radius):
    """Soft oval mask so a crop melts into the cover background."""
    m = Image.new('L', img.size, 0)
    ImageDraw.Draw(m).ellipse((radius, radius, img.width - radius, img.height - radius), fill=255)
    return m.filter(ImageFilter.GaussianBlur(radius))


def gradient(W, H, c0, c1, cx=0.7, cy=0.35):
    """Radial gradient from c1 at (cx, cy) out to c0."""
    small = Image.new('RGB', (64, 96))
    px = small.load()
    for y in range(96):
        for x in range(64):
            d = min(1.0, ((x / 64 - cx) ** 2 + (y / 96 - cy) ** 2) ** 0.5 * 1.35)
            px[x, y] = tuple(int(c1[i] + (c0[i] - c1[i]) * d) for i in range(3))
    return small.resize((W, H), Image.BICUBIC)


def cover_roots(src, out):
    s = Image.open(src).convert('RGB')
    W, H = 1600, 2400
    bg = s.getpixel((20, 20))
    c = Image.new('RGB', (W, H), bg)
    title = s.crop((70, 125, 620, 345))
    tw = W - 260
    title = title.resize((tw, int(title.height * tw / title.width)), Image.LANCZOS)
    c.paste(title, (130, 230))
    d = ImageDraw.Draw(c)
    sub = font('/System/Library/Fonts/Avenir Next.ttc', 64, 0)
    for i, ln in enumerate(['An interactive guide to South Asian', 'cultures for high school students']):
        d.text((132, 230 + title.height + 70 + i * 86), ln, font=sub, fill=(76, 72, 128))
    art = s.crop((680, 95, 1120, 535))
    aw = int(W * 0.72)
    art = art.resize((aw, aw), Image.LANCZOS)
    c.paste(art, ((W - aw) // 2, H - aw - 230), feather(art, 40))
    d.rectangle((0, H - 120, W, H - 70), fill=(27, 36, 84))
    d.rectangle((0, H - 70, W, H), fill=(240, 132, 28))
    Image.blend(c, Image.effect_noise((W, H), 10).convert('RGB'), 0.035).save(out, quality=94)


def cover_neuro(src, out):
    s = Image.open(src).convert('RGB')
    W, H = 1600, 2400
    c = gradient(W, H, (33, 18, 64), (108, 56, 158))
    d = ImageDraw.Draw(c)
    eyebrow = font('/System/Library/Fonts/HelveticaNeue.ttc', 54, 1)
    big = font('/System/Library/Fonts/HelveticaNeue.ttc', 200, 1)
    sub = font('/System/Library/Fonts/HelveticaNeue.ttc', 66, 0)
    d.text((130, 240), 'FREE  ·  INTERACTIVE  ·  OPEN', font=eyebrow, fill=(246, 168, 210))
    for i, ln in enumerate(['From Neuron', 'to Bedside']):
        d.text((126, 340 + i * 220), ln, font=big, fill=(255, 255, 255))
    for i, ln in enumerate(['An interactive neuroscience textbook', 'for high school students and', 'future doctors']):
        d.text((132, 840 + i * 88), ln, font=sub, fill=(228, 214, 246))
    art = s.crop((800, 150, 1130, 470))
    aw = int(W * 0.7)
    art = art.resize((aw, int(art.height * aw / art.width)), Image.LANCZOS)
    c.paste(art, ((W - aw) // 2 + 60, H - art.height - 250), feather(art, 60))
    d.rectangle((0, H - 70, W, H), fill=(142, 84, 196))
    Image.blend(c, Image.effect_noise((W, H), 10).convert('RGB'), 0.035).save(out, quality=94)


def edges(out, W=2048, H=256):
    img = Image.new('RGB', (W, H), (226, 216, 194))
    d = ImageDraw.Draw(img)
    for y in range(0, H, 2):
        v = random.randint(-14, 8)
        d.line((0, y, W, y), fill=(226 + v, 216 + v, 194 + v))
    img.filter(ImageFilter.GaussianBlur(0.7)).save(out, quality=92)


os.makedirs(OUT, exist_ok=True)
n1 = clean_md(open(os.path.join(NEURO, 'chapters/01-neurons-and-glia/index.md')).read())
r1 = clean_md(open(os.path.join(ROOTS, 'chapters/01-what-is-south-asia/index.md')).read())
page(n1[:40], head='From Neuron to Bedside', folio='12').save(os.path.join(OUT, 'page_left.jpg'), quality=93)
page(r1[:40], title='What Is South Asia?', head='Roots & Rivers', folio='13', mirror=True).save(os.path.join(OUT, 'page_right.jpg'), quality=93)
cover_roots(os.path.join(ROOTS, 'img/cover.png'), os.path.join(OUT, 'cover_roots.jpg'))
cover_neuro(os.path.join(NEURO, 'img/cover.png'), os.path.join(OUT, 'cover_neuro.jpg'))
edges(os.path.join(OUT, 'page_edges.jpg'))
print('textures written:', sorted(os.listdir(OUT)))
