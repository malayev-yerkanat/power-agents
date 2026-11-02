"""Local, deterministic PIL edits. Run from any working directory; writes only here."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageChops, ImageFont
import json, math, hashlib

ROOT = Path(__file__).resolve().parent
NAMES = ('codex', 'claude', 'gemini')
NEAREST = Image.Resampling.NEAREST
RINGS = {
    'codex': (511, 443, 434, 424, 60),
    'claude': (511, 402, 403, 381, 58),
    'gemini': (510, 404, 402, 390, 55),
}

def load(name):
    return Image.open(ROOT / f'v11-{name}.png').convert('RGB')

def character_mask(name, source):
    if name != 'codex':
        barrier = Image.new('L', source.size)
        barrier.putdata([255 if max(c) < (110 if name == 'gemini' else 155) else 0 for c in source.get_flattened_data()])
        closed = barrier.filter(ImageFilter.MaxFilter(13))
        ImageDraw.floodfill(closed, (0, 0), 128, thresh=0)
        inside = closed.point(lambda v: 0 if v == 128 else 255).filter(ImageFilter.MinFilter(13))
        return ImageChops.lighter(inside, barrier)
    # Trace the existing stepped navy silhouette; no portrait resampling.
    vertices = [
        (0,1023),(0,886),(12,886),(12,844),(24,844),(24,826),(43,814),
        (43,687),(55,687),(55,661),(68,661),(68,638),(81,638),(81,614),
        (106,590),(130,566),(154,553),(166,541),(214,541),(214,531),
        (263,531),(263,542),(311,542),(311,553),(356,553),
        (356,504),(389,478),(389,453),(376,453),(376,429),(364,429),
        (364,404),(351,404),(351,380),(339,380),(339,355),(326,355),
        (326,299),(337,299),(337,250),(349,250),(349,226),(361,226),
        (361,202),(386,202),(386,177),(411,177),(411,153),(437,153),
        (437,129),(484,129),(484,105),(588,105),(588,117),(622,117),
        (622,129),(659,129),(659,141),(683,141),(683,153),(708,153),
        (708,178),(732,178),(732,202),(744,202),(744,239),(756,239),
        (756,348),(744,348),(744,380),(733,380),(733,419),(709,419),
        (709,453),(684,453),(684,490),(672,490),(672,538),(660,538),
        (660,566),(636,566),(636,614),(709,614),(709,601),(758,601),
        (758,613),(794,613),(794,625),(819,625),(819,638),(843,638),
        (843,662),(867,662),(867,687),(880,687),(880,723),(892,723),
        (892,771),(916,771),(916,828),(903,828),(903,899),(929,899),
        (929,948),(954,948),(954,974),(979,974),(979,999),(1005,999),
        (1005,1023),
    ]
    mask = Image.new('L', source.size)
    ImageDraw.Draw(mask).polygon(vertices, fill=255)
    nearby=mask.filter(ImageFilter.MaxFilter(49))
    core=mask.load();near=nearby.load();sp=source.load()
    for y in range(1024):
        for x in range(1024):
            if core[x,y] or not near[x,y]:continue
            r,g,b=sp[x,y]
            background_navy=(r<60 and 15<=g<75 and 30<=b<115)
            background_lavender=(r>80 and abs(r-g)<20 and b>r+30)
            if not background_navy and not background_lavender and (b>115 or r>160 or g>100):core[x,y]=255
    edge_near=mask.filter(ImageFilter.MaxFilter(7)).load()
    for y in range(1024):
        for x in range(1024):
            if edge_near[x,y] and not core[x,y]:
                r,g,b=sp[x,y]
                if g<15 and b<100:core[x,y]=255
    return mask

def ring_mask(name, foreground):
    cx,cy,rx,ry,th = RINGS[name]
    m=Image.new('L',(1024,1024));d=ImageDraw.Draw(m)
    # Margin includes the original curved edge / dark fringe.
    d.ellipse((cx-rx-16,cy-ry-16,cx+rx+16,cy+ry+16),fill=255)
    d.ellipse((cx-rx+th+16,cy-ry+th+16,cx+rx-th-16,cy+ry-th-16),fill=0)
    return ImageChops.subtract(m,foreground)

def reconstruct_stripes(source, mask, foreground, name):
    """Continue diagonal runs through the annulus with original, nearest donors.

    Nearest clean source patches continue each stripe. No blur or generated pixels.
    """
    src=source.load(); holes=mask.load(); fg=foreground.load(); out=source.copy(); px=out.load()
    step=12 if name != 'claude' else 8
    for by in range(0,1024,step):
        for bx in range(0,1024,step):
            points=[(x,y) for y in range(by,min(by+step,1024)) for x in range(bx,min(bx+step,1024)) if holes[x,y]]
            if not points:continue
            donors=[]
            for sign in [-1,1]:
                for delta in range(step,1024,step):
                    dx,dy=sign*delta,-sign*round(delta * (1.07 if name == 'gemini' else 1.0))
                    if not (0<=bx+dx<1024-step and 0<=by+dy<1024-step):break
                    if all(not holes[x+dx,y+dy] and not fg[x+dx,y+dy] and (name!='codex' or src[x+dx,y+dy][1]>=12) for x,y in points):
                        donors.append((delta,dx,dy));break
            if not donors:
                for x,y in points:
                    found=False
                    for delta in range(1,1024):
                        for sign in [-1,1]:
                            xx,yy=x+sign*delta,y-sign*delta
                            if not (0<=xx<1024 and 0<=yy<1024):continue
                            if not holes[xx,yy] and not fg[xx,yy] and (name!='codex' or src[xx,yy][1]>=12):
                                px[x,y]=src[xx,yy];found=True;break
                        if found:break
                    if not found:raise RuntimeError(f'No stripe donor: {name} {x},{y}')
                continue
            _,dx,dy=min(donors)
            for x,y in points:px[x,y]=src[x+dx,y+dy]
    return out

def initial():
    for name in NAMES:
        src=load(name);fg=character_mask(name,src);ring=ring_mask(name,fg)
        fg.save(ROOT/f'character-mask-{name}.png');ring.save(ROOT/f'ring-mask-{name}.png')
        result=reconstruct_stripes(src,ring,fg,name)
        if name in ('codex', 'gemini'):
            pp=result.load();sp=src.load();mm=ring.load()
            for y in range(125):
                for x in range(1024):
                    u=round(x+(y//8*8)/(1.07 if name=='gemini' else 1))
                    if mm[x,y] and 340<=u<=730:pp[x,y]=sp[u,0]
        from pixel_cleanup import clean
        result=clean(result,ring,fg,name)
        result.save(ROOT/f'ringless-{name}.png')


# Each replacement is first drawn on its measured local logical cell grid.
PALETTE = {
    'white_codex': (254,253,244), 'white_gemini': (254,253,245),
    'codex_blue': (11,55,251), 'codex_high': (77,78,253),
    'navy': (8,15,29), 'red': (253,0,10), 'yellow': (255,203,0),
    'green': (0,163,65), 'blue': (0,82,254),
}

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

def codex_badge(image, source):
    old=colored_footprint(source,(438,643,701,899),lambda r,g,b:b>r+25 and b>g+25, seed=(568,770))
    image.paste(PALETTE['white_codex'],(0,0),old)
    # 21x21, mirrored stepped shield with a full 12px white rim.
    halfwidths=[4,6,8,9,10,10,10,10,10,10,10,10,9,9,8,7,6,5,4,3,2]
    silhouette={(x,y) for y,h in enumerate(halfwidths) for x in range(10-h,11+h)}
    inside={p for p in silhouette if all((p[0]+dx,p[1]+dy) in silhouette for dx,dy in [(0,-1),(0,1),(-1,0),(1,0)])}
    cells={p:'white_codex' for p in silhouette}
    cells.update({p:('codex_high' if p[1]<4 else 'codex_blue') for p in inside})
    # Bold chevron and underscore finish on row 13. Combined bounds centre at x=10.
    glyph=['##...','.##..','..##.','...##','..##.','.##..','##...']
    terminal=set()
    for y,row in enumerate(glyph,7):
        for x,v in enumerate(row,4):
            if v=='#':terminal.add((x,y))
    terminal.update((x,y) for x in range(10,17) for y in [12,13])
    for p in terminal:cells[p]='white_codex'
    drawn=paint_cells(image,cells,(442,646),12,PALETTE)
    allowed=ImageChops.lighter(old,drawn)
    assert all((20-x,y) in silhouette for x,y in silhouette)
    assert max(y for x,y in terminal if x<10)==max(y for x,y in terminal if x>=10)==13
    return allowed, {'grid_px':12,'origin':[442,646],'crop':[430,634,706,910],
                     'center':[568,772],'shield_horizontal_symmetry':True,
                     'terminal_common_baseline_y_exclusive':814,'terminal_pair_center_x':568,
                     'old_footprint_pixels':sum(v>0 for v in old.get_flattened_data())}

def gemini_chest(image,source):
    old=colored_footprint(source,(446,702,703,963),lambda r,g,b:max(r,g,b)-min(r,g,b)>50 and min(r,g,b)<160, seed=(556,850))
    image.paste(PALETTE['white_gemini'],(0,0),old)
    # Four equal angular blades, related by exact quarter turns about (0,0).
    widths=[1,1,2,2,3,4,6,8]
    red={(x,y-8) for y,w in enumerate(widths) for x in range(-w,0)}
    rotate=lambda points:{(-y-1,x) for x,y in points}
    blue=rotate(red);green=rotate(blue);yellow=rotate(green)
    blades={'red':red,'blue':blue,'green':green,'yellow':yellow}
    shape=set().union(*blades.values())
    rim={(x+dx,y+dy) for x,y in shape for dx,dy in [(0,0),(0,-1),(0,1),(-1,0),(1,0)]}-shape
    cells={p:'navy' for p in rim}
    for color,points in blades.items():cells.update({p:color for p in points})
    # Boundary through (556,832); logical origin is the centre junction.
    drawn=paint_cells(image,cells,(556,832),13,PALETTE)
    assert len({len(v) for v in blades.values()})==1
    assert rotate(shape)==shape
    return ImageChops.lighter(old,drawn), {'grid_px':13,'center':[556,832],
        'crop':[426,702,686,962],'blade_cell_counts':{k:len(v) for k,v in blades.items()},
        'quarter_turn_geometry_equal':True,'solid_palette_blades':True,'outline':'dark navy'}

def gemini_visor(image,source):
    old=colored_footprint(source,(519,205,628,386),lambda r,g,b:(r>160 and r>g*1.6 and r>b*1.8) or (r>170 and g>120 and b<100) or (g>60 and g>r*1.5 and g>b*1.4))
    # Old coloured trail / drop shadow belongs to the mark, not the helmet.
    ImageDraw.Draw(old).rectangle((576,287,621,411),fill=255)
    om=old.load();sp=source.load()
    for yy in range(309,412):
        for xx in range(541,624):
            if max(sp[xx,yy])<120:om[xx,yy]=255
    pix=image.load();s=source.load();m=old.load()
    for y in range(205,412):
        for x in range(519,628):
            if not m[x,y]:continue
            if y<264:
                # Same helmet row, immediately left of the oversized mark.
                pix[x,y]=s[x-65,y]
            else:
                # Sample the uninterrupted black visor at the same height.
                pix[x,y]=s[658,max(y,350)]
    # 78px cross (45% of the previous 175px height), six 13px cells.
    shape={(x,y) for y in range(6) for x in range(6) if not (x in [0,5] and y in [0,5])}
    cells={p:('red' if p[0]<3 and p[1]<3 else 'blue' if p[1]<3 else 'yellow' if p[0]<3 else 'green') for p in shape}
    drawn=paint_cells(image,cells,(539,237),13,PALETTE)
    assert {(5-x,y) for x,y in shape}==shape
    assert {(x,5-y) for x,y in shape}==shape
    return ImageChops.lighter(old,drawn), {'grid_px':13,'center':[578,276],
        'crop':[513,211,643,341],'new_size_px':[78,78], 'old_size_px':[104,175],
        'axis_aligned':True,'symmetric_geometry':True,'four_colors':True,
        'old_mark_trail_removed':True,'old_trail_cleanup_includes_fringe_x':[622,623]}

def font(size):
    for p in ['/System/Library/Fonts/Menlo.ttc','/System/Library/Fonts/Helvetica.ttc']:
        if Path(p).exists():return ImageFont.truetype(p,size)
    return ImageFont.load_default(size=size)

def circular(image,size):
    tile=image.resize((size,size),NEAREST).convert('RGBA')
    m=Image.new('L',(size,size));ImageDraw.Draw(m).ellipse((0,0,size-1,size-1),fill=255)
    tile.putalpha(m);return tile

def review_board(results,metadata):
    board=Image.new('RGB',(2690,3840),(17,23,35));d=ImageDraw.Draw(board)
    d.text((30,22),'AGENT PORTRAITS / v11 → v12',font=font(30),fill='white')
    d.text((30,67),'Ring removal + three deterministic pixel emblems. All previews use nearest-neighbour.',font=font(18),fill=(182,192,208))
    for row,name in enumerate(NAMES):
        y=120+row*1240
        d.text((30,y),name.upper(),font=font(26),fill='white')
        d.text((30,y+40),'v11 / approved source',font=font(18),fill=(182,192,208))
        d.text((558,y+40),'v12 / final',font=font(18),fill=(182,192,208))
        board.paste(load(name).resize((512,512),NEAREST),(30,y+75))
        board.paste(results[name].resize((512,512),NEAREST),(558,y+75))
        d.text((30,y+610),'Circular previews / final',font=font(18),fill=(182,192,208))
        for size,x in [(64,30),(128,142)]:
            preview=circular(results[name],size);preview.save(ROOT/f'preview-{name}-{size}.png')
            board.paste(preview,(x,y+650),preview)
            d.text((x,y+790),f'{size}px',font=font(17),fill='white')
        if name=='codex':
            box=metadata[name]['chest']['crop'];tile=results[name].crop(box)
            board.paste(tile.resize((tile.width*4,tile.height*4),NEAREST),(1110,y+75))
            d.text((1110,y+40),'Chest badge / exact 4×',font=font(18),fill='white')
        elif name=='gemini':
            for key,x,dy in [('chest',1110,75),('visor',2170,75)]:
                box=metadata[name][key]['crop'];tile=results[name].crop(box)
                board.paste(tile.resize((tile.width*4,tile.height*4),NEAREST),(x,y+dy))
                d.text((x,y+40),f'{key.title()} / exact 4×',font=font(18),fill='white')
        else:
            d.text((1110,y+75),'Ring removal only.',font=font(24),fill='white')
            d.text((1110,y+120),'Character is pixel-identical to v11.',font=font(20),fill=(182,192,208))
    board.save(ROOT/'review-board.png')

def finalize():
    initial();results={};metadata={};agents={}
    for name in NAMES:
        source=load(name);im=Image.open(ROOT/f'ringless-{name}.png').convert('RGB')
        ring=Image.open(ROOT/f'ring-mask-{name}.png').convert('L');fg=Image.open(ROOT/f'character-mask-{name}.png').convert('L')
        emblem=Image.new('L',source.size);metadata[name]={}
        if name=='codex':
            emblem,metadata[name]['chest']=codex_badge(im,source)
        elif name=='gemini':
            chest,metadata[name]['chest']=gemini_chest(im,source)
            visor,metadata[name]['visor']=gemini_visor(im,source)
            emblem=ImageChops.lighter(chest,visor)
        allowed=ImageChops.lighter(ring,emblem)
        delta=ImageChops.difference(im,source).convert('RGB')
        changed=Image.new('L',source.size);changed.putdata([255 if max(c)>0 else 0 for c in delta.get_flattened_data()])
        outside=ImageChops.subtract(changed,allowed)
        protected=ImageChops.multiply(changed,ImageChops.subtract(fg,emblem))
        count=lambda mask:sum(v>0 for v in mask.get_flattened_data())
        assert count(outside)==0, f'{name}: changed pixels outside requested areas'
        assert count(protected)==0, f'{name}: unrelated character edits'
        assert im.size==(1024,1024) and im.mode=='RGB'
        emblem.save(ROOT/f'emblem-mask-{name}.png');changed.save(ROOT/f'diff-mask-{name}.png');allowed.save(ROOT/f'allowed-mask-{name}.png')
        im.save(ROOT/f'pfp-{name}.png');results[name]=im
        agents[name]={'dimensions':[1024,1024],'opaque':True,'ring_removed':True,
          'character_pixels_outside_emblem_fixes_unchanged':True,'ring_repair_before_emblems':True,
          'changed_pixels_total':count(changed),'changed_pixels_outside_fix_areas':count(outside),
          'unexpected_character_changes':count(protected),'outside_fix_changed_coordinates':[],
          'ring_repair_mask':f'ring-mask-{name}.png','emblem_repair_mask':f'emblem-mask-{name}.png',
          'exact_diff_mask':f'diff-mask-{name}.png','emblems':metadata[name],
          'source_sha256':hashlib.sha256((ROOT/f'v11-{name}.png').read_bytes()).hexdigest()}
    review_board(results,metadata)
    inspection={'method':'Deterministic PIL source-pixel stripe continuation, followed by local grid emblem drawing.',
       'generator_used':False,'resampling':'nearest-neighbour only','stripe_cleanup':'Discrete stripe-label continuation with copied source colours; no RGB averaging or blur',
       'grid_measurement':{'codex_nominal_block_px':12,'gemini_nominal_block_px':13,
          'limitation':'The v11 raster has variable-width cells, not one exact global grid. Local nominal grids are used only inside the replacement emblems.'},
       'checklist':{'rings_removed_all_three':'done','codex_symmetric_blue_badge_white_outline':'done',
          'codex_bold_terminal_pair_centered_common_baseline':'done','gemini_equal_four_color_chest_blades_navy_outline':'done',
          'gemini_small_axis_aligned_four_color_visor_mark':'done','claude_ring_only':'done',
          'review_board_before_after_4x_and_circular_previews':'done','no_changes_outside_fix_areas':'done'},
       'agents':agents,'remaining_issues':[],
       'independent_verifier':'verify_artifacts.py','verification':'Pixel-difference assertions, badge reflection and common baseline assertions, quarter-turn blade geometry/count assertions, visor reflection assertions; visual review of all portraits and the review board.'}
    (ROOT/'inspection.json').write_text(json.dumps(inspection,indent=2)+'\n')
    (ROOT/'PROMPTS.md').write_text('''# v12 edit record\n\nNo image generator was used. There are no generator prompts.\n\nThe brief permits procedural stripe reconstruction. The PIL method keeps the approved character pixels intact and makes every change auditable.\n\nRun: `PYTHONDONTWRITEBYTECODE=1 python3 edit_portraits.py` from this folder. The script writes only beside itself.\n\n1. Protect the source character silhouettes. Remove the background rings inside documented annulus masks by continuing the diagonal speed stripes with nearest source-pixel patches. The clean top-border profile anchors the Codex and Gemini top arcs in stepped rows. Categorical stripe-label continuation removes isolated donor fragments by copying matching source pixels; it never averages or blurs RGB colours. No whole-portrait resampling.\n2. Clear only the old coloured emblem footprints, plus the old visor mark trail. Use surrounding chest-panel colours and same-row helmet/visor samples.\n3. Draw Codex on its nominal 12px local grid: reflected stepped blue shield, white outline, a centred bold `>_` with one shared baseline.\n4. Draw Gemini on its nominal 13px local grid: four identical quarter-turned angular blades (red, blue, green, yellow) with a navy outline, centred at the white chest panel. Draw a small symmetric four-quadrant visor cross on the same grid.\n5. Compare final and source pixels. Assert zero changes outside ring/emblem masks and zero protected character changes. Save exact diff masks, 64px/128px circular previews, and native-crop 4× emblem zooms on the review board. Run `PYTHONDONTWRITEBYTECODE=1 python3 verify_artifacts.py` for an independent read-only check of exported pixels, actual glyph components, equal blade areas/quarter-turns, previews, and board crops.\n\nThe generated source rasters do not have a mathematically exact global pixel grid; the 12px/13px local grids follow measured emblem block sizes. Outside the requested repairs, source pixels are retained exactly.\n''')
    print(json.dumps({name:{k:v for k,v in a.items() if k in ['changed_pixels_total','changed_pixels_outside_fix_areas','unexpected_character_changes']} for name,a in agents.items()},indent=2))

if __name__=='__main__':finalize()
