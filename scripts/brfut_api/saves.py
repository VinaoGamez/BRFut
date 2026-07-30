"""CRUD de saves por usuário em Documentos/BR Fut/saves/{username}/."""
from __future__ import annotations

import json
import re
import secrets
import time
from pathlib import Path
from typing import Any

from .auth import ApiError

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
    r'^brfut-slot-[a-zA-Z0-9-]+-(career|season|player-history|live-match)$'
)


def _is_allowed_save_key(key: str) -> bool:
    if key in ALLOWED_SAVE_KEYS:
        return True
    return bool(SLOT_KEY_RE.match(key))

KEY_FILE_RE = re.compile(r'^[a-zA-Z0-9._-]+$')


def _user_dir(root: Path, username: str) -> Path:
    safe = re.sub(r'[^a-zA-Z0-9_-]', '', username)
    return root / 'saves' / safe


def _key_path(user_dir: Path, key: str) -> Path:
    if not _is_allowed_save_key(key):
        raise ApiError(400, 'invalid_key', f'Chave de save não permitida: {key}')
    file_name = key.replace('/', '_') + '.json'
    return user_dir / file_name


def _read_payload(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except (OSError, json.JSONDecodeError) as error:
        raise ApiError(500, 'read_failed', 'Falha ao ler save.') from error


def list_saves(root: Path, username: str) -> list[str]:
    user_dir = _user_dir(root, username)
    if not user_dir.is_dir():
        return []
    keys: list[str] = []
    for file in user_dir.glob('*.json'):
        key = file.stem
        if _is_allowed_save_key(key):
            keys.append(key)
    return sorted(keys)


def get_all_saves(root: Path, username: str) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key in list_saves(root, username):
        path = _key_path(_user_dir(root, username), key)
        payload = _read_payload(path)
        if isinstance(payload, dict) and 'value' in payload:
            out[key] = {
                'value': payload['value'],
                'updatedAt': payload.get('updatedAt'),
            }
        else:
            out[key] = {'value': payload, 'updatedAt': None}
    return out


def get_save(root: Path, username: str, key: str) -> Any:
    path = _key_path(_user_dir(root, username), key)
    if not path.is_file():
        raise ApiError(404, 'not_found', 'Save não encontrado.')
    payload = _read_payload(path)
    if isinstance(payload, dict) and 'value' in payload:
        return payload['value']
    return payload


def put_save(root: Path, username: str, key: str, value: Any) -> dict[str, Any]:
    user_dir = _user_dir(root, username)
    user_dir.mkdir(parents=True, exist_ok=True)
    path = _key_path(user_dir, key)
    envelope = {
        'key': key,
        'value': value,
        'updatedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
    }
    raw = json.dumps(envelope, ensure_ascii=False, separators=(',', ':'))
    tmp = path.with_name(f'.{path.name}.{secrets.token_hex(6)}.tmp')
    tmp.write_text(raw, encoding='utf-8')
    tmp.replace(path)
    return {'key': key, 'updatedAt': envelope['updatedAt'], 'bytes': len(raw.encode('utf-8'))}


def delete_save(root: Path, username: str, key: str) -> None:
    path = _key_path(_user_dir(root, username), key)
    if path.is_file():
        path.unlink()


def delete_all_saves(root: Path, username: str) -> int:
    user_dir = _user_dir(root, username)
    if not user_dir.is_dir():
        return 0
    count = 0
    for file in user_dir.glob('*.json'):
        file.unlink(missing_ok=True)
        count += 1
    return count


def migrate_saves(root: Path, username: str, saves: dict[str, Any], *, overwrite: bool = False) -> dict[str, Any]:
    if not isinstance(saves, dict):
        raise ApiError(400, 'invalid_body', 'Corpo deve ser um objeto de saves.')
    imported: list[str] = []
    skipped: list[str] = []
    for key, value in saves.items():
        if not _is_allowed_save_key(key):
            skipped.append(key)
            continue
        path = _key_path(_user_dir(root, username), key)
        if path.is_file() and not overwrite:
            skipped.append(key)
            continue
        put_save(root, username, key, value)
        imported.append(key)
    return {'imported': imported, 'skipped': skipped}
