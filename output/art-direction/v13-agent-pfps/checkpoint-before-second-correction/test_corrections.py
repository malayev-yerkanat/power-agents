"""Independent acceptance checks for the requested correction geometry."""
from pathlib import Path
import unittest
from PIL import Image

ROOT = Path(__file__).resolve().parent


class CorrectionTests(unittest.TestCase):
    def test_codex_rim_bands_and_terminal(self):
        image = Image.open(ROOT/'pfp-codex.png').convert('RGB')
        palette = {(169,163,255),(133,132,255),(96,100,255),(58,69,255),(45,52,200),(255,255,255)}
        def cell(x,y):
            return image.getpixel((430+x*12+6,634+y*12+6))
        self.assertEqual(cell(11,0),(45,52,200))
        self.assertEqual({cell(11,y) for y in (2,7,13,20)},
                         {(169,163,255),(133,132,255),(96,100,255),(58,69,255)})
        for y,left in enumerate((6,7,8,9,8,7,6),8):
            self.assertEqual([cell(left,y),cell(left+1,y)],[(255,255,255)]*2)
        for y in (13,14):
            for x in range(13,19):self.assertEqual(cell(x,y),(255,255,255))
        # Eight extrema, each separated by a radial indentation of >=2 cells.
        for x,y in ((11,0),(5,2),(2,5),(0,11),(2,17),(5,20),(11,22),(17,20),(20,17),(22,11),(20,5),(17,2)):
            self.assertIn(cell(x,y),palette)
        for x,y in ((7,1),(1,7),(1,15),(7,21),(15,21),(21,15),(21,7),(15,1)):
            self.assertNotIn(cell(x,y),palette)

    def test_gemini_plump_tips_clean_palette(self):
        image=Image.open(ROOT/'pfp-gemini.png').convert('RGB')
        base={(249,67,73),(251,188,5),(22,188,104),(50,133,255),
              (104,143,255),(115,182,239),(52,181,204)}
        rim={tuple(round(c*.87) for c in color) for color in base}
        for n,origin,colors in ((19,(433,709),base|rim),(9,(520,218),base)):
            def cell(x,y):return image.getpixel((origin[0]+x*13+6,origin[1]+y*13+6))
            c=n//2
            for x,y in ((c,0),(0,c),(c,n-1),(n-1,c)):
                self.assertIn(cell(x,y),colors)
            for x in (c-1,c,c+1):self.assertIn(cell(x,1),colors)
            self.assertNotIn(cell(c-1,0),colors)
            self.assertNotIn(cell(1,1),colors)
            for y in range(n):
                for x in range(n):
                    if cell(x,y) in colors:
                        self.assertIn(cell(n-1-y,x),colors)


if __name__=='__main__':unittest.main()
