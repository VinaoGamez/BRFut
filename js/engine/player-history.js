/**
 * Histórico de jogadores (todos os clubes) — sobrevive a clearSeasonSave.
 * Chave: brfut-player-history (legado matchday-player-history)
 *
 * matchLogs = buffer só da temporada corrente (cap ≈ nº de jogos do calendário).
 * No finalizeSeason os logs são apagados; permanece players.*.seasons (médias).
 */
import { SAVE_KEYS, SAVE_VERSION, MODULE_VERSIONS, CAREER_INDEX_KEY, ACTIVE_SLOT_SESSION_KEY, slotBundleKeys } from '../core/constants.js';
import { isLocalStorageCheckpoint } from '../core/local-save-checkpoint.js';
import { readJson, writeJson, getStoragePressure, prepareStorageForSave } from '../core/save.js';
import { buildMatchPlayerSheets, playerKey } from './player-match-stats.js';

export const PLAYER_HISTORY_LIMITS = {
  /** Teto de segurança — relatórios usam só jogos recentes da temporada. */
  maxMatchLogsPerSeason: 320,
  maxSeasonArchives: 8,
  maxPlayersSoft: 2500,
};

/** @deprecated use maxMatchLogsPerSeason — mantido para leitores antigos/testes. */
Object.defineProperty(PLAYER_HISTORY_LIMITS, 'maxMatchLogs', {
  enumerable: true,
  get: () => PLAYER_HISTORY_LIMITS.maxMatchLogsPerSeason,
});

const emptyStore = (season = null) => ({
  version: SAVE_VERSION.playerHistory || 1,
  statsModelVersion: 2,
  players: {},
  season: season ?? null,
  matchLogs: [],
  seasonArchives: [],
});

function migrateCompetitionBuckets(store) {
  if (Number(store?.statsModelVersion) >= 2) return store;
  (store.matchLogs || []).forEach(log => {
    const competitionId = normalizeStatsCompetitionId(log.competition);
    (log.players || []).forEach(sheet => {
      const player = store.players?.[sheet.key];
      const seasonBucket = player?.seasons?.[String(log.season)];
      if (!seasonBucket) return;
      if (!seasonBucket.competitions || typeof seasonBucket.competitions !== 'object') {
        seasonBucket.competitions = {};
      }
      if (!seasonBucket.competitions[competitionId]) {
        seasonBucket.competitions[competitionId] = { ...emptyStatBucket(), clubs: {} };
      }
      applySheetToBucket(seasonBucket.competitions[competitionId], sheet);
      if (!seasonBucket.clubs || typeof seasonBucket.clubs !== 'object') seasonBucket.clubs = {};
      if (!seasonBucket.clubs[sheet.club]) seasonBucket.clubs[sheet.club] = emptyStatBucket();
      applySheetToBucket(seasonBucket.clubs[sheet.club], sheet);
      const comp = seasonBucket.competitions[competitionId];
      if (!comp.clubs[sheet.club]) comp.clubs[sheet.club] = emptyStatBucket();
      applySheetToBucket(comp.clubs[sheet.club], sheet);
    });
  });
  Object.values(store.players || {}).forEach(player => {
    Object.values(player?.seasons || {}).forEach(bucket => {
      if (!bucket.competitions || typeof bucket.competitions !== 'object') bucket.competitions = {};
      if (!bucket.clubs || typeof bucket.clubs !== 'object') bucket.clubs = {};
    });
  });
  store.statsModelVersion = 2;
  return store;
}

function slimLeaders(list, metric, limit = 5) {
  return (list || [])
    .filter(row => (Number(row?.[metric]) || 0) > 0)
    .slice(0, limit)
    .map(row => ({
      name: row.name,
      club: row.club,
      [metric]: Number(row[metric]) || 0,
    }));
}

function ensureSeasonBucket(player, year) {
  const key = String(year);
  if (!player.seasons[key]) {
    player.seasons[key] = {
      apps: 0,
      starts: 0,
      minutes: 0,
      goals: 0,
      assists: 0,
      yellow: 0,
      red: 0,
      passesEst: 0,
      ratingSum: 0,
      ratingCount: 0,
      competitions: {},
      clubs: {},
    };
  }
  if (!player.seasons[key].competitions || typeof player.seasons[key].competitions !== 'object') {
    player.seasons[key].competitions = {};
  }
  if (!player.seasons[key].clubs || typeof player.seasons[key].clubs !== 'object') {
    player.seasons[key].clubs = {};
  }
  return player.seasons[key];
}

function emptyStatBucket() {
  return {
    apps: 0,
    starts: 0,
    minutes: 0,
    goals: 0,
    assists: 0,
    yellow: 0,
    red: 0,
    passesEst: 0,
    ratingSum: 0,
    ratingCount: 0,
  };
}

