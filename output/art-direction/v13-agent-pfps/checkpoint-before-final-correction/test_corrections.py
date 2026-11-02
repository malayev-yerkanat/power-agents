"""Independent acceptance checks against the supplied official logo pixels."""
from pathlib import Path
import unittest
from PIL import Image, ImageDraw, ImageChops, ImageColor

ROOT = Path(__file__).resolve().parent
GEMINI = tuple(ImageColor.getrgb(c) for c in (
    '#ea4335','#c5221f','#fbbc04','#e09c00','#34a853',
    '#188038','#4285f4','#1a5fd0','#8ab4f8'))
DARK = {GEMINI[i]:GEMINI[j] for i,j in ((0,1),(1,1),(2,3),(3,3),
                                             (4,5),(5,5),(6,7),(7,7),(8,7))}


def reference(name, size):
    image = Image.open(ROOT/f'logo-{name}-official.png').convert('RGBA')
    mask = Image.new('L',image.size)
    mask.putdata([255 if min(r,g,b)<245 and a else 0
                  for r,g,b,a in image.get_flattened_data()])
    if name == 'codex':
        # Select the connected cloud, excluding the opaque white app tile and
        # its antialiased outer fringe. Fill the enclosed white terminal holes.
        ImageDraw.floodfill(mask,(320,320),128)
        mask = mask.point(lambda p:255 if p==128 else 0)
        ImageDraw.floodfill(mask,(0,0),128)
        mask = ImageChops.darker(image.getchannel('A'),mask.point(lambda p:0 if p==128 else 255))
    bounds = mask.getbbox()
    coverage = mask.crop(bounds).resize((size,size),Image.Resampling.BOX)
    rgb = image.convert('RGB').crop(bounds).resize((size,size),Image.Resampling.BOX)
    shape = {(x,y) for y in range(size) for x in range(size)
             if coverage.getpixel((x,y)) >= 127.5}
    return shape,rgb


class CorrectionTests(unittest.TestCase):
    def test_gemini_source_shape_colors_and_equal_tips(self):
        image = Image.open(ROOT/'pfp-gemini.png').convert('RGB')
        for n,(ox,oy) in ((19,(433,709)),(9,(520,218))):
            shape,rgb = reference('gemini',n)
            actual = {(x,y) for y in range(n) for x in range(n)
                      if image.getpixel((ox+x*13+6,oy+y*13+6)) in GEMINI}
            self.assertEqual(actual,shape)
            self.assertEqual(shape,{(n-1-y,x) for x,y in shape})
            c=n//2
            self.assertTrue({(c,0),(0,c),(c,n-1),(n-1,c)} <= shape)
            self.assertEqual([x for x in range(n) if (x,0) in shape],[c])
            # Concavity: the diagonal half-radius sits outside the silhouette.
            self.assertNotIn((c//2,c//2),shape)
            for x,y in shape:
                sample=rgb.getpixel((x,y))
                color=min(GEMINI,key=lambda p:sum((a-b)**2 for a,b in zip(p,sample)))
                if any((x+dx,y+dy) not in shape for dx,dy in ((1,0),(-1,0),(0,1),(0,-1))):
                    color=DARK[color]
                tile=image.crop((ox+x*13,oy+y*13,ox+(x+1)*13,oy+(y+1)*13))
                self.assertEqual(tile.getcolors(),[(169,color)])

    def test_codex_source_shape_rim_bands_and_terminal(self):
        image=Image.open(ROOT/'pfp-codex.png').convert('RGB')
        shape,_=reference('codex',23)
        bands=((169,163,255),(133,132,255),(96,100,255),(58,69,255))
        rim=(45,52,200);white=(255,255,255)
        palette=set(bands)|{rim,white}
        def cell(x,y):return image.getpixel((430+x*12+6,634+y*12+6))
        actual={(x,y) for y in range(23) for x in range(23) if cell(x,y) in palette}
        self.assertEqual(actual,shape)
        glyph={(x,y) for y,left in enumerate((5,6,6,7,7,6,6,5),8) for x in (left,left+1)}
        glyph|={(x,y) for y in (14,15) for x in range(11,18)}
        self.assertTrue(glyph <= shape)
        self.assertEqual({p for p in shape if cell(*p)==white},glyph)
        for x,y in shape-glyph:
            edge=any((x+dx,y+dy) not in shape for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)))
            self.assertEqual(cell(x,y),rim if edge else bands[min(3,y*4//23)])


if __name__=='__main__':unittest.main()
