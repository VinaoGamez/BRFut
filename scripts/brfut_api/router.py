"""Roteador HTTP JSON da API local BR Football."""
from __future__ import annotations

import json
from typing import Any
from urllib.parse import unquote

from .auth import ApiError, get_user_avatar, get_player_stats, login_user, logout_user, register_user, resolve_session, update_user_profile
from .paths import default_data_root, ensure_layout
from .saves import (
    ALLOWED_SAVE_KEYS,
    delete_all_saves,
    delete_save,
    get_all_saves,
    get_save,
    migrate_saves,
    put_save,
)


def _json_response(status: int, payload: dict[str, Any]) -> tuple[int, dict[str, str], bytes]:
    body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    headers = {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': str(len(body)),
    }
    return status, headers, body


def _parse_json(body: bytes) -> Any:
    if not body:
        return None
    try:
        return json.loads(body.decode('utf-8'))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ApiError(400, 'invalid_json', 'JSON inválido.') from error


def _bearer_token(headers: dict[str, str]) -> str | None:
    auth = headers.get('Authorization') or headers.get('authorization') or ''
    if auth.lower().startswith('bearer '):
        return auth[7:].strip()
    return None


def handle_api(
    method: str,
    path: str,
    headers: dict[str, str],
    body: bytes,
) -> tuple[int, dict[str, str], bytes]:
    root = ensure_layout(default_data_root())
    method = method.upper()
    path = unquote(path.split('?', 1)[0])
    if not path.startswith('/api/'):
        raise ApiError(404, 'not_found', 'Endpoint não encontrado.')

    rel = path[len('/api/') :].strip('/')
    parts = [p for p in rel.split('/') if p]

    try:
        if method == 'GET' and rel == 'health':
            return _json_response(
                200,
                {
                    'ok': True,
                    'service': 'brfut-api',
                    'version': 1,
                    'dataRoot': str(root),
                    'allowedKeys': sorted(ALLOWED_SAVE_KEYS),
                    **get_player_stats(root),
                },
            )

        if method == 'GET' and rel == 'stats':
            return _json_response(200, get_player_stats(root))

        if method == 'POST' and rel == 'auth/register':
            data = _parse_json(body) or {}
            profile = register_user(root, data.get('username', ''), data.get('password', ''), data.get('displayName'))
            token, logged = login_user(root, profile['username'], data.get('password', ''))
            return _json_response(201, {'token': token, 'user': logged})

        if method == 'POST' and rel == 'auth/login':
            data = _parse_json(body) or {}
            token, profile = login_user(root, data.get('username', ''), data.get('password', ''))
            return _json_response(200, {'token': token, 'user': profile})

        if method == 'POST' and rel == 'auth/logout':
            logout_user(root, _bearer_token(headers))
            return _json_response(200, {'ok': True})

        if method == 'GET' and rel == 'auth/me':
            user = resolve_session(root, _bearer_token(headers))
            return _json_response(200, {'user': user})

        if method == 'PUT' and rel == 'auth/profile':
            user = resolve_session(root, _bearer_token(headers))
            data = _parse_json(body) or {}
            updated = update_user_profile(
                root,
                user['id'],
                data.get('displayName'),
                data.get('avatar') if 'avatar' in data else None,
            )
            return _json_response(200, {'user': updated})

        if method == 'GET' and rel == 'auth/avatar':
            user = resolve_session(root, _bearer_token(headers))
            avatar = get_user_avatar(root, user['id'])
            if not avatar:
                raise ApiError(404, 'no_avatar', 'Sem foto de perfil.')
            body_bytes, mime = avatar
            return 200, {'Content-Type': mime, 'Content-Length': str(len(body_bytes)), 'Cache-Control': 'no-store'}, body_bytes

        token = _bearer_token(headers)
        user = resolve_session(root, token)
        username = user['username']

        if method == 'GET' and rel == 'saves':
            return _json_response(200, {'saves': get_all_saves(root, username)})

        if method == 'POST' and rel == 'saves/migrate':
            data = _parse_json(body) or {}
            result = migrate_saves(
                root,
                username,
                data.get('saves') or {},
                overwrite=bool(data.get('overwrite')),
            )
            return _json_response(200, result)

        if method == 'DELETE' and rel == 'saves':
            removed = delete_all_saves(root, username)
            return _json_response(200, {'removed': removed})

        if len(parts) == 2 and parts[0] == 'saves':
            key = parts[1]
            if method == 'GET':
                return _json_response(200, {'key': key, 'value': get_save(root, username, key)})
            if method == 'PUT':
                data = _parse_json(body)
                if data is None or 'value' not in data:
                    raise ApiError(400, 'invalid_body', 'Corpo deve incluir "value".')
                meta = put_save(root, username, key, data['value'])
                return _json_response(200, meta)
            if method == 'DELETE':
                delete_save(root, username, key)
                return _json_response(200, {'key': key, 'removed': True})

        raise ApiError(404, 'not_found', 'Endpoint não encontrado.')
    except ApiError as error:
        return _json_response(error.status, {'ok': False, 'code': error.code, 'error': error.message})
