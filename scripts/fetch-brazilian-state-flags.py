#!/usr/bin/env python3
"""Baixa bandeiras oficiais dos 27 estados (CC0, 200px) → public/state-flags/."""
from __future__ import annotations

import ssl
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'state-flags'
# 200px: nitidez em ~56px na UI (~3.5× retina) sem decodificar 800px na RAM.
BASE = 'https://raw.githubusercontent.com/pierrelapalu/icones-bandeiras-br-uf/master/dist/full/png-200'

# CC0 — https://github.com/pierrelapalu/icones-bandeiras-br-uf
STATE_FILES: dict[str, str] = {
    'AC': '02-acre-full.png',
    'AL': '03-alagoas-full.png',
    'AP': '04-amapa-full.png',
    'AM': '05-amazonas-full.png',
    'BA': '06-bahia-full.png',
    'CE': '07-ceara-full-v2.png',
    'DF': '08-distrito-federal-full.png',
    'ES': '09-espirito-santo-full-v2.png',
    'GO': '10-goias-full.png',
    'MA': '11-maranhao-full.png',
    'MT': '12-mato-grosso-full.png',
    'MS': '13-mato-grosso-do-sul-full.png',
    'MG': '14-minas-gerais-full.png',
    'PA': '15-para-full.png',
    'PB': '16-paraiba-full-v2.png',
    'PR': '17-parana-full.png',
    'PE': '18-pernambuco-full.png',
    'PI': '19-piaui-full.png',
    'RJ': '20-rio-de-janeiro-full.png',
    'RN': '21-rio-grande-do-norte-full.png',
    'RS': '22-rio-grande-do-sul-full.png',
    'RO': '23-rondonia-full.png',
    'RR': '24-roraima-full.png',
    'SC': '25-santa-catarina-full.png',
    'SP': '26-sao-paulo-full.png',
    'SE': '27-sergipe-full.png',
    'TO': '28-tocantins-full.png',
}


def download(url: str) -> bytes | None:
    req = urllib.request.Request(url, headers={'User-Agent': 'Matchday-Alpha/1.0 (state flags fetch)'})
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, timeout=60, context=ctx) as resp:
            data = resp.read()
            return data if len(data) >= 500 else None
    except (urllib.error.URLError, TimeoutError, OSError):
        return None


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    ok = fail = 0
    for uf, filename in STATE_FILES.items():
        url = f'{BASE}/{urllib.parse.quote(filename)}'
        dest = OUT / f'{uf.lower()}.png'
        data = download(url)
        if data:
            dest.write_bytes(data)
            kb = len(data) // 1024
            print(f'OK   {uf} ({kb} KB)')
            ok += 1
        else:
            print(f'FAIL {uf}  {url}')
            fail += 1
    print(f'Done: {ok} ok, {fail} fail -> {OUT}')


if __name__ == '__main__':
    main()
