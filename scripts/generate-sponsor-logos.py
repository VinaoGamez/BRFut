#!/usr/bin/env python3
"""Gera os logos dos patrocinadores fictícios do BR Fut (SVG fonte + WebP 512×512).

Todas as marcas aqui são inventadas para o jogo e não imitam empresas reais.
Fontes vetoriais em assets/sponsors/source/*.svg; o jogo usa os WebP de
assets/sponsors/icons/ e assets/sponsors/full/ (mesmo arquivo nos dois).

Uso: python scripts/generate-sponsor-logos.py   (requer cairosvg e Pillow)
"""
from __future__ import annotations

import io
import math
from pathlib import Path

import cairosvg
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT_SRC = ROOT / 'assets' / 'sponsors' / 'source'
OUT_ICONS = ROOT / 'assets' / 'sponsors' / 'icons'
OUT_FULL = ROOT / 'assets' / 'sponsors' / 'full'
NIGHT = '#050c17'


def _poly(points: list[tuple[float, float]]) -> str:
    return ' '.join(f'{x:.1f},{y:.1f}' for x, y in points)


# --- símbolos (desenhados numa área de 200×200, centro em 100,100) -----------

def sym_bird(c1: str, c2: str) -> str:  # tucano estilizado
    return (f'<circle cx="92" cy="100" r="62" fill="{c1}"/>'
            f'<path d="M120 70 Q190 62 196 98 Q170 112 122 110 Z" fill="{c2}"/>'
            f'<circle cx="104" cy="86" r="10" fill="{NIGHT}"/><circle cx="107" cy="83" r="3.5" fill="#fff"/>')


def sym_shield_wave(c1: str, c2: str) -> str:
    return (f'<path d="M100 22 L168 46 V104 Q168 154 100 182 Q32 154 32 104 V46 Z" fill="{c1}"/>'
            f'<path d="M44 112 Q72 92 100 112 T156 112 V124 Q128 104 100 124 T44 124 Z" fill="{c2}"/>'
            f'<path d="M50 84 Q75 66 100 84 T150 84 V96 Q125 78 100 96 T50 96 Z" fill="{c2}" opacity=".7"/>')


def sym_flame(c1: str, c2: str) -> str:
    return (f'<path d="M100 18 C134 58 166 84 160 126 C155 160 128 182 100 182 C72 182 45 160 40 126 C36 98 58 82 70 56 C76 78 86 88 96 92 C92 66 92 42 100 18 Z" fill="{c1}"/>'
            f'<path d="M100 96 C118 116 132 130 128 150 C125 166 113 174 100 174 C87 174 75 166 72 150 C70 136 82 124 100 96 Z" fill="{c2}"/>')


def sym_basket(c1: str, c2: str) -> str:
    return (f'<rect x="38" y="76" width="124" height="96" rx="18" fill="{c1}"/>'
            f'<path d="M66 80 V62 Q66 30 100 30 Q134 30 134 62 V80" fill="none" stroke="{c2}" stroke-width="14" stroke-linecap="round"/>'
            f'<rect x="60" y="108" width="80" height="12" rx="6" fill="{c2}"/><rect x="60" y="134" width="56" height="12" rx="6" fill="{c2}"/>')


def sym_bolt_circle(c1: str, c2: str) -> str:
    return (f'<circle cx="100" cy="100" r="80" fill="{c1}"/>'
            f'<polygon points="{_poly([(112, 36), (64, 110), (98, 110), (86, 166), (138, 88), (102, 88)])}" fill="{c2}"/>')


def sym_target(c1: str, c2: str) -> str:
    return (f'<circle cx="100" cy="100" r="80" fill="none" stroke="{c1}" stroke-width="18"/>'
            f'<circle cx="100" cy="100" r="44" fill="none" stroke="{c1}" stroke-width="18"/>'
            f'<circle cx="100" cy="100" r="14" fill="{c2}"/>'
            f'<path d="M100 100 L176 24" stroke="{c2}" stroke-width="12" stroke-linecap="round"/>'
            f'<polygon points="{_poly([(176, 24), (150, 30), (170, 50)])}" fill="{c2}"/>')


