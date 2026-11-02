"""Deterministic v13 emblem edits; all outputs stay beside this script."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import json
import shutil

ROOT = Path(__file__).resolve().parent
NEAREST = Image.Resampling.NEAREST

def paint_cells(image, cells, origin, cell, colors):
    draw=ImageDraw.Draw(image)
    footprint=Image.new('L',image.size);md=ImageDraw.Draw(footprint)
    for (x,y),color in cells.items():
        box=(origin[0]+x*cell,origin[1]+y*cell,origin[0]+(x+1)*cell-1,origin[1]+(y+1)*cell-1)
        draw.rectangle(box,fill=colors[color]);md.rectangle(box,fill=255)
    return footprint

def colored_footprint(source, box, test, seed=None):
    m=Image.new('L',source.size);mp=m.load();s=source.load()
    for y in range(box[1],box[3]):
        for x in range(box[0],box[2]):
            if test(*s[x,y]):mp[x,y]=255
    if seed is not None:
        assert m.getpixel(seed)==255
        ImageDraw.floodfill(m,seed,128,thresh=0)
        m=m.point(lambda value:255 if value==128 else 0)
    return m.filter(ImageFilter.MaxFilter(3))


def save_edit(name, image, masks, metadata):
    image.save(ROOT / f'pfp-{name}.png')
    allowed = Image.new('L', image.size)
    for key, mask in masks.items():
        mask.save(ROOT / f'mask-{name}-{key}.png')
        allowed = ImageChops.lighter(allowed, mask)
    allowed.save(ROOT / f'emblem-mask-{name}.png')
    (ROOT / f'metadata-{name}.json').write_text(json.dumps(metadata, indent=2)+'\n')


def codex():
    source = Image.open(ROOT / 'v12-codex.png').convert('RGB')
    image = source.copy()
    old = colored_footprint(source, (450,657,683,887),
                            lambda r,g,b: b > r+25 and b > g+25, seed=(568,770))
    image.paste((254,253,244), (0,0), old)
    reference = Image.open(ROOT / 'logo-codex-official.png').convert('RGB')
    # Fill the white terminal holes before sampling the official cloud silhouette.
    mask = Image.new('L', reference.size)
    mask.putdata([255 if b > r+15 and b > g+5 else 0 for r,g,b in reference.get_flattened_data()])
    ImageDraw.floodfill(mask, (0,0), 128)
    mask = mask.point(lambda v: 0 if v == 128 else 255)
    colors = dict(enumerate(['#b0a8ff','#999fff','#7c9cff','#637bff','#3a45ff']))
    colors['white'] = '#ffffff'
    cells = {}
    for y in range(21):
        for x in range(21):
            point = (80+int((x+.5)*480/21), 80+int((y+.5)*480/21))
            if mask.getpixel(point):
                cells[x,y] = 'white' if min(reference.getpixel(point)) > 240 else min(4,y*5//21)
    drawn = paint_cells(image, cells, (442,646), 12, colors)
    save_edit('codex', image, {'chest':ImageChops.lighter(old,drawn)},
              {'chest':{'origin':[442,646],'grid_px':12,'cells':21,
                        'crop':[430,634,706,910],'gradient_bands':5,
                        'shape':'official scalloped cloud sampled on local grid',
                        'glyph':'white rounded >_ sampled from official reference','outline':'none'}})


def sparkle(image, origin, size, rim):
    reference = Image.open(ROOT / 'logo-gemini-official.png').convert('RGB')
    # Four concave, equal blades. Palette samples become four discrete blend bands.
    palette = [(253,65,72),(220,100,122),(151,129,191),(49,134,255),
               (251,193,10),(194,192,62),(113,181,116),(46,159,190),
               (5,185,109),(40,174,145),(49,151,217)]
    half = size//2
    shape = {(x,y) for y in range(size) for x in range(size)
             if (abs(x-half)/half)**.65 + (abs(y-half)/half)**.65 <= 1.01}
    assert { (size-1-y,x) for x,y in shape } == shape
    cells, colors = {}, {}
    for x,y in sorted(shape):
        point = (int((x+.5)*554/size), int((y+.5)*554/size))
        sample = reference.getpixel(point)
        color = min(palette, key=lambda c: sum((a-b)**2 for a,b in zip(c,sample)))
        if rim and any((x+dx,y+dy) not in shape for dx,dy in [(1,0),(-1,0),(0,1),(0,-1)]):
            color = tuple(round(c*.87) for c in color)
        colors[color] = color
        cells[x,y] = color
    return paint_cells(image, cells, origin, 13, colors)


def gemini():
    source = Image.open(ROOT / 'v12-gemini.png').convert('RGB')
    image = source.copy()
    old = colored_footprint(source, (439,715,674,950),
        lambda r,g,b: max(r,g,b)-min(r,g,b)>50 or max(r,g,b)<70, seed=(550,820))
    image.paste((254,253,245), (0,0), old)
    chest = ImageChops.lighter(old, sparkle(image, (446,722), 17, True))
    # Clear the exact v12 six-cell mark using the existing row-donor approach.
    old_cells = {(x,y):0 for y in range(6) for x in range(6)
                 if not (x in [0,5] and y in [0,5])}
    old = paint_cells(Image.new('RGB',source.size), old_cells, (539,237), 13, {0:'white'})
    for y in range(237,315):
        for x in range(539,617):
            if old.getpixel((x,y)):
                donor = (x-104,y) if y < 264 else (658,max(y,350))
                image.putpixel((x,y),source.getpixel(donor))
    visor = ImageChops.lighter(old, sparkle(image, (507,205), 11, False))
    save_edit('gemini', image, {'chest':chest,'visor':visor}, {
        'chest':{'origin':[446,722],'grid_px':13,'cells':17,'crop':[426,702,686,962],
                 'outline':'one cell darker local color; no black/navy'},
        'visor':{'origin':[507,205],'grid_px':13,'cells':11,'crop':[494,192,663,361],
                 'outline':'none'},
        'shape':'quarter-turn symmetric concave four-point sparkle',
        'color_field':'red top, yellow left, green bottom, blue right/body; four stepped blend bands'})


if __name__ == '__main__':
    codex()
    gemini()
    shutil.copyfile(ROOT/'v12-claude.png', ROOT/'pfp-claude.png')
