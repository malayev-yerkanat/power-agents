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
        # User permits a 22–24-cell badge; constrain it to the centred 23-cell extent.
        new = {(x,y) for x in range(23) for y in range(23)}
        return ImageChops.lighter(cells_mask(old,(442,646),12).filter(ImageFilter.MaxFilter(3)),
                                  cells_mask(new,(430,634),12))
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
    for size,origin in [(19,(433,709)),(9,(520,218))]:
        half = size//2
        # Fixed approved bounds, independent of masks exported by the editor.
        points = {(x,y) for x in range(size) for y in range(size)}
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
                        center = tile.getpixel((step//2,step//2))
                        from test_corrections import GEMINI
                        palette = (set(GEMINI) if name == 'gemini' else
                                   {(169,163,255),(133,132,255),(96,100,255),
                                    (58,69,255),(45,52,200),(255,255,255)})
                        if center in palette:
                            assert len(tile.getcolors(step*step)) == 1, 'non-flat painted cell'
        previous = ROOT/'checkpoint-before-second-correction'/f'pfp-{name}.png'
        correction_difference = ImageChops.difference(Image.open(previous).convert('RGB'),final)
        correction_mask = Image.new('L',final.size)
        correction_mask.putdata([255 if max(p) else 0 for p in correction_difference.get_flattened_data()])
        prior_mask = (Image.open(ROOT/'checkpoint-before-second-correction'/f'emblem-mask-{name}.png')
                      if name != 'claude' else allowed)
        correction_outside = COUNT(ImageChops.subtract(correction_mask,ImageChops.lighter(declared,prior_mask)))
        assert correction_outside == 0, f'{name}: correction changed pixels beyond old/new emblems'
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
            'correction_changed_pixels_outside_old_and_new_masks':correction_outside,
            'source_sha256':hashlib.sha256((ROOT/f'v12-{name}.png').read_bytes()).hexdigest()}
    assert Image.open(ROOT/'review-board.png').size == (3440,4270)
    # Visual approval is recorded only after the exact exports have been viewed.
    visual = json.loads((ROOT/'visual-review.json').read_text())
    for filename,digest in visual['sha256'].items():
        assert hashlib.sha256((ROOT/filename).read_bytes()).hexdigest() == digest, 'stale visual review'
    assert visual['reviewed'] is True
    from test_corrections import CorrectionTests
    import unittest
    result = unittest.TextTestRunner().run(unittest.defaultTestLoader.loadTestsFromTestCase(CorrectionTests))
    assert result.wasSuccessful(), 'correction acceptance checks failed'
    report = {'method':'Official-logo BOX coverage >= 0.5; flat 12px/13px cells; nearest-neighbour previews',
        'checklist':{'codex_23_cells_official_cloud_four_bands_blue_rim_two_cell_terminal':True,
            'gemini_19_cell_chest_official_mask_equal_tips_fixed_palette':True,
            'gemini_9_cell_visor_official_mask_equal_tips_local_color_edges':True,'claude_byte_identical':True,
            'review_board_v12_v13_three_4x_comparisons_64_128_circles':True,
            'zero_changes_outside_emblem_masks':True,
            'three_6x_nearest_neighbour_comparisons_visually_reviewed':True},
        'agents':agents,'visual_review':visual,
        'verify_command':'PYTHONDONTWRITEBYTECODE=1 python3 verify_v13.py'}
    (ROOT/'inspection.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(agents,indent=2))


if __name__ == '__main__':
    main()
