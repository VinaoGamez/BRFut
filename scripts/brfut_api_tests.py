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

from brfut_api import db  # noqa: E402
from brfut_api.auth import ApiError, login_user, register_user, resolve_session, session_id_for_token  # noqa: E402
from brfut_api.legacy_import import import_legacy_data  # noqa: E402
from brfut_api.cors import cors_headers  # noqa: E402
from brfut_api.router import handle_api  # noqa: E402
from brfut_api.rate_limit import RateLimiter, reset_rate_limits  # noqa: E402
from brfut_api.saves import get_all_saves, get_save, put_save  # noqa: E402


class BrfutApiTests(unittest.TestCase):
    def setUp(self) -> None:
        reset_rate_limits()
        db.reset_for_tests()
        self.tmp = tempfile.mkdtemp(prefix='brfut-api-')
        self.root = Path(self.tmp)
        if db.backend() == 'postgres':
            db.drop_all_for_tests(self.root)

    def tearDown(self) -> None:
        reset_rate_limits()
        db.reset_for_tests()
        shutil.rmtree(self.tmp, ignore_errors=True)

    def _sql(self, sql: str, params: tuple = ()):
        with db.connect(self.root) as conn:
            return conn.execute(sql, params).fetchall()

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

    def test_rejects_markup_in_display_name_and_unknown_auth_fields(self) -> None:
        with self.assertRaises(ApiError) as display_error:
            register_user(self.root, 'unsafe', 'secretpass1', '<img src=x onerror=alert(1)>')
        self.assertEqual(display_error.exception.code, 'invalid_display_name')

        status, body = self._route(
            'POST', '/api/auth/register',
            {'username': 'alpha', 'password': 'passphrase12', 'admin': True},
        )
        self.assertEqual(status, 400)
        self.assertEqual(body['code'], 'unknown_fields')

    def test_rejects_invalid_query_instead_of_returning_500(self) -> None:
        register_user(self.root, 'tester', 'secretpass1', 'Tester')
        token, _ = login_user(self.root, 'tester', 'secretpass1')
        status, body = self._route(
            'GET', '/api/careers/career-1/stats/leaders?season=not-a-number', token=token,
        )
        self.assertEqual(status, 400)
        self.assertEqual(body['code'], 'invalid_query')

    def test_rejects_abusive_save_structure(self) -> None:
        nested = {'value': True}
        for _ in range(42):
            nested = {'nested': nested}
        with self.assertRaises(ApiError) as depth_error:
            put_save(self.root, 'tester', 'brfut-season', nested)
        self.assertEqual(depth_error.exception.code, 'json_too_deep')

        with self.assertRaises(ApiError) as string_error:
            put_save(self.root, 'tester', 'brfut-season', {'data': 'x' * 1_100_001})
        self.assertEqual(string_error.exception.code, 'string_too_large')

    def test_rejects_non_string_avatar_without_server_error(self) -> None:
        status, register = self._route(
            'POST', '/api/auth/register',
            {'username': 'alpha', 'password': 'passphrase12'},
        )
        self.assertEqual(status, 201)
        token, _ = login_user(self.root, 'alpha', 'passphrase12')
        status, body = self._route(
            'PUT', '/api/auth/profile', {'avatar': 123}, token=token,
        )
        self.assertEqual(status, 400)
        self.assertEqual(body['code'], 'invalid_avatar')

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
        self.assertTrue(body['capabilities']['stateLeagues'])
        self.assertTrue(body['capabilities']['optionalSaveReads'])
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
        # Saves antigos (versão < 7) gravados direto no banco, como viriam da importação.
        for key, value in (
            ('brfut-career', {'version': 6, 'clubName': 'Antigo'}),
            ('brfut-career-index', {'version': 1, 'slots': [{'id': 'old'}]}),
        ):
            self._sql(
                'INSERT INTO saves (username, save_key, value_json, updated_at, bytes) VALUES (?,?,?,?,?)',
                ('legacy7', key, json.dumps(value), '2026-08-01T00:00:00Z', 10),
            )

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
        self.assertEqual(self._sql("SELECT save_key FROM saves WHERE username='legacy7'"), [])

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

    def test_session_storage_does_not_contain_raw_token(self) -> None:
        register_user(self.root, 'opaque1', 'secretpass1', 'Opaque')
        token, _ = login_user(self.root, 'opaque1', 'secretpass1')
        rows = self._sql('SELECT * FROM sessions')
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['id'], session_id_for_token(token))
        self.assertNotIn(token, json.dumps(rows, default=str))

    def test_legacy_data_folder_is_imported(self) -> None:
        legacy = Path(tempfile.mkdtemp(prefix='brfut-legacy-'))
        try:
            import hashlib
            from brfut_api.auth import LEGACY_PBKDF2_ITERS

            salt = b'0123456789abcdef'
            digest = hashlib.pbkdf2_hmac('sha256', b'oldpassword1', salt, LEGACY_PBKDF2_ITERS).hex()
            (legacy / 'profiles').mkdir(parents=True)
            (legacy / 'profiles' / 'index.json').write_text(json.dumps({'users': [{
                'id': 'abc123', 'username': 'veterano', 'displayName': 'Veterano',
                'salt': salt.hex(), 'passwordHash': digest, 'createdAt': '2026-07-25T20:13:49Z',
            }]}), encoding='utf-8')
            token = 'legacy-token-value'
            (legacy / 'sessions').mkdir()
            (legacy / 'sessions' / f'{session_id_for_token(token)}.json').write_text(json.dumps({
                'userId': 'abc123', 'username': 'veterano', 'expiresAt': time.time() + 3600,
                'absoluteExpiresAt': time.time() + 7200, 'lastSeenAt': time.time(), 'provider': 'password',
            }), encoding='utf-8')
            (legacy / 'sessions' / 'expired.json').write_text(json.dumps({
                'userId': 'abc123', 'expiresAt': 1, 'lastSeenAt': 1,
            }), encoding='utf-8')
            (legacy / 'saves' / 'veterano').mkdir(parents=True)
            (legacy / 'saves' / 'veterano' / 'brfut-career.json').write_text(json.dumps({
                'key': 'brfut-career', 'value': {'version': 7, 'clubName': 'Ituano'}, 'updatedAt': '2026-08-10T06:04:57Z',
            }), encoding='utf-8')

            report = import_legacy_data(legacy, self.root)
            self.assertEqual(report['users'], 1)
            self.assertEqual(report['sessions'], 1)
            self.assertEqual(report['saves'], 1)
            # Idempotente: rodar de novo não duplica nada.
            again = import_legacy_data(legacy, self.root)
            self.assertEqual((again['users'], again['sessions'], again['saves']), (0, 0, 0))

            self.assertEqual(resolve_session(self.root, token)['username'], 'veterano')
            self.assertEqual(get_save(self.root, 'veterano', 'brfut-career')['clubName'], 'Ituano')
            # Senha antiga continua válida e é atualizada para o custo novo no login.
            login_user(self.root, 'veterano', 'oldpassword1')
            iters = self._sql("SELECT pbkdf2_iters FROM users WHERE username='veterano'")[0]['pbkdf2_iters']
            from brfut_api.auth import PBKDF2_ITERS
            self.assertEqual(iters, PBKDF2_ITERS)
            login_user(self.root, 'veterano', 'oldpassword1')
        finally:
            shutil.rmtree(legacy, ignore_errors=True)

    def test_gzip_request_and_response(self) -> None:
        import gzip as gz
        from brfut_api.router import finalize_response

        register_user(self.root, 'gzip1', 'secretpass1', 'Gzip')
        token, _ = login_user(self.root, 'gzip1', 'secretpass1')
        value = {'version': 7, 'clubName': 'Compacto', 'rows': ['x' * 50] * 2000}
        raw = gz.compress(json.dumps({'value': value}).encode('utf-8'))
        import brfut_api.router as router_mod
        old = router_mod.default_data_root
        router_mod.default_data_root = lambda: self.root  # type: ignore[assignment]
        try:
            headers = {'Authorization': f'Bearer {token}', 'Content-Encoding': 'gzip'}
            status, _, _ = handle_api('PUT', '/api/saves/brfut-career', headers, raw)
            self.assertEqual(status, 200)
            response = handle_api('GET', '/api/saves', {'Authorization': f'Bearer {token}'}, b'')
            status, out_headers, payload = finalize_response(response, {'Accept-Encoding': 'gzip, br'})
            self.assertEqual(out_headers['Content-Encoding'], 'gzip')
            self.assertLess(len(payload), len(response[2]) / 5)
            body = json.loads(gz.decompress(payload))
            self.assertEqual(body['saves']['brfut-career']['value']['clubName'], 'Compacto')

            bomb = gz.compress(b'{' + b' ' * 12_000_000 + b'}')
            status, _, payload = handle_api('PUT', '/api/saves/brfut-career', headers, bomb)
            self.assertEqual(status, 413)
        finally:
            router_mod.default_data_root = old

    def test_avatar_content_must_match_declared_type(self) -> None:
        import base64

        register_user(self.root, 'avatar1', 'secretpass1', 'Avatar')
        token, _ = login_user(self.root, 'avatar1', 'secretpass1')
        fake = 'data:image/png;base64,' + base64.b64encode(b'<svg onload=alert(1)>').decode()
        status, body = self._route('PUT', '/api/auth/profile', {'avatar': fake}, token=token)
        self.assertEqual(status, 400)
        png = 'data:image/png;base64,' + base64.b64encode(b'\x89PNG\r\n\x1a\n' + b'0' * 32).decode()
        status, body = self._route('PUT', '/api/auth/profile', {'avatar': png}, token=token)
        self.assertEqual(status, 200)
        self.assertTrue(body['user']['hasAvatar'])

    def test_http_origin_does_not_inherit_https_cors(self) -> None:
        import os

        previous = os.environ.get('BRFUT_CORS_ORIGINS')
        try:
            os.environ['BRFUT_CORS_ORIGINS'] = 'https://brfut.com.br'
            self.assertEqual(cors_headers('http://brfut.com.br'), {})
            self.assertEqual(cors_headers('https://brfut.com.br')['Access-Control-Allow-Origin'], 'https://brfut.com.br')
        finally:
            if previous is None:
                os.environ.pop('BRFUT_CORS_ORIGINS', None)
            else:
                os.environ['BRFUT_CORS_ORIGINS'] = previous

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
        self._sql(
            'UPDATE sessions SET last_seen_at=0, expires_at=? WHERE id=?',
            (time.time() + 60, session_id_for_token(token)),
        )

        resolve_session(self.root, token)

        renewed = self._sql('SELECT expires_at FROM sessions WHERE id=?', (session_id_for_token(token),))[0]
        self.assertGreater(renewed['expires_at'], time.time() + 29 * 24 * 60 * 60)

    def test_persistent_login_lockout_survives_new_instance(self) -> None:
        from brfut_api.rate_limit import PersistentAuthGuard

        now = [10_000.0]
        guard = PersistentAuthGuard(clock=lambda: now[0])
        for _ in range(3):
            guard.record_login_failure(self.root, 'tester')
        # Outra instância (memória vazia) enxerga o bloqueio gravado no banco.
        other = PersistentAuthGuard(clock=lambda: now[0])
        with self.assertRaises(ApiError) as blocked:
            other.check_auth(self.root, '198.51.100.7', 'tester')
        self.assertEqual(blocked.exception.code, 'login_temporarily_blocked')
        now[0] += 6
        other.check_auth(self.root, '198.51.100.7', 'tester')
        other.record_login_success(self.root, 'tester')


if __name__ == '__main__':
    unittest.main()
