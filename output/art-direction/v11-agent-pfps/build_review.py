"""Rebuild the v11 review board and inspection; writes only beside this script."""

import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
NEAREST = Image.Resampling.NEAREST
AGENTS = ("codex", "claude", "gemini")
# Visual helmet-top-to-mouthplate bounds; portrait bounds measured on 1254px drafts.
BOUNDS = {
    "codex": {"reference": (224, 8, 400, 176), "portrait_1254": (397, 129, 923, 699)},
    "claude": {"reference": (136, 8, 320, 184), "portrait_1254": (360, 107, 945, 720)},
    "gemini": {"reference": (128, 8, 288, 176), "portrait_1254": (314, 60, 962, 716)},
}
REQUIRED = {
    "codex": [
        ("blue_violet_helmet", "Blue-violet helmet retained."),
        ("white_top_and_side_swooshes", "White swept helmet stripes retained."),
        ("black_wraparound_visor", "Black wraparound visor retained."),
        ("small_cyan_eye_glints", "Cyan visor glints retained."),
        ("pale_silver_mouthplate", "Silver mouthplate retained below visor."),
        ("white_upper_chest_yoke", "White chest yoke retained."),
        ("central_blue_shield_badge", "Central blue shield retained."),
        ("white_terminal_prompt_glyph", "White >_ glyph readable on badge."),
        ("large_blue_shoulder_pads", "Large blue shoulder pads retained."),
        ("lavender_shoulder_highlights", "Lavender shoulder highlights retained."),
        ("silver_belt", "Silver belt visible at lower frame edge."),
        ("gold_buckle", "Gold buckle visible, partly cropped at bottom as in accepted draft."),
    ],
    "claude": [
        ("orange_helmet", "Accepted orange helmet retained unchanged apart from export scaling."),
        ("front_to_back_dome_grooves", "Stepped front-to-back grooves visible; coarser than sprite ridges."),
        ("black_visor", "Black visor present."),
        ("cyan_glints", "Cyan visor glints present."),
        ("pale_silver_mouthplate", "Pale silver mouthplate below visor."),
        ("ivory_chest_panel", "Ivory chest panel present."),
        ("orange_radiating_sunburst", "Orange radiating emblem present; detailed contour differs from sprite."),
        ("large_rounded_orange_shoulder_pads", "Rounded orange shoulder pads present."),
        ("dark_collar_under_chin", "Dark collar visible under chin."),
    ],
    "gemini": [
        ("royal_blue_helmet", "Royal-blue helmet, not cyan."),
        ("royal_blue_suit", "Royal-blue suit and blue shoulder pads."),
        ("black_visor", "Black wraparound visor present."),
        ("red_yellow_green_mark_at_visor_top", "Red/yellow/green mark present at visor top; enlarged relative to crop."),
        ("pale_silver_mouthplate", "Pale silver mouthplate below visor."),
        ("white_chest_panel", "White chest panel present."),
        ("angular_multicolour_chest_emblem", "Angular red/yellow/green/blue emblem present; interpreted contour."),
        ("chest_emblem_red", "Red upper section present."),
        ("chest_emblem_yellow", "Yellow left section present."),
        ("chest_emblem_green", "Green lower section present."),
        ("chest_emblem_blue", "Blue right section present."),
        ("red_caps_on_blue_shoulder_pads", "Red shoulder caps present on both blue shoulder pads."),
    ],
}
DRIFT = {
    "codex": [
        "Character visually matches accepted draft; regeneration does not guarantee identical character pixels.",
        "Lavender ring has faint seams and merges with lavender stripes; flat exact #b8b9ff fill is not met.",
        "Tight accepted bust occupies about 90% of frame height; belt buckle is clipped at bottom.",
    ],
    "claude": [
        "Accepted draft kept as instructed; coarse grooves and expanded sunburst contour differ from the tiny sprite.",
        "Tight accepted bust occupies about 90% of frame height rather than approximately 70%.",
    ],
    "gemini": [
        "Visor mark is enlarged and its green stroke extends further down the visor than in the sprite.",
        "Four-colour chest emblem is present, but its enlarged angular contour is not an exact pixel trace.",
        "Tighter bust framing than the approximately 70% target; helmet and shoulders dominate the frame.",
    ],
}


def font(size):
    try:
        return ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", size)
    except OSError:
        return ImageFont.load_default(size=size)


