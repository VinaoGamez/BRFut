"""Autenticação local simples (PBKDF2 + sessões em disco)."""
from __future__ import annotations

import hashlib
import json
import re
import secrets
import time
import binascii
from pathlib import Path
from typing import Any

from .paths import ensure_layout

USERNAME_RE = re.compile(r'^[a-zA-Z0-9_]{3,24}$')
SESSION_TTL_SEC = 60 * 60 * 24 * 30  # 30 dias
ONLINE_WINDOW_SEC = 300  # 5 min — jogador "ON" se teve atividade recente
SESSION_TOUCH_MIN_SEC = 60  # throttle de gravação lastSeenAt
PBKDF2_ITERS = 260_000


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


def _profiles_path(root: Path) -> Path:
    return root / 'profiles' / 'index.json'


def _load_profiles(root: Path) -> dict[str, Any]:
    path = _profiles_path(root)
    if not path.is_file():
        return {'users': []}
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
        if isinstance(data, dict) and isinstance(data.get('users'), list):
            return data
    except (OSError, json.JSONDecodeError):
        pass
    return {'users': []}


def _save_profiles(root: Path, data: dict[str, Any]) -> None:
    path = _profiles_path(root)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')


def _hash_password(password: str, salt: bytes | None = None) -> tuple[str, str]:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, PBKDF2_ITERS)
    return salt.hex(), digest.hex()


def _verify_password(password: str, salt_hex: str, hash_hex: str) -> bool:
    salt = bytes.fromhex(salt_hex)
    _, candidate = _hash_password(password, salt)
    return secrets.compare_digest(candidate, hash_hex)


def _session_path(root: Path, token: str) -> Path:
    safe = re.sub(r'[^a-zA-Z0-9_-]', '', token)
    return root / 'sessions' / f'{safe}.json'


def _session_last_seen(session: dict[str, Any]) -> float:
    if session.get('lastSeenAt'):
        try:
            return float(session['lastSeenAt'])
        except (TypeError, ValueError):
            pass
    created = session.get('createdAt')
    if isinstance(created, str) and created:
        try:
            from datetime import datetime, timezone

            dt = datetime.strptime(created, '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=timezone.utc)
            return dt.timestamp()
        except ValueError:
            pass
    try:
        return float(session.get('expiresAt', 0)) - SESSION_TTL_SEC
    except (TypeError, ValueError):
        return 0.0


def _touch_session_last_seen(root: Path, path: Path, session: dict[str, Any]) -> None:
    now = time.time()
    try:
        last = float(session.get('lastSeenAt', 0))
    except (TypeError, ValueError):
        last = 0.0
    if now - last < SESSION_TOUCH_MIN_SEC:
        return
    session['lastSeenAt'] = now
    try:
        path.write_text(json.dumps(session), encoding='utf-8')
    except OSError:
        pass


def get_player_stats(root: Path, online_window_sec: int = ONLINE_WINDOW_SEC) -> dict[str, Any]:
    _cleanup_expired_sessions(root)
    registered = len(_load_profiles(root).get('users', []))
    now = time.time()
    online_user_ids: set[str] = set()
    sessions_dir = root / 'sessions'
    if sessions_dir.is_dir():
        for file in sessions_dir.glob('*.json'):
            try:
                session = json.loads(file.read_text(encoding='utf-8'))
            except (OSError, json.JSONDecodeError):
                continue
            try:
                if float(session.get('expiresAt', 0)) <= now:
                    continue
            except (TypeError, ValueError):
                continue
            user_id = session.get('userId')
            if not user_id:
                continue
            if now - _session_last_seen(session) <= online_window_sec:
                online_user_ids.add(str(user_id))
    return {
        'registered': registered,
        'online': len(online_user_ids),
        'onlineWindowSec': online_window_sec,
    }


def _cleanup_expired_sessions(root: Path) -> None:
    sessions_dir = root / 'sessions'
    if not sessions_dir.is_dir():
        return
    now = time.time()
    for file in sessions_dir.glob('*.json'):
        try:
            data = json.loads(file.read_text(encoding='utf-8'))
            if float(data.get('expiresAt', 0)) <= now:
                file.unlink(missing_ok=True)
        except (OSError, json.JSONDecodeError, TypeError, ValueError):
            file.unlink(missing_ok=True)


def _avatars_dir(root: Path) -> Path:
    return root / 'profiles' / 'avatars'


def _avatar_path_for_user(root: Path, user_id: str) -> Path | None:
    avatars = _avatars_dir(root)
    for ext in ('.jpg', '.jpeg', '.png', '.webp'):
        path = avatars / f'{user_id}{ext}'
        if path.is_file():
            return path
    return None


def user_has_avatar(root: Path, user_id: str) -> bool:
    return _avatar_path_for_user(root, user_id) is not None


def _profile_from_user(root: Path, user: dict[str, Any]) -> dict[str, Any]:
    return {
        'id': user['id'],
        'username': user['username'],
        'displayName': user.get('displayName', user['username']),
        'hasAvatar': user_has_avatar(root, user['id']),
    }


def _decode_avatar_data_url(data_url: str) -> tuple[bytes, str]:
    import base64
    import re

    match = re.match(r'^data:image/(jpeg|jpg|png|webp);base64,(.+)$', (data_url or '').strip(), re.I)
    if not match:
        raise ApiError(400, 'invalid_avatar', 'Imagem inválida (use JPEG, PNG ou WebP).')
    ext = match.group(1).lower()
    if ext == 'jpeg':
        ext = 'jpg'
    try:
        raw = base64.b64decode(match.group(2), validate=True)
    except (ValueError, binascii.Error) as error:
        raise ApiError(400, 'invalid_avatar', 'Imagem inválida.') from error
    if len(raw) > 512_000:
        raise ApiError(400, 'avatar_too_large', 'Imagem muito grande (máx. 500 KB).')
    return raw, ext


def update_user_profile(
    root: Path,
    user_id: str,
    display_name: str | None = None,
    avatar_data_url: str | None = None,
) -> dict[str, Any]:
    data = _load_profiles(root)
    user = next((u for u in data['users'] if u.get('id') == user_id), None)
    if not user:
        raise ApiError(404, 'user_not_found', 'Usuário não encontrado.')

    if display_name is not None:
        name = display_name.strip()[:40]
        if not name:
            raise ApiError(400, 'invalid_display_name', 'Informe um nome exibido.')
        user['displayName'] = name

    if avatar_data_url is not None:
        if avatar_data_url == '':
            avatars = _avatars_dir(root)
            for ext in ('.jpg', '.jpeg', '.png', '.webp'):
                (avatars / f'{user_id}{ext}').unlink(missing_ok=True)
        else:
            raw, ext = _decode_avatar_data_url(avatar_data_url)
            avatars = _avatars_dir(root)
            avatars.mkdir(parents=True, exist_ok=True)
            for old_ext in ('.jpg', '.jpeg', '.png', '.webp'):
                if old_ext != f'.{ext}':
                    (avatars / f'{user_id}{old_ext}').unlink(missing_ok=True)
            (avatars / f'{user_id}.{ext}').write_bytes(raw)

    _save_profiles(root, data)
    return _profile_from_user(root, user)


def get_user_avatar(root: Path, user_id: str) -> tuple[bytes, str] | None:
    path = _avatar_path_for_user(root, user_id)
    if not path:
        return None
    ext = path.suffix.lower().lstrip('.')
    mime = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'webp': 'image/webp',
    }.get(ext, 'application/octet-stream')
    return path.read_bytes(), mime


