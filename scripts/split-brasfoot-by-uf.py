#!/usr/bin/env python3
"""Divide brasfoot-clubs-import.json em índice slim + 27 arquivos por UF."""
from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'public' / 'data' / 'brasfoot-clubs-import.json'
OUT_DIR = ROOT / 'public' / 'data' / 'brasfoot-by-uf'
INDEX = ROOT / 'public' / 'data' / 'brasfoot-regional-index.json'


def slim(club: dict) -> dict:
    return {
        'name': club.get('name') or '',
        'uf': str(club.get('uf') or '').upper(),
        'division': club.get('division') or 'REG',
        'country': club.get('country') or 'BRA',
    }


def main() -> None:
    payload = json.loads(SRC.read_text(encoding='utf-8'))
    clubs = payload.get('clubs') or []
    by_uf: dict[str, list] = defaultdict(list)
    index_clubs = []

    for club in clubs:
        uf = str(club.get('uf') or '').upper()
        if not uf or not club.get('name'):
            continue
        by_uf[uf].append(club)
        index_clubs.append(slim(club))

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for uf, items in sorted(by_uf.items()):
        dest = OUT_DIR / f'{uf.lower()}.json'
        dest.write_text(
            json.dumps({'uf': uf, 'clubs': items}, ensure_ascii=False, separators=(',', ':')),
            encoding='utf-8',
        )
        kb = dest.stat().st_size // 1024
        print(f'OK  {uf} ({len(items)} clubes, {kb} KB)')

    INDEX.write_text(
        json.dumps({'version': 1, 'clubs': index_clubs}, ensure_ascii=False, separators=(',', ':')),
        encoding='utf-8',
    )
    print(f'Index: {len(index_clubs)} clubes -> {INDEX}')
    print(f'Done: {len(by_uf)} UFs -> {OUT_DIR}')


if __name__ == '__main__':
    main()
