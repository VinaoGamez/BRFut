"""Autenticação (PBKDF2 + sessões opacas) persistida no banco (db.py)."""
from __future__ import annotations

import base64
import binascii
import hashlib
import re
import secrets
import time
import unicodedata
from pathlib import Path
from typing import Any

from . import db

USERNAME_RE = re.compile(r'^[a-zA-Z0-9_]{3,24}$')
SESSION_TTL_SEC = 60 * 60 * 24 * 30  # 30 dias
SESSION_ABSOLUTE_TTL_SEC = 60 * 60 * 24 * 90  # novo login obrigatório em 90 dias
MAX_SESSIONS_PER_USER = 5
ONLINE_WINDOW_SEC = 300  # 5 min — jogador "ON" se teve atividade recente
SESSION_TOUCH_MIN_SEC = 60  # throttle de gravação lastSeenAt
PBKDF2_ITERS = 600_000  # OWASP 2023+ para PBKDF2-HMAC-SHA256
LEGACY_PBKDF2_ITERS = 260_000  # contas criadas antes da migração
MAX_AVATAR_BYTES = 512_000

db.register_schema('accounts', """
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  salt TEXT,
  password_hash TEXT,
  pbkdf2_iters INTEGER,
  google_sub TEXT UNIQUE,
  email TEXT,
  auth_provider TEXT NOT NULL DEFAULT 'password',
  created_at TEXT NOT NULL,
  avatar BLOB,
  avatar_mime TEXT
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'password',
  created_at TEXT NOT NULL,
  last_seen_at REAL NOT NULL,
  expires_at REAL NOT NULL,
  absolute_expires_at REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
""")


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str, retry_after: int | None = None) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.retry_after = retry_after


def _now_iso() -> str:
    return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())


def validate_display_name(value: Any, fallback: str | None = None) -> str:
    if value is None:
        value = fallback or ''
    if not isinstance(value, str):
        raise ApiError(400, 'invalid_display_name', 'Nome exibido inválido.')
    name = ' '.join(value.strip().split())
    if not name or len(name) > 40:
        raise ApiError(400, 'invalid_display_name', 'Nome exibido deve ter entre 1 e 40 caracteres.')
    if '<' in name or '>' in name or any(unicodedata.category(char).startswith('C') for char in name):
        raise ApiError(400, 'invalid_display_name', 'Nome exibido contém caracteres não permitidos.')
    return name


# --- senhas -----------------------------------------------------------------

def _hash_password(password: str, salt: bytes | None = None, iterations: int = PBKDF2_ITERS) -> tuple[str, str]:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, iterations)
    return salt.hex(), digest.hex()


def _verify_password(password: str, salt_hex: str, hash_hex: str, iterations: int) -> bool:
    try:
        salt = bytes.fromhex(salt_hex or '')
        if not salt or not hash_hex:
            return False
        _, candidate = _hash_password(password, salt, iterations)
        return secrets.compare_digest(candidate, hash_hex)
    except (TypeError, ValueError):
        return False


# --- usuários ---------------------------------------------------------------

_USER_COLUMNS = (
    'id, username, display_name, salt, password_hash, pbkdf2_iters, google_sub, email, '
    'auth_provider, created_at, avatar_mime'
)


def _user_from_row(row: dict[str, Any] | None) -> dict[str, Any] | None:
    if not row:
        return None
    return {
        'id': row['id'],
        'username': row['username'],
        'displayName': row['display_name'] or row['username'],
        'salt': row['salt'],
        'passwordHash': row['password_hash'],
        'pbkdf2Iters': row['pbkdf2_iters'] or LEGACY_PBKDF2_ITERS,
        'googleSub': row['google_sub'],
        'email': row['email'],
        'authProvider': row['auth_provider'],
        'createdAt': row['created_at'],
        'hasAvatar': bool(row['avatar_mime']),
    }


def find_user(conn: db.Connection, *, user_id: str | None = None, username: str | None = None,
              google_sub: str | None = None, email: str | None = None) -> dict[str, Any] | None:
    if user_id is not None:
        clause, value = 'id=?', user_id
    elif username is not None:
        clause, value = 'username=?', username
    elif google_sub is not None:
        clause, value = 'google_sub=?', google_sub
    elif email is not None:
        clause, value = 'lower(email)=?', email.lower()
    else:
        return None
    row = conn.execute(f'SELECT {_USER_COLUMNS} FROM users WHERE {clause} LIMIT 1', (value,)).fetchone()
    return _user_from_row(row)


def username_exists(conn: db.Connection, username: str) -> bool:
    return conn.execute('SELECT 1 FROM users WHERE username=? LIMIT 1', (username,)).fetchone() is not None


def insert_user(conn: db.Connection, user: dict[str, Any]) -> None:
    conn.execute(
        '''INSERT INTO users (id, username, display_name, salt, password_hash, pbkdf2_iters,
                              google_sub, email, auth_provider, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?)''',
        (
            user['id'], user['username'], user['displayName'], user.get('salt'), user.get('passwordHash'),
            user.get('pbkdf2Iters'), user.get('googleSub'), user.get('email'),
            user.get('authProvider') or 'password', user.get('createdAt') or _now_iso(),
        ),
    )