export function normalizeStatsCompetitionId(value, fallbackDivision = null) {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw || raw === 'LEAGUE') return fallbackDivision ? `LEAGUE:${fallbackDivision}` : 'LEAGUE';
  if (raw.includes('COPA DO BRASIL')) return 'CBR';
  if (raw.includes('COPA DO MUNDO') || raw === 'CMU') return 'CMU';
  if (raw.includes('RECOPA')) return 'RECOPA';
  if (raw.startsWith('LEAGUE:')) return raw;
  if (raw.includes('ESTADUAL')) return raw.replace(/\s+/g, ':');
  return raw.replace(/\s+/g, ':');
}

export function buildStatsFixtureId(game, {
  season,
  competitionId = null,
  round = null,
  leg = null,
} = {}) {
  if (game?.fixtureId) return String(game.fixtureId);
  const competition = normalizeStatsCompetitionId(competitionId || game?.competition || 'LEAGUE');
  const clean = value => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return [
    Number(season) || 'season',
    clean(competition),
    clean(round ?? game?.round ?? game?.phaseIndex ?? 'x'),
    clean(game?.home),
    clean(game?.away),
    clean(leg || game?.leg || 'single'),
    clean(game?.gameNumber || game?.date || ''),
  ].join(':');
}

function applySheetToBucket(bucket, sheet) {
  bucket.apps += 1;
  if (sheet.started) bucket.starts += 1;
  bucket.minutes += Number(sheet.minutes) || 0;
  bucket.goals += Number(sheet.goals) || 0;
  bucket.assists += Number(sheet.assists) || 0;
  if (sheet.yellow) bucket.yellow += 1;
  if (sheet.red) bucket.red += 1;
  bucket.passesEst += Number(sheet.passesEst) || 0;
  if (sheet.rating != null) {
    bucket.ratingSum += Number(sheet.rating) || 0;
    bucket.ratingCount += 1;
  }
}

function applySheetToSeason(player, year, sheet, competitionId) {
  const bucket = ensureSeasonBucket(player, year);
  applySheetToBucket(bucket, sheet);
  if (!bucket.clubs[sheet.club]) bucket.clubs[sheet.club] = emptyStatBucket();
  applySheetToBucket(bucket.clubs[sheet.club], sheet);
  const key = normalizeStatsCompetitionId(competitionId);
  if (!bucket.competitions[key]) bucket.competitions[key] = { ...emptyStatBucket(), clubs: {} };
  if (!bucket.competitions[key].clubs) bucket.competitions[key].clubs = {};
  applySheetToBucket(bucket.competitions[key], sheet);
  if (!bucket.competitions[key].clubs[sheet.club]) {
    bucket.competitions[key].clubs[sheet.club] = emptyStatBucket();
  }
  applySheetToBucket(bucket.competitions[key].clubs[sheet.club], sheet);
}

/** Fonte única para card, elenco, dashboard e rankings. */
export function resolvePlayerSeasonStats(
  storeOrEngine,
  playerOrKey,
  season,
  competitionId = null,
  { clubId = null } = {},
) {
  const store = storeOrEngine?.getStore?.() || storeOrEngine;
  const key = typeof playerOrKey === 'string' ? playerOrKey : playerKey(playerOrKey);
  const seasonBucket = store?.players?.[key]?.seasons?.[String(season)] || null;
  if (!seasonBucket) return null;
  let bucket = competitionId
    ? seasonBucket.competitions?.[normalizeStatsCompetitionId(competitionId)] || null
    : seasonBucket;
  if (bucket && clubId) bucket = bucket.clubs?.[clubId] || null;
  if (!bucket) return null;
  return {
    ...bucket,
    avgRating: bucket.avgRating != null ? Number(bucket.avgRating) : seasonAverageRating(bucket),
  };
}

export function playerSeasonLeaderboard(
  storeOrEngine,
  { season, competitionId = null, metric = 'goals', clubNames = null, getClub = null } = {},
) {
  const store = storeOrEngine?.getStore?.() || storeOrEngine;
  const allowed = new Set(['apps', 'minutes', 'goals', 'assists', 'yellow', 'red', 'avgRating']);
  const field = allowed.has(metric) ? metric : 'goals';
  const clubs = clubNames ? new Set(clubNames) : null;
  const rows = [];
  Object.entries(store?.players || {}).forEach(([key, record]) => {
    const seasonBucket = record?.seasons?.[String(season)];
    const baseBucket = competitionId
      ? seasonBucket?.competitions?.[normalizeStatsCompetitionId(competitionId)]
      : seasonBucket;
    const clubIds = Object.keys(baseBucket?.clubs || {});
    const scopes = clubIds.length ? clubIds : [record?.club].filter(Boolean);
    scopes.forEach(clubId => {
      if (clubs && !clubs.has(clubId)) return;
      const stats = resolvePlayerSeasonStats(store, key, season, competitionId, { clubId })
        || resolvePlayerSeasonStats(store, key, season, competitionId);
      const value = Number(stats?.[field]) || 0;
      if (!(value > 0)) return;
      const club = typeof getClub === 'function' ? getClub(clubId) : null;
      rows.push({
        key,
        name: record.name || '—',
        club: clubId || '—',
        division: club?.division || null,
        games: Number(stats.apps) || 0,
        goals: Number(stats.goals) || 0,
        assists: Number(stats.assists) || 0,
        avgRating: stats.avgRating,
        [field]: value,
      });
    });
  });
  return rows.sort(
    (a, b) => (Number(b[field]) || 0) - (Number(a[field]) || 0) || a.games - b.games || a.name.localeCompare(b.name),
  );
}

