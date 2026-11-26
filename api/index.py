"""Função serverless da Vercel que expõe a API BR Fut (scripts/brfut_api).

Todas as rotas ``/api/*`` são reescritas para esta função (ver vercel.json).
O armazenamento é o Postgres apontado por ``DATABASE_URL`` (Neon).
"""
from __future__ import annotations

import json
import logging
import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / 'scripts'
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from brfut_api.cors import cors_headers  # noqa: E402
from brfut_api.router import MAX_REQUEST_BODY_BYTES, finalize_response, handle_api  # noqa: E402

LOGGER = logging.getLogger('brfut.vercel')
ROUTE_PARAM = '__route'


def resolve_api_path(raw_path: str) -> str:
    """Recupera ``/api/<rota>?query`` original, com ou sem o parâmetro da rewrite."""
    split = urlsplit(raw_path or '/')
    params = parse_qsl(split.query, keep_blank_values=True)
    route = next((value for key, value in params if key == ROUTE_PARAM), None)
    rest = [(key, value) for key, value in params if key != ROUTE_PARAM]
    path = split.path
    if route is not None:
        path = '/api/' + route.lstrip('/')
    query = urlencode(rest)
    return f'{path}?{query}' if query else path


def _error_payload(status: int, code: str, message: str) -> tuple[int, dict[str, str], bytes]:
    body = json.dumps({'ok': False, 'code': code, 'error': message}, ensure_ascii=False).encode('utf-8')
    return status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': str(len(body)),
        'Cache-Control': 'no-store',
    }, body


class handler(BaseHTTPRequestHandler):  # noqa: N801 — nome exigido pela Vercel
    server_version = 'brfut-api'
    sys_version = ''

    def _headers(self) -> dict[str, str]:
        return {key: value for key, value in self.headers.items()}

    def _body(self) -> bytes:
        try:
            length = int(self.headers.get('Content-Length') or 0)
        except ValueError:
            length = 0
        if length <= 0:
            return b''
        # Lê até 1 byte além do teto para a API responder 413 sem carregar tudo.
        return self.rfile.read(min(length, MAX_REQUEST_BODY_BYTES + 1))

    def _send(self, response: tuple[int, dict[str, str], bytes]) -> None:
        status, headers, body = response
        headers = {**headers, **cors_headers(self.headers.get('Origin'))}
        headers.setdefault('X-Content-Type-Options', 'nosniff')
        self.send_response(status)
        for key, value in headers.items():
            self.send_header(key, value)
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)

    def _dispatch(self) -> None:
        request_headers = self._headers()
        try:
            response = handle_api(self.command, resolve_api_path(self.path), request_headers, self._body())
        except Exception:  # pragma: no cover — nunca vaza stack trace ao cliente
            LOGGER.exception('api_internal_error path=%s', urlsplit(self.path).path)
            response = _error_payload(500, 'internal_error', 'Erro interno do servidor.')
        self._send(finalize_response(response, request_headers))

    def do_OPTIONS(self) -> None:  # noqa: N802
        cors = cors_headers(self.headers.get('Origin'))
        if not cors:
            self._send(_error_payload(403, 'origin_not_allowed', 'Origem não permitida.'))
            return
        self.send_response(204)
        for key, value in cors.items():
            self.send_header(key, value)
        self.send_header('Content-Length', '0')
        self.end_headers()

    do_GET = _dispatch  # noqa: N815
    do_POST = _dispatch  # noqa: N815
    do_PUT = _dispatch  # noqa: N815
    do_DELETE = _dispatch  # noqa: N815

    def log_message(self, format: str, *args) -> None:  # noqa: A002 — evita logar tokens/IPs
        return
