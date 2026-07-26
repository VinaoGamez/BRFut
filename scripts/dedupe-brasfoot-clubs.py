#!/usr/bin/env python3
"""Remove times repetidos do pacote Brasfoot (mesmo nome + mesma UF, ou mesmo slug)."""
from __future__ import annotations

import json
import re
import unicodedata
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JSON_PATH = ROOT / "public" / "data" / "brasfoot-clubs-import.json"


def norm_name(value: str) -> str:
    text = unicodedata.normalize("NFD", str(value or ""))
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = re.sub(r"\s*\([^)]*\)\s*$", "", text)
    text = re.sub(r"\s*-\s*[A-Z]{2}\s*$", "", text)
    text = re.sub(r"[^a-zA-Z0-9]+", " ", text.strip().lower())
    return re.sub(r"\s+", " ", text).strip()


def club_key(club: dict) -> str:
    country = str(club.get("country") or "BRA").upper()
    if country != "BRA":
        return f"{country}|{norm_name(club.get('name', ''))}"
    uf = str(club.get("uf") or "").upper()
    return f"{uf}|{norm_name(club.get('name', ''))}"


def score(club: dict) -> tuple:
    crest = club.get("crest") or {}
    has_image = 1 if crest.get("image") else 0
    needs_review = 0 if not club.get("needsReview") else -1
    slug = str(crest.get("slug") or "")
    slug_bonus = 1 if "_bra" in slug or slug.endswith(f"_{club.get('uf', '').lower()}") else 0
    return (needs_review, has_image, slug_bonus, -len(str(club.get("name") or "")))


def pick_best(group: list[dict]) -> dict:
    return sorted(group, key=score, reverse=True)[0]


def main() -> int:
    payload = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    clubs: list[dict] = payload.get("clubs") or []
    before = len(clubs)

    by_key: dict[str, list[dict]] = defaultdict(list)
    by_slug: dict[str, list[dict]] = defaultdict(list)
    for club in clubs:
        key = club_key(club)
        if norm_name(club.get("name", "")):
            by_key[key].append(club)
        slug = str((club.get("crest") or {}).get("slug") or "")
        if slug:
            by_slug[slug].append(club)

    drop_ids: set[str] = set()
    removed: list[dict] = []

    for key, group in by_key.items():
        if len(group) < 2:
            continue
        best = pick_best(group)
        for club in group:
            if club is not best:
                drop_ids.add(club["id"])
                removed.append(
                    {
                        "reason": "name+uf",
                        "name": club.get("name"),
                        "uf": club.get("uf"),
                        "slug": (club.get("crest") or {}).get("slug"),
                        "kept": best.get("name"),
                        "keptSlug": (best.get("crest") or {}).get("slug"),
                    }
                )

    for slug, group in by_slug.items():
        if len(group) < 2:
            continue
        best = pick_best(group)
        for club in group:
            if club["id"] in drop_ids or club is best:
                continue
            drop_ids.add(club["id"])
            removed.append(
                {
                    "reason": "slug",
                    "name": club.get("name"),
                    "uf": club.get("uf"),
                    "slug": slug,
                    "kept": best.get("name"),
                    "keptSlug": (best.get("crest") or {}).get("slug"),
                }
            )

    kept = [club for club in clubs if club["id"] not in drop_ids]
    kept.sort(key=lambda c: (c.get("uf", ""), norm_name(c.get("name", ""))))

    payload["clubs"] = kept
    payload["dedupedAt"] = datetime.now(timezone.utc).isoformat()
    payload["stats"] = {
        **(payload.get("stats") or {}),
        "before": before,
        "after": len(kept),
        "removedDuplicates": len(removed),
    }
    payload["removedDuplicates"] = removed

    JSON_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Antes: {before} · Depois: {len(kept)} · Removidos: {len(removed)}")
    for row in removed[:25]:
        print(f"  [{row['reason']}] {row['name']} ({row['uf']}) -> {row['kept']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
