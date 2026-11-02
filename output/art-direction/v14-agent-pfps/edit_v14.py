"""Reproducible, narrowly masked v14 artwork edits and review artifacts.

Run: python3 -B edit_v14.py
The live sprite is copied separately, only after verification and visual review.
"""
from pathlib import Path
import json
import math
import shutil
from PIL import Image, ImageDraw, ImageChops, ImageFont

ROOT = Path(__file__).resolve().parent
NEAREST = Image.Resampling.NEAREST
CODEX_ORIGIN = (442, 646)
CELL = 12
PALETTE = {'highlight': (81,106,253), 'mid': (19,62,252),
           'shadow': (7,45,216), 'white': (255,255,255)}


def official_shape(name, size):
    source=Image.open(ROOT/f'logo-{name}-official.png').convert('RGBA')
    mask=Image.new('L',source.size)
    mask.putdata([255 if min(r,g,b)<245 and a else 0
                  for r,g,b,a in source.get_flattened_data()])
    if name == 'codex':
        ImageDraw.floodfill(mask,(320,320),128)
        mask=mask.point(lambda v:255 if v==128 else 0)
        ImageDraw.floodfill(mask,(0,0),128)
        mask=mask.point(lambda v:0 if v==128 else 255)
    mask=mask.crop(mask.getbbox()).resize((size,size),Image.Resampling.BOX)
    return {(x,y) for y in range(size) for x in range(size)
            if mask.getpixel((x,y))>=128}


def cell_mask(size, shape, origin, cell):
    result=Image.new('L',size)
    draw=ImageDraw.Draw(result)
    for x,y in shape:
        draw.rectangle((origin[0]+x*cell,origin[1]+y*cell,
                        origin[0]+(x+1)*cell-1,origin[1]+(y+1)*cell-1),fill=255)
    return result


def codex():
    source=Image.open(ROOT/'v13-codex.png')
    centers=[(11+8*math.cos(k*math.pi/4),11+8*math.sin(k*math.pi/4)) for k in range(8)]
    old={(x,y) for y in range(23) for x in range(23)
         if (x-11)**2+(y-11)**2<=7.8**2
         or any((x-a)**2+(y-b)**2<=3.5**2 for a,b in centers)}
    cleared=source.copy()
    old_mask=cell_mask(source.size,old,(430,634),12)
    cleared.paste((254,253,244),(0,0),old_mask)
    # Seven short stepped lobes: two above, one left, two right, two below.
    # Re-entrant steps separate every pair; the last two rows stay clear
    # of the lower armour. Keep the approved glyph and lighting coordinates.
    rows={
        1:((7,9),), 2:((6,10),(13,15)), 3:((5,17),),
        4:((5,18),), 5:((6,18),), 6:((3,17),),
        7:((2,19),), 8:((1,20),), 9:((1,20),),
        10:((2,18),), 11:((4,19),), 12:((3,19),),
        13:((2,18),), 14:((2,17),), 15:((3,15),),
        16:((4,8),(10,16)), 17:((5,7),(10,15)), 18:((11,14),),
    }
    shape={(x,y) for y,spans in rows.items()
           for left,right in spans for x in range(left,right+1)}
    glyph={(left+dx,y) for y,left in enumerate((5,6,7,8,7,6,5),7) for dx in (0,1)}
    glyph |= {(x,y) for y in (12,13) for x in range(11,17)}
    assert glyph <= shape
    image=cleared.copy()
    draw=ImageDraw.Draw(image)
    for x,y in sorted(shape):
        edge=any((x+dx,y+dy) not in shape for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)))
        # One suit ramp: contour and broad lower-right shade share one blue.
        # The upper-left shoulder's violet-blue provides the small lit cap.
        shade='shadow' if edge or x+y>=26 else 'highlight' if x+y<=11 else 'mid'
        color=PALETTE['white' if (x,y) in glyph else shade]
        draw.rectangle((442+x*12,646+y*12,453+x*12,657+y*12),fill=color)
    image.save(ROOT/'pfp-codex.png')
    mask=ImageChops.lighter(old_mask,cell_mask(source.size,shape,CODEX_ORIGIN,CELL))
    mask.save(ROOT/'mask-codex-chest.png')
    samples={}
    for name,color in PALETTE.items():
        if name=='white': continue
        samples[name]=next([x,y] for y in range(540,800) for x in range(40,365)
                           if source.getpixel((x,y))==color)
    return {'origin':CODEX_ORIGIN,'cell_px':12,'size_cells':21,
            'shape':'7 stepped cloud lobes; 20 by 18 cells; 1–2-cell junction notches',
            'palette':PALETTE,'suit_sample_coordinates':samples,
            'glyph':'2-cell white sharp chevron; underscore baseline rows 12–13',
            'light':'upper left; contour and lower-right shadow share darkest suit blue'}


def portrait_visor_donor(source, mask, x,y):
    # Connect the existing diagonal helmet seam across the removed mark.
    # These steps follow exposed anchors at x598,611,625,643 on successive rows.
    seam = ((551,591) if y<207 else (591,602) if y<228
            else (601,612) if y<242 else (611,626) if y<258
            else (624,644) if y<271 else (637,647))
    on_seam = y<288 and seam[0]<=x<seam[1]
    on_visor = y>=264 and (y>=288 or x<seam[1])
    if on_seam or on_visor:
        if y>=264:
            return (480,y) if y<289 else (508,y) if y<335 else (650,y)
        # Nearest exposed dark seam, or the same-row dark helmet edge when
        # the mark covers the entire seam. Never borrow another marked pixel.
        donors=[dx for dx in range(430,790) if not mask.getpixel((dx,y))
                and max(source.getpixel((dx,y)))<60]
        return (min(donors,key=lambda dx:abs(dx-x)),y)
    if y<218:
        return (571,y)
    # Upper mark covers blue helmet. Same-row clean helmet on the right.
    if y<264:
        return (649,y)
    return (680,y)


