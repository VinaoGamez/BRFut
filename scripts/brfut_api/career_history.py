"""Histórico durável e consultável de temporadas fechadas."""
from __future__ import annotations

import hashlib
import json
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Any

from .auth import ApiError


@contextmanager
def _db(root: Path):
    conn = sqlite3.connect(root / 'career-history.sqlite3')
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA journal_mode=WAL')
    conn.execute('PRAGMA foreign_keys=ON')
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS career_seasons (
          username TEXT NOT NULL, career_id TEXT NOT NULL, season INTEGER NOT NULL,
          user_club TEXT, user_division TEXT, checksum TEXT NOT NULL,
          payload_json TEXT NOT NULL, closed_at TEXT, updated_at INTEGER NOT NULL,
          PRIMARY KEY (username, career_id, season)
        );
        CREATE TABLE IF NOT EXISTS club_season_history (
          username TEXT NOT NULL, career_id TEXT NOT NULL, season INTEGER NOT NULL,
          club_id TEXT NOT NULL, competition_id TEXT NOT NULL,
          games INTEGER NOT NULL DEFAULT 0, wins INTEGER NOT NULL DEFAULT 0,
          draws INTEGER NOT NULL DEFAULT 0, losses INTEGER NOT NULL DEFAULT 0,
          champion INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (username, career_id, season, club_id, competition_id),
          FOREIGN KEY (username, career_id, season)
            REFERENCES career_seasons(username, career_id, season) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS manager_season_history (
          username TEXT NOT NULL, career_id TEXT NOT NULL, season INTEGER NOT NULL,
          manager_id TEXT NOT NULL, manager_name TEXT NOT NULL, clubs_json TEXT NOT NULL,
          games INTEGER NOT NULL DEFAULT 0, wins INTEGER NOT NULL DEFAULT 0,
          draws INTEGER NOT NULL DEFAULT 0, losses INTEGER NOT NULL DEFAULT 0,
          team_average REAL, titles_json TEXT NOT NULL,
          PRIMARY KEY (username, career_id, season, manager_id),
          FOREIGN KEY (username, career_id, season)
            REFERENCES career_seasons(username, career_id, season) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_club_history
          ON club_season_history(username, career_id, club_id, season);
        CREATE INDEX IF NOT EXISTS idx_manager_history
          ON manager_season_history(username, career_id, manager_id, season);
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


def _text(value: Any, label: str, required: bool = True) -> str | None:
    value = str(value or '').strip()
    if not value:
        if required:
            raise ApiError(400, 'invalid_history', f'{label} inválido.')
        return None
    if len(value) > 180:
        raise ApiError(400, 'invalid_history', f'{label} excede o limite.')
    return value


def _checksum(payload: dict[str, Any]) -> str:
    clean = {key: value for key, value in payload.items() if key != 'checksum'}
    raw = json.dumps(clean, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode('utf-8')
    return hashlib.sha256(raw).hexdigest()


def put_season_history(root: Path, username: str, career_id: str, body: dict[str, Any]) -> dict[str, Any]:
    career = _text(career_id, 'careerId')
    archive = body.get('archive') if isinstance(body, dict) else None
    managers = body.get('managerRanking') if isinstance(body, dict) else None
    if not isinstance(archive, dict):
        raise ApiError(400, 'invalid_history', 'Corpo deve incluir archive.')
    season = int(archive.get('careerSeason') or 0)
    if season < 1900:
        raise ApiError(400, 'invalid_history', 'Temporada inválida.')
    standings = archive.get('standings') or {}
    champions = archive.get('champions') or {}
    if not isinstance(standings, dict) or not isinstance(champions, dict):
        raise ApiError(400, 'invalid_history', 'Classificações ou campeões inválidos.')
    for competition, rows in standings.items():
        if not isinstance(rows, list):
            raise ApiError(400, 'invalid_history', f'Classificação {competition} inválida.')
        for row in rows:
            played = int(row.get('played') or 0)
            results = int(row.get('wins') or 0) + int(row.get('draws') or 0) + int(row.get('losses') or 0)
            if min(played, results) < 0 or played != results:
                raise ApiError(400, 'invalid_history', f'Totais inconsistentes na classificação {competition}.')
        if competition in {'A', 'B', 'C'} and rows and champions.get(competition):
            if champions[competition] != rows[0].get('club'):
                raise ApiError(409, 'champion_mismatch', f'Campeão da Série {competition} diverge da classificação.')
    expected_special = {
        'D': (archive.get('serieDCompetition') or {}).get('knockout', {}).get('champion'),
        'CUP': (archive.get('cupCompetition') or {}).get('champion'),
        'RECOPA': (archive.get('recopaCompetition') or {}).get('champion'),
        'WORLD_CUP': (archive.get('worldCupCompetition') or {}).get('champion'),
    }
    for competition, expected in expected_special.items():
        if expected and champions.get(competition) and expected != champions[competition]:
            raise ApiError(409, 'champion_mismatch', f'Campeão de {competition} diverge do torneio arquivado.')
    raw = json.dumps(archive, ensure_ascii=False, separators=(',', ':'))
    if len(raw) > 4_000_000:
        raise ApiError(413, 'history_too_large', 'Arquivo de temporada excede 4 MB.')
    digest = _checksum(archive)
    now = int(time.time())

    with _db(root) as conn:
        conn.execute(
            '''INSERT INTO career_seasons
               (username,career_id,season,user_club,user_division,checksum,payload_json,closed_at,updated_at)
               VALUES (?,?,?,?,?,?,?,?,?)
               ON CONFLICT(username,career_id,season) DO UPDATE SET
                 user_club=excluded.user_club,user_division=excluded.user_division,
                 checksum=excluded.checksum,payload_json=excluded.payload_json,
                 closed_at=excluded.closed_at,updated_at=excluded.updated_at''',
            (username, career, season, archive.get('userClub'), archive.get('userDivision'),
             digest, raw, archive.get('closedAt'), now),
        )
        conn.execute('DELETE FROM club_season_history WHERE username=? AND career_id=? AND season=?',
                     (username, career, season))
        for competition, rows in standings.items():
            for row in rows if isinstance(rows, list) else []:
                club = _text(row.get('club'), 'club', False)
                if not club:
                    continue
                conn.execute(
                    '''INSERT INTO club_season_history
                       (username,career_id,season,club_id,competition_id,games,wins,draws,losses,champion)
                       VALUES (?,?,?,?,?,?,?,?,?,?)''',
                    (username, career, season, club, str(competition), int(row.get('played') or 0),
                     int(row.get('wins') or 0), int(row.get('draws') or 0), int(row.get('losses') or 0),
                     int(champions.get(str(competition)) == club)),
                )
        conn.execute('DELETE FROM manager_season_history WHERE username=? AND career_id=? AND season=?',
                     (username, career, season))
        for manager in (managers or {}).get('managers', []) if isinstance(managers, dict) else []:
            manager_id = _text(manager.get('id'), 'managerId', False)
            if not manager_id:
                continue
            history = manager.get('careerHistory') or {}
            row = next((item for item in history.get('seasons', []) if int(item.get('season') or 0) == season), None)
            if not row:
                continue
            conn.execute(
                '''INSERT INTO manager_season_history
                   (username,career_id,season,manager_id,manager_name,clubs_json,games,wins,draws,losses,team_average,titles_json)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?)''',
                (username, career, season, manager_id, str(manager.get('name') or manager_id),
                 json.dumps(row.get('clubs') or [], ensure_ascii=False), int(row.get('games') or 0),
                 int(row.get('wins') or 0), int(row.get('draws') or 0), int(row.get('losses') or 0),
                 float(row['teamAverage']) if row.get('teamAverage') is not None else None,
                 json.dumps(row.get('titles') or [], ensure_ascii=False)),
            )
    return {'careerId': career, 'season': season, 'checksum': digest, 'stored': True}


def get_season_history(root: Path, username: str, career_id: str, season: int) -> dict[str, Any]:
    with _db(root) as conn:
        row = conn.execute(
            'SELECT payload_json,checksum FROM career_seasons WHERE username=? AND career_id=? AND season=?',
            (username, career_id, season),
        ).fetchone()
    if not row:
        raise ApiError(404, 'history_not_found', 'Histórico da temporada não encontrado.')
    return {'careerId': career_id, 'season': season, 'checksum': row['checksum'], 'archive': json.loads(row['payload_json'])}


def get_manager_history(root: Path, username: str, career_id: str, manager_id: str) -> dict[str, Any]:
    with _db(root) as conn:
        rows = conn.execute(
            '''SELECT season,manager_id,manager_name,clubs_json,games,wins,draws,losses,team_average,titles_json
               FROM manager_season_history WHERE username=? AND career_id=? AND manager_id=? ORDER BY season DESC''',
            (username, career_id, manager_id),
        ).fetchall()
    seasons = []
    for row in rows:
        item = dict(row)
        item['clubs'] = json.loads(item.pop('clubs_json'))
        item['titles'] = json.loads(item.pop('titles_json'))
        seasons.append(item)
    return {'careerId': career_id, 'managerId': manager_id, 'seasons': seasons}


def get_club_seasons(root: Path, username: str, career_id: str, club_id: str) -> dict[str, Any]:
    with _db(root) as conn:
        rows = conn.execute(
            '''SELECT season,competition_id,games,wins,draws,losses,champion
               FROM club_season_history
               WHERE username=? AND career_id=? AND club_id=?
               ORDER BY season DESC, competition_id''',
            (username, career_id, club_id),
        ).fetchall()
    return {'careerId': career_id, 'clubId': club_id, 'competitions': [dict(row) for row in rows]}


def delete_career_history(root: Path, username: str, career_id: str) -> int:
    with _db(root) as conn:
        count = conn.execute(
            'SELECT COUNT(*) FROM career_seasons WHERE username=? AND career_id=?',
            (username, career_id),
        ).fetchone()[0]
        conn.execute('DELETE FROM career_seasons WHERE username=? AND career_id=?', (username, career_id))
    return int(count)


def delete_user_history(root: Path, username: str) -> int:
    if not (root / 'career-history.sqlite3').is_file():
        return 0
    with _db(root) as conn:
        count = conn.execute(
            'SELECT COUNT(*) FROM career_seasons WHERE username=?',
            (username,),
        ).fetchone()[0]
        conn.execute('DELETE FROM career_seasons WHERE username=?', (username,))
    return int(count)
