"""Render the pinned launcher master into Roku's required tile sizes."""
import hashlib
from pathlib import Path

from PIL import Image

MASTER_SHA256 = '1ac37a83827fcc1958629bd60e2c30b7c4c17c0afbc608792cc0f91ddec77964'


def render(root: Path, package: Path):
    master = root / 'roku/branding/app-icon-square-1024.png'
    assert hashlib.sha256(master.read_bytes()).hexdigest() == MASTER_SHA256
    with Image.open(master) as source:
        assert source.size == (1024, 1024) and source.mode == 'RGB'
        for suffix, width, height in [('hd', 290, 218), ('fhd', 540, 405)]:
            tile = Image.new('RGB', (width, height), 'black')
            mark = source.resize((height, height), Image.Resampling.LANCZOS)
            tile.paste(mark, ((width - height) // 2, 0))
            tile.save(package / 'images' / ('launcher-' + suffix + '.png'))
