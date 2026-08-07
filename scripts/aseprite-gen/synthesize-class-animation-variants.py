"""Create a small, deterministic motion pass for the generated class sheets.

The first class export was a contact atlas: every cell was repeated to satisfy the runtime frame
contract. This script keeps the same 92x92 cells, paths, frame counts, palette and feet origin but
adds restrained nearest-neighbour bob/lean variants. It is deliberately a bridge until authored
multi-pose sheets are available; it does not change gameplay hitboxes or animation IDs.

Usage:
    python scripts/aseprite-gen/synthesize-class-animation-variants.py

The source sheets are already tracked under apps/web/public/assets, so this pass is reproducible
from a clean checkout and does not depend on the ignored image-generation artifacts.
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
CHARACTER_ROOT = ROOT / "apps" / "web" / "public" / "assets" / "characters"
FRAME_SIZE = 92
CLASS_IDS = ("assassin", "barbarian", "druid", "necromancer", "paladin", "sorceress")
DIRECTIONS = ("north", "south", "east")


def offsets(animation: str, index: int, count: int) -> tuple[int, int]:
    """Return a subtle pixel-safe translation for one frame of a bridge animation."""

    if animation == "walk":
        pattern = ((0, 0), (1, -1), (0, 0), (-1, 1), (0, 0), (1, -1), (0, 0), (-1, 1))
        return pattern[index % len(pattern)]
    if animation == "basic_attack":
        # Wind-up -> contact -> recovery. The feet stay in the same 92px cell; only the pose
        # drifts a few pixels so the action reads as more than a static repeated contact frame.
        pattern = ((0, 0), (1, -1), (3, -1), (5, 0), (3, 1), (1, 0), (0, 0))
        return pattern[index % len(pattern)]
    if animation == "idle":
        return ((0, 0), (0, -1), (0, 0), (0, 1))[index % 4]
    if animation == "hit":
        return ((0, 0), (-2, 0), (1, 0), (0, 0), (0, 0), (0, 0))[index % 6]
    # Death eases the silhouette down instead of presenting one frozen frame.
    return ((0, 0), (0, 0), (0, 1), (0, 1), (0, 2), (0, 2), (0, 3))[index % 7]


def translated(frame: Image.Image, dx: int, dy: int) -> Image.Image:
    canvas = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    canvas.alpha_composite(frame, (dx, dy))
    return canvas


def write_sheet(path: Path, animation: str) -> None:
    source = Image.open(path).convert("RGBA")
    if source.height != FRAME_SIZE or source.width % FRAME_SIZE != 0:
        raise ValueError(f"Unexpected sheet dimensions: {path} ({source.size})")
    count = source.width // FRAME_SIZE
    output = Image.new("RGBA", source.size, (0, 0, 0, 0))
    for index in range(count):
        frame = source.crop((index * FRAME_SIZE, 0, (index + 1) * FRAME_SIZE, FRAME_SIZE))
        dx, dy = offsets(animation, index, count)
        output.alpha_composite(translated(frame, dx, dy), (index * FRAME_SIZE, 0))
    # Indexed PNG preserves hard pixel edges and keeps the browser art budget bounded.
    output.quantize(colors=64, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(
        path, format="PNG", optimize=True
    )


def update_manifest(path: Path) -> None:
    manifest = json.loads(path.read_text(encoding="utf-8"))
    manifest["notes"] = (
        "Generated contact poses receive deterministic nearest-neighbour bob/lean variants for "
        "walk, attack, idle, hit and death. Replace with authored multi-pose animation without "
        "changing IDs, frame size, pivots or routes."
    )
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    for character in CLASS_IDS:
        full = CHARACTER_ROOT / character / "full"
        for animation in ("idle", "walk", "basic_attack", "hit", "death"):
            for direction in DIRECTIONS:
                write_sheet(full / f"{character}_{animation}_{direction}.png", animation)
        update_manifest(CHARACTER_ROOT / character / "metadata" / "manifest.json")


if __name__ == "__main__":
    main()