def sym_drop(c1: str, c2: str) -> str:  # pitanga
    return (f'<path d="M100 54 C146 54 172 90 166 128 C160 162 132 180 100 180 C68 180 40 162 34 128 C28 90 54 54 100 54 Z" fill="{c1}"/>'
            f'<path d="M100 56 C96 38 104 24 120 18 C120 34 114 46 100 56 Z" fill="{c2}"/>'
            f'<path d="M72 92 Q86 80 100 92" stroke="#ffffff" stroke-opacity=".5" stroke-width="8" fill="none" stroke-linecap="round"/>')


def sym_hanger(c1: str, c2: str) -> str:
    return (f'<path d="M100 40 Q100 22 116 22 Q130 22 130 36 Q130 50 100 64 L30 132 Q22 142 34 146 H166 Q178 142 170 132 L100 64" fill="none" stroke="{c1}" stroke-width="12" stroke-linejoin="round" stroke-linecap="round"/>'
            f'<rect x="58" y="154" width="84" height="12" rx="6" fill="{c2}"/>')


def sym_turtle_box(c1: str, c2: str) -> str:
    return (f'<rect x="36" y="58" width="128" height="100" rx="16" fill="{c1}"/>'
            f'<path d="M36 92 H164 M100 58 V158" stroke="{NIGHT}" stroke-width="8"/>'
            f'<polygon points="{_poly([(150, 30), (186, 58), (150, 86)])}" fill="{c2}"/>'
            f'<rect x="120" y="50" width="36" height="16" fill="{c2}"/>')


def sym_cactus_signal(c1: str, c2: str) -> str:
    return (f'<rect x="88" y="44" width="24" height="132" rx="12" fill="{c1}"/>'
            f'<path d="M88 118 H66 Q52 118 52 104 V80" fill="none" stroke="{c1}" stroke-width="20" stroke-linecap="round"/>'
            f'<path d="M112 100 H134 Q148 100 148 86 V66" fill="none" stroke="{c1}" stroke-width="20" stroke-linecap="round"/>'
            f'<path d="M140 30 Q162 38 166 58 M150 16 Q182 28 188 60" fill="none" stroke="{c2}" stroke-width="8" stroke-linecap="round"/>')


def sym_cup(c1: str, c2: str) -> str:
    return (f'<path d="M40 76 H150 V120 Q150 170 95 170 Q40 170 40 120 Z" fill="{c1}"/>'
            f'<path d="M150 88 H164 Q186 88 186 110 Q186 132 164 132 H150" fill="none" stroke="{c1}" stroke-width="12"/>'
            f'<path d="M72 30 Q62 44 72 58 M96 24 Q86 40 96 58 M120 30 Q110 44 120 58" fill="none" stroke="{c2}" stroke-width="8" stroke-linecap="round"/>')


def sym_capybara(c1: str, c2: str) -> str:
    return (f'<rect x="30" y="72" width="140" height="84" rx="40" fill="{c1}"/>'
            f'<rect x="122" y="52" width="58" height="56" rx="20" fill="{c1}"/>'
            f'<circle cx="152" cy="72" r="7" fill="{NIGHT}"/><rect x="138" y="44" width="14" height="16" rx="6" fill="{c2}"/>'
            f'<rect x="48" y="146" width="18" height="26" rx="8" fill="{c1}"/><rect x="132" y="146" width="18" height="26" rx="8" fill="{c1}"/>')


def sym_wind(c1: str, c2: str) -> str:
    return (f'<path d="M24 76 H132 Q160 76 160 52 Q160 30 138 30 Q118 30 116 50" fill="none" stroke="{c1}" stroke-width="16" stroke-linecap="round"/>'
            f'<path d="M24 112 H162 Q186 112 186 136 Q186 158 164 158 Q144 158 142 140" fill="none" stroke="{c2}" stroke-width="16" stroke-linecap="round"/>'
            f'<path d="M24 148 H98" stroke="{c1}" stroke-width="16" stroke-linecap="round"/>')


