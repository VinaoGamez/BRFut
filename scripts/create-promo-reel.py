from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "promo" / "reels-brfut"
SLIDES = OUT / "carrossel"
W, H = 1080, 1920

SCREENSHOTS = [
    {
        "title": "DO REGIONAL AO MUNDO",
        "subtitle": "Sua carreira. Suas decisões. Seu legado.",
        "image": ROOT / "public" / "brand" / "home-stadium.png",
        "mode": "hero",
    },
    {
        "title": "MONTE SEU ELENCO",
        "subtitle": "Avalie jogadores, salários, contratos e o futuro do clube.",
        "image": Path(r"C:\Users\VINO~1\AppData\Local\Temp\codex-clipboard-46008654-291e-4f50-b17e-39d68d526748.png"),
    },
    {
        "title": "DOMINE O MERCADO",
        "subtitle": "Busque talentos e encontre a contratação perfeita.",
        "image": Path(r"C:\Users\VINO~1\AppData\Local\Temp\codex-clipboard-a3761598-194b-4c7d-aa4e-8a8be5307ef2.png"),
    },
    {
        "title": "VIVA CADA PARTIDA",
        "subtitle": "Acompanhe o jogo ao vivo e mude o rumo da temporada.",
        "image": Path(r"C:\Users\VINO~1\AppData\Local\Temp\codex-clipboard-9649091d-c4a1-4555-9d59-bf46a3097eda.png"),
    },
    {
        "title": "SEJA O TÉCNICO",
        "subtitle": "Construa sua reputação e dispute o ranking nacional.",
        "image": Path(r"C:\Users\VINO~1\AppData\Local\Temp\codex-clipboard-ade81db3-0ce1-4cce-9e0a-b781cf874a04.png"),
        "mode": "portrait",
    },
    {
        "title": "CONQUISTE TROFÉUS",
        "subtitle": "Cada temporada escreve um novo capítulo da sua história.",
        "image": Path(r"C:\Users\VINO~1\AppData\Local\Temp\codex-clipboard-bf0beac2-7a84-47d6-8824-6d3a8e7ab7b9.png"),
    },
    {
        "title": "CHEGUE AO TOPO",
        "subtitle": "Compare sua carreira com os melhores técnicos do país.",
        "image": Path(r"C:\Users\VINO~1\AppData\Local\Temp\codex-clipboard-c18b3764-24d7-4910-9214-5b1772e0999f.png"),
    },
    {
        "title": "SUA CARREIRA COMEÇA AGORA",
        "subtitle": "Jogue grátis e entre para a comunidade BR Fut.",
        "image": ROOT / "public" / "brand" / "support-qrcode.png",
        "mode": "cta",
    },
]


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        Path(r"C:\Windows\Fonts\impact.ttf") if bold else Path(r"C:\Windows\Fonts\arial.ttf"),
        Path(r"C:\Windows\Fonts\arialbd.ttf") if bold else Path(r"C:\Windows\Fonts\segoeui.ttf"),
    ]
    for candidate in candidates:
        if candidate.is_file():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default()


FONT_TITLE = font(82, True)
FONT_SUBTITLE = font(34)
FONT_SMALL = font(23, True)
FONT_URL = font(55, True)


def gradient_background() -> Image.Image:
    image = Image.new("RGB", (W, H))
    px = image.load()
    for y in range(H):
        t = y / (H - 1)
        for x in range(W):
            glow = max(0.0, 1.0 - (((x - W * 0.72) / 720) ** 2 + ((y - H * 0.28) / 900) ** 2))
            px[x, y] = (
                int(2 + 2 * glow),
                int(12 + 23 * glow + 2 * t),
                int(24 + 43 * glow + 5 * t),
            )
    return image


