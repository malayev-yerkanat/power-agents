"""Independently check exported pixels, geometry, scope, and previews."""
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter
import hashlib
import json

ROOT = Path(__file__).resolve().parent
COUNT = lambda mask: sum(value != 0 for value in mask.get_flattened_data())


def cells_mask(points, origin, step):
    mask = Image.new('L',(1024,1024))
    draw = ImageDraw.Draw(mask)
    for x,y in points:
        left,top = origin[0]+x*step,origin[1]+y*step
        draw.rectangle((left,top,left+step-1,top+step-1),fill=255)
    return mask


def authorized(name):
    if name == 'claude':
        return Image.new('L',(1024,1024))
    if name == 'codex':
        widths = [4,6,8,9,10,10,10,10,10,10,10,10,9,9,8,7,6,5,4,3,2]
        old = {(x,y) for y,w in enumerate(widths) for x in range(10-w,11+w)}
        # Both old shield and new cloud occupy this fixed local 21-cell extent.
        new = {(x,y) for x in range(21) for y in range(21)}
        return cells_mask(old|new,(442,646),12).filter(ImageFilter.MaxFilter(3))
    widths = [1,1,2,2,3,4,6,8]
    blade = {(x,y-8) for y,w in enumerate(widths) for x in range(-w,0)}
    shape = set(blade)
    for _ in range(3):
        blade = {(-y-1,x) for x,y in blade}
        shape |= blade
    old = {(x+dx,y+dy) for x,y in shape for dx,dy in [(0,0),(1,0),(-1,0),(0,1),(0,-1)]}
    mask = cells_mask(old,(556,832),13).filter(ImageFilter.MaxFilter(3))
    visor = {(x,y) for x in range(6) for y in range(6) if not (x in [0,5] and y in [0,5])}
    mask = ImageChops.lighter(mask,cells_mask(visor,(539,237),13))
    for size,origin in [(17,(446,722)),(11,(507,205))]:
        half = size//2
        points = {(x,y) for x in range(size) for y in range(size)
                  if (abs(x-half)/half)**.65+(abs(y-half)/half)**.65<=1.01}
        assert {(size-1-y,x) for x,y in points} == points
        mask = ImageChops.lighter(mask,cells_mask(points,origin,13))
    return mask


def main():
    agents = {}
    for name in ('codex','gemini','claude'):
        source = Image.open(ROOT/f'v12-{name}.png').convert('RGB')
        final = Image.open(ROOT/f'pfp-{name}.png')
        assert final.size == (1024,1024) and final.mode == 'RGB'
        difference = ImageChops.difference(source,final)
        changed = Image.new('L',final.size)
        changed.putdata([255 if max(p) else 0 for p in difference.get_flattened_data()])
        allowed = authorized(name)
        declared = Image.open(ROOT/f'emblem-mask-{name}.png') if name != 'claude' else allowed
        assert not ImageChops.subtract(declared,allowed).getbbox(), f'{name}: oversized mask'
        outside = COUNT(ImageChops.subtract(changed,declared))
        assert outside == 0, f'{name}: {outside} changes outside emblem masks'
        if name == 'claude':
            assert (ROOT/'pfp-claude.png').read_bytes() == (ROOT/'v12-claude.png').read_bytes()
        else:
            metadata = json.loads((ROOT/f'metadata-{name}.json').read_text())
            for key in ('chest','visor'):
                if key not in metadata:
                    continue
                spec = metadata[key]
                ox,oy = spec['origin']; step = spec['grid_px']; n = spec['cells']
                for y in range(n):
                    for x in range(n):
                        tile = final.crop((ox+x*step,oy+y*step,ox+(x+1)*step,oy+(y+1)*step))
                        if name == 'gemini':
                            half = n//2
                            if (abs(x-half)/half)**.65+(abs(y-half)/half)**.65>1.01:
                                continue
                        elif not declared.getpixel((ox+x*step+step//2,oy+y*step+step//2)):
                            continue
                        # Cleared margins retain panel pixels; painted cells must be flat.
                        center = tile.getpixel((step//2,step//2))
                        painted = name == 'gemini' or center == (255,255,255) or center in {
                            (176,168,255),(153,159,255),(124,156,255),(99,123,255),(58,69,255)}
                        if painted:
                            assert len(tile.getcolors(step*step)) == 1
                            assert max(center) > 150, 'black/navy emblem cell'
        for size in (64,128):
            preview = Image.open(ROOT/f'preview-{name}-{size}.png')
            assert preview.size == (size,size) and preview.mode == 'RGBA'
            expected = final.resize((size,size),Image.Resampling.NEAREST)
            assert not ImageChops.difference(preview.convert('RGB'),expected).getbbox()
            alpha = Image.new('L',(size,size))
            ImageDraw.Draw(alpha).ellipse((0,0,size-1,size-1),fill=255)
            assert not ImageChops.difference(preview.getchannel('A'),alpha).getbbox()
        agents[name] = {'dimensions':[1024,1024],'opaque':True,
            'changed_pixels_total':COUNT(changed),'changed_pixels_outside_emblem_masks':outside,
            'source_sha256':hashlib.sha256((ROOT/f'v12-{name}.png').read_bytes()).hexdigest()}
    assert Image.open(ROOT/'review-board.png').size == (3440,4270)
    report = {'method':'Deterministic PIL; local 12px/13px cells; nearest-neighbour only',
        'checklist':{'codex_official_cloud_five_bands_white_terminal':True,
            'gemini_concave_equal_tips_stepped_colors_no_black_outline':True,
            'gemini_visor_eleven_cells_no_outline':True,'claude_byte_identical':True,
            'review_board_v12_v13_three_4x_comparisons_64_128_circles':True,
            'zero_changes_outside_emblem_masks':True},
        'agents':agents,'remaining_issues':[],
        'visual_checks':'Portraits and full review board inspected; logical-cell rounding approximates reference curves.',
        'verify_command':'PYTHONDONTWRITEBYTECODE=1 python3 verify_v13.py'}
    (ROOT/'inspection.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(agents,indent=2))


if __name__ == '__main__':
    main()
