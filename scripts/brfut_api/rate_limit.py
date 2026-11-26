"""Rate limiting em memória para defesa adicional da API.

O nginx continua sendo a primeira camada. Este módulo protege também o processo
Python e aplica bloqueio progressivo por conta sem registrar identificadores brutos.
"""
from __future__ import annotations

import hashlib
import logging
import threading
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Callable

from pathlib import Path

from . import db
from .auth import ApiError

LOGGER = logging.getLogger('brfut.security')


@dataclass
class FailureState:
    attempts: int = 0
    blocked_until: float = 0.0
    last_failure: float = 0.0


class RateLimiter:
    def __init__(self, clock: Callable[[], float] = time.monotonic) -> None:
        self.clock = clock
        self.lock = threading.Lock()
        self.windows: dict[tuple[str, str], deque[float]] = defaultdict(deque)
        self.failures: dict[str, FailureState] = {}

    @staticmethod
    def _subject(value: str) -> str:
        normalized = (value or 'unknown').strip().lower()
        return hashlib.sha256(normalized.encode('utf-8')).hexdigest()[:16]

    def _check_window(self, scope: str, subject: str, limit: int, seconds: int) -> None:
        now = self.clock()
        key = (scope, self._subject(subject))
        with self.lock:
            bucket = self.windows[key]
            cutoff = now - seconds
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()
            if len(bucket) >= limit:
                retry_after = max(1, int(bucket[0] + seconds - now) + 1)
                LOGGER.warning('rate_limit scope=%s subject=%s retry_after=%s', scope, key[1], retry_after)
                raise ApiError(429, 'rate_limited', 'Muitas tentativas. Aguarde e tente novamente.', retry_after)
            bucket.append(now)

    def check_request(self, ip: str) -> None:
        # Segunda camada. O nginx permanece mais restritivo (120/min).
        self._check_window('api_ip', ip, 180, 60)

    def check_auth(self, ip: str, account: str = '') -> None:
        self._check_window('auth_ip', ip, 10, 60)
        if not account:
            return
        account_key = self._subject(account)
        now = self.clock()
        with self.lock:
            state = self.failures.get(account_key)
            if state and state.blocked_until > now:
                retry_after = max(1, int(state.blocked_until - now) + 1)
                LOGGER.warning('login_blocked subject=%s retry_after=%s', account_key, retry_after)
                raise ApiError(429, 'login_temporarily_blocked', 'Muitas tentativas para esta conta.', retry_after)
        self._check_window('auth_account', account, 8, 15 * 60)

    def record_login_failure(self, account: str) -> None:
        account_key = self._subject(account)
        now = self.clock()
        with self.lock:
            state = self.failures.setdefault(account_key, FailureState())
            if now - state.last_failure > 30 * 60:
                state.attempts = 0
            state.attempts += 1
            state.last_failure = now
            delays = (0, 0, 5, 15, 60, 300)
            delay = delays[min(state.attempts, len(delays)) - 1]
            state.blocked_until = now + delay
            LOGGER.warning('login_failed subject=%s attempts=%s delay=%s', account_key, state.attempts, delay)

    def record_login_success(self, account: str) -> None:
        account_key = self._subject(account)
        with self.lock:
            self.failures.pop(account_key, None)

    def reset(self) -> None:
        with self.lock:
            self.windows.clear()
            self.failures.clear()


RATE_LIMITER = RateLimiter()


db.register_schema('rate_limits', """
CREATE TABLE IF NOT EXISTS rate_counters (
  scope TEXT NOT NULL,
  subject TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  hits INTEGER NOT NULL,
  PRIMARY KEY (scope, subject, window_start)
);
CREATE TABLE IF NOT EXISTS auth_failures (
  subject TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  blocked_until REAL NOT NULL,
  last_failure REAL NOT NULL
)
""")

_FAILURE_DELAYS = (0, 0, 5, 15, 60, 300)


