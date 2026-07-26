#!/usr/bin/env python3
"""
Atribui divisão (A/B/C/D/REG) aos clubes BRA do import — temporada 2026 (CBF).

Fonte: participantes oficiais Séries A–D 2026 (ge/CBF, dez/2025).
Clubes fora das 4 séries nacionais ficam REG (base estadual).

Uso:
  py scripts/assign-brazil-divisions-2026.py
  py scripts/assign-brazil-divisions-2026.py --write-registry
"""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IN_JSON = ROOT / "public" / "data" / "brasfoot-clubs-import.json"
REGISTRY_JS = ROOT / "js" / "engine" / "brazilian-clubs-by-uf.js"
OUT_REPORT = ROOT / "public" / "data" / "brazil-divisions-2026-report.json"

# Participantes Brasileirão 2026 — listas ge.globo (jul/2026, usuário)
SERIE_A_2026 = [
    ("Palmeiras", "SP"),
    ("Athletico PR", "PR"),
    ("Atlético-MG", "MG"),
    ("Bahia", "BA"),
    ("Botafogo", "RJ"),
    ("Chapecoense", "SC"),
    ("Corinthians", "SP"),
    ("Coritiba", "PR"),
    ("Cruzeiro", "MG"),
    ("Flamengo", "RJ"),
    ("Fluminense", "RJ"),
    ("Grêmio", "RS"),
    ("Internacional", "RS"),
    ("Mirassol", "SP"),
    ("Bragantino", "SP"),
    ("Remo", "PA"),
    ("Santos", "SP"),
    ("São Paulo", "SP"),
    ("Vasco", "RJ"),
    ("Vitória", "BA"),
]

SERIE_B_2026 = [
    ("América-MG", "MG"),
    ("Athletic", "MG"),
    ("Atlético-GO", "GO"),
    ("Avai", "SC"),
    ("Botafogo-SP", "SP"),
    ("Ceará", "CE"),
    ("CRB", "AL"),
    ("Criciúma", "SC"),
    ("Cuiabá", "MT"),
    ("Fortaleza", "CE"),
    ("Goiás", "GO"),
    ("Juventude", "RS"),
    ("Londrina", "PR"),
    ("Náutico", "PE"),
    ("Novorizontino", "SP"),
    ("Operário PR", "PR"),
    ("Ponte Preta", "SP"),
    ("São Bernardo", "SP"),
    ("Sport", "PE"),
    ("Vila Nova", "GO"),
]

SERIE_C_2026 = [
    ("Amazonas", "AM"),
    ("Anápolis", "GO"),
    ("Barra", "SC"),
    ("Botafogo-PB", "PB"),
    ("Brusque", "SC"),
    ("Caxias", "RS"),
    ("Confiança", "SE"),
    ("Ferroviária", "SP"),
    ("Figueirense", "SC"),
    ("Floresta", "CE"),
    ("Guarani", "SP"),
    ("Inter de Limeira", "SP"),
    ("Itabaiana", "SE"),
    ("Ituano", "SP"),
    ("Maranhão", "MA"),
    ("Maringá", "PR"),
    ("Paysandu", "PA"),
    ("Santa Cruz", "PE"),
    ("Volta Redonda", "RJ"),
    ("Ypiranga", "RS"),
]