def _profile_from_user(user: dict[str, Any]) -> dict[str, Any]:
    return {
        'id': user['id'],
        'username': user['username'],
        'displayName': user.get('displayName') or user['username'],
        'hasAvatar': bool(user.get('hasAvatar')),
    }


def count_users(root: Path) -> int:
    with db.connect(root) as conn:
        row = conn.execute('SELECT COUNT(*) FROM users').fetchone()
    return int(row[0] if row else 0)


# --- sessões ----------------------------------------------------------------

def session_id_for_token(token: str) -> str:
    """O token secreto nunca é persistido: o banco guarda apenas o SHA-256."""
    return hashlib.sha256(token.encode('utf-8')).hexdigest()


def _cleanup_expired_sessions(conn: db.Connection, now: float | None = None) -> None:
    now = time.time() if now is None else now
    conn.execute('DELETE FROM sessions WHERE expires_at<=? OR absolute_expires_at<=?', (now, now))


def create_session_in(conn: db.Connection, user: dict[str, Any], provider: str = 'password') -> str:
    token = secrets.token_urlsafe(32)
    now = time.time()
    conn.execute(
        '''INSERT INTO sessions (id, user_id, provider, created_at, last_seen_at, expires_at, absolute_expires_at)
           VALUES (?,?,?,?,?,?,?)''',
        (session_id_for_token(token), user['id'], provider, _now_iso(), now,
         now + SESSION_TTL_SEC, now + SESSION_ABSOLUTE_TTL_SEC),
    )
    _cleanup_expired_sessions(conn, now)
    stale = conn.execute(
        'SELECT id FROM sessions WHERE user_id=? ORDER BY last_seen_at DESC',
        (user['id'],),
    ).fetchall()[MAX_SESSIONS_PER_USER:]
    for row in stale:
        conn.execute('DELETE FROM sessions WHERE id=?', (row['id'],))
    return token


def create_session(root: Path, user: dict[str, Any], provider: str = 'password') -> str:
    with db.connect(root) as conn:
        return create_session_in(conn, user, provider)


def get_player_stats(root: Path, online_window_sec: int = ONLINE_WINDOW_SEC) -> dict[str, Any]:
    now = time.time()
    with db.connect(root) as conn:
        registered = conn.execute('SELECT COUNT(*) FROM users').fetchone()[0]
        online = conn.execute(
            '''SELECT COUNT(DISTINCT user_id) FROM sessions
               WHERE expires_at>? AND absolute_expires_at>? AND last_seen_at>=?''',
            (now, now, now - online_window_sec),
        ).fetchone()[0]
    return {
        'registered': int(registered or 0),
        'online': int(online or 0),
        'onlineWindowSec': online_window_sec,
    }


def resolve_session(root: Path, token: str | None) -> dict[str, Any]:
    if not token or not isinstance(token, str) or len(token) > 512:
        raise ApiError(401, 'missing_token', 'Sessão não informada.')
    session_id = session_id_for_token(token)
    now = time.time()
    with db.connect(root) as conn:
        session = conn.execute(
            'SELECT user_id, last_seen_at, expires_at, absolute_expires_at FROM sessions WHERE id=?',
            (session_id,),
        ).fetchone()
        if not session:
            raise ApiError(401, 'invalid_session', 'Sessão expirada ou inválida.')
        if float(session['expires_at']) <= now or float(session['absolute_expires_at']) <= now:
            conn.execute('DELETE FROM sessions WHERE id=?', (session_id,))
            expired = True
        else:
            expired = False
            if now - float(session['last_seen_at'] or 0) >= SESSION_TOUCH_MIN_SEC:
                conn.execute(
                    'UPDATE sessions SET last_seen_at=?, expires_at=? WHERE id=?',
                    (now, min(now + SESSION_TTL_SEC, float(session['absolute_expires_at'])), session_id),
                )
            user = find_user(conn, user_id=session['user_id'])
    if expired:
        raise ApiError(401, 'session_expired', 'Sessão expirada.')
    if not user:
        raise ApiError(401, 'invalid_session', 'Usuário não encontrado.')
    return _profile_from_user(user)


def logout_user(root: Path, token: str | None) -> None:
    if not token:
        return
    with db.connect(root) as conn:
        conn.execute('DELETE FROM sessions WHERE id=?', (session_id_for_token(token),))


# --- cadastro / login -------------------------------------------------------

