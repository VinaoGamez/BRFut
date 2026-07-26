"""Remove fundo sólido (preto / magenta) dos badges de especialista e exporta PNG transparente."""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets" / "cards" / "badges"
BADGE_MAX_HEIGHT = 140
WEBP_QUALITY = 82
CURSOR_ASSETS = Path(
    r"C:\Users\Vinão\.cursor\projects\c-Users-Vin-o-Documents-Matchday-Alpha\assets"
)

SRC = [
    (
        CURSOR_ASSETS
        / "c__Users_Vin_o_AppData_Roaming_Cursor_User_workspaceStorage_d270694926bdfd4a0b308a3b89cea87b_images_image-b362731c-7051-420d-ae34-d36d5ebf3db1.png",
        "card-badge-especialista-falta.png",
    ),
    (
        CURSOR_ASSETS
        / "c__Users_Vin_o_AppData_Roaming_Cursor_User_workspaceStorage_d270694926bdfd4a0b308a3b89cea87b_images_image-d7bfc2c6-5cb2-4a21-a306-8e93883ab442.png",
        "card-badge-especialista-penalti.png",
    ),
    (
        CURSOR_ASSETS
        / "c__Users_Vin_o_AppData_Roaming_Cursor_User_workspaceStorage_d270694926bdfd4a0b308a3b89cea87b_images_image-12b473ba-0243-4147-bc22-d994de7931e5.png",
        "card-badge-especialista-defesa-penalti.png",
    ),
]

LEGACY_ALIASES = {
    "card-badge-especialista-falta.png": "card-badge-falta.png",
    "card-badge-especialista-penalti.png": "card-badge-penalti.png",
}


def is_magenta_backdrop(r: int, g: int, b: int) -> bool:
    if r > 240 and g < 40 and b > 240:
        return True
    if r > 180 and b > 180 and g < 120 and (r + b - g) > 200:
        return True
    return False


def is_black_backdrop(r: int, g: int, b: int, threshold: int = 32) -> bool:
    return r <= threshold and g <= threshold and b <= threshold


def is_backdrop(r: int, g: int, b: int) -> bool:
    return is_magenta_backdrop(r, g, b) or is_black_backdrop(r, g, b)


def flood_remove_edge_backdrop(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    seen = [[False] * w for _ in range(h)]
    q: deque[tuple[int, int]] = deque()

    def try_add(x: int, y: int) -> None:
        if x < 0 or y < 0 or x >= w or y >= h or seen[y][x]:
            return
        r, g, b, _a = px[x, y]
        if not is_backdrop(r, g, b):
            return
        seen[y][x] = True
        q.append((x, y))

    for x in range(w):
        try_add(x, 0)
        try_add(x, h - 1)
    for y in range(h):
        try_add(0, y)
        try_add(w - 1, y)

    while q:
        x, y = q.popleft()
        px[x, y] = (0, 0, 0, 0)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            try_add(x + dx, y + dy)

    return im


def key_and_trim(im: Image.Image) -> Image.Image:
    im = flood_remove_edge_backdrop(im)
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, _a = px[x, y]
            if is_magenta_backdrop(r, g, b):
                px[x, y] = (r, g, b, 0)
    bbox = im.getbbox()
    if not bbox:
        return im
    pad = max(8, int(min(im.size) * 0.02))
    l, t, r, b = bbox
    l = max(0, l - pad)
    t = max(0, t - pad)
    r = min(w, r + pad)
    b = min(h, b + pad)
    return im.crop((l, t, r, b))


def fit_height(im: Image.Image, max_h: int) -> Image.Image:
    w, h = im.size
    if h <= max_h:
        return im
    scale = max_h / h
    return im.resize((max(1, int(round(w * scale))), max_h), Image.Resampling.LANCZOS)


def main() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)
    for src, name in SRC:
        if not src.exists():
            raise FileNotFoundError(src)
        out = fit_height(key_and_trim(Image.open(src)), BADGE_MAX_HEIGHT)
        webp_path = ASSETS / name.replace(".png", ".webp")
        out.save(webp_path, "WEBP", quality=WEBP_QUALITY, method=6)
        print(f"{webp_path.name}: {out.size} ({webp_path.stat().st_size // 1024} KB)")

    for new, old in LEGACY_ALIASES.items():
        webp_new = ASSETS / new.replace(".png", ".webp")
        webp_old = ASSETS / old.replace(".png", ".webp")
        if webp_new.exists():
            Image.open(webp_new).save(webp_old, "WEBP", quality=WEBP_QUALITY, method=6)
            print(f"alias -> {webp_old.name}")


if __name__ == "__main__":
    main()
