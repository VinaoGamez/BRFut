"""Camada única de banco de dados da API BR Fut.

Dois backends com o mesmo SQL:

* **Postgres** quando ``DATABASE_URL`` (ou ``POSTGRES_URL``) estiver definido —
  usado na Vercel com Neon. Funções serverless não têm disco persistente, então
  tudo (contas, sessões, saves, estatísticas) vive no banco.
* **SQLite** em ``<data_root>/brfut.sqlite3`` quando não houver URL — usado no
  servidor local de testers e nos testes automatizados.

O SQL dos módulos é escrito no dialeto comum (placeholders ``?``,
``ON CONFLICT ... DO UPDATE``); este módulo traduz o necessário para Postgres.
"""
from __future__ import annotations

import os
import re
import threading
from contextlib import contextmanager
from decimal import Decimal
from pathlib import Path
from typing import Any, Iterable, Iterator, Sequence

SQLITE_FILE_NAME = 'brfut.sqlite3'

_SCHEMAS: list[tuple[str, str]] = []
_SCHEMA_READY: set[str] = set()
_SCHEMA_LOCK = threading.Lock()
_LOCAL = threading.local()


class Row(dict):
    """Linha que aceita acesso por nome (``row['col']``) e por posição (``row[0]``)."""

    def __getitem__(self, key: Any) -> Any:  # type: ignore[override]
        if isinstance(key, int):
            return list(self.values())[key]
        return super().__getitem__(key)


def register_schema(name: str, ddl: str) -> None:
    """Registra DDL (``CREATE TABLE IF NOT EXISTS`` ...) aplicado na 1ª conexão."""
    if not any(existing == name for existing, _ in _SCHEMAS):
        _SCHEMAS.append((name, ddl))
        _SCHEMA_READY.clear()  # novo schema: reaplica na próxima conexão (IF NOT EXISTS)


def database_url() -> str:
    for key in ('DATABASE_URL', 'POSTGRES_URL', 'BRFUT_DATABASE_URL'):
        value = (os.environ.get(key) or '').strip()
        if value:
            return value
    return ''


def backend() -> str:
    return 'postgres' if database_url() else 'sqlite'


def _normalize(value: Any) -> Any:
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    if isinstance(value, memoryview):
        return bytes(value)
    return value


def _translate_pg(sql: str) -> str:
    # Nenhum SQL do projeto usa "?" ou "%" dentro de literais; a tradução é direta.
    return sql.replace('%', '%%').replace('?', '%s')


def _translate_ddl_pg(ddl: str) -> str:
    ddl = re.sub(r'\bINTEGER\b', 'BIGINT', ddl)
    ddl = re.sub(r'\bREAL\b', 'DOUBLE PRECISION', ddl)
    ddl = re.sub(r'\bBLOB\b', 'BYTEA', ddl)
    return ddl


def _split_statements(ddl: str) -> list[str]:
    return [part.strip() for part in ddl.split(';') if part.strip()]


class _Cursor:
    def __init__(self, raw: Any) -> None:
        self._raw = raw

    def _row(self, values: Sequence[Any] | None) -> Row | None:
        if values is None:
            return None
        names = [col[0] for col in (self._raw.description or [])]
        return Row(zip(names, (_normalize(v) for v in values)))

    def fetchone(self) -> Row | None:
        if self._raw.description is None:
            return None
        return self._row(self._raw.fetchone())

    def fetchall(self) -> list[Row]:
        if self._raw.description is None:
            return []
        return [self._row(values) for values in self._raw.fetchall()]  # type: ignore[misc]

    @property
    def rowcount(self) -> int:
        return int(self._raw.rowcount or 0)


