#!/usr/bin/env python3
"""
Completa a pirâmide nacional 2026: listas oficiais CBF + Brasfoot + placeholders.

- Nacional (A/B/C/D): listas oficiais ge.globo — cada clube em sua divisão.
- Placeholder temporário quando o .ban ainda não existe no Brasfoot.
- Regional (REG): demais clubes BRA do import Brasfoot.

Saídas:
  public/data/brasfoot-clubs-import.json   (atualizado)
  public/data/brazil-official-pyramid-2026.json
  public/data/brazil-divisions-2026-report.json

Uso:
  py scripts/complete-official-pyramid-2026.py
  py scripts/complete-official-pyramid-2026.py --write-registry
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IN_JSON = ROOT / "public" / "data" / "brasfoot-clubs-import.json"
OUT_PYRAMID = ROOT / "public" / "data" / "brazil-official-pyramid-2026.json"
OUT_REPORT = ROOT / "public" / "data" / "brazil-divisions-2026-report.json"
REGISTRY_JS = ROOT / "js" / "engine" / "brazilian-clubs-by-uf.js"

spec = importlib.util.spec_from_file_location(
    "assign_divisions", ROOT / "scripts" / "assign-brazil-divisions-2026.py"
)
assign = importlib.util.module_from_spec(spec)
spec.loader.exec_module(assign)

OFFICIAL_SERIES = (
    ("A", assign.SERIE_A_2026),
    ("B", assign.SERIE_B_2026),
    ("C", assign.SERIE_C_2026),
    ("D", assign.SERIE_D_2026),
)

# Brasfoot costuma errar UF no .ban — força UF oficial por slug conhecido.
SLUG_OFFICIAL_UF: dict[str, str] = {
    "botafogosp_bra": "SP",
    "aguiapa_bra": "PA",
    "atleticoce_bra": "CE",
    "portuguesarj_bra": "RJ",
    "novohamburgo_bra": "RS",
    "concordiasc_bra": "SC",
    "hercilioluzsc_bra": "SC",
}


def slug_from_name(name: str, uf: str) -> str:
    text = assign.norm_name(name).replace(" ", "-")
    suffix = uf.lower()
    return f"{text}-{suffix}" if text else f"clube-{suffix}"


def crest_from_name(name: str) -> dict:
    label = str(name or "Clube")
    h = 0
    for ch in label:
        h = (h * 31 + ord(ch)) & 0xFFFFFFFF
    hue = h % 360
    hue2 = (hue + 168) % 360
    patterns = ("vertical", "horizontal", "diagonal", "stripes-h", "solid")
    shapes = ("classic", "round", "modern", "banner")
    return {
        "slug": "",
        "primary": f"hsl({hue} 58% 38%)",
        "secondary": f"hsl({hue2} 52% 92%)",
        "accent": "#ffffff",
        "pattern": patterns[h % len(patterns)],
        "shape": shapes[(h >> 2) % len(shapes)],
    }


def placeholder_id(name: str, uf: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", assign.norm_name(name)).strip("-") or "clube"
    return f"official-placeholder-{base}-{uf.lower()}"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def index_official_matches(clubs: list[dict], official: dict[str, str]) -> dict[str, list[dict]]:
    slug_map = assign.build_slug_division_map(clubs, official)
    by_key: dict[str, list[dict]] = {}
    for club in clubs:
        if club.get("country") != "BRA":
            continue
        div, method = assign.match_division(club, official, slug_map)
        if not div:
            continue
        canon_name, canon_uf = assign.resolve_canonical(club.get("name", ""), club.get("uf", ""))
        key = assign.registry_key(canon_name, canon_uf)
        by_key.setdefault(key, []).append(club)
    return by_key


def pick_best_match(candidates: list[dict]) -> dict | None:
    if not candidates:
        return None
    real = [c for c in candidates if not c.get("placeholder")]
    pool = real or candidates
    return sorted(pool, key=lambda c: c.get("name", ""))[0]


def club_slug(club: dict) -> str:
    crest = club.get("crest") or {}
    brasfoot = club.get("brasfoot") or {}
    return str(crest.get("slug") or brasfoot.get("slug") or "").lower()


def apply_official_slot_metadata(club: dict, official_name: str, official_uf: str) -> None:
    """Nome + UF canônicos da lista CBF no clube que ocupa o slot."""
    club["name"] = official_name
    club["uf"] = official_uf.upper()
    club.pop("needsReview", None)
    slug = club_slug(club)
    if slug and slug in SLUG_OFFICIAL_UF:
        club["uf"] = SLUG_OFFICIAL_UF[slug]
    brasfoot = club.get("brasfoot")
    if isinstance(brasfoot, dict):
        brasfoot["ufCorrected"] = official_uf.upper()


def build_placeholder(name: str, uf: str, division: str) -> dict:
    crest = crest_from_name(name)
    crest["slug"] = slug_from_name(name, uf)
    ts = now_iso()
    return {
        "name": name,
        "country": "BRA",
        "uf": uf.upper(),
        "division": division,
        "crest": crest,
        "id": placeholder_id(name, uf),
        "placeholder": True,
        "createdAt": ts,
        "updatedAt": ts,
        "divisionSource": "cbf2026:placeholder",
    }


def inject_missing_placeholders(clubs: list[dict], official: dict[str, str]) -> tuple[list[dict], list[dict]]:
    by_key = index_official_matches(clubs, official)
    existing_ids = {c.get("id") for c in clubs if c.get("id")}
    added: list[dict] = []

    for division, teams in OFFICIAL_SERIES:
        for name, uf in teams:
            key = assign.registry_key(name, uf)
            if pick_best_match(by_key.get(key, [])):
                continue
            pid = placeholder_id(name, uf)
            if pid in existing_ids:
                continue
            entry = build_placeholder(name, uf, division)
            clubs.append(entry)
            by_key.setdefault(key, []).append(entry)
            existing_ids.add(entry["id"])
            added.append({"name": name, "uf": uf, "division": division, "id": entry["id"]})

    return clubs, added


def assign_all_divisions(
    clubs: list[dict], official: dict[str, str]
) -> tuple[Counter, dict[str, dict]]:
    """Cada slot oficial (149) recebe no máximo 1 clube; restante do Brasfoot → REG."""
    slug_map = assign.build_slug_division_map(clubs, official)
    by_key = index_official_matches(clubs, official)
    filled: dict[str, dict] = {}

    for division, teams in OFFICIAL_SERIES:
        for name, uf in teams:
            key = assign.registry_key(name, uf)
            match = pick_best_match(by_key.get(key, []))
            if match:
                filled[key] = match
                match["division"] = division
                apply_official_slot_metadata(match, name, uf)
                if match.get("placeholder"):
                    match["divisionSource"] = "cbf2026:placeholder"
                else:
                    _, method = assign.match_division(match, official, slug_map)
                    match["divisionSource"] = f"cbf2026:{method}"

    filled_ids = {id(c) for c in filled.values()}
    stats: Counter = Counter()
    for club in clubs:
        if club.get("country") != "BRA":
            continue
        if id(club) in filled_ids:
            stats[club["division"]] += 1
        else:
            club["division"] = "REG"
            club["divisionSource"] = "cbf2026:regional"
            stats["REG"] += 1
    return stats, filled


def club_summary(club: dict, official_name: str, official_uf: str) -> dict:
    crest = club.get("crest") or {}
    brasfoot = club.get("brasfoot") or {}
    return {
        "name": official_name,
        "uf": official_uf.upper(),
        "id": club.get("id"),
        "slug": crest.get("slug") or brasfoot.get("slug") or "",
        "placeholder": bool(club.get("placeholder")),
        "hasBrasfoot": bool(brasfoot.get("file")),
        "divisionSource": club.get("divisionSource"),
    }


def build_pyramid_lists(
    clubs: list[dict], official: dict[str, str], filled: dict[str, dict]
) -> dict[str, list[dict]]:
    pyramid: dict[str, list[dict]] = {div: [] for div, _ in OFFICIAL_SERIES}

    for division, teams in OFFICIAL_SERIES:
        for name, uf in teams:
            key = assign.registry_key(name, uf)
            match = filled.get(key) or build_placeholder(name, uf, division)
            pyramid[division].append(club_summary(match, name, uf))

    return pyramid


def build_serie_d_groups(pyramid_d: list[dict]) -> list[list[str]]:
    """Chaves oficiais A1–A16 (6 clubes cada), na ordem CBF 2026."""
    return [
        [entry["name"] for entry in pyramid_d[g * 6 : (g + 1) * 6]]
        for g in range(16)
        if len(pyramid_d) >= (g + 1) * 6
    ]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write-registry", action="store_true")
    args = parser.parse_args()

    official = assign.build_official_map()
    data = json.loads(IN_JSON.read_text(encoding="utf-8"))
    clubs: list[dict] = list(data.get("clubs") or [])

    clubs, added = inject_missing_placeholders(clubs, official)
    stats, filled = assign_all_divisions(clubs, official)
    pyramid = build_pyramid_lists(clubs, official, filled)

    data["clubs"] = clubs
    data["stats"] = data.get("stats") or {}
    data["stats"]["divisions2026"] = dict(stats)
    data["stats"]["divisions2026At"] = now_iso()
    data["stats"]["officialPlaceholders"] = len(added)

    IN_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    pyramid_doc = {
        "generatedAt": now_iso(),
        "season": 2026,
        "source": "CBF Brasileirão Séries A-D 2026 (ge.globo) + Brasfoot + placeholders",
        "policy": {
            "national": "official_lists",
            "regional": "brasfoot_remainder",
            "fictionalNames": False,
        },
        "totals": {
            "A": len(pyramid["A"]),
            "B": len(pyramid["B"]),
            "C": len(pyramid["C"]),
            "D": len(pyramid["D"]),
            "REG": stats.get("REG", 0),
            "nationalTotal": sum(len(pyramid[d]) for d in "ABCD"),
            "braTotal": sum(stats.values()),
            "placeholdersAdded": len(added),
        },
        "divisions": pyramid,
        "serieDGroups": build_serie_d_groups(pyramid["D"]),
        "serieDGroupRules": {
            "groups": 16,
            "clubsPerGroup": 6,
            "maxClubsPerFederationPerGroup": 3,
            "formationCriteria": ["geographic", "logistics", "max_3_per_federation"],
            "knockoutPairing": "adjacent_pairs",
            "knockoutSeeding": "1v4_2v3",
            "source": "CBF conselho técnico mar/2026",
        },
        "placeholders": added,
    }
    OUT_PYRAMID.write_text(json.dumps(pyramid_doc, ensure_ascii=False, indent=2), encoding="utf-8")

    report = {
        "generatedAt": now_iso(),
        "season": 2026,
        "source": pyramid_doc["source"],
        "totals": dict(stats),
        "officialNationalClubs": len(official),
        "pyramidCounts": pyramid_doc["totals"],
        "placeholdersAdded": added,
        "divisions": pyramid,
    }
    OUT_REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    registry_updated = 0
    if args.write_registry:
        registry_updated = assign.write_registry(assign.load_registry_entries(), official)

    print("Piramide oficial 2026 completa")
    for div in ("A", "B", "C", "D", "REG"):
        print(f"  {div}: {stats.get(div, 0)}")
    print(f"  Placeholders criados: {len(added)}")
    print(f"  Piramide: {OUT_PYRAMID}")
    print(f"  Import:   {IN_JSON}")
    print(f"  Relatorio: {OUT_REPORT}")
    if args.write_registry:
        print(f"  Registry JS: {registry_updated} entradas atualizadas")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
