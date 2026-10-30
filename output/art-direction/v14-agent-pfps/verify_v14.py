"""Independent pixel invariants for v14. Run with -B to avoid bytecode files."""
from pathlib import Path
import argparse
import hashlib
import json
import math
from PIL import Image, ImageDraw, ImageChops

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parents[2]
SPRITE_ROWS = {55: (85, 85), 56: (84, 86), 57: (83, 87),
               58: (84, 86), 59: (84, 86), 60: (84, 86),
               61: (84, 86), 62: (85, 86)}


def verify_codex(source, edited):
    # Approved seven-lobe cloud: rows of (left, right) cell spans.
    rows={1:((7,9),),2:((6,10),(13,15)),3:((5,17),),4:((5,18),),5:((6,18),),
          6:((3,17),),7:((2,19),),8:((1,20),),9:((1,20),),10:((2,18),),
          11:((4,19),),12:((3,19),),13:((2,18),),14:((2,17),),15:((3,15),),
          16:((4,8),(10,16)),17:((5,7),(10,15)),18:((11,14),)}
    shape={(x,y) for y,spans in rows.items() for left,right in spans for x in range(left,right+1)}
    # At least one cell of chest panel between the badge and the armour.
    for x,y in shape:
        for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
            if (x+dx,y+dy) not in shape:
                cx,cy=442+(x+dx)*12+6,646+(y+dy)*12+6
                assert min(edited.getpixel((cx,cy)))>=200, ('no white clearance',x+dx,y+dy)
    blues={(81,106,253),(19,62,252),(7,45,216)}
    suit=set(source.crop((40,540,365,800)).get_flattened_data())
    assert blues<=suit, 'Badge palette must come from suit'
    white={(left+dx,y) for y,left in enumerate((5,6,7,8,7,6,5),7) for dx in (0,1)}
    white|={(x,y) for y in (12,13) for x in range(11,17)}
    used=set()
    for y in range(21):
        for x in range(21):
            block=edited.crop((442+x*12,646+y*12,454+x*12,658+y*12))
            colors=set(block.get_flattened_data())
            if (x,y) in shape:
                assert len(colors)==1, (x,y,'nonuniform cell')
                color=next(iter(colors))
                assert color==(255,255,255) if (x,y) in white else color in blues
                used.add(color)
    assert used==blues|{(255,255,255)}
    for y in range(634,910):
        for x in range(430,706):
            if source.getpixel((x,y))!=edited.getpixel((x,y)):
                cell=((x-442)//12,(y-646)//12)
                if cell not in shape:
                    assert edited.getpixel((x,y))==(254,253,244), 'Old badge residue'
    return {'suit_blue_shades':3,'cloud_lobes':7,'white_clearance':True,
            'white_glyph_two_cells':True,'old_badge_cleared':True}


def verify_review_artifacts():
    zooms=[('pfp-codex.png',(424,628,712,916),6,'zoom-codex-badge-6x.png'),
           ('pfp-gemini.png',(420,696,693,969),6,'zoom-gemini-chest-6x.png'),
           ('pfp-gemini.png',(440,179,710,374),6,'zoom-gemini-visor-6x.png'),
           ('v13-gemini.png',(440,179,710,374),6,'zoom-gemini-visor-before-6x.png'),
           ('sprite-gemini.png',(0,0,160,160),8,'zoom-sprite-gemini-8x.png'),
           ('sprite-gemini-original.png',(0,0,160,160),8,'zoom-sprite-gemini-original-8x.png'),
           ('sprite-gemini.png',(76,50,96,68),6,'zoom-sprite-visor-6x.png')]
    for source,box,scale,filename in zooms:
        expected=Image.open(ROOT/source).crop(box)
        expected=expected.resize((expected.width*scale,expected.height*scale),Image.Resampling.NEAREST)
        actual=Image.open(ROOT/filename)
        assert (actual.size,actual.mode,actual.tobytes())==(expected.size,expected.mode,expected.tobytes())
    for name in ('codex','claude','gemini'):
        for size in (64,128):
            actual=Image.open(ROOT/f'preview-{name}-{size}.png')
            assert actual.size==(size,size) and actual.mode=='RGBA'
            assert actual.getpixel((0,0))[3]==0
            assert actual.getpixel((size//2,size//2))[3]==255
    assert Image.open(ROOT/'review-board.png').size==(3440,5800)
    return {'exact_nearest_neighbor_zooms':7,'circle_previews':6,'board_size':[3440,5800]}


def allowed_mask(name, size):
    mask = Image.new('L', size)
    draw = ImageDraw.Draw(mask)
    if name == 'codex':
        centers = [(11 + 8 * math.cos(k * math.pi / 4),
                    11 + 8 * math.sin(k * math.pi / 4)) for k in range(8)]
        for y in range(23):
            for x in range(23):
                if ((x - 11) ** 2 + (y - 11) ** 2 <= 7.8 ** 2
                        or any((x - a) ** 2 + (y - b) ** 2 <= 3.5 ** 2
                               for a, b in centers)):
                    draw.rectangle((430+x*12, 634+y*12, 441+x*12, 645+y*12), fill=255)
        # New, smaller cloud stays inside this chest-panel rectangle.
        draw.rectangle((442, 646, 693, 897), fill=255)
    elif name == 'gemini':
        # Independent exact v13 mark palette, restricted to the visor.
        source = Image.open(ROOT / 'v13-gemini.png')
        palette = {(234,67,53), (197,34,31), (251,188,4), (224,156,0),
                   (52,168,83), (24,128,56), (66,133,244), (26,95,208), (138,180,248)}
        for y in range(192, 361):
            for x in range(494, 663):
                if source.getpixel((x,y)) in palette:
                    draw.point((x,y), fill=255)
        # Previous six-cell visor mark and its row-donor restoration.
        for y in range(6):
            for x in range(6):
                if not (x in (0,5) and y in (0,5)):
                    draw.rectangle((539+x*13,237+y*13,551+x*13,249+y*13),fill=255)
    elif name == 'sprite-gemini':
        for y, (left, right) in SPRITE_ROWS.items():
            draw.line((left,y,right,y),fill=255)
    return mask


def verify(deployed=False):
    hashes = json.loads((ROOT / 'source-hashes.json').read_text())
    for name, expected in hashes.items():
        assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == expected, name
    results = {'sources_unchanged': True, 'files': {}}
    pairs = [('codex','v13-codex.png','pfp-codex.png'),
             ('claude','v13-claude.png','pfp-claude.png'),
             ('gemini','v13-gemini.png','pfp-gemini.png'),
             ('sprite-gemini','sprite-gemini-original.png','sprite-gemini.png')]
    for name, before, after in pairs:
        source, edited = Image.open(ROOT/before), Image.open(ROOT/after)
        assert (source.size,source.mode) == (edited.size,edited.mode), name
        mask = allowed_mask(name,source.size)
        changed = Image.new('L',source.size)
        changed.putdata([255 if a != b else 0 for a,b in zip(
            source.get_flattened_data(),edited.get_flattened_data())])
        outside = ImageChops.subtract(changed,mask)
        assert outside.getbbox() is None, f'{name}: changes outside mask'
        if name == 'claude':
            assert (ROOT/before).read_bytes() == (ROOT/after).read_bytes()
        else:
            assert changed.getbbox(), f'{name}: expected an edit'
        if name == 'codex':
            results['codex_badge']=verify_codex(source,edited)
        if name == 'gemini':
            assert source.crop((420,696,693,969)).tobytes() == edited.crop((420,696,693,969)).tobytes()
            for y in range(192,361):
                for x in range(494,663):
                    if mask.getpixel((x,y)):
                        r,g,b = edited.getpixel((x,y))
                        assert max(r,g,b)<100 or (b>r+80 and b>g+50), (x,y,(r,g,b))
        if name == 'sprite-gemini':
            assert source.getchannel('A').tobytes() == edited.getchannel('A').tobytes()
            for y,(left,right) in SPRITE_ROWS.items():
                for x in range(left,right+1):
                    r,g,b,a=edited.getpixel((x,y))
                    assert (b>r+80 and b>g+50) if y<57 and x<86 else max(r,g,b)<30
        results['files'][after] = {
            'size':list(edited.size), 'mode':edited.mode,
            'changed_pixels':sum(v>0 for v in changed.get_flattened_data()),
            'changed_bounds':changed.getbbox(), 'outside_mask_changes':0,
            'sha256':hashlib.sha256((ROOT/after).read_bytes()).hexdigest()}
    if deployed:
        live = PROJECT/'public/art/gemini.png'
        assert live.read_bytes() == (ROOT/'sprite-gemini.png').read_bytes()
        results['public_sprite_matches_verified_output'] = True
        results['files']['public/art/gemini.png'] = dict(results['files']['sprite-gemini.png'])
    results['sprite_alpha_unchanged'] = True
    results['gemini_chest_unchanged'] = True
    results['claude_byte_identical'] = True
    results['review_artifacts'] = verify_review_artifacts()
    return results


if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--deployed',action='store_true')
    args=parser.parse_args()
    results=verify(args.deployed)
    path=ROOT/'inspection.json'
    previous=json.loads(path.read_text()) if path.exists() else {}
    results['visual_inspection']=previous.get('visual_inspection', {'completed':False})
    if results['visual_inspection'].get('completed'):
        seen=results['visual_inspection'].get('viewed_artifact_hashes',{})
        if not seen or any(hashlib.sha256((ROOT/name).read_bytes()).hexdigest()!=digest
                           for name,digest in seen.items()):
            results['visual_inspection']={'completed':False,'reason':'Viewed artifacts changed; inspect again.'}
    results['validation_scope']={
        'pixel_invariants':'passed', 'python_syntax':'checked with compile(); no bytecode written',
        'app_suite':'Not run: suite invokes git init/add/commit; user forbids state-changing git commands.',
        'linter':'No lint command configured in package.json.'}
    path.write_text(json.dumps(results,indent=2)+'\n')
    print(json.dumps(results,indent=2))
