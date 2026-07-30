#!/usr/bin/env python3
"""Testes unitários da API local (sem HTTP)."""
from __future__ import annotations

import json
import shutil
import sys
import tempfile
import time
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from brfut_api.auth import ApiError, login_user, register_user, resolve_session  # noqa: E402
from brfut_api.router import handle_api  # noqa: E402
from brfut_api.saves import get_all_saves, get_save, put_save  # noqa: E402


class BrfutApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.mkdtemp(prefix='brfut-api-')
        self.root = Path(self.tmp)
        (self.root / 'profiles').mkdir(parents=True)
        (self.root / 'saves').mkdir(parents=True)
        (self.root / 'sessions').mkdir(parents=True)

    def tearDown(self) -> None:
        shutil.rmtree(self.tmp, ignore_errors=True)

    def _route(self, method: str, path: str, body: dict | None = None, token: str | None = None):
        import brfut_api.router as router_mod

        old = router_mod.default_data_root
        router_mod.default_data_root = lambda: self.root  # type: ignore[assignment]
        try:
            raw = json.dumps(body).encode('utf-8') if body is not None else b''
            headers = {'Authorization': f'Bearer {token}'} if token else {}
            status, _, payload = handle_api(method, path, headers, raw)
            return status, json.loads(payload.decode('utf-8'))
        finally:
            router_mod.default_data_root = old

    def test_register_login_and_save_roundtrip(self) -> None:
        register_user(self.root, 'tester', 'secret1', 'Tester')
        token, profile = login_user(self.root, 'tester', 'secret1')
        self.assertEqual(profile['username'], 'tester')
        resolve_session(self.root, token)

        put_save(self.root, 'tester', 'brfut-career', {'clubName': 'Flamengo', 'division': 'A'})
        data = get_save(self.root, 'tester', 'brfut-career')
        self.assertEqual(data['clubName'], 'Flamengo')
        self.assertEqual(get_all_saves(self.root, 'tester')['brfut-career']['value']['clubName'], 'Flamengo')

    def test_http_health_and_auth_flow(self) -> None:
        status, body = self._route('GET', '/api/health')
        self.assertEqual(status, 200)
        self.assertTrue(body['ok'])

        status, body = self._route('POST', '/api/auth/register', {'username': 'alpha', 'password': 'pass12'})
        self.assertEqual(status, 201)
        token = body['token']

        status, body = self._route('GET', '/api/auth/me', token=token)
        self.assertEqual(status, 200)
        self.assertEqual(body['user']['username'], 'alpha')

        status, body = self._route(
            'PUT',
            '/api/saves/brfut-career',
            {'value': {'clubName': 'Santos'}},
            token=token,
        )
        self.assertEqual(status, 200)

        status, body = self._route('GET', '/api/saves', token=token)
        self.assertEqual(status, 200)
        self.assertEqual(body['saves']['brfut-career']['value']['clubName'], 'Santos')

    def test_profile_update(self) -> None:
        register_user(self.root, 'profile1', 'secret1', 'Profile One')
        token, _ = login_user(self.root, 'profile1', 'secret1')

        status, body = self._route(
            'PUT',
            '/api/auth/profile',
            {'displayName': 'Novo Nome'},
            token=token,
        )
        self.assertEqual(status, 200)
        self.assertEqual(body['user']['displayName'], 'Novo Nome')

        status, body = self._route('GET', '/api/auth/me', token=token)
        self.assertEqual(body['user']['displayName'], 'Novo Nome')

    def test_player_stats(self) -> None:
        register_user(self.root, 'online1', 'secret1', 'One')
        register_user(self.root, 'online2', 'secret2', 'Two')
        token, _ = login_user(self.root, 'online1', 'secret1')
        resolve_session(self.root, token)

        status, body = self._route('GET', '/api/health')
        self.assertEqual(status, 200)
        self.assertTrue(body['ok'])
        self.assertIn('registered', body)
        self.assertIn('online', body)

        status, body = self._route('GET', '/api/stats', token=token)
        self.assertEqual(status, 200)
        self.assertEqual(body['registered'], 2)
        self.assertEqual(body['online'], 1)
        self.assertEqual(body['onlineWindowSec'], 300)

    def test_invalid_credentials(self) -> None:
        register_user(self.root, 'user1', 'abcdef', None)
        with self.assertRaises(ApiError):
            login_user(self.root, 'user1', 'wrong')

    def test_active_session_renews_expiration(self) -> None:
        register_user(self.root, 'renew1', 'secret1', 'Renew')
        token, _ = login_user(self.root, 'renew1', 'secret1')
        path = self.root / 'sessions' / f'{token}.json'
        session = json.loads(path.read_text(encoding='utf-8'))
        session['lastSeenAt'] = 0
        session['expiresAt'] = time.time() + 60
        path.write_text(json.dumps(session), encoding='utf-8')

        resolve_session(self.root, token)

        renewed = json.loads(path.read_text(encoding='utf-8'))
        self.assertGreater(renewed['expiresAt'], time.time() + 29 * 24 * 60 * 60)


if __name__ == '__main__':
    unittest.main()
