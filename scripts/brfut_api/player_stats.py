"""Estatísticas normalizadas e idempotentes por carreira (SQLite)."""
from __future__ import annotations

import json
import hashlib
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Any

from .auth import ApiError


@contextmanager
def _db(root: Path):
    path = root / 'player-stats.sqlite3'
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA journal_mode=WAL')
    conn.execute('PRAGMA foreign_keys=ON')
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS stats_matches (
          username TEXT NOT NULL,
          career_id TEXT NOT NULL,
          fixture_id TEXT NOT NULL,
          season INTEGER NOT NULL,
          competition_id TEXT NOT NULL,
          round_label TEXT,
          home_club TEXT NOT NULL,
          away_club TEXT NOT NULL,
          home_goals INTEGER NOT NULL,
          away_goals INTEGER NOT NULL,
          played_at TEXT,
          checksum TEXT,
          payload_json TEXT NOT NULL,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (username, career_id, fixture_id)
        );
        CREATE TABLE IF NOT EXISTS player_match_stats (
          username TEXT NOT NULL,
          career_id TEXT NOT NULL,
          fixture_id TEXT NOT NULL,
          player_id TEXT NOT NULL,
          player_name TEXT NOT NULL,
          club_id TEXT NOT NULL,
          season INTEGER NOT NULL,
          competition_id TEXT NOT NULL,
          started INTEGER NOT NULL DEFAULT 0,
          minutes INTEGER NOT NULL DEFAULT 0,
          goals INTEGER NOT NULL DEFAULT 0,
          assists INTEGER NOT NULL DEFAULT 0,
          own_goals INTEGER NOT NULL DEFAULT 0,
          yellow INTEGER NOT NULL DEFAULT 0,
          red INTEGER NOT NULL DEFAULT 0,
          passes INTEGER NOT NULL DEFAULT 0,
          rating REAL,
          PRIMARY KEY (username, career_id, fixture_id, player_id),
          FOREIGN KEY (username, career_id, fixture_id)
            REFERENCES stats_matches(username, career_id, fixture_id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_player_stats_lookup
          ON player_match_stats(username, career_id, season, player_id);
        CREATE INDEX IF NOT EXISTS idx_player_stats_club
          ON player_match_stats(username, career_id, season, club_id, competition_id);
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


def _safe_id(value: Any, label: str) -> str:
    text = str(value or '').strip()
    if not text or len(text) > 180:
        raise ApiError(400, 'invalid_stats', f'{label} inválido.')
    return text


def _bounded_int(value: Any, label: str, minimum: int = 0, maximum: int = 1_000_000) -> int:
    try:
        number = int(value or 0)
    except (TypeError, ValueError) as error:
        raise ApiError(400, 'invalid_stats', f'{label} inválido.') from error
    if number < minimum or number > maximum:
        raise ApiError(400, 'invalid_stats', f'{label} fora do intervalo permitido.')
    return number


def _match_checksum(match: dict[str, Any]) -> str:
    canonical = {key: value for key, value in match.items() if key != 'checksum'}
    raw = json.dumps(canonical, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode('utf-8')
    return hashlib.sha256(raw).hexdigest()


def put_match_batch(root: Path, username: str, career_id: str, body: dict[str, Any]) -> dict[str, Any]:
    career = _safe_id(career_id, 'careerId')
    matches = body.get('matches') if isinstance(body, dict) else None
    if not isinstance(matches, list) or not matches:
        raise ApiError(400, 'invalid_stats', 'Corpo deve incluir matches.')
    if len(matches) > 100:
        raise ApiError(413, 'stats_batch_too_large', 'Máximo de 100 partidas por lote.')

    accepted = 0
    with _db(root) as conn:
        for match in matches:
            fixture = _safe_id(match.get('fixtureId'), 'fixtureId')
            season = int(match.get('season') or 0)
            competition = _safe_id(match.get('competitionId') or 'ALL', 'competitionId')
            home = _safe_id(match.get('homeClub'), 'homeClub')
            away = _safe_id(match.get('awayClub'), 'awayClub')
            players = match.get('players') or []
            if season < 1900 or not isinstance(players, list) or home == away:
                raise ApiError(400, 'invalid_stats', 'Temporada ou jogadores inválidos.')
            home_goals = _bounded_int(match.get('homeGoals'), 'homeGoals', 0, 99)
            away_goals = _bounded_int(match.get('awayGoals'), 'awayGoals', 0, 99)
            checksum = _match_checksum(match)
            now = int(time.time())
            payload = json.dumps(match, ensure_ascii=False, separators=(',', ':'))
            conn.execute(
                """INSERT INTO stats_matches
                   (username,career_id,fixture_id,season,competition_id,round_label,
                    home_club,away_club,home_goals,away_goals,played_at,checksum,payload_json,updated_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                   ON CONFLICT(username,career_id,fixture_id) DO UPDATE SET
                     season=excluded.season, competition_id=excluded.competition_id,
                     round_label=excluded.round_label, home_club=excluded.home_club,
                     away_club=excluded.away_club, home_goals=excluded.home_goals,
                     away_goals=excluded.away_goals, played_at=excluded.played_at,
                     checksum=excluded.checksum, payload_json=excluded.payload_json,
                     updated_at=excluded.updated_at""",
                (
                    username, career, fixture, season, competition, str(match.get('round') or ''),
                    home, away, home_goals, away_goals,
                    match.get('playedAt'), checksum, payload, now,
                ),
            )
            conn.execute(
                'DELETE FROM player_match_stats WHERE username=? AND career_id=? AND fixture_id=?',
                (username, career, fixture),
            )
            player_ids: set[str] = set()
            for row in players:
                player_id = _safe_id(row.get('playerId'), 'playerId')
                if player_id in player_ids:
                    raise ApiError(400, 'duplicate_player', f'Jogador duplicado na partida: {player_id}.')
                player_ids.add(player_id)
                club_id = _safe_id(row.get('clubId'), 'clubId')
                if club_id not in {home, away}:
                    raise ApiError(400, 'invalid_player_club', 'Jogador pertence a um clube fora da partida.')
                minutes = _bounded_int(row.get('minutes'), 'minutes', 0, 200)
                rating = float(row['rating']) if row.get('rating') is not None else None
                if rating is not None and not 0 <= rating <= 10:
                    raise ApiError(400, 'invalid_stats', 'Nota do jogador fora do intervalo permitido.')
                conn.execute(
                    """INSERT INTO player_match_stats
                       (username,career_id,fixture_id,player_id,player_name,club_id,season,
                        competition_id,started,minutes,goals,assists,own_goals,yellow,red,passes,rating)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (
                        username, career, fixture, player_id, str(row.get('name') or player_id),
                        club_id, season, competition,
                        int(bool(row.get('started'))), minutes,
                        _bounded_int(row.get('goals'), 'goals', 0, 99),
                        _bounded_int(row.get('assists'), 'assists', 0, 99),
                        _bounded_int(row.get('ownGoals'), 'ownGoals', 0, 99), int(bool(row.get('yellow'))),
                        int(bool(row.get('red'))), _bounded_int(row.get('passes'), 'passes'),
                        rating,
                    ),
                )
            accepted += 1
    return {'accepted': accepted, 'careerId': career}


def get_match_manifest(
    root: Path, username: str, career_id: str, season: int | None = None,
) -> dict[str, Any]:
    where = 'username=? AND career_id=?'
    args: list[Any] = [username, career_id]
    if season:
        where += ' AND season=?'
        args.append(season)
    with _db(root) as conn:
        rows = conn.execute(
            f'''SELECT fixture_id,season,competition_id,home_club,away_club,
                       home_goals,away_goals,played_at,checksum,updated_at
                FROM stats_matches WHERE {where}
                ORDER BY season, played_at, fixture_id''',
            args,
        ).fetchall()
    return {'careerId': career_id, 'season': season, 'matches': [dict(row) for row in rows]}


def get_club_history(root: Path, username: str, career_id: str, club_id: str) -> dict[str, Any]:
    with _db(root) as conn:
        rows = conn.execute(
            '''SELECT season, competition_id,
                      COUNT(*) games,
                      SUM(CASE WHEN (home_club=? AND home_goals>away_goals) OR
                                         (away_club=? AND away_goals>home_goals) THEN 1 ELSE 0 END) wins,
                      SUM(CASE WHEN home_goals=away_goals THEN 1 ELSE 0 END) draws,
                      SUM(CASE WHEN (home_club=? AND home_goals<away_goals) OR
                                         (away_club=? AND away_goals<home_goals) THEN 1 ELSE 0 END) losses
               FROM stats_matches
               WHERE username=? AND career_id=? AND (home_club=? OR away_club=?)
               GROUP BY season, competition_id ORDER BY season DESC, competition_id''',
            (club_id, club_id, club_id, club_id, username, career_id, club_id, club_id),
        ).fetchall()
    return {'careerId': career_id, 'clubId': club_id, 'competitions': [dict(row) for row in rows]}


_AGG_SQL = """
SELECT player_id, competition_id, MAX(player_name) player_name, MAX(club_id) club_id,
       COUNT(*) apps, SUM(started) starts, SUM(minutes) minutes,
       SUM(goals) goals, SUM(assists) assists, SUM(own_goals) own_goals,
       SUM(yellow) yellow, SUM(red) red, SUM(passes) passes,
       ROUND(AVG(rating) * 2) / 2.0 avg_rating, COUNT(rating) rating_count
FROM player_match_stats
WHERE username=? AND career_id=? AND season=?
"""


def _competition_clause(competition: str | None) -> tuple[str, list[Any]]:
    return (' AND competition_id=?', [competition]) if competition else ('', [])


def get_player(
    root: Path, username: str, career_id: str, player_id: str, season: int,
    club_id: str | None = None,
) -> dict[str, Any]:
    club_clause = ' AND club_id=?' if club_id else ''
    args: tuple[Any, ...] = (username, career_id, season, player_id, *([club_id] if club_id else []))
    with _db(root) as conn:
        rows = conn.execute(
            _AGG_SQL + ' AND player_id=?' + club_clause + ' GROUP BY competition_id ORDER BY competition_id',
            args,
        ).fetchall()
        total = conn.execute(
            _AGG_SQL + ' AND player_id=?' + club_clause + ' GROUP BY player_id',
            args,
        ).fetchone()
    return {
        'playerId': player_id,
        'season': season,
        'clubId': club_id,
        'total': dict(total) if total else None,
        'competitions': [dict(row) for row in rows],
    }


def get_club_squad(
    root: Path, username: str, career_id: str, club_id: str, season: int, competition: str | None,
) -> dict[str, Any]:
    clause, args = _competition_clause(competition)
    sql = _AGG_SQL + ' AND club_id=?' + clause + ' GROUP BY player_id ORDER BY apps DESC, player_name'
    with _db(root) as conn:
        rows = conn.execute(sql, (username, career_id, season, club_id, *args)).fetchall()
    return {'clubId': club_id, 'season': season, 'competitionId': competition, 'players': [dict(r) for r in rows]}


def get_leaders(
    root: Path, username: str, career_id: str, season: int, competition: str | None, metric: str,
) -> dict[str, Any]:
    allowed = {'goals', 'assists', 'apps', 'minutes', 'yellow', 'red', 'avg_rating'}
    if metric not in allowed:
        raise ApiError(400, 'invalid_metric', 'Métrica inválida.')
    clause, args = _competition_clause(competition)
    sql = _AGG_SQL + clause + f' GROUP BY player_id ORDER BY {metric} DESC, apps ASC LIMIT 100'
    with _db(root) as conn:
        rows = conn.execute(sql, (username, career_id, season, *args)).fetchall()
    return {'season': season, 'competitionId': competition, 'metric': metric, 'leaders': [dict(r) for r in rows]}


def delete_career_stats(root: Path, username: str, career_id: str) -> int:
    with _db(root) as conn:
        count = conn.execute(
            'SELECT COUNT(*) FROM stats_matches WHERE username=? AND career_id=?',
            (username, career_id),
        ).fetchone()[0]
        conn.execute(
            'DELETE FROM stats_matches WHERE username=? AND career_id=?',
            (username, career_id),
        )
    return int(count)


def delete_user_stats(root: Path, username: str) -> int:
    if not (root / 'player-stats.sqlite3').is_file():
        return 0
    with _db(root) as conn:
        count = conn.execute(
            'SELECT COUNT(*) FROM stats_matches WHERE username=?',
            (username,),
        ).fetchone()[0]
        conn.execute('DELETE FROM stats_matches WHERE username=?', (username,))
    return int(count)
