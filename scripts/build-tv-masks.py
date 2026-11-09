#!/usr/bin/env python3
"""Rasterize the shared TV scrim formulas once, rather than on the device."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]

def save(name, image):
    for directory in (ROOT / "public/tv-artwork", ROOT / "roku/pkg/assets"):
        image.save(directory / name, optimize=True)

mask = Image.new("RGBA", (512, 288))
for y in range(mask.height):
    for x in range(mask.width):
        px, py = (x + .5) / 512 * 1920, (y + .5) / 288 * 1080
        left = .85 - .3 * px / 652.8 if px < 652.8 else .55 * (1 - (px - 652.8) / 537.6) if px < 1190.4 else 0
        bottom = 0 if py < 560 else .92 * (py - 560) / 286 if py < 846 else .92 + .08 * (py - 846) / 234
        top = .7 * (1 - py / 200) if py < 200 else 0
        mask.putpixel((x, y), (11, 11, 12, round((1 - (1-left) * (1-bottom) * (1-top)) * 255)))
save("hero-scrim.png", mask)

top = Image.new("RGBA", (480, 33))
for y in range(top.height):
    t = y / 32
    alpha = .94 + (.82 - .94) * t / .72 if t < .72 else .82 * (1 - (t - .72) / .28)
    for x in range(top.width):
        top.putpixel((x, y), (11, 11, 12, round(alpha * 255)))
save("topbar-scrim.png", top)

spinner = Image.new("RGBA", (224, 224))
draw = ImageDraw.Draw(spinner)
draw.ellipse((28, 28, 196, 196), outline=(255,255,255,65), width=20)
draw.arc((28, 28, 196, 196), -90, 0, fill=(255,255,255,255), width=20)
save("busy-spinner.png", spinner.resize((112,112), Image.Resampling.LANCZOS))