/** Média da temporada (passo 0.5), ou null se não houver notas. */
export function seasonAverageRating(bucket) {
  const count = Number(bucket?.ratingCount) || 0;
  if (count <= 0) return null;
  const avg = (Number(bucket.ratingSum) || 0) / count;
  return Math.max(1, Math.min(10, Math.round(avg * 2) / 2));
}

function roundRatingValue(avg) {
  if (avg == null || !Number.isFinite(Number(avg))) return null;
  return Math.max(1, Math.min(10, Math.round(Number(avg) * 2) / 2));
}

function roundSeasonAverage(sum, count) {
  if (!count) return null;
  return roundRatingValue(sum / count);
}

function averageFromRatingBuckets(buckets) {
  let sum = 0;
  let count = 0;
  (buckets || []).forEach(bucket => {
    const c = Number(bucket?.ratingCount) || 0;
    if (c <= 0) return;
    sum += Number(bucket.ratingSum) || 0;
    count += c;
  });
  return roundSeasonAverage(sum, count);
}

function clubRatingsFromMatchLog(log, clubName) {
  let sum = 0;
  let count = 0;
  (log.players || []).forEach(sheet => {
    if (sheet.club !== clubName || sheet.rating == null) return;
    sum += Number(sheet.rating) || 0;
    count += 1;
  });
  if (!count) return null;
  return { sum, count, average: sum / count };
}

/**
 * Resumo da média do time na temporada.
 *
 * Fórmula (preferencial, por partida):
 * 1) Em cada jogo, NotaPartida = média das notas Brasfoot de todos os jogadores do clube em campo.
 * 2) MédiaTemporada = média aritmética das NotaPartida (cada partida pesa igual).
 * Após 1 jogo, o valor exibido é a NotaPartida desse jogo.
 */
export function clubSeasonRatingSummary(store, clubName, season, { getClub } = {}) {
  if (!clubName || !store) return { average: null, matches: 0, appearances: 0, method: 'none' };

  const logs = Array.isArray(store.matchLogs) ? store.matchLogs : [];
  const year = season != null ? Number(season) : null;
  const matchAverages = [];
  let appearances = 0;

  logs.forEach(log => {
    if (year != null && Number(log.season) !== year) return;
    if (log.home !== clubName && log.away !== clubName) return;
    const match = clubRatingsFromMatchLog(log, clubName);
    if (!match) return;
    matchAverages.push(match.average);
    appearances += match.count;
  });

  if (matchAverages.length > 0) {
    const avg = matchAverages.reduce((total, value) => total + value, 0) / matchAverages.length;
    return {
      average: roundRatingValue(avg),
      matches: matchAverages.length,
      appearances,
      method: 'per-match',
    };
  }

  const seasonKey = year != null ? String(year) : null;
  if (!seasonKey) return { average: null, matches: 0, appearances: 0, method: 'none' };

  const club = typeof getClub === 'function' ? getClub(clubName) : null;
  const rosterKeys = new Set();
  const rosterNames = new Set();
  (club?.roster || []).forEach(player => {
    const key = playerKey(player);
    if (key) rosterKeys.add(key);
    if (player?.name) rosterNames.add(player.name);
  });

  if (club?.roster?.length) {
    const rosterBuckets = club.roster
      .map(player => store?.players?.[playerKey(player)]?.seasons?.[seasonKey])
      .filter(Boolean);
    const average = averageFromRatingBuckets(rosterBuckets);
    const apps = rosterBuckets.reduce((total, bucket) => total + (Number(bucket?.ratingCount) || 0), 0);
    if (average != null) {
      return { average, matches: 0, appearances: apps, method: 'roster-fallback' };
    }
  }

  const clubBuckets = Object.entries(store?.players || {})
    .filter(([key, player]) =>
      player?.club === clubName || rosterKeys.has(key) || rosterNames.has(player?.name),
    )
    .map(([, player]) => player.seasons?.[seasonKey])
    .filter(Boolean);
  const average = averageFromRatingBuckets(clubBuckets);
  const apps = clubBuckets.reduce((total, bucket) => total + (Number(bucket?.ratingCount) || 0), 0);
  if (average != null) {
    return { average, matches: 0, appearances: apps, method: 'club-fallback' };
  }

  return { average: null, matches: 0, appearances: 0, method: 'none' };
}

