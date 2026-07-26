"""Extract BR FUT monogram + BR Football lockup with clean transparency."""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
LOCKUP_SRC = ROOT / "assets" / "brand" / "source" / "brfut-lockup-source.png"
MARK_SRC = ROOT / "assets" / "brand" / "source" / "brfut-mark-source.png"
CANONICAL_LOCKUP = LOCKUP_SRC
CANONICAL_MARK = MARK_SRC
OUT = ROOT / "assets" / "brand"
PUBLIC = ROOT / "public" / "brand"
FAVICON_BG = (5, 12, 23, 255)


def is_magenta_bg(r: int, g: int, b: int, a: int = 255) -> bool:
    if a < 10:
        return True
    if r >= 150 and b >= 150 and g <= max(r, b) * 0.55:
        return True
    if r >= 180 and b >= 120 and g <= 90:
        return True
    return False


def is_dark_sheet(r: int, g: int, b: int, a: int = 255) -> bool:
    if a < 10:
        return True
    peak = max(r, g, b)
    if peak > 62:
        return False
    spread = max(r, g, b) - min(r, g, b)
    # Keep saturated dark blues (bola) off the sheet mask.
    if b > r + 18 and b > g + 10 and peak > 24:
        return False
    return spread <= 36


def detect_bg_mode(im: Image.Image) -> str:
    px = im.load()
    w, h = im.size
    corners = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    magenta = sum(1 for x, y in corners if is_magenta_bg(*px[x, y]))
    if magenta >= 3:
        return "magenta"
    return "dark"