def register_user(root: Path, username: str, password: str, display_name: str | None = None) -> dict[str, Any]:
    username = (username or '').strip().lower()
    if not USERNAME_RE.match(username):
        raise ApiError(400, 'invalid_username', 'Usuário: 3–24 caracteres (letras, números, _).')
    if len(password or '') < 6:
        raise ApiError(400, 'weak_password', 'Senha deve ter pelo menos 6 caracteres.')

    data = _load_profiles(root)
    users: list[dict[str, Any]] = data['users']
    if any(u.get('username') == username for u in users):
        raise ApiError(409, 'username_taken', 'Este usuário já existe.')

    salt_hex, hash_hex = _hash_password(password)
    user_id = secrets.token_hex(8)
    user = {
        'id': user_id,
        'username': username,
        'displayName': (display_name or username).strip()[:40] or username,
        'salt': salt_hex,
        'passwordHash': hash_hex,
        'createdAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
    }
    users.append(user)
    _save_profiles(root, data)
    return _profile_from_user(root, user)


def login_user(root: Path, username: str, password: str) -> tuple[str, dict[str, Any]]:
    username = (username or '').strip().lower()
    data = _load_profiles(root)
    user = next((u for u in data['users'] if u.get('username') == username), None)
    if not user or not _verify_password(password, user.get('salt', ''), user.get('passwordHash', '')):
        raise ApiError(401, 'invalid_credentials', 'Usuário ou senha inválidos.')

    token = secrets.token_urlsafe(32)
    expires_at = time.time() + SESSION_TTL_SEC
    session = {
        'token': token,
        'userId': user['id'],
        'username': user['username'],
        'expiresAt': expires_at,
        'createdAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'lastSeenAt': time.time(),
    }
    _session_path(root, token).write_text(json.dumps(session), encoding='utf-8')
    _cleanup_expired_sessions(root)
    profile = _profile_from_user(root, user)
    return token, profile


def resolve_session(root: Path, token: str | None) -> dict[str, Any]:
    if not token:
        raise ApiError(401, 'missing_token', 'Sessão não informada.')
    path = _session_path(root, token)
    if not path.is_file():
        raise ApiError(401, 'invalid_session', 'Sessão expirada ou inválida.')
    try:
        session = json.loads(path.read_text(encoding='utf-8'))
    except (OSError, json.JSONDecodeError):
        raise ApiError(401, 'invalid_session', 'Sessão inválida.') from None
    if float(session.get('expiresAt', 0)) <= time.time():
        path.unlink(missing_ok=True)
        raise ApiError(401, 'session_expired', 'Sessão expirada.')
    _touch_session_last_seen(root, path, session)
    data = _load_profiles(root)
    user = next((u for u in data['users'] if u.get('id') == session.get('userId')), None)
    if not user:
        path.unlink(missing_ok=True)
        raise ApiError(401, 'invalid_session', 'Usuário não encontrado.')
    return _profile_from_user(root, user)


def logout_user(root: Path, token: str | None) -> None:
    if not token:
        return
    _session_path(root, token).unlink(missing_ok=True)
