#!/usr/bin/env python3
"""
Mantém só 20 clubes argentinos recentes em Libertadores e/ou Sudamericana (2023–2025).

Saída:
  public/data/argentina-continental-clubs.json — manifest
  public/data/brasfoot-clubs-import.json      — lista filtrada
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IN_JSON = ROOT / "public" / "data" / "brasfoot-clubs-import.json"
OUT_MANIFEST = ROOT / "public" / "data" / "argentina-continental-clubs.json"

# Slugs Brasfoot (crest.slug) — participantes recentes Libertadores / Sudamericana.
KEEP_META = [
    {"slug": "racing_arg", "name": "Racing Club", "notes": "Libertadores 2023–2025 · Sudamericana 2024"},
    {"slug": "velezsarsfield_arg", "name": "Vélez Sarsfield", "notes": "Libertadores 2025"},
    {"slug": "estudiantes_ar", "name": "Estudiantes", "notes": "Libertadores 2024–2025"},
    {"slug": "centralcordoba_arg", "name": "Central Córdoba", "notes": "Libertadores 2025"},
    {"slug": "talleres_arg", "name": "Talleres", "notes": "Libertadores 2024–2025"},
    {"slug": "riverplate_arg", "name": "River Plate", "notes": "Libertadores 2023–2025"},
    {"slug": "bocajuniors_arg", "name": "Boca Juniors", "notes": "Libertadores 2023–2025 · Sudamericana 2024"},
    {"slug": "godoycruz_ar", "name": "Godoy Cruz", "notes": "Libertadores 2024 · Sudamericana 2025"},
    {"slug": "independiente_arg", "name": "Independiente", "notes": "Sudamericana 2025"},
    {"slug": "huracan_arg", "name": "Huracán", "notes": "Libertadores 2023 · Sudamericana 2025"},
    {"slug": "union_arg", "name": "Unión", "notes": "Sudamericana 2025"},
    {"slug": "lanus_arg", "name": "Lanús", "notes": "Sudamericana 2024–2025"},
    {"slug": "defensayjusticia_ar", "name": "Defensa y Justicia", "notes": "Sudamericana 2024–2025"},
    {"slug": "rosariocentral_arg", "name": "Rosario Central", "notes": "Libertadores 2024"},
    {"slug": "sanlorenzo_ar", "name": "San Lorenzo", "notes": "Libertadores 2024"},
    {"slug": "belgrano_arg", "name": "Belgrano", "notes": "Sudamericana 2024"},
    {"slug": "argentinojnrs_arg", "name": "Argentinos Juniors", "notes": "Libertadores 2023 · Sudamericana 2024"},
    {"slug": "tigre_arg", "name": "Tigre", "notes": "Sudamericana 2023"},
    {"slug": "newoldboys_ar", "name": "Newell's Old Boys", "notes": "Sudamericana 2023"},
    {"slug": "gimnasialp_arg", "name": "Gimnasia", "notes": "Sudamericana 2023"},
]

KEEP_SLUGS = frozenset(entry["slug"] for entry in KEEP_META)
KEEP_IDS = frozenset(f"brasfoot-{slug}" for slug in KEEP_SLUGS)


def club_slug(club: dict) -> str:
    return str((club.get("crest") or {}).get("slug") or "").lower()


def should_keep(club: dict) -> bool:
    if club.get("country") != "ARG":
        return True
    slug = club_slug(club)
    club_id = str(club.get("id") or "")
    return slug in KEEP_SLUGS or club_id in KEEP_IDS


def main() -> int:
    data = json.loads(IN_JSON.read_text(encoding="utf-8"))
    clubs = data.get("clubs") or []
    kept = [club for club in clubs if should_keep(club)]
    kept_arg = [club for club in kept if club.get("country") == "ARG"]
    removed_arg = sum(1 for club in clubs if club.get("country") == "ARG") - len(kept_arg)

    found_slugs = {club_slug(club) for club in kept_arg}
    missing = sorted(KEEP_SLUGS - found_slugs)
    if missing:
        print("ERRO: slugs ausentes:", ", ".join(missing))
        return 1

    now = datetime.now(timezone.utc).isoformat()
    manifest = {
        "generatedAt": now,
        "description": "20 clubes argentinos recentes em Libertadores e/ou Sudamericana (2023–2025)",
        "slugs": sorted(KEEP_SLUGS),
        "clubs": KEEP_META,
    }
    OUT_MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    data["clubs"] = kept
    stats = data.setdefault("stats", {})
    stats["argentinaContinentalKeep"] = len(kept_arg)
    stats["argentinaRemoved"] = removed_arg
    stats["after"] = len(kept)
    IN_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Manifest: {OUT_MANIFEST}")
    print(f"Argentina: {len(kept_arg)} mantidos, {removed_arg} removidos")
    print(f"Total clubes: {len(clubs)} -> {len(kept)}")
    for club in sorted(kept_arg, key=lambda item: item.get("name", "")):
        print(f"  - {club.get('name')} ({club_slug(club)})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