def flood_remove_sheet(im: Image.Image, mode: str) -> Image.Image:
    is_bg = is_magenta_bg if mode == "magenta" else is_dark_sheet
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    visited = [[False] * h for _ in range(w)]
    q: deque[tuple[int, int]] = deque()

    def seed(x: int, y: int) -> None:
        if 0 <= x < w and 0 <= y < h and not visited[x][y]:
            r, g, b, a = px[x, y]
            if is_bg(r, g, b, a):
                visited[x][y] = True
                q.append((x, y))

    for x in range(w):
        seed(x, 0)
        seed(x, h - 1)
    for y in range(h):
        seed(0, y)
        seed(w - 1, y)

    while q:
        x, y = q.popleft()
        px[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h and not visited[nx][ny]:
                r, g, b, a = px[nx, ny]
                if is_bg(r, g, b, a):
                    visited[nx][ny] = True
                    q.append((nx, ny))
    return im


def defringe_near_black(im: Image.Image) -> Image.Image:
    """Remove halos/canvas residue without eating saturated dark logo colors."""
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a <= 0:
                continue
            peak = max(r, g, b)
            spread = max(r, g, b) - min(r, g, b)
            if b > r + 18 and b > g + 10 and peak > 24:
                continue
            if peak <= 24:
                px[x, y] = (r, g, b, 0)
                continue
            if peak <= 58 and spread <= 28:
                fade = (peak - 24) / 34
                px[x, y] = (r, g, b, int(a * max(0.0, min(1.0, fade))))
    return im


def remove_background(im: Image.Image) -> Image.Image:
    mode = detect_bg_mode(im)
    cut = flood_remove_sheet(im, mode)
    return defringe_near_black(cut)


def trim(im: Image.Image, pad: int = 8) -> Image.Image:
    bbox = im.getbbox()
    if not bbox:
        return im
    l, t, r, b = bbox
    return im.crop(
        (max(0, l - pad), max(0, t - pad), min(im.width, r + pad), min(im.height, b + pad))
    )


def resize_height(im: Image.Image, height: int) -> Image.Image:
    ratio = height / max(im.height, 1)
    width = max(1, int(im.width * ratio))
    return im.resize((width, height), Image.Resampling.LANCZOS)


def to_square_mark(im: Image.Image, side: int = 256) -> Image.Image:
    trimmed = trim(im, pad=10)
    canvas = Image.new("RGBA", (max(trimmed.size), max(trimmed.size)), (0, 0, 0, 0))
    canvas.paste(
        trimmed,
        ((canvas.width - trimmed.width) // 2, (canvas.height - trimmed.height) // 2),
        trimmed,
    )
    return canvas.resize((side, side), Image.Resampling.LANCZOS)


def to_favicon_mark(im: Image.Image, side: int = 180) -> Image.Image:
    """Monogram on solid dark background — browser tab only."""
    trimmed = trim(im, pad=12)
    scale = min((side - 28) / max(trimmed.width, 1), (side - 28) / max(trimmed.height, 1))
    resized = trimmed.resize(
        (max(1, int(trimmed.width * scale)), max(1, int(trimmed.height * scale))),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", (side, side), FAVICON_BG)
    canvas.paste(
        resized,
        ((side - resized.width) // 2, (side - resized.height) // 2),
        resized,
    )
    return canvas


def sample_cyan(im: Image.Image) -> str:
    px = im.load()
    votes = []
    for y in range(0, im.height, 2):
        for x in range(0, im.width, 2):
            r, g, b, a = px[x, y]
            if a < 180:
                continue
            if min(r, g, b) > 220:
                continue
            if b > 140 and b >= g and b > r + 15:
                votes.append((r, g, b))
    if not votes:
        return "#14d5f3"
    n = len(votes)
    r = sum(v[0] for v in votes) // n
    g = sum(v[1] for v in votes) // n
    b = sum(v[2] for v in votes) // n
    return f"#{r:02x}{g:02x}{b:02x}"


def resolve_source(preferred: Path, canonical: Path) -> Path:
    if preferred.is_file():
        return preferred
    if canonical.is_file():
        return canonical
    raise SystemExit(f"Logo source not found: {preferred}")


def opacity_stats(im: Image.Image) -> tuple[int, int]:
    px = im.load()
    opaque = 0
    dark = 0
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a > 8:
                opaque += 1
                if max(r, g, b) <= 24:
                    dark += 1
    return opaque, dark


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)
    CANONICAL_LOCKUP.parent.mkdir(parents=True, exist_ok=True)

    lockup_source = resolve_source(LOCKUP_SRC, CANONICAL_LOCKUP)
    mark_source = resolve_source(MARK_SRC, CANONICAL_MARK)

    lockup_cut = trim(remove_background(Image.open(lockup_source).convert("RGBA")), pad=10)
    mark_cut = trim(remove_background(Image.open(mark_source).convert("RGBA")), pad=12)

    lockup = resize_height(lockup_cut, 160)
    lockup_lg = resize_height(lockup_cut, 220)
    mark_256 = to_square_mark(mark_cut, 256)
    mark_128 = mark_256.resize((128, 128), Image.Resampling.LANCZOS)
    mark_favicon = to_favicon_mark(mark_cut, 180)
    cyan = sample_cyan(lockup_cut)
    palette = (
        f"cyan={cyan}\nlime=#bbeb27\nnight=#050c17\nbrand=BR Football\n"
        f"monogram=BR FUT\nlockup={lockup_source.name}\nmark={mark_source.name}\n"
    )

    for folder in (OUT, PUBLIC):
        lockup.save(folder / "lockup.png")
        lockup_lg.save(folder / "lockup-lg.png")
        mark_128.save(folder / "mark.png")
        mark_256.save(folder / "mark-lg.png")
        mark_favicon.save(folder / "mark-favicon.png")
        (folder / "palette.txt").write_text(palette, encoding="utf-8")

    _, lockup_dark = opacity_stats(lockup)
    _, mark_dark = opacity_stats(mark_128)
    print("cyan", cyan)
    print("lockup", lockup.size, "residual_dark_px", lockup_dark)
    print("mark", mark_128.size, "residual_dark_px", mark_dark)
    print("saved ->", OUT, PUBLIC)


if __name__ == "__main__":
    main()
