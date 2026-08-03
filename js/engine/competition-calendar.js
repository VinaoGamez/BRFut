/**
 * Políticas de calendário por campeonato — mando de campo, persistência e matching.
 */
import { buildBrazilianLeagueFixtures } from './league-fixtures.js';
import { parseCalendarDate } from './season-scheduler.js';

/** @typedef {{ type: string, balanceHomeAway?: { enabled: boolean, maxStreak?: number, scope?: string }, persistFixtures?: boolean }} CalendarPolicy */

/** Registry de campeonatos (extensível para estadual, continental, etc.). */
export const COMPETITION_CALENDAR_POLICIES = {
  brasileirao: {
    type: 'round-robin-double',
    balanceHomeAway: { enabled: true, maxStreak: 2, scope: 'first-leg-only' },
    persistFixtures: true,
  },
  'serie-d-groups': {
    type: 'round-robin-double',
    balanceHomeAway: { enabled: true, maxStreak: 2, scope: 'first-leg-only' },
    persistFixtures: true,
  },
  'copa-brasil': {
    type: 'knockout-two-legged',
    balanceHomeAway: { enabled: false },
    persistFixtures: true,
  },
  'serie-d-knockout': {
    type: 'knockout-two-legged',
    balanceHomeAway: { enabled: false },
    persistFixtures: true,
  },
};

