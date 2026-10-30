"""Independent acceptance checks for the final three emblem corrections."""
from pathlib import Path
import unittest
from PIL import Image, ImageChops, ImageColor

ROOT = Path(__file__).resolve().parent
GEMINI = tuple(ImageColor.getrgb(c) for c in (
    '#ea4335','#c5221f','#fbbc04','#e09c00','#34a853',
    '#188038','#4285f4','#1a5fd0','#8ab4f8'))


def reference_shape(size):
    image = Image.open(ROOT/'logo-gemini-official.png').convert('RGBA')
    mask = Image.new('L',image.size)
    mask.putdata([255 if min(r,g,b)<245 and a else 0
                  for r,g,b,a in image.get_flattened_data()])
    coverage = mask.crop(mask.getbbox()).resize((size,size),Image.Resampling.BOX)
    return {(x,y) for y in range(size) for x in range(size)
            if coverage.getpixel((x,y)) >= 127.5}


class CorrectionTests(unittest.TestCase):
    def test_codex_exact_target(self):
        image = Image.open(ROOT/'pfp-codex.png').convert('RGB')
        target = Image.open(ROOT/'target-codex-badge.png').convert('RGB')
        actual = image.crop((400,600,780,920)).resize(target.size,Image.Resampling.NEAREST)
        self.assertIsNone(ImageChops.difference(actual,target).getbbox())

    def test_chest_only_four_stray_edge_cells_change(self):
        before = Image.open(ROOT/'checkpoint-before-final-correction/pfp-gemini.png').convert('RGB')
        after = Image.open(ROOT/'pfp-gemini.png').convert('RGB')
        expected = before.copy()
        # Red-side fringe, two green-side fringe cells, and green bottom blade.
        fixes = {(10,2):GEMINI[1], (5,12):GEMINI[5],
                 (6,13):GEMINI[5], (10,16):GEMINI[5]}
        for (x,y),color in fixes.items():
            expected.paste(color,(433+x*13,709+y*13,433+(x+1)*13,709+(y+1)*13))
        self.assertIsNone(ImageChops.difference(
            after.crop((420,696,693,969)),expected.crop((420,696,693,969))).getbbox())

    def test_gemini_official_shapes_flat_cells_and_connected_tips(self):
        image = Image.open(ROOT/'pfp-gemini.png').convert('RGB')
        for n,(ox,oy) in ((19,(433,709)),(13,(494,192))):
            shape = reference_shape(n)
            actual = {(x,y) for y in range(n) for x in range(n)
                      if image.getpixel((ox+x*13+6,oy+y*13+6)) in GEMINI}
            self.assertEqual(actual,shape)
            self.assertEqual(shape,{(n-1-y,x) for x,y in shape})
            c=n//2
            for point,color in (((c,0),GEMINI[1]),((0,c),GEMINI[3]),
                                ((c,n-1),GEMINI[5]),((n-1,c),GEMINI[7])):
                x,y=point
                self.assertEqual(image.getpixel((ox+x*13+6,oy+y*13+6)),color)
            self.assertEqual([x for x in range(n) if (x,0) in shape],[c])
            self.assertNotIn((c//2,c//2),shape)
            reached={(c,c)}
            while True:
                expanded=reached|{(x+dx,y+dy) for x,y in reached
                    for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)) if (x+dx,y+dy) in shape}
                if expanded==reached:break
                reached=expanded
            self.assertEqual(reached,shape)
            for x,y in shape:
                tile=image.crop((ox+x*13,oy+y*13,ox+(x+1)*13,oy+(y+1)*13))
                self.assertEqual(len(tile.getcolors()),1)

    def test_visor_color_families_and_center(self):
        image=Image.open(ROOT/'pfp-gemini.png').convert('RGB')
        # Edge colors use their blade family; lower-case letters are dark shades.
        rows=('      r      ','      r      ','     rRr     ',
              '    rRllb    ','   rRllBBb   ','  yyllBBBBb  ',
              'yyyyGBBBBBBbb','  yGGBBBBBb  ','   gGGBBBb   ',
              '    gGBBb    ','     gGg     ','      g      ','      g      ')
        colors=dict(zip('RrYyGgBbl',GEMINI))
        for y,row in enumerate(rows):
            for x,key in enumerate(row):
                if key!=' ':
                    self.assertEqual(image.getpixel((494+x*13+6,192+y*13+6)),colors[key],(x,y))
        self.assertEqual((494+13*13/2,192+13*13/2),(520+9*13/2,218+9*13/2))


if __name__=='__main__':unittest.main()