# Série D 2026 — 96 clubes, 16 grupos × 6 (CBF / ge.globo, grupos A1–A16).
SERIE_D_2026 = [
    # Grupo A1
    ("Manauara", "AM"),
    ("Nacional", "AM"),
    ("São Raimundo", "RR"),
    ("Monte Roraima", "RR"),
    ("Manaus", "AM"),
    ("GAS", "RR"),
    # Grupo A2
    ("Guaporé", "RO"),
    ("Gazin Porto Velho", "RO"),
    ("Araguaína", "TO"),
    ("Independência", "AC"),
    ("Galvez", "AC"),
    ("Humaitá", "AC"),
    # Grupo A3
    ("Gama", "DF"),
    ("Luverdense", "MT"),
    ("Brasiliense", "DF"),
    ("Aparecidense", "GO"),
    ("Primavera", "MT"),
    ("Inhumas", "GO"),
    # Grupo A4
    ("Capital", "DF"),
    ("Goiatuba", "GO"),
    ("Ceilândia", "DF"),
    ("Mixto", "MT"),
    ("União Rondonópolis", "MT"),
    ("Operário VG", "MT"),
    # Grupo A5
    ("Trem", "AP"),
    ("Águia de Marabá", "PA"),
    ("Imperatriz", "MA"),
    ("Tuna Luso", "PA"),
    ("Tocantinópolis", "TO"),
    ("Oratório", "AP"),
    # Grupo A6
    ("Iguatu", "CE"),
    ("Maracanã", "CE"),
    ("Parnahyba", "PI"),
    ("Sampaio Corrêa", "MA"),
    ("Moto Club", "MA"),
    ("IAPE", "MA"),
    # Grupo A7
    ("Ferroviário", "CE"),
    ("Piauí", "PI"),
    ("Fluminense-PI", "PI"),
    ("Altos", "PI"),
    ("Tirol", "CE"),
    ("Atlético-CE", "CE"),
    # Grupo A8
    ("ABC", "RN"),
    ("América-RN", "RN"),
    ("Maguary", "PE"),
    ("Central", "PE"),
    ("Sousa", "PB"),
    ("Laguna", "RN"),
    # Grupo A9
    ("Treze", "PB"),
    ("Sergipe", "SE"),
    ("Serra Branca", "PB"),
    ("Lagarto", "SE"),
    ("Retrô", "PE"),
    ("Decisão", "PE"),
    # Grupo A10
    ("CSA", "AL"),
    ("Juazeirense", "BA"),
    ("ASA", "AL"),
    ("Jacuipense", "BA"),
    ("CSE", "AL"),
    ("Atlético de Alagoinhas", "BA"),
    # Grupo A11
    ("Uberlândia", "MG"),
    ("Betim", "MG"),
    ("CRAC", "GO"),
    ("Ivinhema", "MS"),
    ("ABECAT", "GO"),
    ("Operário MS", "MS"),
    # Grupo A12
    ("Democrata GV", "MG"),
    ("Tombense", "MG"),
    ("Vitória ES", "ES"),
    ("Rio Branco ES", "ES"),
    ("Porto-BA", "BA"),
    ("Real Noroeste", "ES"),
    # Grupo A13
    ("Portuguesa", "SP"),
    ("Água Santa", "SP"),
    ("Portuguesa-RJ", "RJ"),
    ("América-RJ", "RJ"),
    ("Madureira", "RJ"),
    ("Pouso Alegre", "MG"),
    # Grupo A14
    ("XV de Piracicaba", "SP"),
    ("Noroeste", "SP"),
    ("Velo Clube", "SP"),
    ("Sampaio Corrêa-RJ", "RJ"),
    ("Nova Iguaçu", "RJ"),
    ("Maricá", "RJ"),
    # Grupo A15
    ("Santa Catarina", "SC"),
    ("Cianorte", "PR"),
    ("FC Cascavel", "PR"),
    ("São Luiz", "RS"),
    ("Joinville", "SC"),
    ("Guarany de Bagé", "RS"),
    # Grupo A16
    ("Blumenau", "SC"),
    ("Marcílio Dias", "SC"),
    ("São Joseense", "PR"),
    ("São José", "RS"),
    ("Brasil de Pelotas", "RS"),
    ("Azuriz", "PR"),
]