/** Média das notas do elenco nos jogos disputados na temporada. */
export function clubSeasonAverageRating(store, clubName, season, options = {}) {
  return clubSeasonRatingSummary(store, clubName, season, options).average;
}

/** Artilheiro e assistências do clube/seleção a partir do histórico por jogador. */
export function clubSeasonLeadersFromHistory(store, clubName, season, { getClub } = {}) {
  const empty = { scorer: { name: '—' }, goals: 0, assistant: { name: '—' }, assists: 0 };
  if (!clubName || !store) return empty;

  const year = season != null ? String(season) : null;
  if (!year) return empty;

  const scorerRows = playerSeasonLeaderboard(store, {
    season,
    metric: 'goals',
    clubNames: [clubName],
    getClub,
  });
  const assistantRows = playerSeasonLeaderboard(store, {
    season,
    metric: 'assists',
    clubNames: [clubName],
    getClub,
  });
  if (scorerRows.length || assistantRows.length) {
    return {
      scorer: scorerRows[0] || { name: '—' },
      goals: Number(scorerRows[0]?.goals) || 0,
      assistant: assistantRows[0] || { name: '—' },
      assists: Number(assistantRows[0]?.assists) || 0,
    };
  }

  const club = typeof getClub === 'function' ? getClub(clubName) : null;
  const rosterKeys = new Set();
  const rosterNames = new Set();
  (club?.roster || []).forEach(player => {
    const key = playerKey(player);
    if (key) rosterKeys.add(key);
    if (player?.name) rosterNames.add(player.name);
  });

  const belongsToClub = (key, player) =>
    player?.club === clubName || rosterKeys.has(key) || rosterNames.has(player?.name);

  let bestScorer = null;
  let bestAssistant = null;

  Object.entries(store.players || {}).forEach(([key, player]) => {
    if (!belongsToClub(key, player)) return;
    const bucket = player.seasons?.[year];
    if (!bucket) return;
    const goals = Number(bucket.goals) || 0;
    const assists = Number(bucket.assists) || 0;
    const apps = Number(bucket.apps) || 0;
    if (
      goals > 0 &&
      (!bestScorer ||
        goals > bestScorer.goals ||
        (goals === bestScorer.goals && apps < bestScorer.apps))
    ) {
      bestScorer = { name: player.name || '—', goals, apps };
    }
    if (
      assists > 0 &&
      (!bestAssistant ||
        assists > bestAssistant.assists ||
        (assists === bestAssistant.assists && apps < bestAssistant.apps))
    ) {
      bestAssistant = { name: player.name || '—', assists, apps };
    }
  });

  if (!bestScorer || !bestAssistant) {
    const goalsByName = new Map();
    const assistsByName = new Map();
    const appsByName = new Map();
    (store.matchLogs || []).forEach(log => {
      if (Number(log.season) !== Number(year)) return;
      if (log.home !== clubName && log.away !== clubName) return;
      (log.players || []).forEach(sheet => {
        if (sheet.club !== clubName) return;
        const goals = Number(sheet.goals) || 0;
        const assists = Number(sheet.assists) || 0;
        if (goals > 0) goalsByName.set(sheet.name, (goalsByName.get(sheet.name) || 0) + goals);
        if (assists > 0) assistsByName.set(sheet.name, (assistsByName.get(sheet.name) || 0) + assists);
        appsByName.set(sheet.name, (appsByName.get(sheet.name) || 0) + 1);
      });
    });
    goalsByName.forEach((goals, name) => {
      const apps = appsByName.get(name) || 0;
      if (
        !bestScorer ||
        goals > bestScorer.goals ||
        (goals === bestScorer.goals && apps < bestScorer.apps)
      ) {
        bestScorer = { name, goals, apps };
      }
    });
    assistsByName.forEach((assists, name) => {
      const apps = appsByName.get(name) || 0;
      if (
        !bestAssistant ||
        assists > bestAssistant.assists ||
        (assists === bestAssistant.assists && apps < bestAssistant.apps)
      ) {
        bestAssistant = { name, assists, apps };
      }
    });
  }

  return {
    scorer: bestScorer || { name: '—' },
    goals: bestScorer?.goals || 0,
    assistant: bestAssistant || { name: '—' },
    assists: bestAssistant?.assists || 0,
  };
}

