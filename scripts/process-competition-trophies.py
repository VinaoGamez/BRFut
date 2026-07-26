"""Remove fundo magenta dos troféus de campeonato e exporta PNG transparente."""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets" / "competitions" / "trophies"
TROPHY_MAX_HEIGHT = 112
WEBP_QUALITY = 78
CURSOR_ASSETS = Path(
    r"C:\Users\Vinão\.cursor\projects\c-Users-Vin-o-Documents-Matchday-Alpha\assets"
)

SRC = [
    (
        CURSOR_ASSETS
        / "c__Users_Vin_o_AppData_Roaming_Cursor_User_workspaceStorage_d270694926bdfd4a0b308a3b89cea87b_images_call_w7fZXA0ANwoByv2F6yR9FwpK-fbdc40a4-ef67-4450-a9ef-43b112ef1bee.png",
        "trophy-nacional.png",
    ),
    (
        CURSOR_ASSETS
        / "c__Users_Vin_o_AppData_Roaming_Cursor_User_workspaceStorage_d270694926bdfd4a0b308a3b89cea87b_images_call_yyYyJCYDAv5nGgptG07lZZp3-a0bc37cc-ae4f-4d14-8ccf-6a72af4bc950.png",
        "trophy-copa-nacional.png",
    ),
    (
        CURSOR_ASSETS
        / "c__Users_Vin_o_AppData_Roaming_Cursor_User_workspaceStorage_d270694926bdfd4a0b308a3b89cea87b_images_call_7BgNIz7zjQb2sgNy2kXiunqb-352d46ef-f03b-46dc-bba0-778c0f830bb0.png",
        "trophy-recopa-nacional.png",
    ),
    (
        CURSOR_ASSETS
        / "c__Users_Vin_o_AppData_Roaming_Cursor_User_workspaceStorage_d270694926bdfd4a0b308a3b89cea87b_images_call_IMeASQapQS9BJaSsoY6IDVy3-ab38a1b3-c15a-4ab3-bd94-7e90b3c97de6.png",
        "trophy-estaduais.png",
    ),
    (
        CURSOR_ASSETS
        / "c__Users_Vin_o_AppData_Roaming_Cursor_User_workspaceStorage_d270694926bdfd4a0b308a3b89cea87b_images_call_rB25oZ6Bt8thzrgklpFv0KNH-8aa1c11b-9469-4e7b-aaa8-5b4e0a1b38de.png",
        "trophy-libertadores.png",
    ),
    (
        CURSOR_ASSETS
        / "c__Users_Vin_o_AppData_Roaming_Cursor_User_workspaceStorage_d270694926bdfd4a0b308a3b89cea87b_images_call_3GgtS9FBj3pNjtdnt0LfMo3Y-0083fc46-bc86-4b70-a32d-b093b04d2d62.png",
        "trophy-sul-americana.png",
    ),
]


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
        out = fit_height(key_and_trim(Image.open(src)), TROPHY_MAX_HEIGHT)
        webp_path = ASSETS / name.replace(".png", ".webp")
        out.save(webp_path, "WEBP", quality=WEBP_QUALITY, method=6)
        print(f"{webp_path.name}: {out.size} ({webp_path.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
