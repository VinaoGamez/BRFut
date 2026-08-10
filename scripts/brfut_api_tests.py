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

from brfut_api.auth import ApiError, _legacy_session_path, _session_path, login_user, register_user, resolve_session  # noqa: E402
from brfut_api.cors import cors_headers  # noqa: E402
from brfut_api.router import handle_api  # noqa: E402
from brfut_api.rate_limit import RateLimiter, reset_rate_limits  # noqa: E402
from brfut_api.saves import get_all_saves, get_save, put_save  # noqa: E402


class BrfutApiTests(unittest.TestCase):
    def setUp(self) -> None:
        reset_rate_limits()
        self.tmp = tempfile.mkdtemp(prefix='brfut-api-')
        self.root = Path(self.tmp)
        (self.root / 'profiles').mkdir(parents=True)
        (self.root / 'saves').mkdir(parents=True)
        (self.root / 'sessions').mkdir(parents=True)

    def tearDown(self) -> None:
        reset_rate_limits()
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_python_rate_limit_and_progressive_account_block(self) -> None:
        now = [1000.0]
        limiter = RateLimiter(clock=lambda: now[0])
        for _ in range(10):
            limiter.check_auth('203.0.113.10')
        with self.assertRaises(ApiError) as ip_error:
            limiter.check_auth('203.0.113.10')
        self.assertEqual(ip_error.exception.status, 429)
        self.assertGreaterEqual(ip_error.exception.retry_after or 0, 1)

        for _ in range(3):
            limiter.record_login_failure('Tester')
        with self.assertRaises(ApiError) as account_error:
            limiter.check_auth('203.0.113.11', 'tester')
        self.assertEqual(account_error.exception.code, 'login_temporarily_blocked')
        now[0] += 6
        limiter.check_auth('203.0.113.11', 'tester')
        limiter.record_login_success('tester')

    def test_rate_limit_response_exposes_retry_after(self) -> None:
        for index in range(10):
            self._route(
                'POST', '/api/auth/login',
                {'username': f'missing{index}', 'password': 'wrongpass123'},
            )
        status, body = self._route(
            'POST', '/api/auth/login',
            {'username': 'missing-final', 'password': 'wrongpass123'},
        )
        self.assertEqual(status, 429)
        self.assertEqual(body['code'], 'rate_limited')
        self.assertIn('Retry-After', self.last_headers)

    def _route(
        self,
        method: str,
        path: str,
        body: dict | None = None,
        token: str | None = None,
        cookie: str | None = None,
        csrf: bool = False,
        secure: bool = False,
    ):
        import brfut_api.router as router_mod

        old = router_mod.default_data_root
        router_mod.default_data_root = lambda: self.root  # type: ignore[assignment]
        try:
            raw = json.dumps(body).encode('utf-8') if body is not None else b''
            headers = {'Authorization': f'Bearer {token}'} if token else {}
            if cookie:
                headers['Cookie'] = cookie
            if csrf:
                headers['X-BRFut-Request'] = '1'
            if secure:
                headers['Origin'] = 'https://brfut.com.br'
                headers['X-Forwarded-Proto'] = 'https'
                headers['Host'] = 'api.brfut.com.br'
            status, response_headers, payload = handle_api(method, path, headers, raw)
            self.last_headers = response_headers
            return status, json.loads(payload.decode('utf-8'))
        finally:
            router_mod.default_data_root = old

    def test_register_login_and_save_roundtrip(self) -> None:
        register_user(self.root, 'tester', 'secretpass1', 'Tester')
        token, profile = login_user(self.root, 'tester', 'secretpass1')
        self.assertEqual(profile['username'], 'tester')
        resolve_session(self.root, token)

        put_save(self.root, 'tester', 'brfut-career', {'version': 7, 'clubName': 'Flamengo', 'division': 'A'})
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
        self.assertNotIn('dataRoot', body)
        self.assertNotIn('allowedKeys', body)
        self.assertNotIn('googleClientId', body)

        status, body = self._route(
            'POST',
            '/api/auth/register',
            {'username': 'alpha', 'password': 'passphrase12', 'remember': True},
        )
        self.assertEqual(status, 201)
        self.assertNotIn('token', body)
        cookie_header = self.last_headers['Set-Cookie']
        self.assertIn('brfut_session=', cookie_header)
        self.assertIn('HttpOnly', cookie_header)
        self.assertIn('SameSite=Lax', cookie_header)
        self.assertIn('Max-Age=', cookie_header)
        cookie = cookie_header.split(';', 1)[0]

        status, body = self._route('GET', '/api/auth/me', cookie=cookie)
        self.assertEqual(status, 200)
        self.assertEqual(body['user']['username'], 'alpha')

        status, body = self._route(
            'PUT',
            '/api/saves/brfut-career',
            {'value': {'version': 7, 'clubName': 'Santos'}},
            cookie=cookie,
        )
        self.assertEqual(status, 403)
        self.assertEqual(body['code'], 'csrf_rejected')

        status, body = self._route(
            'PUT',
            '/api/saves/brfut-career',
            {'value': {'version': 7, 'clubName': 'Santos'}},
            cookie=cookie,
            csrf=True,
        )
        self.assertEqual(status, 200)

        status, body = self._route('GET', '/api/saves', cookie=cookie)
        self.assertEqual(status, 200)
        self.assertEqual(body['saves']['brfut-career']['value']['clubName'], 'Santos')

    def test_secure_cookie_and_legacy_session_migration(self) -> None:
        register_user(self.root, 'legacycookie', 'secretpass1', 'Legacy Cookie')
        token, _ = login_user(self.root, 'legacycookie', 'secretpass1')
        status, body = self._route(
            'POST',
            '/api/auth/session/migrate',
            {'remember': True},
            token=token,
            csrf=True,
            secure=True,
        )
        self.assertEqual(status, 200)
        self.assertNotIn('token', body)
        cookie_header = self.last_headers['Set-Cookie']
        self.assertIn('HttpOnly', cookie_header)
        self.assertIn('Secure', cookie_header)
        self.assertIn('SameSite=None', cookie_header)

        cookie = cookie_header.split(';', 1)[0]
        status, body = self._route('POST', '/api/auth/logout', cookie=cookie, csrf=True, secure=True)
        self.assertEqual(status, 200)
        self.assertIn('Max-Age=0', self.last_headers['Set-Cookie'])

    def test_obsolete_career_save_is_rejected(self) -> None:
        with self.assertRaises(ApiError) as context:
            put_save(self.root, 'tester', 'brfut-career', {'version': 6, 'clubName': 'Antigo'})
        self.assertEqual(context.exception.status, 409)
        self.assertEqual(context.exception.code, 'save_version_obsolete')

        put_save(self.root, 'tester', 'brfut-season', {'version': 1, 'year': 2028})
        self.assertEqual(get_save(self.root, 'tester', 'brfut-season')['year'], 2028)

    def test_obsolete_saved_account_is_purged_on_read_without_affecting_others(self) -> None:
        register_user(self.root, 'legacy7', 'secretpass1', 'Legacy')
        legacy_token, _ = login_user(self.root, 'legacy7', 'secretpass1')
        legacy_dir = self.root / 'saves' / 'legacy7'
        legacy_dir.mkdir(parents=True, exist_ok=True)
        (legacy_dir / 'brfut-career.json').write_text(json.dumps({
            'key': 'brfut-career',
            'value': {'version': 6, 'clubName': 'Antigo'},
            'updatedAt': '2026-08-01T00:00:00Z',
        }), encoding='utf-8')
        (legacy_dir / 'brfut-career-index.json').write_text(json.dumps({
            'key': 'brfut-career-index',
            'value': {'version': 1, 'slots': [{'id': 'old'}]},
            'updatedAt': '2026-08-01T00:00:00Z',
        }), encoding='utf-8')

        register_user(self.root, 'modern7', 'secretpass1', 'Modern')
        modern_token, _ = login_user(self.root, 'modern7', 'secretpass1')
        put_save(self.root, 'modern7', 'brfut-career', {'version': 7, 'clubName': 'Atual'})
        put_save(self.root, 'modern7', 'brfut-slot-new-career', {
            'version': 7,
            'clubName': 'Atual',
            'season': 2026,
        })
        put_save(self.root, 'modern7', 'brfut-career-index', {
            'version': 2,
            'slots': [{'id': 'new', 'name': 'Atual 2026'}],
        })

        status, body = self._route('GET', '/api/saves', token=legacy_token)
        self.assertEqual(status, 200)
        self.assertEqual(body['saves'], {})
        self.assertFalse(any(legacy_dir.glob('*.json')))

        status, body = self._route('GET', '/api/saves', token=modern_token)
        self.assertEqual(status, 200)
        self.assertEqual(body['saves']['brfut-career']['value']['clubName'], 'Atual')

        # Simula sair e entrar novamente: a nova sessão precisa recuperar todo
        # o conjunto atual, sem acionar a limpeza reservada aos saves antigos.
        relogin_token, _ = login_user(self.root, 'modern7', 'secretpass1')
        status, body = self._route('GET', '/api/saves', token=relogin_token)
        self.assertEqual(status, 200)
        self.assertEqual(body['saves']['brfut-slot-new-career']['value']['version'], 7)
        self.assertEqual(len(body['saves']['brfut-career-index']['value']['slots']), 1)

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

    def test_legacy_session_filename_is_migrated_without_logout(self) -> None:
        register_user(self.root, 'legacy1', 'secretpass1', 'Legacy')
        token, _ = login_user(self.root, 'legacy1', 'secretpass1')
        hashed = _session_path(self.root, token)
        legacy = _legacy_session_path(self.root, token)
        hashed.replace(legacy)
        profile = resolve_session(self.root, token)
        self.assertEqual(profile['username'], 'legacy1')
        self.assertTrue(hashed.is_file())
        self.assertFalse(legacy.is_file())

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
            self.assertEqual(
                cors_headers('https://preview.pages.dev').get('Access-Control-Allow-Credentials'),
                'true',
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
            'GET', '/api/careers/slot-1/stats/players/p-1?season=2027&club=Beta', token=token,
        )
        self.assertEqual(status, 200)
        self.assertIsNone(body['total'])

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