def gemini():
    source=Image.open(ROOT/'v13-gemini.png')
    sparkle=cell_mask(source.size,official_shape('gemini',13),(494,192),13)
    old={(x,y) for y in range(6) for x in range(6)
         if not (x in (0,5) and y in (0,5))}
    mask=ImageChops.lighter(sparkle,cell_mask(source.size,old,(539,237),13))
    image=source.copy()
    for y in range(192,361):
        for x in range(494,663):
            if mask.getpixel((x,y)):
                image.putpixel((x,y),source.getpixel(portrait_visor_donor(source,mask,x,y)))
    image.save(ROOT/'pfp-gemini.png')
    mask.save(ROOT/'mask-gemini-visor.png')


def sprite():
    source=Image.open(ROOT/'sprite-gemini-original.png')
    rows={55:(85,85),56:(84,86),57:(83,87),58:(84,86),
          59:(84,86),60:(84,86),61:(84,86),62:(85,86)}
    image=source.copy()
    mask=Image.new('L',source.size)
    for y,(left,right) in rows.items():
        for x in range(left,right+1):
            donor_x=87 if y<57 and x<86 else 86 if y==56 else 82 if y<60 else 88
            rgb=source.getpixel((donor_x,y))[:3]
            image.putpixel((x,y),(*rgb,source.getpixel((x,y))[3]))
            mask.putpixel((x,y),255)
    image.save(ROOT/'sprite-gemini.png')
    mask.save(ROOT/'mask-sprite-gemini-visor.png')


def zoom(name, box, scale, filename):
    image=Image.open(ROOT/name).crop(box)
    result=image.resize((image.width*scale,image.height*scale),NEAREST)
    result.save(ROOT/filename)
    return result


def circle(name, size):
    image=Image.open(ROOT/f'pfp-{name}.png').convert('RGBA').resize((size,size),NEAREST)
    mask=Image.new('L',(size,size))
    ImageDraw.Draw(mask).ellipse((0,0,size-1,size-1),fill=255)
    image.putalpha(mask)
    image.save(ROOT/f'preview-{name}-{size}.png')
    return image


def board():
    # Native image pixels are enlarged exactly 6x or 8x with no smoothing.
    board=Image.new('RGB',(3440,5800),'#101827')
    draw=ImageDraw.Draw(board)
    font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',30)
    title_font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf',44)
    def label(text,x,y,big=False):
        draw.text((x,y),text,font=title_font if big else font,fill='#edf2ff')
    def paste(image,x,y):
        board.paste(image,(x,y),image.getchannel('A') if image.mode=='RGBA' else None)
    label('V14 / CODEX CLOUD + GEMINI VISOR CLEANUP',40,24,True)
    for x,name,text in [(40,'v13-codex.png','Codex / v13'),(480,'pfp-codex.png','Codex / v14')]:
        label(text,x,100);paste(Image.open(ROOT/name).resize((384,384),NEAREST),x,150)
    label('3 suit shades + white glyph. Official cloud, 21 cells.',940,150)
    label('Upper-left light; no separate rim color.',940,200)
    for i,(name,size) in enumerate((n,s) for n in ('codex','claude','gemini') for s in (64,128)):
        x=960+i*280
        label(f'{name} / {size}px',x,300)
        paste(circle(name,size),x,350)
    label('Codex chest / v14 / 6x',40,575)
    label('Approved Gemini chest / unchanged / 6x',1740,575)
    paste(zoom('pfp-codex.png',(424,628,712,916),6,'zoom-codex-badge-6x.png'),20,630)
    paste(zoom('pfp-gemini.png',(420,696,693,969),6,'zoom-gemini-chest-6x.png'),1780,630)
    label('GEMINI PORTRAIT / chest unchanged',40,2390,True)
    for x,name,text in [(40,'v13-gemini.png','v13'),(480,'pfp-gemini.png','v14')]:
        label(text,x,2460);paste(Image.open(ROOT/name).resize((384,384),NEAREST),x,2510)
    label('Visor before / 6x',40,2940);label('Visor after / 6x',1740,2940)
    paste(zoom('v13-gemini.png',(440,179,710,374),6,'zoom-gemini-visor-before-6x.png'),40,3000)
    paste(zoom('pfp-gemini.png',(440,179,710,374),6,'zoom-gemini-visor-6x.png'),1740,3000)
    label('IN-APP SPRITE / 8x / alpha unchanged',40,4230,True)
    for x,name,text in [(40,'sprite-gemini-original.png','Original / 8x'),(1450,'sprite-gemini.png','Edited / 8x')]:
        label(text,x,4310)
        paste(zoom(name,(0,0,160,160),8,f'zoom-{Path(name).stem}-8x.png'),x,4360)
    label('64px / 128px circle previews shown at actual size above.',40,5700)
    board.save(ROOT/'review-board.png')
    zoom('sprite-gemini.png',(76,50,96,68),6,'zoom-sprite-visor-6x.png')


if __name__=='__main__':
    metadata=codex()
    print('Saved Codex portrait and mask.')
    gemini()
    print('Saved Gemini portrait and mask.')
    sprite()
    print('Saved sprite candidate and mask; public sprite untouched.')
    shutil.copyfile(ROOT/'v13-claude.png',ROOT/'pfp-claude.png')
    (ROOT/'metadata-v14.json').write_text(json.dumps(metadata,indent=2)+'\n')
    board()
    print('Saved board, native 6x zooms, and circle previews.')
