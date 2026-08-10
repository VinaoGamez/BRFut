#!/usr/bin/env python3
"""Remove todos os arquivos de save da API (local ou VPS).

Uso local (5081 / Documentos):
  py scripts/purge-cloud-saves.py

VPS (dados em /var/lib/brfut/data):
  py scripts/purge-cloud-saves.py --root /var/lib/brfut/data
"""
from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from brfut_api.paths import default_data_root  # noqa: E402


def purge_saves(root: Path) -> int:
    saves_dir = root / 'saves'
    if not saves_dir.is_dir():
        print(f'Nada a apagar: {saves_dir} não existe.')
        return 0
    count = 0
    for user_dir in saves_dir.iterdir():
        if not user_dir.is_dir():
            continue
        for file in user_dir.glob('*.json'):
            file.unlink(missing_ok=True)
            count += 1
        try:
            user_dir.rmdir()
        except OSError:
            pass
    print(f'Removidos {count} arquivo(s) de save em {saves_dir}')
    return count


def purge_structured_history(root: Path) -> int:
    count = 0
    for name in ('career-history.sqlite3', 'player-stats.sqlite3'):
        for suffix in ('', '-wal', '-shm'):
            path = root / f'{name}{suffix}'
            if path.is_file():
                path.unlink()
                count += 1
    print(f'Removidos {count} arquivo(s) de histórico estruturado em {root}')
    return count


def main() -> int:
    parser = argparse.ArgumentParser(description='Apaga todos os saves da nuvem local/VPS.')
    parser.add_argument(
        '--root',
        type=Path,
        default=None,
        help='Raiz de dados (padrão: Documentos/BR Fut ou BRFUT_DATA_DIR)',
    )
    parser.add_argument(
        '--yes',
        action='store_true',
        help='Confirma sem prompt interativo',
    )
    args = parser.parse_args()
    root = args.root.expanduser().resolve() if args.root else default_data_root()
    print(f'Raiz: {root}')
    if not args.yes:
        answer = input('Apagar TODOS os saves? [y/N] ').strip().lower()
        if answer not in ('y', 'yes', 's', 'sim'):
            print('Cancelado.')
            return 1
    purge_saves(root)
    purge_structured_history(root)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
