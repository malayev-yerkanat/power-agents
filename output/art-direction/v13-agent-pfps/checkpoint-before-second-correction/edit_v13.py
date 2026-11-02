"""Deterministic v13 emblem edits; all outputs stay beside this script."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import json
import shutil
import math

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
    # Eight circular lobes sit outside a filled centre; valleys remain >=2 cells deep.
    centers = [(11+8*math.cos(k*math.pi/4),11+8*math.sin(k*math.pi/4))
               for k in range(8)]
    shape = {(x,y) for y in range(23) for x in range(23)
             if (x-11)**2+(y-11)**2 <= 7.8**2
             or any((x-a)**2+(y-b)**2 <= 3.5**2 for a,b in centers)}
    colors = dict(enumerate(['#a9a3ff','#8584ff','#6064ff','#3a45ff']))
    colors.update({'white':'#ffffff','rim':'#2d34c8'})
    cells = {(x,y):('rim' if is_edge(shape,x,y) else min(3,y*4//23))
             for x,y in shape}
    # Two-cell strokes: the seven-row chevron shares its baseline with the bar.
    for y,left in enumerate((6,7,8,9,8,7,6),8):
        for x in (left,left+1):cells[x,y] = 'white'
    for y in (13,14):
        for x in range(13,19):cells[x,y] = 'white'
    drawn = paint_cells(image, cells, (430,634), 12, colors)
    save_edit('codex', image, {'chest':ImageChops.lighter(old,drawn)},
              {'chest':{'origin':[430,634],'grid_px':12,'cells':23,
                        'crop':[418,622,718,922],'gradient_bands':4,
                        'shape':'eight rounded lobes with at least two-cell radial valleys',
                        'glyph':'two-cell white > and _; seven-row chevron; shared baseline',
                        'outline':'one-cell #2d34c8 blue rim'}})


def is_edge(shape, x, y):
    return any((x+dx,y+dy) not in shape for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)))


def sparkle(image, origin, size, rim):
    half = size//2
    if size == 9:
        widths = (0,1,1,3,4,3,1,1,0)
        shape = {(x,y) for y,w in enumerate(widths) for x in range(half-w,half+w+1)}
    else:
        # Half-cell coverage keeps each needle to its terminal cell only.
        shape = {(x,y) for y in range(size) for x in range(size)
                 if (max(abs(x-half)-.5,0)/half)**.8
                 + (max(abs(y-half)-.5,0)/half)**.8 <= 1}
    assert {(size-1-y,x) for x,y in shape} == shape
    palette = {'red':(249,67,73),'yellow':(251,188,5),'green':(22,188,104),
               'blue':(50,133,255),'red_step':(104,143,255),
               'yellow_step':(115,182,239),'green_step':(52,181,204)}
    cut = math.ceil(half*.55)
    cells, colors = {}, {}
    for x,y in sorted(shape):
        # Blue owns the centre. Each coloured blade has one crisp transition band.
        distance, blade = max(((half-y,'red'),(half-x,'yellow'),(y-half,'green')))
        key = blade if distance >= cut else blade+'_step' if distance == cut-1 else 'blue'
        color = palette[key]
        if rim and is_edge(shape,x,y):
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
    chest = ImageChops.lighter(old, sparkle(image, (433,709), 19, True))
    # Clear the exact v12 six-cell mark using the existing row-donor approach.
    old_cells = {(x,y):0 for y in range(6) for x in range(6)
                 if not (x in [0,5] and y in [0,5])}
    old = paint_cells(Image.new('RGB',source.size), old_cells, (539,237), 13, {0:'white'})
    for y in range(237,315):
        for x in range(539,617):
            if old.getpixel((x,y)):
                donor = (x-104,y) if y < 264 else (658,max(y,350))
                image.putpixel((x,y),source.getpixel(donor))
    visor = ImageChops.lighter(old, sparkle(image, (520,218), 9, False))
    save_edit('gemini', image, {'chest':chest,'visor':visor}, {
        'chest':{'origin':[433,709],'grid_px':13,'cells':19,'crop':[420,696,693,969],
                 'outline':'one cell darker local color; no black/navy'},
        'visor':{'origin':[520,218],'grid_px':13,'cells':9,'crop':[507,205,650,348],
                 'outline':'none'},
        'shape':'quarter-turn symmetric concave four-point sparkle',
        'color_field':'red top, yellow left, green bottom, blue right/body; clean blade bands with one intermediate step per boundary'})


if __name__ == '__main__':
    codex()
    gemini()
    shutil.copyfile(ROOT/'v12-claude.png', ROOT/'pfp-claude.png')
