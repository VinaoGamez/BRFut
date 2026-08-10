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


def request_ip(headers: dict[str, str]) -> str:
    lowered = {str(key).lower(): str(value) for key, value in headers.items()}
    value = lowered.get('x-real-ip') or lowered.get('x-forwarded-for', '').split(',', 1)[0] or 'unknown'
    value = value.strip()
    return value[:64] if value else 'unknown'


def reset_rate_limits() -> None:
    RATE_LIMITER.reset()
