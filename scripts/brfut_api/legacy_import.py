"""Importa a pasta de dados antiga (formato da VPS) para o banco atual.

Formato de origem (``Documentos/BR Fut`` ou ``/var/lib/brfut``)::

    profiles/index.json          contas (PBKDF2 260k)
    profiles/avatars/<id>.<ext>  fotos de perfil
    sessions/<sha256>.json       sessões (só as ainda válidas são importadas)
    saves/<username>/<key>.json  saves {key, value, updatedAt}
    player-stats.sqlite3, career-history.sqlite3, state-leagues.sqlite3

O destino é o banco configurado (``DATABASE_URL`` → Postgres; senão SQLite em
``target_root``). A importação é idempotente: registros existentes são mantidos.
"""
from __future__ import annotations

import hashlib
import json
import re
import sqlite3
import time
from pathlib import Path
from typing import Any

from . import db
from . import auth  # noqa: F401  (registra o schema de contas)
from . import career_history, player_stats, saves, state_leagues  # noqa: F401
from .auth import LEGACY_PBKDF2_ITERS, SESSION_ABSOLUTE_TTL_SEC
from .saves import _is_allowed_save_key

_HEX64 = re.compile(r'^[0-9a-f]{64}$')
_AVATAR_MIME = {'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp'}

# Ordem importa: tabelas-pai antes das filhas (chaves estrangeiras).
_LEGACY_TABLES = (
    ('player-stats.sqlite3', ('stats_matches', 'player_match_stats', 'manager_match_stats')),
    ('career-history.sqlite3', ('career_seasons', 'club_season_history', 'manager_season_history')),
    ('state-leagues.sqlite3', ('state_league_snapshots',)),
)


def _read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding='utf-8'))


def _insert_ignore(conn: db.Connection, table: str, columns: list[str], values: tuple[Any, ...]) -> bool:
    placeholders = ','.join('?' for _ in columns)
    cursor = conn.execute(
        f'INSERT INTO {table} ({",".join(columns)}) VALUES ({placeholders}) ON CONFLICT DO NOTHING',
        values,
    )
    return cursor.rowcount > 0


def import_legacy_data(source: Path, target_root: Path | None = None) -> dict[str, int]:
    source = Path(source)
    target_root = Path(target_root or source)
    report = {'users': 0, 'avatars': 0, 'sessions': 0, 'saves': 0, 'statsRows': 0, 'skipped': 0}
    now = time.time()

    with db.connect(target_root) as conn:
        user_ids: set[str] = set()
        profiles_path = source / 'profiles' / 'index.json'
        if profiles_path.is_file():
            for user in (_read_json(profiles_path).get('users') or []):
                if not isinstance(user, dict) or not user.get('id') or not user.get('username'):
                    report['skipped'] += 1
                    continue
                user_ids.add(str(user['id']))
                inserted = _insert_ignore(conn, 'users', [
                    'id', 'username', 'display_name', 'salt', 'password_hash', 'pbkdf2_iters',
                    'google_sub', 'email', 'auth_provider', 'created_at',
                ], (
                    str(user['id']), str(user['username']).lower(),
                    str(user.get('displayName') or user['username']),
                    user.get('salt'), user.get('passwordHash'),
                    LEGACY_PBKDF2_ITERS if user.get('passwordHash') else None,
                    user.get('googleSub'), (user.get('email') or None),
                    user.get('authProvider') or ('google' if user.get('googleSub') else 'password'),
                    user.get('createdAt') or time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                ))
                report['users'] += int(inserted)

        avatars = source / 'profiles' / 'avatars'
        if avatars.is_dir():
            for file in avatars.iterdir():
                mime = _AVATAR_MIME.get(file.suffix.lower())
                if not mime or file.stem not in user_ids or file.stat().st_size > auth.MAX_AVATAR_BYTES:
                    continue
                conn.execute(
                    'UPDATE users SET avatar=?, avatar_mime=? WHERE id=? AND avatar IS NULL',
                    (file.read_bytes(), mime, file.stem),
                )
                report['avatars'] += 1

        sessions_dir = source / 'sessions'
        if sessions_dir.is_dir():
            for file in sessions_dir.glob('*.json'):
                try:
                    data = _read_json(file)
                    expires = float(data.get('expiresAt', 0))
                    absolute = float(data.get('absoluteExpiresAt') or (expires + SESSION_ABSOLUTE_TTL_SEC))
                except (OSError, ValueError, TypeError, AttributeError):
                    report['skipped'] += 1
                    continue
                if expires <= now or absolute <= now or str(data.get('userId')) not in user_ids:
                    continue
                stem = file.stem
                session_id = stem if _HEX64.match(stem) else hashlib.sha256(stem.encode('utf-8')).hexdigest()
                report['sessions'] += int(_insert_ignore(conn, 'sessions', [
                    'id', 'user_id', 'provider', 'created_at', 'last_seen_at', 'expires_at', 'absolute_expires_at',
                ], (
                    session_id, str(data['userId']), str(data.get('provider') or 'password'),
                    str(data.get('createdAt') or ''), float(data.get('lastSeenAt') or now), expires, absolute,
                )))

        saves_dir = source / 'saves'
        if saves_dir.is_dir():
            for user_dir in saves_dir.iterdir():
                if not user_dir.is_dir():
                    continue
                for file in user_dir.glob('*.json'):
                    key = file.stem
                    if not _is_allowed_save_key(key):
                        report['skipped'] += 1
                        continue
                    try:
                        payload = _read_json(file)
                    except (OSError, ValueError):
                        report['skipped'] += 1
                        continue
                    value = payload.get('value') if isinstance(payload, dict) and 'value' in payload else payload
                    updated = (payload.get('updatedAt') if isinstance(payload, dict) else None) or ''
                    raw = json.dumps(value, ensure_ascii=False, separators=(',', ':'))
                    report['saves'] += int(_insert_ignore(conn, 'saves', [
                        'username', 'save_key', 'value_json', 'updated_at', 'bytes',
                    ], (user_dir.name.lower(), key, raw, updated, len(raw.encode('utf-8')))))

        for file_name, tables in _LEGACY_TABLES:
            path = source / file_name
            if not path.is_file():
                continue
            legacy = sqlite3.connect(f'file:{path}?mode=ro', uri=True)
            try:
                for table in tables:
                    exists = legacy.execute(
                        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,),
                    ).fetchone()
                    if not exists:
                        continue
                    cursor = legacy.execute(f'SELECT * FROM {table}')
                    columns = [col[0] for col in cursor.description]
                    for values in cursor:
                        report['statsRows'] += int(_insert_ignore(conn, table, columns, tuple(values)))
            finally:
                legacy.close()
    return report
