"""CORS para API em produção (front GitHub Pages + api.brfut.com.br)."""
from __future__ import annotations

import os


def allowed_origins() -> list[str]:
    raw = os.environ.get('BRFUT_CORS_ORIGINS', '')
    return [origin.strip() for origin in raw.split(',') if origin.strip()]


def cors_headers(origin: str | None) -> dict[str, str]:
    if not origin:
        return {}
    if origin not in allowed_origins():
        return {}
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin',
    }
