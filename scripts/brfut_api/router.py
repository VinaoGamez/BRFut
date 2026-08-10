"""Roteador HTTP JSON da API local BR Football."""
from __future__ import annotations

import json
from http.cookies import SimpleCookie
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
    has_obsolete_career_saves,
    migrate_saves,
    put_save,
)
from .player_stats import (
    delete_career_stats,
    delete_user_stats,
    get_club_history,
    get_club_squad,
    get_leaders,
    get_match_manifest,
    get_player,
    put_match_batch,
)
from .career_history import delete_career_history, delete_user_history, get_club_seasons, get_manager_history, get_season_history, put_season_history


PUBLIC_ROUTES = {
    ('GET', 'health'),
    ('GET', 'stats'),
    ('GET', 'auth/google/config'),
    ('POST', 'auth/login'),
    ('POST', 'auth/register'),
    ('POST', 'auth/google'),
}

SESSION_COOKIE_NAME = '__Host-brfut_session'
LOCAL_SESSION_COOKIE_NAME = 'brfut_session'
CSRF_HEADER_NAME = 'x-brfut-request'


def _purge_obsolete_user_data(root, username: str) -> dict[str, int]:
    if not has_obsolete_career_saves(root, username):
        return {'saves': 0, 'stats': 0, 'history': 0}
    return {
        'saves': delete_all_saves(root, username),
        'stats': delete_user_stats(root, username),
        'history': delete_user_history(root, username),
    }


