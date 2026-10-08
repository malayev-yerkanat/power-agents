from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont

BASE = Path(__file__).resolve().parent
ART = BASE.parent
NN = Image.Resampling.NEAREST
FRAME = 160
BASELINE = 144
NAMES = ['c1-straight-saber', 'c2-energy-katana', 'c3-paired-tonfas', 'l1-rigid-staff', 'l2-double-glaive', 'l3-tech-hammer']
LABELS = ['C1 / Straight saber', 'C2 / Energy katana', 'C3 / Paired tonfas', 'L1 / Rigid staff', 'L2 / Double glaive', 'L3 / Tech hammer']
DETAILS = [(40,88,120,142), (35,88,128,146), (26,58,140,126), (29,52,135,133), (28,65,139,129), (47,91,139,124)]
(BASE/'preview-frames').mkdir(exist_ok=True)
records = []

def normalize(path, name, height=96):
    src = Image.open(path).convert('RGBA')
    alpha = src.getchannel('A')
    hist = alpha.histogram()
    mask = alpha.point(lambda a: 255 if a >= 128 else 0)
    bounds = mask.getbbox()
    clean = src.copy()
    clean.putalpha(mask)
    left, top, right, bottom = bounds
    foot_band = mask.crop((0, bottom-max(1,int((bottom-top)*.07)), src.width, bottom)).getbbox()
    pivot_x = (foot_band[0]+foot_band[2])/2
    scale = height/(bottom-top)
    crop = clean.crop(bounds)
    size = (round(crop.width*scale), height)
    sprite = crop.resize(size, NN)
    pos = (round(80-(pivot_x-left)*scale), BASELINE-height)
    assert pos[0]>=0 and pos[0]+size[0]<=FRAME and pos[1]>=0
    frame = Image.new('RGBA',(FRAME,FRAME))
    frame.alpha_composite(sprite,pos)
    frame.save(BASE/'preview-frames'/f'{name}.png')
    records.append({'name':name,'source':str(path),'source_size':src.size,'source_mode':Image.open(path).mode,'source_alpha_range':alpha.getextrema(),'zero_alpha_pixels':hist[0],'low_alpha_1_to_15':sum(hist[1:16]),'dominant_nonzero_alpha':max(range(1,256),key=lambda x:hist[x]),'visible_bounds_alpha128':bounds,'preview_frame':[160,160],'preview_actor_height':height,'preview_placement':pos,'preview_pivot':[80,144],'alpha_processing':'threshold128 in preview only; original unchanged','resampling':'nearest-neighbor; normalization study, not hand-redrawn production sprite'})
    return frame

frames = {name:normalize(BASE/f'{name}.png',name) for name in NAMES}
font_path = '/System/Library/Fonts/Helvetica.ttc'
def font(n): return ImageFont.truetype(font_path,n)
def board(agent, indexes, filename):
    out = Image.new('RGB',(1536,1152),'#101d30')
    d = ImageDraw.Draw(out)
    d.text((28,20),f'POWER AGENTS / {agent.upper()} WEAPON OPTIONS',font=font(34),fill='#edf2fa')
    d.text((28,68),'Same source sprites / nearest-neighbor previews / selection pending',font=font(20),fill='#9eb4cf')
    for col, idx in enumerate(indexes):
        x = 16+col*512
        d.rectangle((x,112,x+495,1072),fill='#1b2c43',outline='#43617e',width=2)
        d.text((x+18,128),LABELS[idx],font=font(28),fill='#ffffff')
        enlarged = frames[NAMES[idx]].resize((480,480),NN)
        out.paste(enlarged,(x+8,172),enlarged)
        d.text((x+18,657),'Full silhouette / 3x logical preview',font=font(20),fill='#b5c9df')
        detail = frames[NAMES[idx]].crop(DETAILS[idx])
        mult = min(4, 460//detail.width, 335//detail.height)
        detail = detail.resize((detail.width*mult,detail.height*mult),NN)
        out.paste(detail,(x+(496-detail.width)//2,711+(335-detail.height)//2),detail)
        d.text((x+18,689),f'Weapon construction / {mult}x exact crop',font=font(20),fill='#b5c9df')
    d.text((28,1091),'CONCEPTS: preview-grid normalization does not certify production sprite geometry.',font=font(22),fill='#dfc896')
    out.save(BASE/filename)

board('Codex',range(3),'codex-comparison-board.png')
board('Claude',range(3,6),'claude-comparison-board.png')

frames['gemini'] = normalize(ART/'v3-weapons-formations/gemini-blaster.png','gemini',96)
for name,height in [('villain-foot-soldier',91),('villain-monster',110),('villain-boss',134)]:
    frames[name] = normalize(ART/f'v2-ai-rangers-city/{name}.png',name,height)
background = Image.open(ART/'v2-ai-rangers-city/city-background.png').convert('RGBA').resize((768,512),NN)
scene = background.copy()
actors = [('l1-rigid-staff',(145,311)),('c1-straight-saber',(285,391)),('gemini',(137,461)),('villain-foot-soldier',(460,365)),('villain-monster',(543,461)),('villain-boss',(674,332))]
for name,(x,y) in sorted(actors,key=lambda a:a[1][1]):
    scene.alpha_composite(frames[name],(x-80,y-144))
scene.convert('RGB').save(BASE/'scene-logical.png')
scene.convert('RGB').resize((1536,1024),NN).save(BASE/'scene-style-preview.png')

# Actual intended-size and enlarged inspections, without repainting assets.
small = Image.new('RGB',(960,380),'#26384c')
draw = ImageDraw.Draw(small)
for i,name in enumerate(['c1-straight-saber','l1-rigid-staff','gemini']):
    im = frames[name].resize((320,320),NN)
    small.paste(im,(i*320,28),im)
    draw.text((i*320+20,350),name,font=font(20),fill='white')
small.save(BASE/'inspection-display-2x.png')
zoom = frames['c1-straight-saber'].crop((45,88,122,143)).resize((616,440),NN)
zoom.save(BASE/'inspection-c1-8x.png')

check = Image.open(BASE/'scene-style-preview.png')
back = check.resize((768,512),NN).resize(check.size,NN)
assert check.tobytes() == back.tobytes()
(BASE/'asset-checks.json').write_text(json.dumps({'originals_and_preview_derivations':records,'scene':{'logical_size':[768,512],'display_size':[1536,1024],'exact_2x_block_replication_verified':True,'provisional_selection':['C1','L1'],'positions':actors,'composition':'deterministic alpha composition, no generative repaint','caveat':'Grid replication verified only; artist-level grid alignment, palette ramps and geometry remain unverified.'}},indent=2)+'\n')
print('Saved two boards, scene, intended-size inspection, enlarged inspection, preview frames and metadata.')
