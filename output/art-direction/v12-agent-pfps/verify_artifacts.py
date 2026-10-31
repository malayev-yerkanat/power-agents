"""Read-only checks of exported pixels, independent of drawing implementation."""
from pathlib import Path
from collections import Counter
import json
from PIL import Image, ImageChops

ROOT=Path(__file__).resolve().parent
report=json.loads((ROOT/'inspection.json').read_text())
board=Image.open(ROOT/'review-board.png').convert('RGB')
assert board.size==(2690,3840)
count=lambda mask:sum(v>0 for v in mask.get_flattened_data())
for row,name in enumerate(['codex','claude','gemini']):
    source=Image.open(ROOT/f'v11-{name}.png').convert('RGB')
    final=Image.open(ROOT/f'pfp-{name}.png')
    assert final.mode=='RGB' and final.size==(1024,1024)
    diff=ImageChops.difference(source,final)
    changed=Image.new('L',final.size)
    changed.putdata([255 if max(c) else 0 for c in diff.get_flattened_data()])
    allowed=Image.open(ROOT/f'allowed-mask-{name}.png').convert('L')
    fg=Image.open(ROOT/f'character-mask-{name}.png').convert('L')
    emblems=Image.open(ROOT/f'emblem-mask-{name}.png').convert('L')
    assert count(ImageChops.subtract(changed,allowed))==0
    assert count(ImageChops.multiply(changed,ImageChops.subtract(fg,emblems)))==0
    assert count(changed)==report['agents'][name]['changed_pixels_total']
    assert not ImageChops.difference(changed,Image.open(ROOT/f'diff-mask-{name}.png')).getbbox()
    if name=='claude':assert not emblems.getbbox()
    y=120+row*1240+75
    for im,x in [(source,30),(final,558)]:
        assert not ImageChops.difference(board.crop((x,y,x+512,y+512)),im.resize((512,512),Image.Resampling.NEAREST)).getbbox()
    for size in [64,128]:
        preview=Image.open(ROOT/f'preview-{name}-{size}.png')
        assert preview.size==(size,size) and preview.mode=='RGBA'
        assert preview.getpixel((0,0))[3]==0
    for kind,meta in report['agents'][name]['emblems'].items():
        crop=final.crop(meta['crop']);zoom=crop.resize((crop.width*4,crop.height*4),Image.Resampling.NEAREST)
        x=2170 if kind=='visor' else 1110
        assert not ImageChops.difference(board.crop((x,y,x+zoom.width,y+zoom.height)),zoom).getbbox()

# Extract the two actual connected terminal glyphs; equal ink area and baseline.
im=Image.open(ROOT/'pfp-codex.png')
white={(x,y) for y in range(720,815) for x in range(480,654) if im.getpixel((x,y))==(254,253,244)}
components=[]
while white:
    todo=[white.pop()];part=set(todo)
    while todo:
        x,y=todo.pop()
        for point in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
            if point in white:white.remove(point);part.add(point);todo.append(point)
    components.append(part)
assert len(components)==2
assert len(components[0])==len(components[1])==2016
assert max(y for x,y in components[0])==max(y for x,y in components[1])==813
xs=[x for part in components for x,y in part]
assert (min(xs)+max(xs)+1)/2==568

# Four equally sized actual colour masks must be exact quarter-turn rotations.
im=Image.open(ROOT/'pfp-gemini.png').crop((439,715,673,949))
colors=[(253,0,10),(0,82,254),(0,163,65),(255,203,0)]
counts=Counter(im.get_flattened_data())
assert all(counts[color]==4563 for color in colors)
for a,b in zip(colors,colors[1:]+colors[:1]):
    ma=Image.new('L',im.size);ma.putdata([255 if c==a else 0 for c in im.get_flattened_data()])
    mb=Image.new('L',im.size);mb.putdata([255 if c==b else 0 for c in im.get_flattened_data()])
    assert not ImageChops.difference(ma.transpose(Image.Transpose.ROTATE_270),mb).getbbox()
for x in [622,623]:
    for y in range(315,334):assert max(Image.open(ROOT/'pfp-gemini.png').getpixel((x,y)))<35
print('PASS: opaque dimensions, exact diff masks, zero outside-area/protected-character edits, before/after board crops, exact 4x crops, circular previews, equal terminal ink/baseline/centering, equal quarter-turned Gemini blades.')
