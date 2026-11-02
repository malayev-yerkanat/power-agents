"""Build the concept review board; writes only beside this script.

Run: python3 output/art-direction/v10-agent-pfps/build_review_board.py
Requires Pillow. Portraits and source sprites are read-only inputs.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


OUTPUT = Path(__file__).resolve().parent
PROJECT = OUTPUT.parents[2]
AGENTS = (
    ("codex", "CODEX", "#b8b9ff"),
    ("claude", "CLAUDE", "#ffad80"),
    ("gemini", "GEMINI", "#7ed8ff"),
)
BACKGROUND = "#10182b"
IVORY = "#fff4da"
MUTED = "#abb6cf"
BOARD_SIZE = (1664, 1056)


def font(size):
    font_paths = (
        Path("/System/Library/Fonts/Menlo.ttc"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"),
    )
    for path in font_paths:
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def circular_preview(portrait, diameter):
    """Native-size nearest-neighbour preview with a binary, unsoftened mask."""
    preview = portrait.resize((diameter, diameter), Image.Resampling.NEAREST)
    mask = Image.new("L", (diameter, diameter), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, diameter - 1, diameter - 1), fill=255)
    return preview, mask


def draw_agent(board, draw, column, agent, name, accent):
    left = 32 + column * 544
    with Image.open(OUTPUT / f"pfp-{agent}.png") as image:
        portrait = image.convert("RGB")
    if portrait.size != (1024, 1024):
        raise ValueError(f"pfp-{agent}.png must be 1024 x 1024")
    draw.text((left, 110), name, font=font(24), fill=accent)
    board.paste(portrait.resize((512, 512), Image.Resampling.NEAREST), (left, 152))
    draw.text((left, 680), "SQUARE / 512px", font=font(17), fill=MUTED)
    for diameter, offset, top in ((64, 32, 776), (128, 160, 744)):
        preview, mask = circular_preview(portrait, diameter)
        board.paste(preview, (left + offset, top), mask)
        draw.text((left + offset, 892), f"{diameter}px", font=font(19), fill=IVORY)
    with Image.open(PROJECT / "public" / "art" / f"{agent}.png") as image:
        sprite = image.convert("RGBA")
    board.paste(sprite, (left + 352, 716), sprite)
    draw.text((left + 336, 892), "REFERENCE", font=font(17), fill=MUTED)
    draw.line((left, 928, left + 512, 928), fill=accent, width=2)


def main():
    board = Image.new("RGB", BOARD_SIZE, BACKGROUND)
    draw = ImageDraw.Draw(board)
    draw.text((32, 24), "AGENT PROFILE PICTURES / v10", font=font(30), fill=IVORY)
    draw.text((32, 70), "CONCEPTS AWAITING APPROVAL  |  Source portraits: 1024 x 1024", font=font(19), fill=MUTED)
    for column, (agent, name, accent) in enumerate(AGENTS):
        draw_agent(board, draw, column, agent, name, accent)
    draw.text((32, 958), "Circular previews are actual 64px / 128px diameters at 100% board zoom.", font=font(18), fill=IVORY)
    draw.text((32, 990), "Nearest-neighbour sampling + binary masks. Drift / pixel-grid limitations: inspection.json", font=font(17), fill=MUTED)
    destination = OUTPUT / "review-board.png"
    board.save(destination)
    print(f"Saved {destination} ({board.width} x {board.height})")


if __name__ == "__main__":
    main()
