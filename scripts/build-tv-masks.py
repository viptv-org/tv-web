#!/usr/bin/env python3
"""Rasterize the shared TV scrim formulas once, rather than on the device."""
from pathlib import Path
from PIL import Image, ImageDraw
import json
import re

ROOT = Path(__file__).resolve().parents[1]

def save(name, image):
    for directory in (ROOT / "public/tv-artwork", ROOT / "roku/pkg/assets"):
        image.save(directory / name, optimize=True)

mask = Image.new("RGBA", (512, 288))
for y in range(mask.height):
    for x in range(mask.width):
        px, py = (x + .5) / 512 * 1920, (y + .5) / 288 * 1080
        # Pinned TV hero contrast: wide 95%, 90% at 46%, 55% at 62%, clear;
        # tall 30%, clear at 45%, 90% at 80%, ground. Composite once so the
        # same mask protects every backdrop without tinting foreground art.
        left = (.95 - .05 * px / 883.2 if px < 883.2 else
                .90 - .35 * (px - 883.2) / 307.2 if px < 1190.4 else
                .55 * (1 - (px - 1190.4) / 729.6))
        vertical = (.30 * (1 - py / 486) if py < 486 else
                    .90 * (py - 486) / 378 if py < 864 else
                    .90 + .10 * (py - 864) / 216)
        mask.putpixel((x, y), (11, 11, 12, round((1 - (1-left) * (1-vertical)) * 255)))
save("hero-scrim.png", mask)

home = Image.new("RGBA", (512, 288))
for y in range(home.height):
    for x in range(home.width):
        px, py = (x + .5) / 512 * 1920, (y + .5) / 288 * 1080
        t = max(0, min(1, (px - 760) / 760))
        left = 1 - t * t * (3 - 2 * t)
        t = max(0, min(1, (py - 350) / 460))
        bottom = t * t * (3 - 2 * t)
        home.putpixel((x, y), (11, 11, 12, round((1 - (1-left) * (1-bottom)) * 255)))
save("home-scrim.png", home)


top = Image.new("RGBA", (480, 33))
for y in range(top.height):
    t = y / 32
    alpha = .94 + (.82 - .94) * t / .72 if t < .72 else .82 * (1 - (t - .72) / .28)
    for x in range(top.width):
        top.putpixel((x, y), (11, 11, 12, round(alpha * 255)))
save("topbar-scrim.png", top)

# The authored player ramps leave the middle of the video untouched. Package
# one mask for the browser and native paint bands instead of dimming all video.
tokens_path = ROOT / "design-contract/viptv-design-system/tokens/tokens.json"
tokens = json.loads(tokens_path.read_text())
player_colors, player_sizes = tokens["color"]["player"], tokens["size"]["player"]
def rgba(name):
    return tuple(float(value) for value in re.findall(r"[\d.]+", player_colors[name]["$value"]))
top_color, middle_color, end_color = rgba("shade"), rgba("shade-mid-tv"), rgba("shade-end-tv")
top_height = float(player_sizes["shade-top-tv"]["$value"].removesuffix("px"))
bottom_height = float(player_sizes["shade-bottom-tv"]["$value"].removesuffix("px"))
player = Image.new("RGBA", (480, 270))
for y in range(player.height):
    py = (y + .5) / player.height * 1080
    top_alpha = top_color[3] * max(0, 1 - py / top_height)
    t = max(0, min(1, (py - (1080 - bottom_height)) / bottom_height))
    bottom_alpha = (middle_color[3] * t / .45 if t < .45 else
                    middle_color[3] + (end_color[3] - middle_color[3]) * (t - .45) / .55)
    for x in range(player.width):
        player.putpixel((x, y), (*map(round, top_color[:3]), round(max(top_alpha, bottom_alpha) * 255)))
save("player-scrim.png", player)

spinner = Image.new("RGBA", (224, 224))
draw = ImageDraw.Draw(spinner)
draw.ellipse((28, 28, 196, 196), outline=(255,255,255,65), width=20)
draw.arc((28, 28, 196, 196), -90, 0, fill=(255,255,255,255), width=20)
save("busy-spinner.png", spinner.resize((112,112), Image.Resampling.LANCZOS))
