#!/usr/bin/env python3
"""Recompacta badges WebP do verso do card."""
from __future__ import annotations

from pathlib import Path

try:
    from PIL import Image
except ImportError:
    raise SystemExit('Instale Pillow: py -m pip install Pillow')

ROOT = Path(__file__).resolve().parent.parent
BADGES = ROOT / 'assets' / 'cards' / 'badges'
MAX_HEIGHT = 140
QUALITY = 82

FILES = [
    'card-badge-especialista-falta.webp',
    'card-badge-especialista-penalti.webp',
    'card-badge-especialista-defesa-penalti.webp',
    'card-badge-estrela-prata.webp',
    'card-badge-estrela-dourada.webp',
]


def main() -> None:
    for name in FILES:
        src = BADGES / name
        if not src.exists():
            print(f'SKIP {name} (missing)')
            continue
        im = Image.open(src).convert('RGBA')
        w, h = im.size
        if h > MAX_HEIGHT:
            scale = MAX_HEIGHT / h
            im = im.resize((max(1, int(round(w * scale))), MAX_HEIGHT), Image.Resampling.LANCZOS)
        im.save(src, 'WEBP', quality=QUALITY, method=6)
        print(f'OK  {name} -> {im.size[0]}x{im.size[1]} ({src.stat().st_size // 1024} KB)')
    print('Done.')


if __name__ == '__main__':
    main()
