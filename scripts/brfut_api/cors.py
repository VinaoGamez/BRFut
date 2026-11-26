"""CORS da API (front e API na mesma origem na Vercel; app mobile/desktop via lista explícita)."""
from __future__ import annotations

import os


def allowed_origins() -> list[str]:
    raw = os.environ.get('BRFUT_CORS_ORIGINS', '')
    return [origin.strip() for origin in raw.split(',') if origin.strip()]


def _origin_allowed(origin: str, allowed: list[str]) -> bool:
    if origin in allowed:
        return True
    # Origens HTTP não herdam a permissão da versão HTTPS: com credenciais,
    # isso permitiria que um atacante na rede (MITM) usasse a sessão do jogador.
    # Cloudflare Pages preview: https://*.pages.dev
    if origin.endswith('.pages.dev') and origin.startswith('https://'):
        return 'https://*.pages.dev' in allowed
    return False


def cors_headers(origin: str | None) -> dict[str, str]:
    if not origin:
        return {}
    allowed = allowed_origins()
    if not _origin_allowed(origin, allowed):
        return {}
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, Content-Encoding, X-BRFut-Request',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin',
    }
