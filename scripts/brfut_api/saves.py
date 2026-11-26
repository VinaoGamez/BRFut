"""CRUD de saves por usuário (tabela ``saves`` em db.py)."""
from __future__ import annotations

import json
import re
import time
from pathlib import Path
from typing import Any

from . import db
from .auth import ApiError
from .validation import validate_json_structure

# Chaves espelhadas do localStorage do jogo (constants.js SAVE_KEYS + legado Matchday + slots).
ALLOWED_SAVE_KEYS = frozenset({
    'brfut-career',
    'brfut-season',
    'brfut-training-rules',
    'brfut-live-match',
    'brfut-last-seen-build',
    'brfut-player-history',
    'brfut-career-index',
    'matchday-new-game',
    'matchday-season',
    'matchday-training-rules',
    'futmanager-pace',
    'matchday-live-match',
    'matchday-last-seen-build',
    'matchday-player-history',
})

SLOT_KEY_RE = re.compile(
    r'^brfut-slot-[a-zA-Z0-9-]+-(career|season|player-history|live-match|season-archive-\d{4})$'
)
ARCHIVE_KEY_RE = re.compile(r'^brfut-season-archive-\d{4}$')
MIN_CAREER_VERSION = 7
MAX_SAVE_BYTES = 8_000_000
MAX_MIGRATION_SAVES = 80


def _is_career_key(key: str) -> bool:
    return key in {'brfut-career', 'matchday-new-game'} or bool(
        re.match(r'^brfut-slot-[a-zA-Z0-9-]+-career$', key)
    )


def _validate_career_version(key: str, value: Any) -> None:
    if not _is_career_key(key):
        return
    version = value.get('version') if isinstance(value, dict) else None
    if not isinstance(version, int) or version < MIN_CAREER_VERSION:
        raise ApiError(
            409,
            'save_version_obsolete',
            'Este save pertence a uma versão antiga e não pode ser sincronizado.',
        )


db.register_schema('saves', """
CREATE TABLE IF NOT EXISTS saves (
  username TEXT NOT NULL,
  save_key TEXT NOT NULL,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  PRIMARY KEY (username, save_key)
)
""")


def _is_allowed_save_key(key: str) -> bool:
    if not isinstance(key, str) or len(key) > 120:
        return False
    if key in ALLOWED_SAVE_KEYS:
        return True
    return bool(SLOT_KEY_RE.match(key) or ARCHIVE_KEY_RE.match(key))


def _require_key(key: str) -> str:
    if not _is_allowed_save_key(key):
        raise ApiError(400, 'invalid_key', 'Chave de save não permitida.')
    return key


def _career_version(value: Any) -> Any:
    return value.get('version') if isinstance(value, dict) else None


def has_obsolete_career_saves(root: Path, username: str) -> bool:
    with db.connect(root) as conn:
        rows = conn.execute('SELECT save_key, value_json FROM saves WHERE username=?', (username,)).fetchall()
    for row in rows:
        if not _is_career_key(row['save_key']):
            continue
        try:
            version = _career_version(json.loads(row['value_json']))
        except (TypeError, ValueError):
            return True
        if not isinstance(version, int) or version < MIN_CAREER_VERSION:
            return True
    return False


def list_saves(root: Path, username: str) -> list[str]:
    with db.connect(root) as conn:
        rows = conn.execute('SELECT save_key FROM saves WHERE username=? ORDER BY save_key', (username,)).fetchall()
    return [row['save_key'] for row in rows if _is_allowed_save_key(row['save_key'])]


def get_all_saves(root: Path, username: str) -> dict[str, Any]:
    with db.connect(root) as conn:
        rows = conn.execute(
            'SELECT save_key, value_json, updated_at FROM saves WHERE username=? ORDER BY save_key',
            (username,),
        ).fetchall()
    out: dict[str, Any] = {}
    for row in rows:
        if not _is_allowed_save_key(row['save_key']):
            continue
        try:
            value = json.loads(row['value_json'])
        except (TypeError, ValueError) as error:
            raise ApiError(500, 'read_failed', 'Falha ao ler save.') from error
        out[row['save_key']] = {'value': value, 'updatedAt': row['updated_at']}
    return out


def get_save(root: Path, username: str, key: str) -> Any:
    _require_key(key)
    with db.connect(root) as conn:
        row = conn.execute(
            'SELECT value_json FROM saves WHERE username=? AND save_key=?', (username, key),
        ).fetchone()
    if not row:
        raise ApiError(404, 'not_found', 'Save não encontrado.')
    try:
        return json.loads(row['value_json'])
    except (TypeError, ValueError) as error:
        raise ApiError(500, 'read_failed', 'Falha ao ler save.') from error


def _encode_save(key: str, value: Any) -> tuple[str, str, int]:
    validate_json_structure(value)
    _validate_career_version(key, value)
    raw = json.dumps(value, ensure_ascii=False, separators=(',', ':'))
    size = len(raw.encode('utf-8'))
    if size > MAX_SAVE_BYTES:
        raise ApiError(413, 'save_too_large', 'Save excede o limite de 8 MB.')
    return raw, time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), size


def _upsert(conn: db.Connection, username: str, key: str, raw: str, updated_at: str, size: int) -> None:
    conn.execute(
        '''INSERT INTO saves (username, save_key, value_json, updated_at, bytes) VALUES (?,?,?,?,?)
           ON CONFLICT(username, save_key) DO UPDATE SET
             value_json=excluded.value_json, updated_at=excluded.updated_at, bytes=excluded.bytes''',
        (username, key, raw, updated_at, size),
    )


def put_save(root: Path, username: str, key: str, value: Any) -> dict[str, Any]:
    _require_key(key)
    raw, updated_at, size = _encode_save(key, value)
    with db.connect(root) as conn:
        _upsert(conn, username, key, raw, updated_at, size)
    return {'key': key, 'updatedAt': updated_at, 'bytes': size}


def delete_save(root: Path, username: str, key: str) -> None:
    _require_key(key)
    with db.connect(root) as conn:
        conn.execute('DELETE FROM saves WHERE username=? AND save_key=?', (username, key))


def delete_all_saves(root: Path, username: str) -> int:
    with db.connect(root) as conn:
        count = conn.execute('SELECT COUNT(*) FROM saves WHERE username=?', (username,)).fetchone()[0]
        conn.execute('DELETE FROM saves WHERE username=?', (username,))
    return int(count or 0)


def migrate_saves(root: Path, username: str, saves: dict[str, Any], *, overwrite: bool = False) -> dict[str, Any]:
    if not isinstance(saves, dict):
        raise ApiError(400, 'invalid_body', 'Corpo deve ser um objeto de saves.')
    if len(saves) > MAX_MIGRATION_SAVES:
        raise ApiError(413, 'too_many_saves', 'Migração excede o limite de saves permitido.')
    imported: list[str] = []
    skipped: list[str] = []
    encoded: dict[str, tuple[str, str, int]] = {}
    for key, value in saves.items():
        if not _is_allowed_save_key(key):
            skipped.append(key)
            continue
        encoded[key] = _encode_save(key, value)
    with db.connect(root) as conn:
        existing = {
            row['save_key']
            for row in conn.execute('SELECT save_key FROM saves WHERE username=?', (username,)).fetchall()
        }
        for key, (raw, updated_at, size) in encoded.items():
            if key in existing and not overwrite:
                skipped.append(key)
                continue
            _upsert(conn, username, key, raw, updated_at, size)
            imported.append(key)
    return {'imported': imported, 'skipped': skipped}
