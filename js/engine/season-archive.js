/**
 * Snapshot imutável de temporada fechada (visualização + validação).
 * Separado do brfut-season vivo — nunca se funde no boot do ano corrente.
 */

const ARCHIVE_VERSION = 4;
const MAX_LEADERS = 10;
const MAX_ROUND_GAMES = 12;

function slimStandingRow(row) {
  if (!row?.club) return null;
  return {
    club: row.club,
    played: Number(row.played) || 0,
    wins: Number(row.wins) || 0,
    draws: Number(row.draws) || 0,
    losses: Number(row.losses) || 0,
    goalDiff: Number(row.goalDiff) || 0,
    points: Number(row.points) || 0,
  };
}

function slimStandings(rows) {
  return (Array.isArray(rows) ? rows : []).map(slimStandingRow).filter(Boolean);
}

function slimGame(game) {
  if (!game?.home || !game?.away) return null;
  return {
    home: game.home,
    away: game.away,
    homeCode: game.homeCode || null,
    awayCode: game.awayCode || null,
    homeGoals: game.homeGoals ?? game.hg ?? null,
    awayGoals: game.awayGoals ?? game.ag ?? null,
    round: game.round ?? null,
    matchday: game.matchday ?? null,
    gameNumber: game.gameNumber ?? null,
    date: game.date || null,
    competition: game.competition || null,
    phase: game.phase || game.stage || null,
    leg: game.leg || null,
    group: game.group || null,
    groupIndex: game.groupIndex ?? null,
    tieId: game.tieId || null,
    shootoutHome: game.shootoutHome ?? null,
    shootoutAway: game.shootoutAway ?? null,
    shootoutWinner: game.shootoutWinner || null,
    completed: !!(game.completed || game.homeGoals != null || game.hg != null),
  };
}

function slimSerieD(competition) {
  if (!competition || typeof competition !== 'object') return null;
  const stages = {};
  Object.entries(competition.knockout?.stages || {}).forEach(([key, fixtures]) => {
    stages[key] = (Array.isArray(fixtures) ? fixtures : [])
      .flat()
      .map(slimGame)
      .filter(Boolean);
  });
  return {
    groups: (Array.isArray(competition.groups) ? competition.groups : [])
      .map(group => (Array.isArray(group) ? [...group] : [])),
    standings: slimStandings(competition.standings),
    fixtures: (Array.isArray(competition.fixtures) ? competition.fixtures : [])
      .map(round => (Array.isArray(round) ? round.map(slimGame).filter(Boolean) : [])),
    knockout: {
      champion: competition.knockout?.champion || competition.champion || null,
      promoted: [...(competition.knockout?.promoted || [])],
      stages,
    },
  };
}

function slimTournament({ champion = null, complete = false, fixtures = [] } = {}) {
  return {
    champion: champion || null,
    complete: !!complete,
    fixtures: (Array.isArray(fixtures) ? fixtures : []).map(slimGame).filter(Boolean),
  };
}

function slimRoundHistory(historyByDivision) {
  const out = {};
  Object.entries(historyByDivision || {}).forEach(([division, rounds]) => {
    if (!Array.isArray(rounds)) return;
    out[division] = rounds.map(entry => ({
      round: Number(entry?.round) || 0,
      games: (Array.isArray(entry?.games) ? entry.games : [])
        .map(slimGame)
        .filter(Boolean)
        .slice(0, MAX_ROUND_GAMES),
    }));
  });
  return out;
}

function slimCup(cup) {
  if (!cup || typeof cup !== 'object') return null;
  return {
    champion: cup.champion || null,
    currentPhase: cup.currentPhase ?? null,
    stages: (Array.isArray(cup.stages) ? cup.stages : []).map(stage => ({
      index: stage.index,
      name: stage.name,
      completed: !!stage.completed,
      winners: Array.isArray(stage.winners) ? [...stage.winners] : [],
      fixtures: (Array.isArray(stage.fixtures) ? stage.fixtures : [])
        .map(slimGame)
        .filter(Boolean),
    })),
  };
}

function slimLeaders(list, statKey) {
  return (Array.isArray(list) ? list : [])
    .slice(0, MAX_LEADERS)
    .map(row => ({
      club: row.club,
      name: row.name,
      [statKey]: Number(row[statKey]) || 0,
    }));
}