function enrichRoundGameFromUserStats(game, userStats, clubName) {
  if (!game || !userStats || (game.home !== clubName && game.away !== clubName)) return game;
  const userSide = game.home === clubName ? 'home' : 'away';
  const liveHome = userStats.home || {};
  const liveAway = userStats.away || {};
  const data =
    game.data ||
    (userSide === 'home'
      ? {
          homePasses: Number(liveHome.passes) || 0,
          awayPasses: Number(liveAway.passes) || 0,
          homeShots: Number(liveHome.shots) || 0,
          awayShots: Number(liveAway.shots) || 0,
          homeOnTarget: Number(liveHome.on) || 0,
          awayOnTarget: Number(liveAway.on) || 0,
          homeKeeperSaves: Number(liveHome.keeperSaves ?? liveHome.saved) || 0,
          awayKeeperSaves: Number(liveAway.keeperSaves ?? liveAway.saved) || 0,
          homeYellow: Number(liveHome.yellow) || 0,
          awayYellow: Number(liveAway.yellow) || 0,
          homeRed: Number(liveHome.red) || 0,
          awayRed: Number(liveAway.red) || 0,
        }
      : {
          homePasses: Number(liveHome.passes) || 0,
          awayPasses: Number(liveAway.passes) || 0,
          homeShots: Number(liveHome.shots) || 0,
          awayShots: Number(liveAway.shots) || 0,
          homeOnTarget: Number(liveHome.on) || 0,
          awayOnTarget: Number(liveAway.on) || 0,
          homeKeeperSaves: Number(liveHome.keeperSaves ?? liveHome.saved) || 0,
          awayKeeperSaves: Number(liveAway.keeperSaves ?? liveAway.saved) || 0,
          homeYellow: Number(liveHome.yellow) || 0,
          awayYellow: Number(liveAway.yellow) || 0,
          homeRed: Number(liveHome.red) || 0,
          awayRed: Number(liveAway.red) || 0,
        });
  return {
    ...game,
    goals: userStats.goals || game.goals,
    data,
    completed: game.completed !== false,
  };
}

/** Reconstrói matchLogs a partir do histórico de rodadas (saves anteriores ao histórico por jogo). */
export function backfillClubSeasonMatchLogs(
  engine,
  { clubName, season, roundHistory = [], extraGames = [], competitionForRound = () => 'LEAGUE' } = {},
) {
  if (!engine?.recordMatch || !clubName || season == null) return 0;
  const year = Number(season);
  if (!Number.isFinite(year)) return 0;
  const knownIds = new Set((engine.getStore?.().matchLogs || []).map(entry => entry.id));
  let added = 0;

  const ingest = (game, meta) => {
    if (!game?.home || !game?.away) return;
    if (game.home !== clubName && game.away !== clubName) return;
    if (!Number.isFinite(Number(game.homeGoals)) || !Number.isFinite(Number(game.awayGoals))) return;
    const competition = meta.competition || 'LEAGUE';
    const round = meta.round ?? 'x';
    const leg = meta.leg || '';
    const id = buildStatsFixtureId(game, {
      season: year,
      competitionId: competition,
      round,
      leg,
    });
    if (knownIds.has(id)) return;
    const log = engine.recordMatch(
      { ...game, completed: game.completed !== false },
      { season: year, persist: false, competition, round, leg: leg || null, fixtureId: id },
    );
    if (log?.id) {
      knownIds.add(log.id);
      added += 1;
    }
  };

  (roundHistory || []).forEach(round => {
    const roundNo = round?.round;
    (round?.games || []).forEach(game => {
      const enriched = enrichRoundGameFromUserStats(game, round?.userStats, clubName);
      ingest(enriched, {
        round: roundNo,
        competition:
          typeof competitionForRound === 'function'
            ? competitionForRound(round, enriched)
            : competitionForRound,
      });
    });
  });

  (extraGames || []).forEach(game => {
    ingest(game, {
      round: game.round ?? game.phaseIndex ?? null,
      competition: game.competition || 'COPA DO BRASIL',
      leg: game.leg || null,
      id: `${year}-${game.competition || 'COPA DO BRASIL'}-${game.round ?? game.phaseIndex ?? 'x'}-${game.home}-${game.away}-${game.leg || ''}${game.tieId ? `-${game.tieId}` : ''}`,
    });
  });

  if (added > 0) engine.persist?.();
  return added;
}

/**
 * Mantém só logs da temporada corrente e aplica cap FIFO.
 * @param {Array} logs
 * @param {number|null} season
 * @param {number} [max]
 */
export function pruneMatchLogsForSeason(
  logs,
  season,
  max = PLAYER_HISTORY_LIMITS.maxMatchLogsPerSeason,
) {
  let next = Array.isArray(logs) ? logs : [];
  if (season != null && Number.isFinite(Number(season))) {
    const year = Number(season);
    next = next.filter(entry => Number(entry.season) === year);
  }
  const cap = Math.max(1, Math.floor(Number(max) || PLAYER_HISTORY_LIMITS.maxMatchLogsPerSeason));
  if (next.length <= cap) return next;
  return next.slice(next.length - cap);
}

