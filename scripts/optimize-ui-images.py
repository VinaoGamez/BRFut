"""Redimensiona e recompacta badges/troféus para o tamanho real de exibição na UI."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]

TARGETS = [
    (ROOT / "assets" / "cards" / "badges", 140, 82),
    (ROOT / "assets" / "competitions" / "trophies", 112, 78),
]

WEBP_METHOD = 6


def fit_height(im: Image.Image, max_h: int) -> Image.Image:
    im = im.convert("RGBA")
    w, h = im.size
    if h <= max_h:
        return im
    scale = max_h / h
    new_w = max(1, int(round(w * scale)))
    return im.resize((new_w, max_h), Image.Resampling.LANCZOS)


def optimize_file(path: Path, max_h: int, quality: int) -> None:
    im = Image.open(path)
    before = path.stat().st_size
    out = fit_height(im, max_h)
    if path.suffix.lower() == ".webp":
        out.save(path, "WEBP", quality=quality, method=WEBP_METHOD)
    else:
        out.save(path, "PNG", optimize=True)
    after = path.stat().st_size
    print(
        f"{path.relative_to(ROOT)}: {im.size[0]}x{im.size[1]} -> {out.size[0]}x{out.size[1]} "
        f"({before // 1024} KB -> {after // 1024} KB)"
    )


def main() -> None:
    for folder, max_h, quality in TARGETS:
        if not folder.is_dir():
            continue
        for path in sorted(folder.iterdir()):
            if path.suffix.lower() != ".webp":
                continue
            optimize_file(path, max_h, quality)


if __name__ == "__main__":
    main()
