"""Roteador HTTP JSON da API local BR Football."""
from __future__ import annotations

import json
from typing import Any
from urllib.parse import parse_qs, unquote, urlsplit

from .auth import ApiError, get_user_avatar, get_player_stats, login_user, logout_user, register_user, resolve_session, update_user_profile
from .google_auth import google_auth_enabled, google_client_id, login_with_google_id_token
from .paths import default_data_root, ensure_layout
from .saves import (
    delete_all_saves,
    delete_save,
    get_all_saves,
    get_save,
    migrate_saves,
    put_save,
)
from .player_stats import delete_career_stats, get_club_squad, get_leaders, get_player, put_match_batch


PUBLIC_ROUTES = {
    ('GET', 'health'),
    ('GET', 'stats'),
    ('GET', 'auth/google/config'),
    ('POST', 'auth/login'),
    ('POST', 'auth/register'),
    ('POST', 'auth/google'),
}


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
    split = urlsplit(path)
    query = parse_qs(split.query)
    path = unquote(split.path)
    if not path.startswith('/api/'):
        raise ApiError(404, 'not_found', 'Endpoint não encontrado.')

    rel = path[len('/api/') :].strip('/')
    parts = [p for p in rel.split('/') if p]

    try:
        # Falha fechada: qualquer rota não declarada pública exige uma sessão válida.
        user = None
        if (method, rel) not in PUBLIC_ROUTES:
            user = resolve_session(root, _bearer_token(headers))

        if method == 'GET' and rel == 'health':
            return _json_response(
                200,
                {
                    'ok': True,
                    'service': 'brfut-api',
                    'version': 1,
                    'googleAuthEnabled': google_auth_enabled(),
                    **get_player_stats(root),
                },
            )

        if method == 'GET' and rel == 'auth/google/config':
            cid = google_client_id()
            return _json_response(200, {'enabled': bool(cid), 'clientId': cid or ''})

        if method == 'POST' and rel == 'auth/google':
            data = _parse_json(body) or {}
            token, profile = login_with_google_id_token(root, data.get('idToken', ''))
            return _json_response(200, {'token': token, 'user': profile})

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
            return _json_response(200, {'user': user})

        if method == 'PUT' and rel == 'auth/profile':
            data = _parse_json(body) or {}
            updated = update_user_profile(
                root,
                user['id'],
                data.get('displayName'),
                data.get('avatar') if 'avatar' in data else None,
            )
            return _json_response(200, {'user': updated})

        if method == 'GET' and rel == 'auth/avatar':
            avatar = get_user_avatar(root, user['id'])
            if not avatar:
                raise ApiError(404, 'no_avatar', 'Sem foto de perfil.')
            body_bytes, mime = avatar
            return 200, {'Content-Type': mime, 'Content-Length': str(len(body_bytes)), 'Cache-Control': 'no-store'}, body_bytes

        username = user['username']

        if len(parts) == 4 and parts[0] == 'careers' and parts[2:] == ['stats', 'matches'] and method == 'POST':
            data = _parse_json(body) or {}
            return _json_response(200, put_match_batch(root, username, parts[1], data))

        if len(parts) == 5 and parts[0] == 'careers' and parts[2:4] == ['stats', 'players'] and method == 'GET':
            season = int((query.get('season') or [0])[0])
            club_id = (query.get('club') or [None])[0]
            return _json_response(200, get_player(root, username, parts[1], parts[4], season, club_id))

        if len(parts) == 6 and parts[0] == 'careers' and parts[2:4] == ['stats', 'clubs'] and parts[5] == 'squad' and method == 'GET':
            season = int((query.get('season') or [0])[0])
            competition = (query.get('competition') or [None])[0]
            return _json_response(200, get_club_squad(root, username, parts[1], parts[4], season, competition))

        if len(parts) == 4 and parts[0] == 'careers' and parts[2:] == ['stats', 'leaders'] and method == 'GET':
            season = int((query.get('season') or [0])[0])
            competition = (query.get('competition') or [None])[0]
            metric = (query.get('metric') or ['goals'])[0]
            return _json_response(200, get_leaders(root, username, parts[1], season, competition, metric))

        if len(parts) == 3 and parts[0] == 'careers' and parts[2] == 'stats' and method == 'DELETE':
            return _json_response(200, {'removed': delete_career_stats(root, username, parts[1])})

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