# Aliases extras (nome Brasfoot / variantes → chave UF|nome canônico)
NAME_ALIASES: dict[str, tuple[str, str]] = {
    "atletico mg": ("Atlético-MG", "MG"),
    "atletico mineiro": ("Atlético-MG", "MG"),
    "atletico paranaense": ("Athletico PR", "PR"),
    "athletico paranaense": ("Athletico PR", "PR"),
    "athletico pr": ("Athletico PR", "PR"),
    "athletico": ("Athletico PR", "PR"),
    "atletico goianiense": ("Atlético-GO", "GO"),
    "atletico go": ("Atlético-GO", "GO"),
    "red bull bragantino": ("Bragantino", "SP"),
    "rb bragantino": ("Bragantino", "SP"),
    "bragantino": ("Bragantino", "SP"),
    "avai": ("Avai", "SC"),
    "vasco da gama": ("Vasco", "RJ"),
    "gremio": ("Grêmio", "RS"),
    "sao paulo": ("São Paulo", "SP"),
    "atletico clube goianiense": ("Atlético-GO", "GO"),
    "operario ferroviario": ("Operário PR", "PR"),
    "operario pr": ("Operário PR", "PR"),
    "operario": ("Operário PR", "PR"),
    "america mg": ("América-MG", "MG"),
    "america mineiro": ("América-MG", "MG"),
    "athletic club": ("Athletic", "MG"),
    "botafogo sp": ("Botafogo-SP", "SP"),
    "botafogo futebol clube sp": ("Botafogo-SP", "SP"),
    "barra sc": ("Barra", "SC"),
    "barra": ("Barra", "SC"),
    "ypiranga de erediano": ("Ypiranga", "RS"),
    "ypiranga ers": ("Ypiranga", "RS"),
    "ypiranga fc": ("Ypiranga", "RS"),
    "ferroviaria": ("Ferroviária", "SP"),
    "uniao araguainense": ("Araguaína", "TO"),
    "aguia de maraba": ("Águia de Marabá", "PA"),
    "aguia maraba": ("Águia de Marabá", "PA"),
    "rio branco es": ("Rio Branco ES", "ES"),
    "rio branco": ("Rio Branco ES", "ES"),
    "sao jose rs": ("São José", "RS"),
    "sao jose de porto alegre": ("São José", "RS"),
    "sao bernardo do campo": ("São Bernardo", "SP"),
    "clube do remo": ("Remo", "PA"),
    "vitoria es": ("Vitória ES", "ES"),
    "real noroeste capixaba": ("Real Noroeste", "ES"),
    "operario vg": ("Operário VG", "MT"),
    "operario varzea grandense": ("Operário VG", "MT"),
    "operario ms": ("Operário MS", "MS"),
    "sao raimundo rr": ("São Raimundo", "RR"),
    "sao raimundo": ("São Raimundo", "RR"),
    "nacional am": ("Nacional", "AM"),
    "amazonas fc": ("Amazonas", "AM"),
    "inter limeira": ("Inter de Limeira", "SP"),
    "inter de limeira": ("Inter de Limeira", "SP"),
    "xv piracicaba": ("XV de Piracicaba", "SP"),
    "xv de jaú": ("XV de Piracicaba", "SP"),
    "primavera ec": ("Primavera", "MT"),
    "uniao rondonopolis": ("União Rondonópolis", "MT"),
    "mixto ec": ("Mixto", "MT"),
    "cascavel": ("FC Cascavel", "PR"),
    "fc cascavel": ("FC Cascavel", "PR"),
    "humaita ac": ("Humaitá", "AC"),
    "humaita": ("Humaitá", "AC"),
    "parnahyba": ("Parnahyba", "PI"),
    "tocantinopolis": ("Tocantinópolis", "TO"),
    "sport recife": ("Sport", "PE"),
    "sport": ("Sport", "PE"),
    "decisao goiana": ("Decisão", "PE"),
    "america de natal": ("América-RN", "RN"),
    "america rn": ("América-RN", "RN"),
    "america-rn": ("América-RN", "RN"),
    "porto ba": ("Porto-BA", "BA"),
    "atletico cearense": ("Atlético-CE", "CE"),
    "betim futebol": ("Betim", "MG"),
    "portuguesa de desportos": ("Portuguesa", "SP"),
    "sampaio correa rj": ("Sampaio Corrêa-RJ", "RJ"),
    "sampaio correa - rj": ("Sampaio Corrêa-RJ", "RJ"),
    "parnaiba": ("Parnahyba", "PI"),
    "gazin porto velho": ("Gazin Porto Velho", "RO"),
    "porto velho ec": ("Gazin Porto Velho", "RO"),
    "ceilandia": ("Ceilândia", "DF"),
    "tuna luso": ("Tuna Luso", "PA"),
    "sampaio correa": ("Sampaio Corrêa", "MA"),
    "sampaio correa ma": ("Sampaio Corrêa", "MA"),
    "piaui fc": ("Piauí", "PI"),
    "piaui": ("Piauí", "PI"),
    "maguary pe": ("Maguary", "PE"),
    "maguary": ("Maguary", "PE"),
    "serra branca": ("Serra Branca", "PB"),
    "retro fc": ("Retrô", "PE"),
    "retro": ("Retrô", "PE"),
    "ivinhema": ("Ivinhema", "MS"),
    "tombense": ("Tombense", "MG"),
    "madureira": ("Madureira", "RJ"),
    "santa catarina clube": ("Santa Catarina", "SC"),
    "santa catarina fc": ("Santa Catarina", "SC"),
    "joinville ec": ("Joinville", "SC"),
    "joinville": ("Joinville", "SC"),
    "sao joseense": ("São Joseense", "PR"),
    "democrata gv": ("Democrata GV", "MG"),
    "america rj": ("América-RJ", "RJ"),
    "portuguesa rj": ("Portuguesa-RJ", "RJ"),
    "vitória es": ("Vitória ES", "ES"),
    "vitoria es": ("Vitória ES", "ES"),
    "maringa": ("Maringá", "PR"),
    "botafogo pb": ("Botafogo-PB", "PB"),
    "ypiranga rs": ("Ypiranga", "RS"),
    "cacerense": ("Cacerense", "MT"),
}
STRONG_SLUG_OVERRIDES: dict[str, str] = {
    "botafogopb_bra": "C",
    "botafogosp_bra": "B",
}