class Connection:
    """Wrapper mínimo com a mesma interface para SQLite e Postgres."""

    def __init__(self, raw: Any, kind: str) -> None:
        self.raw = raw
        self.kind = kind

    def execute(self, sql: str, params: Iterable[Any] = ()) -> _Cursor:
        params = tuple(params)
        if self.kind == 'postgres':
            cursor = self.raw.cursor()
            cursor.execute(_translate_pg(sql), params)
            return _Cursor(cursor)
        return _Cursor(self.raw.execute(sql, params))

    def executemany(self, sql: str, rows: Iterable[Iterable[Any]]) -> None:
        rows = [tuple(row) for row in rows]
        if not rows:
            return
        if self.kind == 'postgres':
            with self.raw.cursor() as cursor:
                cursor.executemany(_translate_pg(sql), rows)
            return
        self.raw.executemany(sql, rows)

    def blob(self, value: bytes | None) -> Any:
        return value


def _sqlite_path(root: Path) -> Path:
    return Path(root) / SQLITE_FILE_NAME


def _open_sqlite(root: Path):
    import sqlite3

    path = _sqlite_path(root)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, timeout=15)
    conn.execute('PRAGMA journal_mode=WAL')
    conn.execute('PRAGMA foreign_keys=ON')
    conn.execute('PRAGMA busy_timeout=15000')
    return conn, f'sqlite:{path}'


def _open_postgres():
    url = database_url()
    cached = getattr(_LOCAL, 'pg', None)
    if cached is not None and not cached.closed and cached.info.transaction_status == 0:
        return cached, 'postgres'
    import psycopg

    # prepare_threshold=None: compatível com o pooler (PgBouncer) do Neon.
    conn = psycopg.connect(url, autocommit=False, prepare_threshold=None, connect_timeout=10)
    _LOCAL.pg = conn
    return conn, 'postgres'


def _ensure_schema(conn: Connection, schema_key: str) -> None:
    if schema_key in _SCHEMA_READY:
        return
    with _SCHEMA_LOCK:
        if schema_key in _SCHEMA_READY:
            return
        for _, ddl in _SCHEMAS:
            statements = _split_statements(_translate_ddl_pg(ddl) if conn.kind == 'postgres' else ddl)
            for statement in statements:
                conn.execute(statement)
        conn.raw.commit()
        _SCHEMA_READY.add(schema_key)


@contextmanager
def connect(root: Path) -> Iterator[Connection]:
    """Abre (ou reaproveita) a conexão e executa um bloco em transação."""
    kind = backend()
    if kind == 'postgres':
        raw, schema_key = _open_postgres()
    else:
        raw, schema_key = _open_sqlite(root)
    conn = Connection(raw, kind)
    try:
        _ensure_schema(conn, schema_key)
        yield conn
        raw.commit()
    except BaseException:
        try:
            raw.rollback()
        except Exception:
            pass
        if kind == 'postgres':
            _discard_broken_pg(raw)
        raise
    finally:
        if kind == 'sqlite':
            raw.close()


def _discard_broken_pg(raw: Any) -> None:
    try:
        broken = raw.closed or raw.broken
    except Exception:
        broken = True
    if broken:
        try:
            raw.close()
        except Exception:
            pass
        _LOCAL.pg = None


def drop_all_for_tests(root: Path) -> None:
    """Apaga as tabelas do projeto (somente para testes contra Postgres descartável)."""
    tables = re.findall(r'CREATE TABLE IF NOT EXISTS (\w+)', '\n'.join(ddl for _, ddl in _SCHEMAS))
    with connect(root) as conn:
        for table in reversed(tables):
            conn.execute(f'DROP TABLE IF EXISTS {table} CASCADE' if conn.kind == 'postgres' else f'DROP TABLE IF EXISTS {table}')
    _SCHEMA_READY.clear()


def reset_for_tests() -> None:
    """Esquece o cache de schema (testes trocam de pasta/banco a cada caso)."""
    _SCHEMA_READY.clear()
    cached = getattr(_LOCAL, 'pg', None)
    if cached is not None:
        try:
            cached.close()
        except Exception:
            pass
    _LOCAL.pg = None
