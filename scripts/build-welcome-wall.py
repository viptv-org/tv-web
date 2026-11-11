#!/usr/bin/env python3
"""Pack the existing welcome grid and masks into one shared TV texture.

Requires Pillow; the generated WebP is committed, so normal builds need no
image-processing dependency. This renders existing assets, not a device capture.
"""
from pathlib import Path
import re
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / "src/tv-solid/remote/entry-art.ts"
text = source.read_text()
art = {
    name: (source.parent / filename).resolve()
    for name, filename in re.findall(r'import (art\d+) from "([^"]+)"', text)
}
order = re.findall(r"\bart\d+\b", text.split("export const entryArt = [", 1)[1])
wall = Image.new("RGBA", (1920, 1080), (11, 11, 12, 255))
scale = 1920 / 2520
for index, name in enumerate(order):
    with Image.open(art[name]) as image:
        tile = ImageOps.fit(image.convert("RGBA"), (181, 271), method=Image.Resampling.LANCZOS)
    wall.alpha_composite(tile, (round((index % 10) * 252 * scale), round((index // 10) * 372 * scale)))
for name in ("welcome-scrim.png", "welcome-vignette.png"):
    with Image.open(ROOT / "roku/pkg/assets" / name) as image:
        wall = Image.alpha_composite(wall, image.convert("RGBA").resize(wall.size, Image.Resampling.BILINEAR))
for destination in (ROOT / "public/tv-artwork/welcome-wall.webp", ROOT / "roku/pkg/assets/welcome-wall.webp"):
    destination.parent.mkdir(parents=True, exist_ok=True)
    wall.convert("RGB").save(destination, "WEBP", quality=84, method=6)
    print(f"Generated {destination.relative_to(ROOT)} ({destination.stat().st_size} bytes)")