/** Chave estável do par (independe de home/away). */
export function fixturePairKey(home, away) {
  const a = String(home || '');
  const b = String(away || '');
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Mesmo confronto na mesma rodada/competição (mando pode diferir). */
export function sameFixturePair(a, b) {
  if (!a || !b) return false;
  const compA = a.competition || 'LEAGUE';
  const compB = b.competition || 'LEAGUE';
  if (compA !== compB) return false;
  if ((a.round ?? null) !== (b.round ?? null)) return false;
  if ((a.tieId ?? null) !== (b.tieId ?? null)) return false;
  if ((a.leg ?? null) !== (b.leg ?? null)) return false;
  return fixturePairKey(a.home, a.away) === fixturePairKey(b.home, b.away);
}

export function gameMatchesRecorded(game, recorded) {
  return sameFixturePair(game, recorded);
}

export function findRecordedGame(game, games = []) {
  if (!game || !Array.isArray(games)) return null;
  return games.find(entry => gameMatchesRecorded(game, entry)) || null;
}

/** Mesmo confronto ignorando rodada — save antigo / currentRound dessincronizado. */
export function findRecordedGameByPair(game, games = []) {
  if (!game?.home || !game?.away || !Array.isArray(games)) return null;
  const key = fixturePairKey(game.home, game.away);
  return games.find(entry => entry && fixturePairKey(entry.home, entry.away) === key) || null;
}

/**
 * Compatibilidade para saves antigos: só ignora a rodada quando um dos lados
 * realmente não a possui. Em turno e returno, rodadas distintas são jogos distintos.
 */
export function gameMatchesRecordedCompat(game, recorded) {
  if (gameMatchesRecorded(game, recorded)) return true;
  const gameRound = Number(game?.round);
  const recordedRound = Number(recorded?.round);
  if (Number.isFinite(gameRound) && gameRound > 0 && Number.isFinite(recordedRound) && recordedRound > 0) {
    return false;
  }
  return !!findRecordedGameByPair(game, [recorded]);
}

/** Localiza confronto no calendário nacional pela dupla (home/away). */
export function findLeagueFixtureByPair(game, fixtures) {
  if (!game?.home || !game?.away || !Array.isArray(fixtures)) return null;
  const key = fixturePairKey(game.home, game.away);
  const wantedRound = Number(game.round);
  const wantedId = String(game.fixtureId || game.id || '').trim();
  const matches = [];
  for (let index = 0; index < fixtures.length; index++) {
    const roundGames = fixtures[index];
    if (!Array.isArray(roundGames)) continue;
    roundGames.forEach(candidate => {
      if (!candidate || fixturePairKey(candidate.home, candidate.away) !== key) return;
      const matchRound = Number(candidate.round);
      matches.push({
        game: candidate,
        round: Number.isFinite(matchRound) && matchRound > 0 ? matchRound : index + 1,
      });
    });
  }
  if (!matches.length) return null;
  if (wantedId) {
    const byId = matches.find(item => String(item.game.fixtureId || item.game.id || '').trim() === wantedId);
    if (byId) return byId;
  }
  if (Number.isFinite(wantedRound) && wantedRound > 0) {
    const byRound = matches.find(item => item.round === wantedRound);
    if (byRound) return byRound;
  }
  const byVenue = matches.filter(item => item.game.home === game.home && item.game.away === game.away);
  if (byVenue.length === 1) return byVenue[0];
  if (matches.length === 1) return matches[0];
  // Ambíguo sem id/rodada/mando: preserva compatibilidade, mas nunca escolhe
  // silenciosamente o primeiro turno quando há um candidato pendente inequívoco.
  const pending = matches.filter(item => !item.game.completed && item.game.homeGoals == null);
  return pending.length === 1 ? pending[0] : matches[0];
}

/** Rodada do confronto — usa `game.round` ou posição no calendário nacional. */
export function resolveLeagueFixtureRound(game, fixtures) {
  const direct = Number(game?.round);
  if (Number.isFinite(direct) && direct > 0) return direct;
  if (!game?.home || !game?.away || !Array.isArray(fixtures)) return null;
  for (let index = 0; index < fixtures.length; index++) {
    const roundGames = fixtures[index];
    if (!Array.isArray(roundGames)) continue;
    const match = roundGames.find(
      candidate =>
        candidate &&
        fixturePairKey(candidate.home, candidate.away) === fixturePairKey(game.home, game.away),
    );
    if (match) {
      const matchRound = Number(match.round);
      return Number.isFinite(matchRound) && matchRound > 0 ? matchRound : index + 1;
    }
  }
  return null;
}

/** Garante `round` em rodadas de grupos (save antigo / merge incompleto). */
export function ensureNationalFixtureRounds(fixtures, { groupRounds = 10 } = {}) {
  if (!Array.isArray(fixtures)) return false;
  let changed = false;
  fixtures.slice(0, groupRounds).forEach((roundGames, roundIndex) => {
    if (!Array.isArray(roundGames)) return;
    const targetRound = roundIndex + 1;
    roundGames.forEach(game => {
      if (!game || typeof game !== 'object') return;
      if (Number(game.round) !== targetRound) {
        game.round = targetRound;
        changed = true;
      }
    });
  });
  return changed;
}

export function getCalendarPolicy(competitionKey) {
  return COMPETITION_CALENDAR_POLICIES[competitionKey] || COMPETITION_CALENDAR_POLICIES.brasileirao;
}

/**
 * Pontos corridos com política do campeonato (Brasileirão, grupos Série D).
 * @param {string[]} clubList
 * @param {string} competitionKey
 */
export function buildCompetitionRoundRobinFixtures(clubList, competitionKey = 'brasileirao') {
  const policy = getCalendarPolicy(competitionKey);
  const balance = policy.balanceHomeAway;
  const options = {
    balanceHomeAway: balance?.enabled !== false,
    maxHomeAwayStreak: balance?.maxStreak ?? 2,
    balanceScope: balance?.scope || 'first-leg-only',
  };
  return buildBrazilianLeagueFixtures(clubList, options);
}

/** Slim para save — identidade do confronto + data materializada. */
export function slimNationalFixturesForSave(fixtures) {
  if (!Array.isArray(fixtures)) return [];
  return fixtures.map(round => {
    if (!Array.isArray(round)) return [];
    return round.map(game => ({
      home: game.home,
      away: game.away,
      round: game.round ?? null,
      competition: game.competition || null,
      date: game.date instanceof Date ? game.date.toISOString() : (game.date || null),
      time: game.time || null,
    }));
  });
}

/** Restaura rodadas salvas (validação mínima). */
export function hydrateNationalFixtures(saved, expectedRounds = null) {
  if (!Array.isArray(saved)) return null;
  if (expectedRounds != null && saved.length !== expectedRounds) return null;
  const hydrated = saved.map(round => {
    if (!Array.isArray(round)) return [];
    return round
      .filter(game => game?.home && game?.away)
      .map(game => ({
        home: game.home,
        away: game.away,
        round: game.round ?? null,
        competition: game.competition || null,
        date: parseCalendarDate(game.date),
        time: game.time || null,
      }));
  });
  if (!hydrated.some(round => round.length > 0)) return null;
  return hydrated;
}

/** Mescla rodada salva (mata-mata) preservando date/time materializados. */
export function mergeSerieDFixtureRound(existing, saved) {
  if (!Array.isArray(saved)) return existing;
  const hydrated = saved
    .filter(game => game?.home && game?.away)
    .map(game => ({
      ...game,
      date: parseCalendarDate(game.date),
      time: game.time || null,
    }));
  if (!Array.isArray(existing)) return hydrated;
  return hydrated.map(savedGame => {
    const match =
      existing.find(entry => gameMatchesRecorded(entry, savedGame))
      || existing.find(
        entry =>
          savedGame.tieId
          && entry.tieId === savedGame.tieId
          && (entry.leg || '') === (savedGame.leg || ''),
      );
    if (!match) return savedGame;
    return {
      ...match,
      ...savedGame,
      date: parseCalendarDate(savedGame.date) || parseCalendarDate(match.date),
      time: savedGame.time || match.time,
    };
  });
}

/** Aplica dFixtures do save nas rodadas ≥ fase de grupos (preserva agenda materializada). */
export function applySavedSerieDFixtures(fixtures, savedRounds, groupRounds = 10) {
  if (!Array.isArray(fixtures) || !Array.isArray(savedRounds)) return fixtures;
  savedRounds.forEach((round, index) => {
    if (index < groupRounds || !Array.isArray(round)) return;
    fixtures[index] = mergeSerieDFixtureRound(fixtures[index], round);
  });
  return fixtures;
}