def sym_umbrella_bird(c1: str, c2: str) -> str:
    return (f'<path d="M24 110 Q100 10 176 110 Z" fill="{c1}"/>'
            f'<path d="M100 110 V160 Q100 178 82 178 Q66 178 64 162" fill="none" stroke="{c2}" stroke-width="12" stroke-linecap="round"/>'
            f'<path d="M62 110 Q72 92 82 110 M118 110 Q128 92 138 110" fill="{NIGHT}" opacity=".35"/>')


def sym_hill_sun(c1: str, c2: str) -> str:
    return (f'<circle cx="132" cy="70" r="34" fill="{c2}"/>'
            f'<path d="M14 170 Q60 86 112 128 Q146 98 186 170 Z" fill="{c1}"/>'
            f'<path d="M58 170 Q84 132 112 150" fill="none" stroke="{NIGHT}" stroke-opacity=".25" stroke-width="8"/>')


def sym_leaf_bolt(c1: str, c2: str) -> str:
    return (f'<path d="M36 164 Q24 54 164 30 Q176 160 36 164 Z" fill="{c1}"/>'
            f'<polygon points="{_poly([(112, 52), (72, 116), (100, 116), (88, 156), (130, 92), (102, 92)])}" fill="{c2}"/>')


def sym_gamepad(c1: str, c2: str) -> str:
    return (f'<path d="M50 60 H150 Q186 60 190 104 Q194 152 166 152 Q150 152 136 128 H64 Q50 152 34 152 Q6 152 10 104 Q14 60 50 60 Z" fill="{c1}"/>'
            f'<rect x="44" y="94" width="40" height="12" rx="4" fill="{c2}"/><rect x="58" y="80" width="12" height="40" rx="4" fill="{c2}"/>'
            f'<circle cx="138" cy="88" r="9" fill="{c2}"/><circle cx="158" cy="108" r="9" fill="{c2}"/>')


def sym_hawk_wheel(c1: str, c2: str) -> str:
    return (f'<circle cx="100" cy="112" r="64" fill="none" stroke="{c1}" stroke-width="16"/>'
            f'<circle cx="100" cy="112" r="16" fill="{c1}"/>'
            f'<path d="M100 112 L100 52 M100 112 L152 142 M100 112 L48 142" stroke="{c1}" stroke-width="10"/>'
            f'<path d="M20 40 Q100 4 180 40 Q140 36 100 58 Q60 36 20 40 Z" fill="{c2}"/>')


SYMBOLS = {
    'bird': sym_bird, 'shield_wave': sym_shield_wave, 'flame': sym_flame, 'basket': sym_basket,
    'bolt_circle': sym_bolt_circle, 'target': sym_target, 'drop': sym_drop, 'hanger': sym_hanger,
    'turtle_box': sym_turtle_box, 'cactus_signal': sym_cactus_signal, 'cup': sym_cup,
    'capybara': sym_capybara, 'wind': sym_wind, 'umbrella_bird': sym_umbrella_bird,
    'hill_sun': sym_hill_sun, 'leaf_bolt': sym_leaf_bolt, 'gamepad': sym_gamepad, 'hawk_wheel': sym_hawk_wheel,
}