def norm_name(value: str) -> str:
    text = unicodedata.normalize("NFD", str(value or "").lower())
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = re.sub(r"\s*\([^)]*\)\s*$", "", text)
    text = re.sub(r"[^a-z0-9]+", " ", text).strip()
    return re.sub(r"\s+", " ", text)


def registry_key(name: str, uf: str) -> str:
    return f"{uf.upper()}|{norm_name(name)}"


def build_official_map() -> dict[str, str]:
    mapping: dict[str, str] = {}
    for division, teams in (
        ("A", SERIE_A_2026),
        ("B", SERIE_B_2026),
        ("C", SERIE_C_2026),
        ("D", SERIE_D_2026),
    ):
        for name, uf in teams:
            mapping[registry_key(name, uf)] = division
    return mapping


def resolve_canonical(name: str, uf: str) -> tuple[str, str]:
    key = norm_name(name)
    if key in NAME_ALIASES:
        return NAME_ALIASES[key]
    return name.strip(), uf.upper()


def club_slug(club: dict) -> str:
    crest = club.get("crest") or {}
    brasfoot = club.get("brasfoot") or {}
    return str(crest.get("slug") or brasfoot.get("slug") or "").lower()


def match_division_strict(
    name: str, uf: str, official: dict[str, str]
) -> tuple[str | None, str]:
    """Somente match exato por UF + nome normalizado (ou alias exato)."""
    canon_name, canon_uf = resolve_canonical(name, uf)
    key = registry_key(canon_name, canon_uf)
    if key in official:
        return official[key], "exact"

    n = norm_name(name)
    if n in NAME_ALIASES:
        alias_name, alias_uf = NAME_ALIASES[n]
        hit = official.get(registry_key(alias_name, alias_uf))
        if hit:
            return hit, f"alias:{alias_name}"

    return None, "none"


def build_slug_division_map(clubs: list[dict], official: dict[str, str]) -> dict[str, str]:
    """Slugs de clubes com match exato — desambigua nomes/UF errados no Brasfoot."""
    slug_map: dict[str, str] = {}
    for club in clubs:
        if club.get("country") != "BRA":
            continue
        div, method = match_division_strict(club.get("name", ""), club.get("uf", ""), official)
        if not div or method not in ("exact", "alias"):
            continue
        slug = club_slug(club)
        if slug:
            slug_map[slug] = div
    return slug_map


