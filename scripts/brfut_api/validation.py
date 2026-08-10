"""Validadores compartilhados para dados recebidos pela API."""
from __future__ import annotations

import math
from typing import Any

from .auth import ApiError


def require_object(value: Any, *, label: str = 'Corpo') -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ApiError(400, 'invalid_body', f'{label} deve ser um objeto JSON.')
    return value


def reject_unknown_fields(value: dict[str, Any], allowed: set[str], *, label: str = 'Corpo') -> None:
    unknown = sorted(set(value) - allowed)
    if unknown:
        raise ApiError(400, 'unknown_fields', f'{label} contém campos não permitidos: {", ".join(unknown)}.')


def query_int(
    raw: Any,
    label: str,
    *,
    minimum: int | None = None,
    maximum: int | None = None,
    default: int = 0,
) -> int:
    if raw in (None, ''):
        return default
    if isinstance(raw, bool):
        raise ApiError(400, 'invalid_query', f'{label} inválido.')
    try:
        number = int(str(raw), 10)
    except (TypeError, ValueError) as error:
        raise ApiError(400, 'invalid_query', f'{label} inválido.') from error
    if minimum is not None and number < minimum:
        raise ApiError(400, 'invalid_query', f'{label} fora do intervalo permitido.')
    if maximum is not None and number > maximum:
        raise ApiError(400, 'invalid_query', f'{label} fora do intervalo permitido.')
    return number


def validate_json_structure(
    value: Any,
    *,
    max_depth: int = 40,
    max_nodes: int = 100_000,
    max_collection_items: int = 20_000,
    max_string_length: int = 1_100_000,
) -> None:
    """Rejeita estruturas abusivas sem impor um schema incompatível com saves existentes."""
    nodes = 0
    stack: list[tuple[Any, int]] = [(value, 0)]
    while stack:
        current, depth = stack.pop()
        nodes += 1
        if nodes > max_nodes:
            raise ApiError(413, 'json_too_complex', 'JSON excede o limite de complexidade.')
        if depth > max_depth:
            raise ApiError(413, 'json_too_deep', 'JSON excede o limite de profundidade.')
        if current is None or isinstance(current, (bool, int)):
            continue
        if isinstance(current, float):
            if not math.isfinite(current):
                raise ApiError(400, 'invalid_number', 'JSON contém número inválido.')
            continue
        if isinstance(current, str):
            if len(current) > max_string_length:
                raise ApiError(413, 'string_too_large', 'Texto excede o limite permitido.')
            continue
        if isinstance(current, list):
            if len(current) > max_collection_items:
                raise ApiError(413, 'collection_too_large', 'Lista excede o limite permitido.')
            stack.extend((item, depth + 1) for item in current)
            continue
        if isinstance(current, dict):
            if len(current) > max_collection_items:
                raise ApiError(413, 'collection_too_large', 'Objeto excede o limite permitido.')
            for key, item in current.items():
                if not isinstance(key, str) or len(key) > 180:
                    raise ApiError(400, 'invalid_field', 'Nome de campo inválido.')
                stack.append((item, depth + 1))
            continue
        raise ApiError(400, 'invalid_json_type', 'JSON contém um tipo não permitido.')
