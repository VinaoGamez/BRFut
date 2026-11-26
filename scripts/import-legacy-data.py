#!/usr/bin/env python3
"""Importa a pasta de dados antiga (VPS ou Documentos/BR Fut) para o banco atual.

Uso:
    DATABASE_URL=postgres://... python scripts/import-legacy-data.py "<pasta de dados>"
    python scripts/import-legacy-data.py "<pasta>" --sqlite-root "<pasta destino>"

Sem DATABASE_URL, grava no SQLite em <sqlite-root>/brfut.sqlite3.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from brfut_api import db  # noqa: E402
from brfut_api.legacy_import import import_legacy_data  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('source', type=Path, help='Pasta com profiles/, saves/, sessions/ e *.sqlite3')
    parser.add_argument('--sqlite-root', type=Path, default=None, help='Destino SQLite (padrão: a própria origem)')
    args = parser.parse_args()
    if not args.source.is_dir():
        parser.error(f'pasta não encontrada: {args.source}')
    print(f'Destino: {"Postgres (DATABASE_URL)" if db.backend() == "postgres" else "SQLite"}')
    report = import_legacy_data(args.source, args.sqlite_root or args.source)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