def cover(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    target_w, target_h = size
    ratio = max(target_w / image.width, target_h / image.height)
    resized = image.resize((round(image.width * ratio), round(image.height * ratio)), Image.Resampling.LANCZOS)
    left = (resized.width - target_w) // 2
    top = (resized.height - target_h) // 2
    return resized.crop((left, top, left + target_w, top + target_h))


def contain(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    target_w, target_h = size
    ratio = min(target_w / image.width, target_h / image.height)
    return image.resize((round(image.width * ratio), round(image.height * ratio)), Image.Resampling.LANCZOS)


def rounded_paste(base: Image.Image, image: Image.Image, xy: tuple[int, int], radius: int = 28) -> None:
    mask = Image.new("L", image.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, image.width - 1, image.height - 1), radius=radius, fill=255)
    base.paste(image, xy, mask)


def centered_text(draw: ImageDraw.ImageDraw, y: int, text: str, text_font: ImageFont.ImageFont, fill: str) -> None:
    box = draw.textbbox((0, 0), text, font=text_font)
    draw.text(((W - (box[2] - box[0])) / 2, y), text, font=text_font, fill=fill)


def render_slide(item: dict, index: int) -> Image.Image:
    base = gradient_background()
    draw = ImageDraw.Draw(base)
    source = Image.open(item["image"]).convert("RGB")

    if item.get("mode") == "hero":
        stadium = cover(source, (W, H))
        stadium = stadium.filter(ImageFilter.GaussianBlur(1.2))
        overlay = Image.new("RGBA", (W, H), (1, 10, 23, 120))
        stadium = Image.alpha_composite(stadium.convert("RGBA"), overlay).convert("RGB")
        base.paste(stadium)
        logo = Image.open(ROOT / "public" / "brand" / "lockup-lg.png").convert("RGBA")
        logo = contain(logo, (760, 260))
        base.paste(logo, ((W - logo.width) // 2, 300), logo)
        draw = ImageDraw.Draw(base)
        centered_text(draw, 850, item["title"], FONT_TITLE, "#f5fbff")
        centered_text(draw, 970, item["subtitle"], FONT_SUBTITLE, "#b8cbd5")
        centered_text(draw, 1570, "BRFUT.COM.BR", FONT_URL, "#aaff22")
    elif item.get("mode") == "cta":
        logo = Image.open(ROOT / "public" / "brand" / "lockup-lg.png").convert("RGBA")
        logo = contain(logo, (760, 250))
        base.paste(logo, ((W - logo.width) // 2, 220), logo)
        centered_text(draw, 625, item["title"], font(67, True), "#f5fbff")
        centered_text(draw, 730, item["subtitle"], FONT_SUBTITLE, "#b8cbd5")
        centered_text(draw, 965, "BRFUT.COM.BR", font(92, True), "#aaff22")
        centered_text(draw, 1095, "JOGUE GRÁTIS", font(55, True), "#f5fbff")
        draw.rounded_rectangle((150, 1300, 930, 1515), radius=34, fill="#111f3f", outline="#62e9ff", width=4)
        centered_text(draw, 1340, "ENTRE NA COMUNIDADE", FONT_SMALL, "#8aa5b2")
        centered_text(draw, 1400, "DISCORD.GG/M86REBSTEE", font(39, True), "#62e9ff")
    else:
        # A própria tela vira uma atmosfera desfocada; a captura nítida permanece em destaque.
        crop_top = min(82, max(0, source.height // 12))
        clean = source.crop((0, crop_top, source.width, source.height))
        atmosphere = cover(clean, (W, H)).filter(ImageFilter.GaussianBlur(28))
        atmosphere = Image.alpha_composite(
            atmosphere.convert("RGBA"), Image.new("RGBA", (W, H), (0, 8, 20, 165))
        ).convert("RGB")
        base.paste(atmosphere)
        draw = ImageDraw.Draw(base)
        centered_text(draw, 155, item["title"], FONT_TITLE, "#f5fbff")
        centered_text(draw, 275, item["subtitle"], FONT_SUBTITLE, "#b8cbd5")

        # No formato vertical, ampliar a interface é mais importante que exibir
        # toda a largura do monitor. O recorte central mantém o conteúdo útil
        # legível e ocupa a maior parte da cena.
        sharp = cover(clean, (970, 1200))
        frame = Image.new("RGB", (sharp.width + 16, sharp.height + 16), "#20dff2")
        frame.paste(sharp, (8, 8))
        rounded_paste(base, frame, ((W - frame.width) // 2, 375), 30)

        centered_text(draw, 1635, "BRFUT.COM.BR", FONT_URL, "#aaff22")

    # Marca e progresso do carrossel.
    draw = ImageDraw.Draw(base)
    draw.text((54, 1810), "BR FUT · ALPHA", font=font(24, True), fill="#5ce9ff")
    draw.text((945, 1810), f"{index + 1:02d}/08", font=font(24, True), fill="#8aa5b2")
    bar_x, bar_y, bar_w = 54, 1870, 972
    draw.rounded_rectangle((bar_x, bar_y, bar_x + bar_w, bar_y + 8), radius=4, fill="#173444")
    draw.rounded_rectangle((bar_x, bar_y, bar_x + int(bar_w * (index + 1) / 8), bar_y + 8), radius=4, fill="#62e9ff")
    return base


def main() -> None:
    SLIDES.mkdir(parents=True, exist_ok=True)
    for index, item in enumerate(SCREENSHOTS):
        if not item["image"].is_file():
            raise FileNotFoundError(item["image"])
        slide = render_slide(item, index)
        slide.save(SLIDES / f"slide-{index + 1:02d}.png", optimize=True)
    print(f"Slides gerados em {SLIDES}")


if __name__ == "__main__":
    main()