# nome exibido, slug, símbolo, cor 1, cor 2, linha 1, linha 2, fonte, peso
SPONSORS = [
    ('Tucanet Fibra', 'tucanet-fibra', 'bird', '#ffb320', '#ff5f1f', 'tucanet', 'FIBRA', 'Montserrat', 800),
    ('Bancoroa', 'bancoroa', 'shield_wave', '#2fd18e', '#0b5d47', 'bancoroa', '', 'Montserrat', 800),
    ('Posto Flecha', 'posto-flecha', 'flame', '#ff4d3d', '#ffd23f', 'FLECHA', 'POSTOS', 'Archivo Black', 400),
    ('Mercadão Paçoca', 'mercadao-pacoca', 'basket', '#f2a541', '#7a3e1d', 'Paçoca', 'MERCADÃO', 'Montserrat', 800),
    ('Rango Já', 'rango-ja', 'bolt_circle', '#ff3b5c', '#fff3e0', 'rango já', '', 'Montserrat', 900),
    ('Lance Certo', 'lance-certo', 'target', '#29d4ff', '#c6ff3d', 'LANCE', 'CERTO', 'Anton', 400),
    ('Pitanga Pay', 'pitanga-pay', 'drop', '#ff4f5e', '#3fbf6b', 'pitanga', 'PAY', 'Montserrat', 800),
    ('Moda Bossa', 'moda-bossa', 'hanger', '#f5e6c8', '#e2557a', 'bossa', 'MODA', 'Montserrat', 600),
    ('Jabuti Express', 'jabuti-express', 'turtle_box', '#4cc38a', '#ffc53d', 'JABUTI', 'EXPRESS', 'Archivo Black', 400),
    ('Mandacaru Telecom', 'mandacaru-telecom', 'cactus_signal', '#5bd96b', '#29d4ff', 'mandacaru', 'TELECOM', 'Montserrat', 800),
    ('Vila Café', 'vila-cafe', 'cup', '#c98a5a', '#f5e6c8', 'Vila Café', 'TORRADO NA HORA', 'Montserrat', 700),
    ('Capivara Calçados', 'capivara-calcados', 'capybara', '#b9855b', '#3a2416', 'capivara', 'CALÇADOS', 'Montserrat', 800),
    ('Ventania Esportes', 'ventania-esportes', 'wind', '#29d4ff', '#c6ff3d', 'VENTANIA', 'ESPORTES', 'Anton', 400),
    ('Sabiá Seguros', 'sabia-seguros', 'umbrella_bird', '#7aa7ff', '#f2c14e', 'sabiá', 'SEGUROS', 'Montserrat', 800),
    ('Granja Serrana', 'granja-serrana', 'hill_sun', '#76c043', '#ffc53d', 'Granja Serrana', 'ALIMENTOS', 'Montserrat', 800),
    ('Cajuí Energia', 'cajui-energia', 'leaf_bolt', '#ff8a1f', '#fff200', 'CAJUÍ', 'ENERGY DRINK', 'Archivo Black', 400),
    ('Pipoca Games', 'pipoca-games', 'gamepad', '#9b6bff', '#ffd23f', 'pipoca', 'GAMES', 'Montserrat', 900),
    ('Carcará Motors', 'carcara-motors', 'hawk_wheel', '#d7dde4', '#ff4d3d', 'CARCARÁ', 'MOTORS', 'Anton', 400),
]


def _escape(text: str) -> str:
    return text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def build_svg(name: str, symbol: str, c1: str, c2: str, line1: str, line2: str, font: str, weight: int) -> str:
    size1 = 74 if len(line1) <= 8 else max(44, int(74 * 8 / len(line1)))
    sub = (f'<text x="256" y="460" text-anchor="middle" font-family="{font}, Montserrat, sans-serif" '
           f'font-weight="600" font-size="26" letter-spacing="7" fill="{c1}">{_escape(line2)}</text>') if line2 else ''
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="{_escape(name)}">'
        f'<rect width="512" height="512" fill="{NIGHT}"/>'
        f'<g transform="translate(126 28) scale(1.3)">{SYMBOLS[symbol](c1, c2)}</g>'
        f'<text x="256" y="{404 if line2 else 420}" text-anchor="middle" font-family="{font}, Montserrat, sans-serif" '
        f'font-weight="{weight}" font-size="{size1}" fill="#ffffff">{_escape(line1)}</text>'
        f'{sub}</svg>'
    )


def main() -> None:
    for folder in (OUT_SRC, OUT_ICONS, OUT_FULL):
        folder.mkdir(parents=True, exist_ok=True)
    for name, slug, symbol, c1, c2, line1, line2, font, weight in SPONSORS:
        svg = build_svg(name, symbol, c1, c2, line1, line2, font, weight)
        (OUT_SRC / f'{slug}.svg').write_text(svg, encoding='utf-8')
        png = cairosvg.svg2png(bytestring=svg.encode('utf-8'), output_width=512, output_height=512)
        image = Image.open(io.BytesIO(png)).convert('RGB')
        for folder in (OUT_ICONS, OUT_FULL):
            image.save(folder / f'{slug}.webp', 'WEBP', quality=90, method=6)
    print(f'{len(SPONSORS)} logos gerados em {OUT_ICONS.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