function pruneArchives(archives, max = PLAYER_HISTORY_LIMITS.maxSeasonArchives) {
  if (!Array.isArray(archives) || archives.length <= max) return archives || [];
  return archives.slice(archives.length - max);
}

function prunePlayers(players, softMax = PLAYER_HISTORY_LIMITS.maxPlayersSoft) {
  const keys = Object.keys(players || {});
  if (keys.length <= softMax) return players || {};
  const scored = keys.map(key => {
    const seasons = players[key]?.seasons || {};
    const years = Object.keys(seasons).map(Number).filter(Number.isFinite);
    const lastYear = years.length ? Math.max(...years) : 0;
    const apps = years.reduce((sum, year) => sum + (seasons[year]?.apps || 0), 0);
    return { key, lastYear, apps };
  });
  scored.sort((a, b) => b.lastYear - a.lastYear || b.apps - a.apps);
  const keep = new Set(scored.slice(0, softMax).map(row => row.key));
  const next = {};
  keep.forEach(key => {
    next[key] = players[key];
  });
  return next;
}

function stampSeasonAverages(players, year) {
  const key = String(year);
  Object.values(players || {}).forEach(player => {
    const bucket = player?.seasons?.[key];
    if (!bucket) return;
    const avg = seasonAverageRating(bucket);
    if (avg != null) bucket.avgRating = avg;
  });
}

function slimLogPlayer(sheet) {
  return {
    key: sheet.key,
    name: sheet.name,
    club: sheet.club,
    pos: sheet.pos,
    side: sheet.side,
    minutes: sheet.minutes,
    started: !!sheet.started,
    goals: sheet.goals,
    assists: sheet.assists,
    ownGoals: sheet.ownGoals || 0,
    passes: sheet.passesEst || 0,
    rating: sheet.rating,
    yellow: !!sheet.yellow,
    red: !!sheet.red,
  };
}

function readActiveSlotIdForHistory() {
  try {
    const session = sessionStorage.getItem(ACTIVE_SLOT_SESSION_KEY);
    if (session) return session;
  } catch {
    /* ignore */
  }
  return readJson(CAREER_INDEX_KEY, null)?.activeSlotId || null;
}

function playerHistoryHasStats(value) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value.matchLogs) && value.matchLogs.length > 0) return true;
  return !!(value.players && typeof value.players === 'object' && Object.keys(value.players).length > 0);
}

export function loadPlayerHistoryStore() {
  let raw = readJson(SAVE_KEYS.playerHistory, null);
  const slotId = readActiveSlotIdForHistory();
  const slotRaw = slotId ? readJson(slotBundleKeys(slotId).playerHistory, null) : null;

  // Checkpoint ativo vazio / slim — preferir bundle do slot (save completo na nuvem).
  if (slotRaw && playerHistoryHasStats(slotRaw) && !isLocalStorageCheckpoint(slotRaw)) {
    if (!raw || isLocalStorageCheckpoint(raw) || !playerHistoryHasStats(raw)) {
      raw = slotRaw;
    }
  } else if (!raw && slotRaw) {
    raw = slotRaw;
  }

  if (!raw || typeof raw !== 'object') return emptyStore();
  // Checkpoint com dados úteis: usa o conteúdo (não zerar dashboard).
  if (isLocalStorageCheckpoint(raw) && !playerHistoryHasStats(raw)) {
    return emptyStore(raw.season ?? null);
  }

  const season = raw.season ?? null;
  const store = {
    version: Number(raw.version) || SAVE_VERSION.playerHistory || 1,
    statsModelVersion: Number(raw.statsModelVersion) || 1,
    players: raw.players && typeof raw.players === 'object' ? raw.players : {},
    season,
    matchLogs: pruneMatchLogsForSeason(
      Array.isArray(raw.matchLogs) ? raw.matchLogs : [],
      season,
    ),
    seasonArchives: Array.isArray(raw.seasonArchives) ? raw.seasonArchives : [],
  };
  try {
    if (JSON.stringify(store).length > 200_000) {
      store.matchLogs = pruneMatchLogsForSeason(store.matchLogs, season, 80);
      store.seasonArchives = pruneArchives(store.seasonArchives, 4);
    }
  } catch {
    store.matchLogs = [];
  }
  return migrateCompetitionBuckets(store);
}

