"""Build exact 4x emblem comparisons and native-size circular previews."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json

ROOT = Path(__file__).resolve().parent
NEAREST = Image.Resampling.NEAREST
FONT = '/System/Library/Fonts/Menlo.ttc'


def label(board, xy, text, size=24):
    ImageDraw.Draw(board).text(xy, text, font=ImageFont.truetype(FONT,size), fill='white')


def circular(image, size):
    tile = image.resize((size,size),NEAREST).convert('RGBA')
    mask = Image.new('L',tile.size)
    ImageDraw.Draw(mask).ellipse((0,0,size-1,size-1),fill=255)
    tile.putalpha(mask)
    return tile


def main():
    board = Image.new('RGB',(3440,3460),'#111723')
    label(board,(30,20),'V13 / official emblem shapes / nearest-neighbour previews',30)
    for row,name in enumerate(('codex','gemini','claude')):
        y = 90+row*1180
        before = Image.open(ROOT/f'v12-{name}.png').convert('RGB')
        after = Image.open(ROOT/f'pfp-{name}.png').convert('RGB')
        label(board,(30,y),f'{name.upper()} / v12')
        label(board,(440,y),'v13')
        board.paste(before.resize((390,390),NEAREST),(30,y+40))
        board.paste(after.resize((390,390),NEAREST),(440,y+40))
        for size,x in ((64,30),(128,150)):
            tile = circular(after,size)
            tile.save(ROOT/f'preview-{name}-{size}.png')
            board.paste(tile,(x,y+490),tile)
            label(board,(x,y+640),f'{size}px',18)
        if name == 'claude':
            label(board,(880,y+40),'Claude unchanged / byte-identical copy')
            continue
        metadata = json.loads((ROOT/f'metadata-{name}.json').read_text())
        official = Image.open(ROOT/f'logo-{name}-official.png').convert('RGBA')
        for key,x,dy in [('chest',880,40),('visor',30,730)]:
            if key not in metadata:
                continue
            crop = after.crop(metadata[key]['crop'])
            zoom = crop.resize((crop.width*4,crop.height*4),NEAREST)
            # The visor comparison uses its own full-height row below the board.
            top = y+dy if key == 'chest' else 3530
            if key == 'visor':
                expanded = Image.new('RGB',(3440,4270),'#111723')
                expanded.paste(board,(0,0))
                board = expanded
            label(board,(x,top-32),f'{name} {key} / exact 4x',20)
            board.paste(zoom,(x,top))
            width = round(official.width*zoom.height/official.height)
            logo = official.resize((width,zoom.height),NEAREST)
            lx = x+zoom.width+35
            label(board,(lx,top-32),'Official / same height',20)
            board.paste(logo,(lx,top),logo)
    board.save(ROOT/'review-board.png')


if __name__ == '__main__':
    main()