/** Checksum simples para detectar blob corrompido / trocado. */
export function seasonArchiveChecksum(archive) {
  try {
    const raw = JSON.stringify({
      v: archive?.version,
      y: archive?.careerSeason,
      s: archive?.seed,
      c: archive?.champions,
      a: archive?.standings?.A?.[0],
    });
    let hash = 2166136261;
    for (let i = 0; i < raw.length; i += 1) {
      hash ^= raw.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  } catch {
    return null;
  }
}

/**
 * Monta arquivo compacto a partir do estado vivo no fechamento da temporada.
 */
export function buildSeasonArchive(input = {}) {
  const careerSeason = Number(input.careerSeason);
  if (!Number.isFinite(careerSeason) || careerSeason < 2000) return null;

  const national = input.nationalCompetitions || {};
  const standings = {};
  ['A', 'B', 'C', 'D'].forEach(division => {
    standings[division] = slimStandings(national[division]?.standings);
  });

  const archive = {
    version: ARCHIVE_VERSION,
    careerSeason,
    seed: input.seed ?? null,
    userClub: input.userClub || null,
    userDivision: input.userDivision || null,
    closedAt: input.closedAt || new Date().toISOString(),
    champions: input.champions ? { ...input.champions } : null,
    standings,
    serieDCompetition: slimSerieD(national.D),
    competitionRoundHistory: slimRoundHistory(input.competitionRoundHistory),
    cupCompetition: slimCup(input.cupCompetition),
    recopaCompetition: input.recopaCompetition
      ? {
          ...slimTournament({
            champion: input.recopaCompetition.champion,
            complete: input.recopaCompetition.complete,
            fixtures: input.recopaFixtures || [input.recopaCompetition.fixture].filter(Boolean),
          }),
          skippedSameClub: !!input.recopaCompetition.skippedSameClub,
          brasileiroChampion: input.recopaCompetition.brasileiroChampion || null,
          copaChampion: input.recopaCompetition.copaChampion || null,
        }
      : null,
    worldCupCompetition: input.worldCupCompetition
      ? {
          ...slimTournament({
            champion: input.worldCupChampion || input.worldCupCompetition.champion,
            complete: input.worldCupCompetition.complete,
            fixtures: input.worldCupFixtures,
          }),
          phase: input.worldCupCompetition.phase || null,
        }
      : null,
    stateLeagueResults: input.stateLeagueResults && typeof input.stateLeagueResults === 'object'
      ? input.stateLeagueResults
      : {},
    stateLeagueSnapshot: input.stateLeagueSnapshot && typeof input.stateLeagueSnapshot === 'object'
      ? input.stateLeagueSnapshot
      : null,
    scorers: slimLeaders(input.scorers, 'goals'),
    assistants: slimLeaders(input.assistants, 'assists'),
    transferDeals: Array.isArray(input.transferDeals)
      ? input.transferDeals.slice(-80).map(item => ({
          playerName: item.playerName || '—',
          playerId: item.playerId || null,
          from: item.from || null,
          to: item.to || null,
          fee: Math.round(Number(item.fee) || 0),
          type: item.type || 'buy',
          at: item.at || null,
          round: Number(item.round) || 0,
        }))
      : [],
    movements: Array.isArray(input.movements)
      ? input.movements.map(row => ({
          title: row.title,
          type: row.type,
          clubs: [...(row.clubs || [])].slice(0, 8),
        }))
      : [],
  };
  archive.checksum = seasonArchiveChecksum(archive);
  return archive;
}

export function isValidSeasonArchive(archive, { seed = null, year = null } = {}) {
  if (!archive || typeof archive !== 'object') return false;
  const y = Number(archive.careerSeason);
  if (!Number.isFinite(y) || y < 2000) return false;
  if (year != null && Number(year) !== y) return false;
  if (seed != null && archive.seed != null && Number(archive.seed) !== Number(seed)) return false;
  const hasTable =
    (Array.isArray(archive.standings?.A) && archive.standings.A.length > 0)
    || (Array.isArray(archive.standings?.D) && archive.standings.D.length > 0)
    || (archive.champions && (archive.champions.A || archive.champions.CUP));
  return !!hasTable;
}

/** Entrada leve para career.seasonIndex */
export function seasonIndexEntryFromArchive(archive, { archiveKey = null, bytes = 0 } = {}) {
  if (!archive) return null;
  return {
    year: Number(archive.careerSeason),
    userClub: archive.userClub || null,
    userDivision: archive.userDivision || null,
    champions: archive.champions
      ? {
          A: archive.champions.A || null,
          CUP: archive.champions.CUP || null,
          D: archive.champions.D || null,
          WORLD_CUP: archive.champions.WORLD_CUP || null,
        }
      : null,
    archiveKey: archiveKey || null,
    bytes: Number(bytes) || 0,
    checksum: archive.checksum || null,
    closedAt: archive.closedAt || null,
  };
}

export function upsertSeasonIndex(index, entry, { maxEntries = 20 } = {}) {
  const list = Array.isArray(index) ? [...index] : [];
  if (!entry?.year) return list;
  const next = list.filter(item => Number(item.year) !== Number(entry.year));
  next.push(entry);
  next.sort((a, b) => Number(a.year) - Number(b.year));
  return next.slice(-maxEntries);
}