def match_division(
    club: dict, official: dict[str, str], slug_map: dict[str, str]
) -> tuple[str | None, str]:
    slug = club_slug(club)
    if slug and slug in STRONG_SLUG_OVERRIDES:
        return STRONG_SLUG_OVERRIDES[slug], "slug_override"

    div, method = match_division_strict(club.get("name", ""), club.get("uf", ""), official)
    if div:
        return div, method

    if slug and slug in slug_map:
        return slug_map[slug], "slug"

    return None, "none"


def load_registry_entries() -> list[dict]:
    text = REGISTRY_JS.read_text(encoding="utf-8")
    entries = []
    for name, uf, division in re.findall(
        r"\{ name: '([^']+)', uf: '([A-Z]{2})', division: '([A-Z]+|REG)'",
        text,
    ):
        entries.append({"name": name, "uf": uf, "division": division})
    return entries


def write_registry(entries: list[dict], official: dict[str, str]) -> int:
    text = REGISTRY_JS.read_text(encoding="utf-8")
    updated = 0
    for entry in entries:
        div, _ = match_division_strict(entry["name"], entry["uf"], official)
        target = div or "REG"
        if entry["division"] == target:
            continue
        old_frag = (
            f"name: '{entry['name']}', uf: '{entry['uf']}', division: '{entry['division']}'"
        )
        new_frag = f"name: '{entry['name']}', uf: '{entry['uf']}', division: '{target}'"
        if old_frag not in text:
            continue
        text = text.replace(old_frag, new_frag, 1)
        updated += 1
    REGISTRY_JS.write_text(text, encoding="utf-8")
    return updated


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write-registry", action="store_true", help="Atualiza REAL_CLUBS_BY_UF")
    args = parser.parse_args()

    official = build_official_map()
    data = json.loads(IN_JSON.read_text(encoding="utf-8"))
    clubs = data.get("clubs") or []

    slug_map = build_slug_division_map(clubs, official)

    stats = Counter()
    unmatched: list[dict] = []
    matched_samples: list[dict] = []

    for club in clubs:
        if club.get("country") != "BRA":
            continue
        name = club.get("name", "")
        uf = club.get("uf", "")
        div, method = match_division(club, official, slug_map)
        if div:
            club["division"] = div
            club["divisionSource"] = f"cbf2026:{method}"
            stats[div] += 1
            if len(matched_samples) < 40:
                matched_samples.append(
                    {"name": name, "uf": uf, "slug": club_slug(club), "division": div, "method": method}
                )
        else:
            club["division"] = "REG"
            club["divisionSource"] = "cbf2026:regional"
            stats["REG"] += 1
            if len(unmatched) < 80:
                unmatched.append({"name": name, "uf": uf, "slug": club_slug(club)})

    data["stats"] = data.get("stats") or {}
    data["stats"]["divisions2026"] = dict(stats)
    data["stats"]["divisions2026At"] = datetime.now(timezone.utc).isoformat()

    IN_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    report = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "season": 2026,
        "source": "CBF Brasileirão Séries A-D 2026 (ge.globo, listas jul/2026)",
        "totals": dict(stats),
        "officialNationalClubs": len(official),
        "unmatchedSample": unmatched,
        "matchedSample": matched_samples,
    }
    OUT_REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    registry_updated = 0
    if args.write_registry:
        registry_updated = write_registry(load_registry_entries(), official)

    bra_total = sum(stats.values())
    print(f"Clubes BRA processados: {bra_total}")
    for div in ("A", "B", "C", "D", "REG"):
        print(f"  {div}: {stats.get(div, 0)}")
    print(f"Relatório: {OUT_REPORT}")
    print(f"JSON: {IN_JSON}")
    if args.write_registry:
        print(f"Registry JS atualizado: {registry_updated} entradas")
    print(f"Amostra sem match nacional ({len(unmatched)} mostrados): ok -> REG estadual")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
