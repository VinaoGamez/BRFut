"""Snapshots dos 27 campeonatos estaduais, separados do save principal."""
from __future__ import annotations

import json
import re
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Any

from .auth import ApiError
from .validation import validate_json_structure

UF_RE = re.compile(r'^[A-Z]{2}$')
MAX_SNAPSHOT_BYTES = 8_000_000


@contextmanager
def _db(root: Path):
    conn = sqlite3.connect(root / 'state-leagues.sqlite3')
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA journal_mode=WAL')
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS state_league_snapshots (
          username TEXT NOT NULL,
          career_id TEXT NOT NULL,
          season INTEGER NOT NULL,
          uf TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (username, career_id, season, uf)
        );
        CREATE INDEX IF NOT EXISTS idx_state_league_career
          ON state_league_snapshots(username, career_id, season);
        """
    )
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _season(value: Any) -> int:
    try:
        season = int(value)
    except (TypeError, ValueError) as error:
        raise ApiError(400, 'invalid_state_league', 'Temporada estadual inválida.') from error
    if season < 1900 or season > 9999:
        raise ApiError(400, 'invalid_state_league', 'Temporada estadual fora do intervalo.')
    return season


def put_state_leagues(
    root: Path, username: str, career_id: str, season_value: Any, body: dict[str, Any],
) -> dict[str, Any]:
    season = _season(season_value)
    snapshot = body.get('snapshot') if isinstance(body, dict) else None
    competitions = snapshot.get('competitions') if isinstance(snapshot, dict) else None
    history = snapshot.get('historyByUf') if isinstance(snapshot, dict) else {}
    results = snapshot.get('results') if isinstance(snapshot, dict) else {}
    if not isinstance(competitions, dict) or not competitions:
        raise ApiError(400, 'invalid_state_league', 'Snapshot deve incluir competições estaduais.')
    if len(competitions) > 27:
        raise ApiError(413, 'state_league_too_large', 'Snapshot excede as 27 federações.')
    validate_json_structure(snapshot, max_nodes=1_000_000)
    raw_snapshot = json.dumps(snapshot, ensure_ascii=False, separators=(',', ':'))
    if len(raw_snapshot.encode('utf-8')) > MAX_SNAPSHOT_BYTES:
        raise ApiError(413, 'state_league_too_large', 'Snapshot estadual excede 8 MB.')

    now = int(time.time())
    stored = 0
    with _db(root) as conn:
        for uf, divisions in competitions.items():
            uf = str(uf or '').upper()
            if not UF_RE.match(uf) or not isinstance(divisions, list):
                raise ApiError(400, 'invalid_state_league', 'Federação ou divisões inválidas.')
            payload = {
                'competitions': divisions,
                'history': history.get(uf, []) if isinstance(history, dict) else [],
                'results': results.get(uf, []) if isinstance(results, dict) else [],
            }
            raw = json.dumps(payload, ensure_ascii=False, separators=(',', ':'))
            conn.execute(
                '''INSERT INTO state_league_snapshots
                   (username,career_id,season,uf,payload_json,updated_at)
                   VALUES (?,?,?,?,?,?)
                   ON CONFLICT(username,career_id,season,uf) DO UPDATE SET
                     payload_json=excluded.payload_json,updated_at=excluded.updated_at''',
                (username, career_id, season, uf, raw, now),
            )
            stored += 1
    return {'careerId': career_id, 'season': season, 'stored': stored, 'updatedAt': now}


def get_state_leagues(
    root: Path, username: str, career_id: str, season_value: Any, uf_value: str | None = None,
) -> dict[str, Any]:
    season = _season(season_value)
    args: list[Any] = [username, career_id, season]
    where = 'username=? AND career_id=? AND season=?'
    if uf_value:
        uf = str(uf_value).upper()
        if not UF_RE.match(uf):
            raise ApiError(400, 'invalid_state_league', 'UF inválida.')
        where += ' AND uf=?'
        args.append(uf)
    with _db(root) as conn:
        rows = conn.execute(
            f'SELECT uf,payload_json,updated_at FROM state_league_snapshots WHERE {where} ORDER BY uf',
            args,
        ).fetchall()
    if not rows:
        return {
            'careerId': career_id,
            'snapshot': None,
            'updatedAt': None,
        }
    competitions: dict[str, Any] = {}
    history: dict[str, Any] = {}
    results: dict[str, Any] = {}
    updated_at = 0
    for row in rows:
        payload = json.loads(row['payload_json'])
        competitions[row['uf']] = payload.get('competitions') or []
        history[row['uf']] = payload.get('history') or []
        results[row['uf']] = payload.get('results') or []
        updated_at = max(updated_at, int(row['updated_at'] or 0))
    return {
        'careerId': career_id,
        'snapshot': {
            'seasonYear': season,
            'competitions': competitions,
            'historyByUf': history,
            'results': results,
        },
        'updatedAt': updated_at,
    }


def delete_career_state_leagues(root: Path, username: str, career_id: str) -> int:
    if not (root / 'state-leagues.sqlite3').is_file():
        return 0
    with _db(root) as conn:
        count = conn.execute(
            'SELECT COUNT(*) FROM state_league_snapshots WHERE username=? AND career_id=?',
            (username, career_id),
        ).fetchone()[0]
        conn.execute(
            'DELETE FROM state_league_snapshots WHERE username=? AND career_id=?',
            (username, career_id),
        )
    return int(count)


def delete_user_state_leagues(root: Path, username: str) -> int:
    if not (root / 'state-leagues.sqlite3').is_file():
        return 0
    with _db(root) as conn:
        count = conn.execute(
            'SELECT COUNT(*) FROM state_league_snapshots WHERE username=?', (username,),
        ).fetchone()[0]
        conn.execute('DELETE FROM state_league_snapshots WHERE username=?', (username,))
    return int(count)