def register_user(root: Path, username: str, password: str, display_name: str | None = None) -> dict[str, Any]:
    if not isinstance(username, str) or not isinstance(password, str):
        raise ApiError(400, 'invalid_credentials_format', 'Usuário ou senha em formato inválido.')
    username = (username or '').strip().lower()
    if not USERNAME_RE.match(username):
        raise ApiError(400, 'invalid_username', 'Usuário: 3–24 caracteres (letras, números, _).')
    if len(password or '') < 10 or len(password or '') > 256:
        raise ApiError(400, 'weak_password', 'Senha deve ter entre 10 e 256 caracteres.')
    name = validate_display_name(display_name, username)
    salt_hex, hash_hex = _hash_password(password)
    user = {
        'id': secrets.token_hex(8),
        'username': username,
        'displayName': name,
        'salt': salt_hex,
        'passwordHash': hash_hex,
        'pbkdf2Iters': PBKDF2_ITERS,
        'authProvider': 'password',
        'createdAt': _now_iso(),
    }
    with db.connect(root) as conn:
        if username_exists(conn, username):
            raise ApiError(409, 'username_taken', 'Este usuário já existe.')
        insert_user(conn, user)
    return _profile_from_user(user)


def login_user(root: Path, username: str, password: str) -> tuple[str, dict[str, Any]]:
    if not isinstance(username, str) or not isinstance(password, str):
        raise ApiError(400, 'invalid_credentials_format', 'Usuário ou senha em formato inválido.')
    username = (username or '').strip().lower()
    with db.connect(root) as conn:
        user = find_user(conn, username=username) if USERNAME_RE.match(username) else None
    valid = bool(
        user
        and len(password or '') <= 256
        and _verify_password(password, user.get('salt') or '', user.get('passwordHash') or '', user['pbkdf2Iters'])
    )
    if not valid or not user:
        raise ApiError(401, 'invalid_credentials', 'Usuário ou senha inválidos.')
    with db.connect(root) as conn:
        if user['pbkdf2Iters'] < PBKDF2_ITERS:
            # Atualiza o hash legado de forma transparente no próximo login válido.
            salt_hex, hash_hex = _hash_password(password)
            conn.execute(
                'UPDATE users SET salt=?, password_hash=?, pbkdf2_iters=? WHERE id=?',
                (salt_hex, hash_hex, PBKDF2_ITERS, user['id']),
            )
        token = create_session_in(conn, user)
    return token, _profile_from_user(user)


# --- perfil e avatar --------------------------------------------------------

def _decode_avatar_data_url(data_url: Any) -> tuple[bytes, str]:
    if not isinstance(data_url, str):
        raise ApiError(400, 'invalid_avatar', 'Imagem em formato inválido.')
    match = re.match(r'^data:image/(jpeg|jpg|png|webp);base64,(.+)$', data_url.strip(), re.I)
    if not match:
        raise ApiError(400, 'invalid_avatar', 'Imagem inválida (use JPEG, PNG ou WebP).')
    ext = match.group(1).lower()
    mime = {'jpeg': 'image/jpeg', 'jpg': 'image/jpeg', 'png': 'image/png', 'webp': 'image/webp'}[ext]
    try:
        raw = base64.b64decode(match.group(2), validate=True)
    except (ValueError, binascii.Error) as error:
        raise ApiError(400, 'invalid_avatar', 'Imagem inválida.') from error
    if len(raw) > MAX_AVATAR_BYTES:
        raise ApiError(400, 'avatar_too_large', 'Imagem muito grande (máx. 500 KB).')
    signatures = {
        'image/jpeg': (b'\xff\xd8\xff',),
        'image/png': (b'\x89PNG\r\n\x1a\n',),
        'image/webp': (b'RIFF',),
    }
    if not raw.startswith(signatures[mime]):
        raise ApiError(400, 'invalid_avatar', 'O conteúdo da imagem não corresponde ao formato informado.')
    return raw, mime


def update_user_profile(
    root: Path,
    user_id: str,
    display_name: str | None = None,
    avatar_data_url: Any = None,
) -> dict[str, Any]:
    with db.connect(root) as conn:
        user = find_user(conn, user_id=user_id)
        if not user:
            raise ApiError(404, 'user_not_found', 'Usuário não encontrado.')
        if display_name is not None:
            user['displayName'] = validate_display_name(display_name)
            conn.execute('UPDATE users SET display_name=? WHERE id=?', (user['displayName'], user_id))
        if avatar_data_url is not None:
            if avatar_data_url == '':
                conn.execute('UPDATE users SET avatar=NULL, avatar_mime=NULL WHERE id=?', (user_id,))
                user['hasAvatar'] = False
            else:
                raw, mime = _decode_avatar_data_url(avatar_data_url)
                conn.execute('UPDATE users SET avatar=?, avatar_mime=? WHERE id=?', (raw, mime, user_id))
                user['hasAvatar'] = True
    return _profile_from_user(user)


def get_user_avatar(root: Path, user_id: str) -> tuple[bytes, str] | None:
    with db.connect(root) as conn:
        row = conn.execute('SELECT avatar, avatar_mime FROM users WHERE id=?', (user_id,)).fetchone()
    if not row or not row['avatar'] or not row['avatar_mime']:
        return None
    return bytes(row['avatar']), str(row['avatar_mime'])