class PersistentAuthGuard:
    """Limites de login gravados no banco.

    Em funções serverless cada instância tem a própria memória, então o
    ``RateLimiter`` acima sozinho não segura ataques distribuídos entre
    instâncias. Esta camada guarda janelas fixas e bloqueio progressivo por
    conta no banco; só é consultada nas rotas de autenticação.
    """

    def __init__(self, clock: Callable[[], float] = time.time) -> None:
        self.clock = clock

    @staticmethod
    def _subject(value: str) -> str:
        return RateLimiter._subject(value)

    def _hit(self, conn: db.Connection, scope: str, subject: str, limit: int, seconds: int) -> None:
        now = self.clock()
        window = int(now // seconds) * seconds
        key = self._subject(subject)
        conn.execute(
            '''INSERT INTO rate_counters (scope, subject, window_start, hits) VALUES (?,?,?,1)
               ON CONFLICT(scope, subject, window_start) DO UPDATE SET hits=rate_counters.hits+1''',
            (scope, key, window),
        )
        hits = conn.execute(
            'SELECT hits FROM rate_counters WHERE scope=? AND subject=? AND window_start=?',
            (scope, key, window),
        ).fetchone()[0]
        if int(hits) > limit:
            retry_after = max(1, int(window + seconds - now) + 1)
            LOGGER.warning('rate_limit_db scope=%s subject=%s retry_after=%s', scope, key, retry_after)
            raise ApiError(429, 'rate_limited', 'Muitas tentativas. Aguarde e tente novamente.', retry_after)

    def check_auth(self, root: Path, ip: str, account: str = '') -> None:
        now = self.clock()
        with db.connect(root) as conn:
            if int(now) % 50 == 0:
                conn.execute('DELETE FROM rate_counters WHERE window_start<?', (int(now) - 3600,))
            self._hit(conn, 'auth_ip', ip, 20, 60)
            if not account:
                return
            row = conn.execute(
                'SELECT blocked_until FROM auth_failures WHERE subject=?', (self._subject(account),),
            ).fetchone()
            if row and float(row['blocked_until']) > now:
                retry_after = max(1, int(float(row['blocked_until']) - now) + 1)
                raise ApiError(429, 'login_temporarily_blocked', 'Muitas tentativas para esta conta.', retry_after)
            self._hit(conn, 'auth_account', account, 12, 15 * 60)

    def record_login_failure(self, root: Path, account: str) -> None:
        now = self.clock()
        key = self._subject(account)
        with db.connect(root) as conn:
            row = conn.execute('SELECT attempts, last_failure FROM auth_failures WHERE subject=?', (key,)).fetchone()
            attempts = 1
            if row and now - float(row['last_failure']) <= 30 * 60:
                attempts = int(row['attempts']) + 1
            delay = _FAILURE_DELAYS[min(attempts, len(_FAILURE_DELAYS)) - 1]
            conn.execute(
                '''INSERT INTO auth_failures (subject, attempts, blocked_until, last_failure) VALUES (?,?,?,?)
                   ON CONFLICT(subject) DO UPDATE SET attempts=excluded.attempts,
                     blocked_until=excluded.blocked_until, last_failure=excluded.last_failure''',
                (key, attempts, now + delay, now),
            )

    def record_login_success(self, root: Path, account: str) -> None:
        with db.connect(root) as conn:
            conn.execute('DELETE FROM auth_failures WHERE subject=?', (self._subject(account),))


AUTH_GUARD = PersistentAuthGuard()


def request_ip(headers: dict[str, str]) -> str:
    lowered = {str(key).lower(): str(value) for key, value in headers.items()}
    # Na Vercel, x-vercel-forwarded-for/x-real-ip são definidos pela plataforma
    # (o cliente não consegue forjá-los); x-forwarded-for fica como último recurso.
    value = (
        lowered.get('x-vercel-forwarded-for', '').split(',', 1)[0]
        or lowered.get('x-real-ip')
        or lowered.get('x-forwarded-for', '').split(',', 1)[0]
        or 'unknown'
    )
    value = value.strip()
    return value[:64] if value else 'unknown'


def reset_rate_limits() -> None:
    RATE_LIMITER.reset()
