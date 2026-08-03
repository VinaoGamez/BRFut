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

from brfut_api.auth import ApiError, _session_path, login_user, register_user, resolve_session  # noqa: E402
from brfut_api.cors import cors_headers  # noqa: E402
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
        register_user(self.root, 'tester', 'secretpass1', 'Tester')
        token, profile = login_user(self.root, 'tester', 'secretpass1')
        self.assertEqual(profile['username'], 'tester')
        resolve_session(self.root, token)

        put_save(self.root, 'tester', 'brfut-career', {'clubName': 'Flamengo', 'division': 'A'})
        data = get_save(self.root, 'tester', 'brfut-career')
        self.assertEqual(data['clubName'], 'Flamengo')
        self.assertEqual(get_all_saves(self.root, 'tester')['brfut-career']['value']['clubName'], 'Flamengo')

    def test_season_archives_are_allowed_for_base_and_slot(self) -> None:
        put_save(self.root, 'tester', 'brfut-season-archive-2026', {'year': 2026})
        put_save(self.root, 'tester', 'brfut-slot-abc-season-archive-2026', {'year': 2026})
        saves = get_all_saves(self.root, 'tester')
        self.assertIn('brfut-season-archive-2026', saves)
        self.assertIn('brfut-slot-abc-season-archive-2026', saves)

    def test_http_health_and_auth_flow(self) -> None:
        status, body = self._route('GET', '/api/health')
        self.assertEqual(status, 200)
        self.assertTrue(body['ok'])

        status, body = self._route('POST', '/api/auth/register', {'username': 'alpha', 'password': 'passphrase12'})
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

    def test_private_routes_fail_closed_without_session(self) -> None:
        private_routes = [
            ('GET', '/api/auth/me'),
            ('POST', '/api/auth/logout'),
            ('GET', '/api/saves'),
            ('GET', '/api/unknown-future-route'),
        ]
        for method, path in private_routes:
            with self.subTest(method=method, path=path):
                status, body = self._route(method, path)
                self.assertEqual(status, 401)
                self.assertIn(body['code'], {'missing_token', 'invalid_session'})

    def test_session_file_does_not_contain_raw_token(self) -> None:
        register_user(self.root, 'opaque1', 'secretpass1', 'Opaque')
        token, _ = login_user(self.root, 'opaque1', 'secretpass1')
        path = _session_path(self.root, token)
        self.assertTrue(path.is_file())
        self.assertNotIn(token, path.name)
        self.assertNotIn(token, path.read_text(encoding='utf-8'))

    def test_pages_preview_requires_explicit_cors_wildcard(self) -> None:
        import os

        previous = os.environ.get('BRFUT_CORS_ORIGINS')
        try:
            os.environ['BRFUT_CORS_ORIGINS'] = 'https://brfut.com.br'
            self.assertEqual(cors_headers('https://preview.pages.dev'), {})
            os.environ['BRFUT_CORS_ORIGINS'] += ',https://*.pages.dev'
            self.assertEqual(
                cors_headers('https://preview.pages.dev').get('Access-Control-Allow-Origin'),
                'https://preview.pages.dev',
            )
        finally:
            if previous is None:
                os.environ.pop('BRFUT_CORS_ORIGINS', None)
            else:
                os.environ['BRFUT_CORS_ORIGINS'] = previous

    def test_profile_update(self) -> None:
        register_user(self.root, 'profile1', 'secretpass1', 'Profile One')
        token, _ = login_user(self.root, 'profile1', 'secretpass1')

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

    def test_player_stats_api_is_idempotent_and_scoped(self) -> None:
        register_user(self.root, 'stats1', 'secretpass1', 'Stats')
        token, _ = login_user(self.root, 'stats1', 'secretpass1')
        match = {
            'fixtureId': '2027-BSD-1-alpha-beta',
            'season': 2027,
            'competitionId': 'LEAGUE:D',
            'round': 1,
            'homeClub': 'Alpha',
            'awayClub': 'Beta',
            'homeGoals': 1,
            'awayGoals': 0,
            'players': [{
                'playerId': 'p-1',
                'name': 'Nascimento',
                'clubId': 'Alpha',
                'started': True,
                'minutes': 90,
                'goals': 1,
                'assists': 0,
                'yellow': False,
                'red': False,
                'passes': 31,
                'rating': 7.5,
            }],
        }
        for _ in range(2):
            status, body = self._route(
                'POST', '/api/careers/slot-1/stats/matches', {'matches': [match]}, token,
            )
            self.assertEqual(status, 200)
            self.assertEqual(body['accepted'], 1)

        status, body = self._route(
            'GET', '/api/careers/slot-1/stats/players/p-1?season=2027', token=token,
        )
        self.assertEqual(status, 200)
        self.assertEqual(body['total']['apps'], 1)
        self.assertEqual(body['total']['goals'], 1)
        self.assertEqual(body['total']['avg_rating'], 7.5)

        status, body = self._route(
            'GET',
            '/api/careers/slot-1/stats/leaders?season=2027&competition=LEAGUE%3AD&metric=goals',
            token=token,
        )
        self.assertEqual(status, 200)
        self.assertEqual(body['leaders'][0]['player_name'], 'Nascimento')

    def test_player_stats(self) -> None:
        register_user(self.root, 'online1', 'secretpass1', 'One')
        register_user(self.root, 'online2', 'secretpass2', 'Two')
        token, _ = login_user(self.root, 'online1', 'secretpass1')
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
        register_user(self.root, 'user1', 'abcdefghij', None)
        with self.assertRaises(ApiError):
            login_user(self.root, 'user1', 'wrong')

    def test_active_session_renews_expiration(self) -> None:
        register_user(self.root, 'renew1', 'secretpass1', 'Renew')
        token, _ = login_user(self.root, 'renew1', 'secretpass1')
        path = _session_path(self.root, token)
        session = json.loads(path.read_text(encoding='utf-8'))
        session['lastSeenAt'] = 0
        session['expiresAt'] = time.time() + 60
        path.write_text(json.dumps(session), encoding='utf-8')

        resolve_session(self.root, token)

        renewed = json.loads(path.read_text(encoding='utf-8'))
        self.assertGreater(renewed['expiresAt'], time.time() + 29 * 24 * 60 * 60)


if __name__ == '__main__':
    unittest.main()
