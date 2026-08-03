"""Login via Google ID token (GIS / Sign in with Google)."""
from __future__ import annotations

import json
import os
import re
import secrets
import time
import urllib.parse
import urllib.request
from typing import Any

from .auth import ApiError, _profile_from_user, _load_profiles, _save_profiles, create_session

USERNAME_RE = re.compile(r'^[a-zA-Z0-9_]{3,24}$')
SESSION_TTL_SEC = 60 * 60 * 24 * 30


def google_client_id() -> str | None:
    value = (os.environ.get('BRFUT_GOOGLE_CLIENT_ID') or '').strip()
    return value or None


def google_auth_enabled() -> bool:
    return bool(google_client_id())


def _verify_id_token(id_token: str, client_id: str) -> dict[str, Any]:
    query = urllib.parse.urlencode({'id_token': id_token})
    url = f'https://oauth2.googleapis.com/tokeninfo?{query}'
    try:
        with urllib.request.urlopen(url, timeout=12) as response:
            payload = json.loads(response.read().decode('utf-8'))
    except Exception as error:
        raise ApiError(401, 'google_verify_failed', 'Não foi possível validar o login Google.') from error

    if payload.get('aud') != client_id:
        raise ApiError(401, 'invalid_google_aud', 'Token Google inválido para este site.')
    if str(payload.get('email_verified', '')).lower() not in ('true', '1'):
        raise ApiError(401, 'google_email_unverified', 'E-mail Google não verificado.')
    if not payload.get('sub'):
        raise ApiError(401, 'invalid_google_sub', 'Token Google incompleto.')
    return payload


def _unique_username(data: dict[str, Any], base: str) -> str:
    base = (base or 'jogador').lower()[:20]
    base = re.sub(r'[^a-z0-9_]', '', base) or 'jogador'
    if len(base) < 3:
        base = f'user_{base}'
    candidate = base[:24]
    if USERNAME_RE.match(candidate) and not any(u.get('username') == candidate for u in data['users']):
        return candidate
    for i in range(2, 100):
        suffix = f'_{i}'
        trimmed = base[: 24 - len(suffix)] + suffix
        if USERNAME_RE.match(trimmed) and not any(u.get('username') == trimmed for u in data['users']):
            return trimmed
    return f'g_{secrets.token_hex(4)}'


def _find_or_create_google_user(root, payload: dict[str, Any]) -> dict[str, Any]:
    sub = str(payload['sub'])
    email = (payload.get('email') or '').strip().lower()
    display = (payload.get('name') or email.split('@')[0] or 'Jogador').strip()[:40]

    data = _load_profiles(root)
    users: list[dict[str, Any]] = data['users']
    user = next((u for u in users if u.get('googleSub') == sub), None)
    if not user and email:
        user = next((u for u in users if (u.get('email') or '').lower() == email), None)
        if user:
            user['googleSub'] = sub
            if email:
                user['email'] = email

    if not user:
        local_part = email.split('@')[0] if email else f'google_{sub[:8]}'
        username = _unique_username(data, local_part)
        user = {
            'id': secrets.token_hex(8),
            'username': username,
            'displayName': display or username,
            'googleSub': sub,
            'email': email,
            'createdAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
            'authProvider': 'google',
        }
        users.append(user)

    if display and not user.get('displayName'):
        user['displayName'] = display
    if email:
        user['email'] = email

    _save_profiles(root, data)
    return user


def login_with_google_id_token(root, id_token: str) -> tuple[str, dict[str, Any]]:
    client_id = google_client_id()
    if not client_id:
        raise ApiError(503, 'google_disabled', 'Login Google não configurado neste servidor.')
    if not (id_token or '').strip():
        raise ApiError(400, 'missing_id_token', 'Token Google não informado.')

    payload = _verify_id_token((id_token or '').strip(), client_id)
    user = _find_or_create_google_user(root, payload)

    token = create_session(root, user, provider='google')
    return token, _profile_from_user(root, user)