export function savePlayerHistoryStore(store, options = {}) {
  const budget =
    Number(options.matchLogBudget) > 0
      ? Math.ceil(Number(options.matchLogBudget))
      : PLAYER_HISTORY_LIMITS.maxMatchLogsPerSeason;
  const applyOk = payload => {
    store.players = payload.players;
    store.matchLogs = payload.matchLogs;
    store.seasonArchives = payload.seasonArchives;
    store.season = payload.season ?? null;
    return true;
  };
  const payload = {
    version: SAVE_VERSION.playerHistory || 1,
    statsModelVersion: 2,
    players: store.players,
    season: store.season ?? null,
    matchLogs: pruneMatchLogsForSeason(store.matchLogs, store.season ?? null, budget),
    seasonArchives: pruneArchives(store.seasonArchives),
  };
  let rawSize = 0;
  try {
    rawSize = JSON.stringify(payload).length;
  } catch {
    rawSize = 0;
  }
  if (rawSize > 100_000) {
    payload.matchLogs = pruneMatchLogsForSeason(
      payload.matchLogs,
      store.season ?? null,
      Math.max(24, Math.floor(budget / 6)),
    );
    payload.seasonArchives = pruneArchives(payload.seasonArchives, 4);
  }
  let ok = writeJson(SAVE_KEYS.playerHistory, payload);
  if (ok) return applyOk(payload);
  // Quota: corta logs pela metade e tenta de novo.
  payload.matchLogs = pruneMatchLogsForSeason(
    payload.matchLogs,
    store.season ?? null,
    Math.max(32, Math.floor(budget / 2)),
  );
  ok = writeJson(SAVE_KEYS.playerHistory, payload);
  if (ok) return applyOk(payload);
  // Ainda cheio: zera logs + arquivos de temporada.
  payload.matchLogs = [];
  payload.seasonArchives = [];
  ok = writeJson(SAVE_KEYS.playerHistory, payload);
  if (ok) return applyOk(payload);
  return false;
}

export function clearPlayerHistoryStore() {
  try {
    localStorage.removeItem(SAVE_KEYS.playerHistory);
  } catch {
    /* ignore */
  }
}

