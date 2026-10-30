"""Deterministic v13 emblem edits; all outputs stay beside this script."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageChops, ImageColor
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
    shape, _ = official_cells('codex', 23)
    colors = dict(enumerate(['#a9a3ff','#8584ff','#6064ff','#3a45ff']))
    colors.update({'white':'#ffffff','rim':'#2d34c8'})
    cells = {(x,y):('rim' if is_edge(shape,x,y) else min(3,y*4//23))
             for x,y in shape}
    # Two-cell strokes follow the official glyph bounds within the cropped cloud.
    for y,left in enumerate((5,6,6,7,7,6,6,5),8):
        for x in (left,left+1):cells[x,y] = 'white'
    for y in (14,15):
        for x in range(11,18):cells[x,y] = 'white'
    drawn = paint_cells(image, cells, (430,634), 12, colors)
    save_edit('codex', image, {'chest':ImageChops.lighter(old,drawn)},
              {'chest':{'origin':[430,634],'grid_px':12,'cells':23,
                        'crop':[418,622,718,922],'gradient_bands':4,
                        'shape':'official cloud alpha, white tile removed; BOX coverage >= 0.5',
                        'glyph':'two-cell white > and _ at official relative bounds; shared baseline',
                        'outline':'one-cell #2d34c8 blue rim'}})


def is_edge(shape, x, y):
    return any((x+dx,y+dy) not in shape for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)))


def official_cells(name, size):
    official = Image.open(ROOT / f'logo-{name}-official.png').convert('RGBA')
    mask = Image.new('L', official.size)
    mask.putdata([255 if min(r,g,b) < 245 and a else 0
                  for r,g,b,a in official.get_flattened_data()])
    if name == 'codex':
        # The supplied alpha includes an opaque white app tile. Isolate the
        # connected cloud, then fill its enclosed glyph holes before using alpha.
        ImageDraw.floodfill(mask, (320,320), 128)
        mask = mask.point(lambda value: 255 if value == 128 else 0)
        ImageDraw.floodfill(mask, (0,0), 128)
        mask = ImageChops.darker(official.getchannel('A'),
            mask.point(lambda value: 0 if value == 128 else 255))
    bounds = mask.getbbox()
    coverage = mask.crop(bounds).resize((size,size), Image.Resampling.BOX)
    rgb = official.convert('RGB').crop(bounds).resize((size,size), Image.Resampling.BOX)
    shape = {(x,y) for y in range(size) for x in range(size)
             if coverage.getpixel((x,y)) >= 255 * 0.5}
    return shape, rgb


def sparkle(image, origin, size):
    shape, rgb = official_cells('gemini', size)
    assert {(size-1-y,x) for x,y in shape} == shape
    half = size//2
    assert {(half,0),(0,half),(half,size-1),(size-1,half)} <= shape
    palette = tuple(ImageColor.getrgb(color) for color in (
        '#ea4335','#c5221f','#fbbc04','#e09c00','#34a853',
        '#188038','#4285f4','#1a5fd0','#8ab4f8'))
    darker = {palette[i]:palette[j] for i,j in
              ((0,1),(1,1),(2,3),(3,3),(4,5),(5,5),(6,7),(7,7),(8,7))}
    cells = {}
    for x,y in sorted(shape):
        sample = rgb.getpixel((x,y))
        color = min(palette, key=lambda p: sum((a-b)**2 for a,b in zip(p,sample)))
        if is_edge(shape,x,y):
            color = darker[color]
        cells[x,y] = color
    return paint_cells(image, cells, origin, 13, {color:color for color in palette})


def gemini():
    source = Image.open(ROOT / 'v12-gemini.png').convert('RGB')
    image = source.copy()
    old = colored_footprint(source, (439,715,674,950),
        lambda r,g,b: max(r,g,b)-min(r,g,b)>50 or max(r,g,b)<70, seed=(550,820))
    image.paste((254,253,245), (0,0), old)
    chest = ImageChops.lighter(old, sparkle(image, (433,709), 19))
    # Clear the exact v12 six-cell mark using the existing row-donor approach.
    old_cells = {(x,y):0 for y in range(6) for x in range(6)
                 if not (x in [0,5] and y in [0,5])}
    old = paint_cells(Image.new('RGB',source.size), old_cells, (539,237), 13, {0:'white'})
    for y in range(237,315):
        for x in range(539,617):
            if old.getpixel((x,y)):
                donor = (x-104,y) if y < 264 else (658,max(y,350))
                image.putpixel((x,y),source.getpixel(donor))
    visor = ImageChops.lighter(old, sparkle(image, (520,218), 9))
    save_edit('gemini', image, {'chest':chest,'visor':visor}, {
        'chest':{'origin':[433,709],'grid_px':13,'cells':19,'crop':[420,696,693,969],
                 'outline':'one cell darker local color; no black/navy'},
        'visor':{'origin':[520,218],'grid_px':13,'cells':9,'crop':[507,205,650,348],
                 'outline':'one cell darker local color; no black/navy'},
        'shape':'official non-near-white mask; BOX coverage >= 0.5; four equal tips',
        'color_field':'official RGB BOX averages snapped to fixed nine-color palette; darker local-color edge'})


if __name__ == '__main__':
    codex()
    gemini()
    shutil.copyfile(ROOT/'v12-claude.png', ROOT/'pfp-claude.png')