def normalized_panel(image, bounds, width, height):
    scale = 240 / (bounds[3] - bounds[1])
    resized = image.convert("RGBA").resize(
        (round(image.width * scale), round(image.height * scale)), NEAREST
    )
    panel = Image.new("RGBA", (width, height), "#172033")
    panel.alpha_composite(resized, ((width - resized.width) // 2, 72 - round(bounds[1] * scale)))
    return panel.convert("RGB"), {
        "scale": scale,
        "displayed_head_height_px": round((bounds[3] - bounds[1]) * scale),
        "bounds": list(bounds),
    }


def circular_preview(image, diameter):
    preview = image.convert("RGBA").resize((diameter, diameter), NEAREST)
    mask = Image.new("L", (diameter, diameter), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, diameter - 1, diameter - 1), fill=255)
    preview.putalpha(mask)
    return preview


def inspect_portrait(agent, portrait):
    rgba = portrait.convert("RGBA")
    assert portrait.size == (1024, 1024), agent
    assert rgba.getchannel("A").getextrema() == (255, 255), agent
    return {
        "file": f"pfp-{agent}.png",
        "dimensions": list(portrait.size),
        "mode": portrait.mode,
        "opaque": True,
        "new_generation_attempts": {"codex": 2, "claude": 0, "gemini": 1}[agent],
        "selected_attempt": {"codex": 2, "claude": "accepted existing draft", "gemini": 1}[agent],
        "required_elements": {
            key: {"status": "present", "observation": observation}
            for key, observation in REQUIRED[agent]
        },
        "shared_elements": {
            "three_quarter_head_toward_viewers_right": "present",
            "ring_behind_head": "present",
            "shoulders_in_front_of_ring_bottom": "present",
            "diagonal_speed_stripes": "present",
            "pixel_art_dark_navy_outlines": "present",
            "extra_text_or_invented_badge": "absent",
        },
        "remaining_drift": DRIFT[agent],
        "exact_sprite_match": False,
        "assessment": "Required elements present; remaining drift listed explicitly.",
    }


def main():
    board = Image.new("RGB", (1760, 2580), "#0c1220")
    draw = ImageDraw.Draw(board)
    draw.text((28, 24), "V11 / SPRITE-FAITHFUL PORTRAIT REVIEW", font=font(27), fill="#f4f5ff")
    draw.text((28, 67), "Head heights aligned to 240px | nearest-neighbour | circles shown at actual size", font=font(17), fill="#b8b9ff")
    inspection = {
        "status": "concept assets awaiting user approval; not wired into app",
        "method": "Manual visual comparison against supplied 8x sprite crops; automated dimensions, opacity and Claude export checks.",
        "resampling": "Pillow Image.Resampling.NEAREST only",
        "reference_crops": "Existing crops retained unchanged; alpha displayed over navy on board.",
        "prior_draft_prompts": "Unavailable; no reconstructed prompt claimed for previous run.",
        "agents": {},
    }
    for row, agent in enumerate(AGENTS):
        top = 120 + row * 810
        draw.line((28, top, 1732, top), fill="#35425b", width=2)
        draw.text((28, top + 15), agent.upper(), font=font(23), fill="#f4f5ff")
        draw.text((28, top + 55), "SPRITE CROP / 8x SOURCE", font=font(17), fill="#aebbd3")
        draw.text((880, top + 55), "PORTRAIT / MATCHED HEAD SIZE", font=font(17), fill="#aebbd3")
        draw.text((1490, top + 55), "CIRCLE PREVIEWS", font=font(17), fill="#aebbd3")
        reference = Image.open(ROOT / f"ref-bust-{agent}.png")
        portrait = Image.open(ROOT / f"pfp-{agent}.png")
        reference_bounds = BOUNDS[agent]["reference"]
        portrait_bounds = tuple(v * 1024 / 1254 for v in BOUNDS[agent]["portrait_1254"])
        left, left_metrics = normalized_panel(reference, reference_bounds, 824, 700)
        right, right_metrics = normalized_panel(portrait, portrait_bounds, 580, 700)
        board.paste(left, (28, top + 86))
        board.paste(right, (880, top + 86))
        for diameter, offset in ((64, 116), (128, 260)):
            preview = circular_preview(portrait, diameter)
            board.paste(preview, (1490, top + offset), preview)
            draw.text((1490, top + offset + diameter + 12), f"{diameter}px", font=font(18), fill="#f4f5ff")
        result = inspect_portrait(agent, portrait)
        result["reference_dimensions"] = list(reference.size)
        result["comparison_panel"] = {"reference": left_metrics, "portrait": right_metrics}
        result["circle_preview_diameters_px"] = [64, 128]
        if agent == "claude":
            expected = Image.open(ROOT / "draft-claude.png").resize((1024, 1024), NEAREST)
            assert ImageChops.difference(expected.convert("RGB"), portrait.convert("RGB")).getbbox() is None
            result["accepted_draft_nearest_export_exact"] = True
        inspection["agents"][agent] = result
    inspection["review_board"] = {"file": "review-board.png", "dimensions": list(board.size)}
    board.save(ROOT / "review-board.png")
    (ROOT / "inspection.json").write_text(json.dumps(inspection, indent=2) + "\n")
    print("Verified 3 opaque 1024x1024 portraits and exact Claude nearest-neighbour export.")
    print("Built review-board.png and inspection.json.")


if __name__ == "__main__":
    main()