export function createPlayerHistoryEngine(deps = {}) {
  const getClub = typeof deps.getClub === 'function' ? deps.getClub : () => null;
  const getMatchLogBudget =
    typeof deps.getMatchLogBudget === 'function' ? deps.getMatchLogBudget : null;
  let store = loadPlayerHistoryStore();
  void import('../core/player-stats-sync.js')
    .then(module => module.queuePlayerStatsHistory(store.matchLogs))
    .catch(() => {});

  const resolveBudget = () => {
    if (!getMatchLogBudget) return PLAYER_HISTORY_LIMITS.maxMatchLogsPerSeason;
    const n = Number(getMatchLogBudget());
    if (!Number.isFinite(n) || n <= 0) return PLAYER_HISTORY_LIMITS.maxMatchLogsPerSeason;
    return Math.max(1, Math.ceil(n));
  };

  const persist = () => {
    const pressure = getStoragePressure();
    prepareStorageForSave({
      preserveKeys: [SAVE_KEYS.playerHistory, SAVE_KEYS.season, SAVE_KEYS.career],
      aggressive: pressure.level === 'critical',
    });

    if (pressure.level === 'critical') {
      store.matchLogs = [];
      store.seasonArchives = pruneArchives(store.seasonArchives, 2);
    } else if (pressure.level === 'warn') {
      store.matchLogs = pruneMatchLogsForSeason(
        store.matchLogs,
        store.season ?? null,
        Math.max(24, Math.floor(resolveBudget() / 2)),
      );
    }

    store.matchLogs = pruneMatchLogsForSeason(
      store.matchLogs,
      store.season ?? null,
      resolveBudget(),
    );
    store.seasonArchives = pruneArchives(store.seasonArchives);
    try {
      localStorage.removeItem(SAVE_KEYS.liveMatch);
    } catch {
      /* ignore */
    }
    try {
      return savePlayerHistoryStore(store, { matchLogBudget: resolveBudget() });
    } catch (error) {
      console.warn('[brfut] falha ao persistir histórico de jogadores', error);
      return false;
    }
  };

  const finalizeSeason = (year, { persist: doPersist = true, nextSeason = null } = {}) => {
    const y = Number(year);
    if (!Number.isFinite(y)) return store;
    // Congela média da temporada e descarta logs jogo a jogo (só rollup fica).
    stampSeasonAverages(store.players, y);
    store.matchLogs = [];
    store.season = nextSeason != null ? nextSeason : y + 1;
    store.players = prunePlayers(store.players);
    if (doPersist) persist();
    return store;
  };

  const ensureSeasonYear = year => {
    if (store.season != null && Number(store.season) !== Number(year)) {
      // Temporada mudou sem finalize — faz rollup defensivo.
      finalizeSeason(store.season, { persist: false });
    }
    store.season = year;
  };

  const recordMatch = (game, meta = {}) => {
    if (!game?.home || !game?.away) return null;
    const season = meta.season ?? store.season;
    if (season == null) return null;
    ensureSeasonYear(season);

    const built = buildMatchPlayerSheets(game, { getClub });
    const allSheets = [...built.home, ...built.away];
    if (!allSheets.length) return null;

    const competitionId = normalizeStatsCompetitionId(
      meta.competition || game.competition || 'LEAGUE',
      getClub(game.home)?.division || null,
    );
    const id = buildStatsFixtureId(game, {
      season,
      competitionId,
      round: meta.round ?? game.round,
      leg: meta.leg || game.leg,
    });

    // Evita duplicar o mesmo id na temporada corrente.
    if (store.matchLogs.some(entry => entry.id === id)) {
      return store.matchLogs.find(entry => entry.id === id);
    }

    allSheets.forEach(sheet => {
      let player = store.players[sheet.key];
      if (!player) {
        player = { name: sheet.name, club: sheet.club, seasons: {} };
        store.players[sheet.key] = player;
      }
      player.name = sheet.name;
      player.club = sheet.club;
      applySheetToSeason(player, season, sheet, competitionId);
    });

    const log = {
      id,
      fixtureId: id,
      season,
      round: meta.round ?? game.round ?? null,
      competition: competitionId,
      leg: meta.leg || game.leg || null,
      date: meta.date || null,
      home: game.home,
      away: game.away,
      homeGoals: Number(game.homeGoals) || 0,
      awayGoals: Number(game.awayGoals) || 0,
      players: allSheets.map(slimLogPlayer),
    };
    store.matchLogs.push(log);
    store.matchLogs = pruneMatchLogsForSeason(
      store.matchLogs,
      store.season ?? season,
      resolveBudget(),
    );
    if (meta.persist !== false) persist();
    void import('../core/player-stats-sync.js')
      .then(module => module.queuePlayerStatsMatch(log))
      .catch(() => {});
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('brfut:player-stats-updated', {
        detail: { season, fixtureId: id, clubs: [game.home, game.away] },
      }));
    }
    return log;
  };

  const findMatchLog = ({ home, away, season, round, competition, leg } = {}) => {
    const logs = store.matchLogs || [];
    return (
      logs.find(entry => {
        if (home && entry.home !== home) return false;
        if (away && entry.away !== away) return false;
        if (season != null && Number(entry.season) !== Number(season)) return false;
        if (round != null && Number(entry.round) !== Number(round)) return false;
        if (competition && entry.competition !== competition) return false;
        if (leg && entry.leg && entry.leg !== leg) return false;
        return true;
      }) || null
    );
  };

  const archiveSeasonBalance = payload => {
    if (!payload?.season) return null;
    const slim = {
      season: payload.season,
      userClub: payload.userClub || null,
      userDivision: payload.userDivision || null,
      userLine: payload.userLine || null,
      userStatus: payload.userStatus || null,
      seasonGoal: payload.seasonGoal
        ? { id: payload.seasonGoal.id, label: payload.seasonGoal.label, tier: payload.seasonGoal.tier }
        : null,
      seasonGoalResult: payload.seasonGoalResult
        ? {
            status: payload.seasonGoalResult.status,
            boardDelta: payload.seasonGoalResult.boardDelta,
            label: payload.seasonGoalResult.label,
            feeling: payload.seasonGoalResult.feeling,
          }
        : null,
      seasonObjectivesResult: payload.seasonObjectivesResult
        ? {
            boardDelta: payload.seasonObjectivesResult.boardDelta,
            feeling: payload.seasonObjectivesResult.feeling,
            metCount: payload.seasonObjectivesResult.metCount,
            missedCount: payload.seasonObjectivesResult.missedCount,
            items: Array.isArray(payload.seasonObjectivesResult.items)
              ? payload.seasonObjectivesResult.items.map(item => ({
                  id: item.id,
                  label: item.label,
                  status: item.status,
                }))
              : [],
          }
        : null,
      champions: payload.champions ? { ...payload.champions } : null,
      movements: Array.isArray(payload.movements)
        ? payload.movements.map(row => ({
            title: row.title,
            type: row.type,
            clubs: [...(row.clubs || [])].slice(0, 8),
          }))
        : [],
      leaders: payload.leadersByDivision
        ? {
            A: {
              scorers: slimLeaders(payload.leadersByDivision.A?.scorers, 'goals'),
              assistants: slimLeaders(payload.leadersByDivision.A?.assistants, 'assists'),
            },
            userDivision: payload.userDivision || null,
          }
        : null,
    };
    store.seasonArchives = store.seasonArchives.filter(
      entry => Number(entry.season) !== Number(slim.season),
    );
    store.seasonArchives.push(slim);
    store.seasonArchives = pruneArchives(store.seasonArchives);
    persist();
    return slim;
  };

  const getPlayer = key => store.players[key] || null;

  const reload = () => {
    store = loadPlayerHistoryStore();
    return store;
  };

  return {
    moduleVersion: MODULE_VERSIONS.playerHistory ?? 1,
    recordMatch,
    findMatchLog,
    archiveSeasonBalance,
    finalizeSeason,
    getPlayer,
    playerKey,
    getStore: () => store,
    reload,
    persist,
    clear: () => {
      clearPlayerHistoryStore();
      store = emptyStore();
    },
  };
}
