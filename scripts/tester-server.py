#!/usr/bin/env python3
"""
Servidor hardened para link externo de testers (porta 5081).

- Preferencia: pasta dist/ (bundle minificado via npm run build)
- Fallback: raiz do projeto com deny-list agressiva
"""
from __future__ import annotations

import argparse
import json
import mimetypes
import os
import re
import socket
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

SCRIPTS = Path(__file__).resolve().parent
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from brfut_api.cors import cors_headers  # noqa: E402
from brfut_api.router import handle_api  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / 'dist'
PORT_DEFAULT = 5081
LOCAL_ENV_FILE = SCRIPTS / 'brfut-local.env'


def env_file_path() -> Path:
    override = os.environ.get('BRFUT_ENV_FILE', '').strip()
    return Path(override).expanduser() if override else LOCAL_ENV_FILE


def load_local_env() -> None:
    """Carrega BRFUT_* de scripts/brfut-local.env ou BRFUT_ENV_FILE (produção)."""
    env_file = env_file_path()
    if env_file.is_file():
        for raw in env_file.read_text(encoding='utf-8').splitlines():
            line = raw.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, _, value = line.partition('=')
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and value:
                os.environ[key] = value
    if not os.environ.get('BRFUT_CORS_ORIGINS', '').strip():
        os.environ['BRFUT_CORS_ORIGINS'] = 'http://127.0.0.1:5081,http://localhost:5081'


load_local_env()

BLOCKED_EXACT = {
    'inspect-save.html',
    'validate-game.html',
    'benchmark.html',
    'benchmark-runner.html',
    'benchmark-cup-divisions.html',
    'benchmark-output.html',
    'package.json',
    'vite.config.js',
    'CHANGELOG.md',
    'LEIA-ME.txt',
    'LINK-COMPARTILHAMENTO.txt',
    'LINK-EXTERNO.txt',
}

BLOCKED_PREFIXES = (
    'docs/',
    'scripts/',
    '.cursor/',
    'tools/',
    '.git/',
    'node_modules/',
    'benchmark-',
    'agent-transcripts/',
)

# Com bundle dist/, bloqueia pastas de fonte mesmo se alguém adivinhar o caminho.
SOURCE_PREFIXES_WHEN_DIST = (
    'js/legacy/',
    'js/core/',
    'js/features/',
    'js/modules/',
    'js/ui/',
)

BLOCKED_SUFFIXES = (
    '.md', '.py', '.bat', '.ps1', '.log', '.jsonl', '.map',
    '.gitignore', '.env', '.example',
)

# JSON permitido fora de assets/ (dados jogáveis servidos em dist/data/).
ALLOWED_JSON_PREFIXES = ('assets/', 'data/')

BLOCKED_QUERY_KEYS = re.compile(
    r'(^|&)(engineTest|cupAudit|autoBenchmark|benchmark)(=|&|$)',
    re.I,
)

def csp_connect_src() -> str:
    """Origens permitidas para fetch (API local, VPS, Google)."""
    origins = ["'self'", 'https://api.brfut.com.br']
    extra = os.environ.get('BRFUT_API_ORIGIN', '').strip().rstrip('/')
    if extra and extra not in origins:
        origins.append(extra)
    return ' '.join(origins)


SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': (
        "default-src 'self'; "
        "script-src 'self' https://accounts.google.com; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com; "
        "font-src 'self' https://fonts.gstatic.com data:; "
        "img-src 'self' data: blob: https://*.googleusercontent.com; "
        f"connect-src {csp_connect_src()}; "
        "frame-src 'self' https://accounts.google.com; "
        "object-src 'none'; "
        "base-uri 'self'; "
        "frame-ancestors 'none'; "
        "form-action 'self'"
    ),
}


def use_dist() -> bool:
    return DIST.is_dir() and (DIST / 'index.html').is_file()


def normalize_path(path: str) -> str:
    path = unquote(path.split('?', 1)[0])
    if path.startswith('/'):
        path = path[1:]
    if not path:
        return 'index.html'
    return path.replace('\\', '/')


