// Bounds follow complete opaque poses, including limbs crossing source grid cells.
// Fixed per-monster scale; right support foot and ground line are shared by all poses.
export type MonsterKind = 'mantis' | 'boss';
export type MonsterAction = 'breathing' | 'roar' | 'stomp' | 'attack1' | 'attack2' | 'attack3';
export type MonsterFrame = { sheet: 'idle' | 'attacks'; x: number; y: number; width: number; height: number; anchorX: number; baseline: number };
type MonsterAtlas = { sources: { idle: string; attacks: string }; scale: number; frames: Record<MonsterAction, MonsterFrame[]> };
export const MONSTER_ATLAS: Record<MonsterKind, MonsterAtlas> = {
  "mantis": {
    "sources": {
      "idle": "/art/monster-motion/mantis-idle.png",
      "attacks": "/art/monster-motion/mantis-attacks.png"
    },
    "scale": 0.38596491228070173,
    "frames": {
      "breathing": [
        {"sheet": "idle", "x": 63, "y": 75, "width": 285, "height": 285, "anchorX": 146.8182, "baseline": 285},
        {"sheet": "idle", "x": 424, "y": 75, "width": 286, "height": 285, "anchorX": 147.8182, "baseline": 285},
        {"sheet": "idle", "x": 781, "y": 74, "width": 284, "height": 286, "anchorX": 139.8182, "baseline": 286},
        {"sheet": "idle", "x": 1148, "y": 80, "width": 288, "height": 280, "anchorX": 146.8182, "baseline": 280}
      ],
      "roar": [
        {"sheet": "idle", "x": 85, "y": 459, "width": 265, "height": 250, "anchorX": 127.8182, "baseline": 250},
        {"sheet": "idle", "x": 428, "y": 425, "width": 306, "height": 284, "anchorX": 145.8182, "baseline": 284},
        {"sheet": "idle", "x": 793, "y": 419, "width": 295, "height": 290, "anchorX": 119.8182, "baseline": 290},
        {"sheet": "idle", "x": 1150, "y": 427, "width": 284, "height": 282, "anchorX": 145.8182, "baseline": 282}
      ],
      "stomp": [
        {"sheet": "idle", "x": 63, "y": 773, "width": 295, "height": 276, "anchorX": 150.8182, "baseline": 276},
        {"sheet": "idle", "x": 442, "y": 750, "width": 296, "height": 300, "anchorX": 131.8182, "baseline": 300},
        {"sheet": "idle", "x": 794, "y": 820, "width": 286, "height": 230, "anchorX": 143.8182, "baseline": 230},
        {"sheet": "idle", "x": 1145, "y": 764, "width": 289, "height": 286, "anchorX": 149.8182, "baseline": 286}
      ],
      "attack1": [
        {"sheet": "attacks", "x": 58, "y": 64, "width": 268, "height": 281, "anchorX": 129.8182, "baseline": 281},
        {"sheet": "attacks", "x": 425, "y": 63, "width": 249, "height": 282, "anchorX": 128.8182, "baseline": 282},
        {"sheet": "attacks", "x": 705, "y": 75, "width": 384, "height": 271, "anchorX": 243.8182, "baseline": 271},
        {"sheet": "attacks", "x": 1175, "y": 62, "width": 260, "height": 284, "anchorX": 124.8182, "baseline": 284}
      ],
      "attack2": [
        {"sheet": "attacks", "x": 59, "y": 458, "width": 277, "height": 254, "anchorX": 154.8182, "baseline": 254},
        {"sheet": "attacks", "x": 421, "y": 388, "width": 256, "height": 324, "anchorX": 135.8182, "baseline": 324},
        {"sheet": "attacks", "x": 791, "y": 476, "width": 297, "height": 236, "anchorX": 176.8182, "baseline": 236},
        {"sheet": "attacks", "x": 1179, "y": 428, "width": 259, "height": 284, "anchorX": 126.8182, "baseline": 284}
      ],
      "attack3": [
        {"sheet": "attacks", "x": 55, "y": 771, "width": 259, "height": 272, "anchorX": 114.8182, "baseline": 272},
        {"sheet": "attacks", "x": 433, "y": 789, "width": 269, "height": 254, "anchorX": 133.8182, "baseline": 254},
        {"sheet": "attacks", "x": 744, "y": 804, "width": 356, "height": 239, "anchorX": 206.8182, "baseline": 239},
        {"sheet": "attacks", "x": 1175, "y": 770, "width": 269, "height": 273, "anchorX": 131.8182, "baseline": 273}
      ]
    }
  },
  "boss": {
    "sources": {
      "idle": "/art/monster-motion/boss-idle.png",
      "attacks": "/art/monster-motion/boss-attacks.png"
    },
    "scale": 0.4110429447852761,
    "frames": {
      "breathing": [
        {"sheet": "idle", "x": 40, "y": 31, "width": 310, "height": 326, "anchorX": 164.7612, "baseline": 326},
        {"sheet": "idle", "x": 400, "y": 26, "width": 307, "height": 331, "anchorX": 158.7612, "baseline": 331},
        {"sheet": "idle", "x": 769, "y": 31, "width": 309, "height": 326, "anchorX": 149.7612, "baseline": 326},
        {"sheet": "idle", "x": 1127, "y": 31, "width": 306, "height": 326, "anchorX": 161.7612, "baseline": 326}
      ],
      "roar": [
        {"sheet": "idle", "x": 47, "y": 447, "width": 295, "height": 266, "anchorX": 157.7612, "baseline": 266},
        {"sheet": "idle", "x": 393, "y": 390, "width": 332, "height": 323, "anchorX": 167.7612, "baseline": 323},
        {"sheet": "idle", "x": 756, "y": 389, "width": 326, "height": 324, "anchorX": 162.7612, "baseline": 324},
        {"sheet": "idle", "x": 1127, "y": 390, "width": 306, "height": 323, "anchorX": 162.7612, "baseline": 323}
      ],
      "stomp": [
        {"sheet": "idle", "x": 48, "y": 745, "width": 294, "height": 319, "anchorX": 156.7612, "baseline": 319},
        {"sheet": "idle", "x": 419, "y": 742, "width": 314, "height": 322, "anchorX": 138.7612, "baseline": 322},
        {"sheet": "idle", "x": 771, "y": 807, "width": 304, "height": 257, "anchorX": 154.7612, "baseline": 257},
        {"sheet": "idle", "x": 1127, "y": 740, "width": 306, "height": 324, "anchorX": 160.7612, "baseline": 324}
      ],
      "attack1": [
        {"sheet": "attacks", "x": 56, "y": 34, "width": 276, "height": 310, "anchorX": 133.7612, "baseline": 310},
        {"sheet": "attacks", "x": 416, "y": 33, "width": 272, "height": 311, "anchorX": 132.7612, "baseline": 311},
        {"sheet": "attacks", "x": 758, "y": 35, "width": 333, "height": 309, "anchorX": 195.7612, "baseline": 309},
        {"sheet": "attacks", "x": 1141, "y": 35, "width": 281, "height": 309, "anchorX": 140.7612, "baseline": 309}
      ],
      "attack2": [
        {"sheet": "attacks", "x": 32, "y": 471, "width": 302, "height": 240, "anchorX": 164.7612, "baseline": 240},
        {"sheet": "attacks", "x": 403, "y": 373, "width": 285, "height": 338, "anchorX": 147.7612, "baseline": 338},
        {"sheet": "attacks", "x": 779, "y": 487, "width": 310, "height": 227, "anchorX": 171.7612, "baseline": 227},
        {"sheet": "attacks", "x": 1137, "y": 396, "width": 286, "height": 315, "anchorX": 142.7612, "baseline": 315}
      ],
      "attack3": [
        {"sheet": "attacks", "x": 46, "y": 757, "width": 280, "height": 302, "anchorX": 142.7612, "baseline": 302},
        {"sheet": "attacks", "x": 409, "y": 755, "width": 277, "height": 304, "anchorX": 139.7612, "baseline": 304},
        {"sheet": "attacks", "x": 751, "y": 758, "width": 337, "height": 302, "anchorX": 157.7612, "baseline": 302},
        {"sheet": "attacks", "x": 1137, "y": 757, "width": 285, "height": 303, "anchorX": 145.7612, "baseline": 303}
      ]
    }
  }
};