def _json_response(status: int, payload: dict[str, Any]) -> tuple[int, dict[str, str], bytes]:
    body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    headers = {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': str(len(body)),
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'Pragma': 'no-cache',
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


def _header(headers: dict[str, str], name: str) -> str:
    wanted = name.lower()
    return next((str(value) for key, value in headers.items() if key.lower() == wanted), '')


def _cookie_token(headers: dict[str, str]) -> str | None:
    raw = _header(headers, 'cookie')
    if not raw:
        return None
    try:
        cookies = SimpleCookie()
        cookies.load(raw)
        morsel = cookies.get(SESSION_COOKIE_NAME) or cookies.get(LOCAL_SESSION_COOKIE_NAME)
        return morsel.value.strip() if morsel and morsel.value else None
    except Exception:
        return None


def _request_token(headers: dict[str, str]) -> tuple[str | None, bool]:
    bearer = _bearer_token(headers)
    if bearer:
        return bearer, False
    cookie = _cookie_token(headers)
    return cookie, bool(cookie)


def _secure_cookie_request(headers: dict[str, str]) -> bool:
    forwarded = _header(headers, 'x-forwarded-proto').lower()
    origin = _header(headers, 'origin').lower()
    host = _header(headers, 'host').lower()
    return forwarded == 'https' or origin.startswith('https://') or host == 'api.brfut.com.br'


def _session_cookie(token: str, headers: dict[str, str], remember: bool) -> str:
    secure = _secure_cookie_request(headers)
    name = SESSION_COOKIE_NAME if secure else LOCAL_SESSION_COOKIE_NAME
    parts = [f'{name}={token}', 'Path=/', 'HttpOnly']
    parts.append('SameSite=None' if secure else 'SameSite=Lax')
    if secure:
        parts.append('Secure')
    if remember:
        parts.append(f'Max-Age={30 * 24 * 60 * 60}')
    return '; '.join(parts)


def _clear_session_cookie(headers: dict[str, str]) -> str:
    secure = _secure_cookie_request(headers)
    name = SESSION_COOKIE_NAME if secure else LOCAL_SESSION_COOKIE_NAME
    parts = [f'{name}=', 'Path=/', 'HttpOnly', 'Max-Age=0']
    parts.append('SameSite=None' if secure else 'SameSite=Lax')
    if secure:
        parts.append('Secure')
    return '; '.join(parts)


def _with_cookie(response, cookie: str):
    status, response_headers, payload = response
    return status, {**response_headers, 'Set-Cookie': cookie}, payload


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
        request_token = None
        cookie_authenticated = False
        if (method, rel) not in PUBLIC_ROUTES:
            request_token, cookie_authenticated = _request_token(headers)
            if (
                cookie_authenticated
                and method not in ('GET', 'HEAD', 'OPTIONS')
                and _header(headers, CSRF_HEADER_NAME) != '1'
            ):
                raise ApiError(403, 'csrf_rejected', 'Requisição de sessão não autorizada.')
            user = resolve_session(root, request_token)

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
            response = _json_response(200, {'user': profile})
            return _with_cookie(response, _session_cookie(token, headers, bool(data.get('remember'))))

        if method == 'GET' and rel == 'stats':
            return _json_response(200, get_player_stats(root))

        if method == 'POST' and rel == 'auth/register':
            data = _parse_json(body) or {}
            profile = register_user(root, data.get('username', ''), data.get('password', ''), data.get('displayName'))
            token, logged = login_user(root, profile['username'], data.get('password', ''))
            response = _json_response(201, {'user': logged})
            return _with_cookie(response, _session_cookie(token, headers, bool(data.get('remember'))))

        if method == 'POST' and rel == 'auth/login':
            data = _parse_json(body) or {}
            token, profile = login_user(root, data.get('username', ''), data.get('password', ''))
            response = _json_response(200, {'user': profile})
            return _with_cookie(response, _session_cookie(token, headers, bool(data.get('remember'))))

        if method == 'POST' and rel == 'auth/session/migrate':
            data = _parse_json(body) or {}
            response = _json_response(200, {'ok': True, 'user': user})
            return _with_cookie(response, _session_cookie(request_token, headers, bool(data.get('remember'))))

        if method == 'POST' and rel == 'auth/logout':
            logout_user(root, request_token)
            return _with_cookie(_json_response(200, {'ok': True}), _clear_session_cookie(headers))

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

        if len(parts) == 4 and parts[0] == 'careers' and parts[2:] == ['stats', 'matches'] and method == 'GET':
            season = int((query.get('season') or [0])[0]) or None
            return _json_response(200, get_match_manifest(root, username, parts[1], season))

        if len(parts) == 5 and parts[0] == 'careers' and parts[2:4] == ['stats', 'players'] and method == 'GET':
            season = int((query.get('season') or [0])[0])
            club_id = (query.get('club') or [None])[0]
            return _json_response(200, get_player(root, username, parts[1], parts[4], season, club_id))

        if len(parts) == 6 and parts[0] == 'careers' and parts[2:4] == ['stats', 'clubs'] and parts[5] == 'squad' and method == 'GET':
            season = int((query.get('season') or [0])[0])
            competition = (query.get('competition') or [None])[0]
            return _json_response(200, get_club_squad(root, username, parts[1], parts[4], season, competition))

        if len(parts) == 6 and parts[0] == 'careers' and parts[2:4] == ['stats', 'clubs'] and parts[5] == 'history' and method == 'GET':
            return _json_response(200, get_club_history(root, username, parts[1], parts[4]))

        if len(parts) == 4 and parts[0] == 'careers' and parts[2:] == ['stats', 'leaders'] and method == 'GET':
            season = int((query.get('season') or [0])[0])
            competition = (query.get('competition') or [None])[0]
            metric = (query.get('metric') or ['goals'])[0]
            return _json_response(200, get_leaders(root, username, parts[1], season, competition, metric))

        if len(parts) == 3 and parts[0] == 'careers' and parts[2] == 'stats' and method == 'DELETE':
            return _json_response(200, {
                'removed': delete_career_stats(root, username, parts[1]),
                'historyRemoved': delete_career_history(root, username, parts[1]),
            })

        if len(parts) == 4 and parts[0] == 'careers' and parts[2] == 'seasons':
            season = int(parts[3])
            if method == 'PUT':
                return _json_response(200, put_season_history(root, username, parts[1], _parse_json(body) or {}))
            if method == 'GET':
                return _json_response(200, get_season_history(root, username, parts[1], season))

        if len(parts) == 4 and parts[0] == 'careers' and parts[2] == 'managers' and method == 'GET':
            return _json_response(200, get_manager_history(root, username, parts[1], parts[3]))

        if len(parts) == 4 and parts[0] == 'careers' and parts[2] == 'clubs' and method == 'GET':
            return _json_response(200, get_club_seasons(root, username, parts[1], parts[3]))

        if method == 'GET' and rel == 'saves':
            _purge_obsolete_user_data(root, username)
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
            return _json_response(200, {
                'removed': removed,
                'statsRemoved': delete_user_stats(root, username),
                'historyRemoved': delete_user_history(root, username),
            })

        if len(parts) == 2 and parts[0] == 'saves':
            key = parts[1]
            if method == 'GET':
                _purge_obsolete_user_data(root, username)
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