class TesterHandler(SimpleHTTPRequestHandler):
    serve_root: Path = ROOT
    dist_mode: bool = False
    api_only: bool = False

    def log_message(self, format: str, *args) -> None:
        if args and str(args[0]).startswith('4'):
            super().log_message(format, *args)

    def end_headers(self) -> None:
        for key, value in SECURITY_HEADERS.items():
            self.send_header(key, value)
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def _header_map(self) -> dict[str, str]:
        return {key: value for key, value in self.headers.items()}

    def _read_body(self) -> bytes:
        length = int(self.headers.get('Content-Length', '0') or 0)
        if length <= 0:
            return b''
        return self.rfile.read(length)

    def _merge_cors(self, headers: dict[str, str]) -> dict[str, str]:
        origin = self.headers.get('Origin')
        merged = dict(headers)
        merged.update(cors_headers(origin))
        return merged

    def _dispatch_api(self, method: str) -> None:
        parsed = urlparse(self.path)
        try:
            status, headers, body = handle_api(method, parsed.path, self._header_map(), self._read_body())
        except Exception as error:  # pragma: no cover — fallback seguro
            payload = json.dumps({'ok': False, 'code': 'internal_error', 'error': str(error)}).encode('utf-8')
            status = 500
            headers = {
                'Content-Type': 'application/json; charset=utf-8',
                'Content-Length': str(len(payload)),
            }
            body = payload
        headers = self._merge_cors(headers)
        self.send_response(status)
        for key, value in headers.items():
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        if not urlparse(self.path).path.startswith('/api/'):
            self.send_error(405, 'Método não permitido.')
            return
        cors = cors_headers(self.headers.get('Origin'))
        if not cors:
            self.send_error(403, 'Origem não permitida.')
            return
        self.send_response(204)
        for key, value in cors.items():
            self.send_header(key, value)
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path.startswith('/api/'):
            self._dispatch_api('GET')
            return
        if self.api_only:
            self.send_error(404, 'Endpoint não encontrado.')
            return
        if parsed.query and BLOCKED_QUERY_KEYS.search(parsed.query):
            self.send_error(403, 'Modo de depuração bloqueado no link de testers.')
            return

        rel = normalize_path(parsed.path)
        if self.is_blocked(rel):
            self.send_error(403, 'Recurso indisponível no ambiente de testers.')
            return

        target = self.resolve_target(rel)
        if target is None or not target.is_file():
            self.send_error(404, 'Arquivo não encontrado.')
            return

        content = target.read_bytes()
        ctype = mimetypes.guess_type(str(target))[0] or 'application/octet-stream'
        self.send_response(200)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def do_POST(self) -> None:
        if urlparse(self.path).path.startswith('/api/'):
            self._dispatch_api('POST')
            return
        self.send_error(405, 'Método não permitido.')

    def do_PUT(self) -> None:
        if urlparse(self.path).path.startswith('/api/'):
            self._dispatch_api('PUT')
            return
        self.send_error(405, 'Método não permitido.')

    def do_DELETE(self) -> None:
        if urlparse(self.path).path.startswith('/api/'):
            self._dispatch_api('DELETE')
            return
        self.send_error(405, 'Método não permitido.')

    def is_blocked(self, rel: str) -> bool:
        lower = rel.lower()
        if lower in BLOCKED_EXACT:
            return True
        if any(lower.startswith(prefix) for prefix in BLOCKED_PREFIXES):
            return True
        if self.dist_mode and any(lower.startswith(prefix) for prefix in SOURCE_PREFIXES_WHEN_DIST):
            return True
        if lower.endswith('.json'):
            return not any(lower.startswith(prefix) for prefix in ALLOWED_JSON_PREFIXES)
        if any(lower.endswith(suffix) for suffix in BLOCKED_SUFFIXES):
            return True
        if '/../' in f'/{lower}/' or lower.startswith('../'):
            return True
        return False

    def resolve_target(self, rel: str) -> Path | None:
        root = self.serve_root.resolve()
        candidate = (root / rel).resolve()
        try:
            candidate.relative_to(root)
        except ValueError:
            return None
        return candidate


def ensure_port_free(bind: str, port: int) -> None:
    """Evita empilhar vários tester-server na mesma porta (Windows aceita reuse silencioso)."""
    probe = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        if sys.platform == 'win32':
            probe.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        else:
            # Reinícios do systemd podem deixar conexões recentes em TIME_WAIT.
            # Isso não representa outro servidor escutando e não deve bloquear o boot.
            probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        probe.bind((bind, port))
    except OSError as error:
        print(f'ERRO: porta {port} já em uso ({error}).')
        print('Encerre o servidor anterior antes de subir outro:')
        print('  Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match "tester-server" }')
        sys.exit(1)
    finally:
        probe.close()


def main() -> None:
    load_local_env()
    parser = argparse.ArgumentParser(description='BR Fut tester server (hardened)')
    parser.add_argument('--port', type=int, default=PORT_DEFAULT)
    parser.add_argument('--bind', default='127.0.0.1')
    parser.add_argument(
        '--api-only',
        action='store_true',
        help='Somente /api/* (produção atrás de nginx; sem arquivos estáticos).',
    )
    args = parser.parse_args()
    ensure_port_free(args.bind, args.port)

    from brfut_api.cors import allowed_origins
    from brfut_api.google_auth import google_auth_enabled, google_client_id

    serve_from = DIST if use_dist() else ROOT
    TesterHandler.serve_root = serve_from
    TesterHandler.dist_mode = serve_from == DIST
    TesterHandler.api_only = args.api_only

    httpd = ThreadingHTTPServer((args.bind, args.port), TesterHandler)
    if args.api_only:
        mode = 'api-only (produção)'
    elif serve_from == DIST:
        mode = 'dist (bundle minificado)'
    else:
        mode = 'fallback (instale Node e rode npm run build para ocultar fontes)'
    print(f'BR Fut tester server em http://{args.bind}:{args.port}/')
    print(f'Modo: {mode}')
    print(f'API: http://{args.bind}:{args.port}/api/health')
    cors = allowed_origins()
    if cors:
        print(f'CORS: {", ".join(cors)}')
    elif args.api_only:
        print('CORS: desativado — defina BRFUT_CORS_ORIGINS no ambiente')
    if google_auth_enabled():
        print(f'Google OAuth: ativado ({google_client_id()[:24]}…)')
    else:
        print('Google OAuth: desativado — defina BRFUT_GOOGLE_CLIENT_ID ou scripts/brfut-local.env')
    print('Bloqueios: docs, scripts, benchmarks, inspect-save, JSON/MD/logs, query debug')
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nServidor encerrado.')


if __name__ == '__main__':
    main()
