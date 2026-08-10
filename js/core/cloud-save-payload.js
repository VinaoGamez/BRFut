/** Reduz payloads antes do PUT na nuvem (limite nginx ~2 MB). */
import { SAVE_KEYS } from './constants.js';

// A API aceita 10 MB. A margem cobre o envelope JSON e mantem a VPS como
// fonte de verdade, sem compactacao destrutiva do estado corrente.
const CLOUD_PAYLOAD_TARGET = 8_500_000;
const PLAYER_HISTORY_CLOUD_TARGET = 8_500_000;

const syncMetadata = value => ({
  saveRevision: Number(value?.saveRevision) || 0,
  updatedAt: value?.updatedAt,
});

function payloadChars(value) {
  try {
    return JSON.stringify(value).length;
  } catch {
    return Infinity;
  }
}

function slimStateLeaguesForCloud(stateLeagues, { ultra = false } = {}) {
  if (!stateLeagues || typeof stateLeagues !== 'object') return stateLeagues;
  const uf = String(stateLeagues.userUf || 'SP').toUpperCase();
  const divisions = stateLeagues.competitions?.[uf];
  if (!Array.isArray(divisions)) {
    return {
      seasonYear: stateLeagues.seasonYear,
      userUf: uf,
      competitions: stateLeagues.competitions || {},
      historyByUf: {},
      results: stateLeagues.results || {},
    };
  }

  const slimDivisions = divisions.map(division => {
    const fixtures = (division.fixtures || []).map((round, roundIndex) =>
      (round || []).map(game => ({
        home: game.home,
        away: game.away,
        homeGoals: game.homeGoals ?? null,
        awayGoals: game.awayGoals ?? null,
        completed: !!(game.completed || game.homeGoals != null),
        played: !!(game.played || game.completed || game.homeGoals != null),
        round: game.round ?? roundIndex + 1,
        date: game.date,
        time: game.time,
        phase: game.phase,
        leg: game.leg,
        stateUf: game.stateUf,
        stateTier: game.stateTier,
      })),
    );
    if (ultra) {
      return {
        uf,
        tier: division.tier,
        currentRound: division.currentRound,
        fixtures,
        champion: division.champion || null,
      };
    }
    return {
      uf,
      tier: division.tier,
      currentRound: division.currentRound,
      fixtures,
      champion: division.champion || null,
      runnerUp: division.runnerUp || null,
    };
  });

  return {
    seasonYear: stateLeagues.seasonYear,
    userUf: uf,
    competitions: { [uf]: slimDivisions },
    historyByUf: {},
    results: stateLeagues.results?.[uf] ? { [uf]: stateLeagues.results[uf] } : {},
  };
}

export function slimCareerForCloudUpload(career) {
  if (!career || typeof career !== 'object') return career;
  const checkpoint = {
    ...syncMetadata(career),
    seed: career.seed,
    clubName: career.clubName,
    managerName: career.managerName,
    division: career.division,
    season: career.season,
    userUf: career.userUf,
    nationalTeamCode: career.nationalTeamCode,
    preferences: career.preferences,
    userRoster: Array.isArray(career.userRoster) ? career.userRoster.slice(0, 32) : [],
    freeAgentsPoolInitialized: !!career.freeAgentsPoolInitialized,
    freeAgentsPool: Array.isArray(career.freeAgentsPool) ? career.freeAgentsPool : [],
    worldYouthStates: career.worldYouthStates || {},
  };
  if (payloadChars(checkpoint) <= CLOUD_PAYLOAD_TARGET) return checkpoint;

  return {
    ...syncMetadata(career),
    seed: checkpoint.seed,
    clubName: checkpoint.clubName,
    managerName: checkpoint.managerName,
    division: checkpoint.division,
    season: checkpoint.season,
    userUf: checkpoint.userUf,
    preferences: checkpoint.preferences,
  };
}

function slimCupFixtureForCloud(game) {
  if (!game || typeof game !== 'object') return game;
  return {
    home: game.home,
    away: game.away,
    homeGoals: game.homeGoals ?? null,
    awayGoals: game.awayGoals ?? null,
    completed: !!game.completed,
    competition: game.competition || 'COPA DO BRASIL',
    phase: game.phase,
    phaseIndex: game.phaseIndex,
    leg: game.leg,
    date: game.date,
    time: game.time,
    gameNumber: game.gameNumber,
    tieId: game.tieId,
    winner: game.winner || null,
  };
}

/** Mantém o calendário da Copa no upload — sem isso hard refresh perde o sorteio. */
export function slimCupCompetitionForCloud(cup, { ultra = false } = {}) {
  if (!cup || typeof cup !== 'object') return cup;
  const stages = Array.isArray(cup.stages) ? cup.stages : [];
  return {
    currentPhase: cup.currentPhase || 1,
    champion: cup.champion || null,
    stages: stages.map(stage => ({
      index: stage.index,
      name: stage.name,
      twoLegged: !!stage.twoLegged,
      completed: !!stage.completed,
      entrants: ultra ? undefined : Array.isArray(stage.entrants) ? stage.entrants : [],
      winners: Array.isArray(stage.winners) ? stage.winners : [],
      fixtures: (stage.fixtures || []).map(slimCupFixtureForCloud),
    })),
  };
}

export function slimSeasonForCloudUpload(season) {
  if (!season || typeof season !== 'object') return season;

  const cup = slimCupCompetitionForCloud(season.cupCompetition);
  const scorers = Array.isArray(season.scorers) ? season.scorers.filter(row => (Number(row?.goals) || 0) > 0) : [];
  const assistants = Array.isArray(season.assistants)
    ? season.assistants.filter(row => (Number(row?.assists) || 0) > 0)
    : [];

  let checkpoint = {
    ...syncMetadata(season),
    seed: season.seed,
    userClubName: season.userClubName,
    currentRound: season.currentRound,
    careerCalendarDate: season.careerCalendarDate,
    stateLeagueProgressRound: season.stateLeagueProgressRound,
    userNationalTeamCode: season.userNationalTeamCode ?? null,
    nationalTeamOfferState: season.nationalTeamOfferState ?? null,
    worldCupCompetition: season.worldCupCompetition ?? null,
    nationalFixtures: season.nationalFixtures ?? null,
    cupCompetition: cup,
    scorers,
    assistants,
    stateLeagues: slimStateLeaguesForCloud(season.stateLeagues),
    standings: season.standings,
    userClubStatus: season.userClubStatus,
    userBudget: season.userBudget,
    fatigue: season.fatigue,
    availability: season.availability,
    careerMessages: Array.isArray(season.careerMessages) ? season.careerMessages.slice(-60) : [],
    competitionRoundHistory: season.competitionRoundHistory,
    managerRanking: season.managerRanking ?? null,
    seasonRoundHistory: Array.isArray(season.seasonRoundHistory)
      ? season.seasonRoundHistory.slice(-6)
      : [],
  };
  if (payloadChars(checkpoint) <= CLOUD_PAYLOAD_TARGET) return checkpoint;

  checkpoint = {
    ...syncMetadata(season),
    seed: season.seed,
    userClubName: season.userClubName,
    currentRound: season.currentRound,
    careerCalendarDate: season.careerCalendarDate,
    stateLeagueProgressRound: season.stateLeagueProgressRound,
    userNationalTeamCode: season.userNationalTeamCode ?? null,
    nationalTeamOfferState: season.nationalTeamOfferState ?? null,
    worldCupCompetition: season.worldCupCompetition ?? null,
    nationalFixtures: season.nationalFixtures ?? null,
    cupCompetition: slimCupCompetitionForCloud(season.cupCompetition, { ultra: true }),
    scorers: scorers.slice(0, 80),
    assistants: assistants.slice(0, 80),
    stateLeagues: slimStateLeaguesForCloud(season.stateLeagues, { ultra: true }),
    standings: season.standings,
    managerRanking: season.managerRanking ?? null,
  };
  if (payloadChars(checkpoint) <= CLOUD_PAYLOAD_TARGET) return checkpoint;

  return {
    ...syncMetadata(season),
    seed: season.seed,
    userClubName: season.userClubName,
    currentRound: season.currentRound,
    careerCalendarDate: season.careerCalendarDate,
    updatedAt: season.updatedAt,
    stateLeagueProgressRound: season.stateLeagueProgressRound,
    userNationalTeamCode: season.userNationalTeamCode ?? null,
    nationalTeamOfferState: season.nationalTeamOfferState ?? null,
    worldCupCompetition: season.worldCupCompetition ?? null,
    nationalFixtures: season.nationalFixtures ?? null,
    cupCompetition: slimCupCompetitionForCloud(season.cupCompetition, { ultra: true }),
    scorers: scorers.slice(0, 40),
    assistants: assistants.slice(0, 40),
    stateLeagues: slimStateLeaguesForCloud(season.stateLeagues, { ultra: true }),
    managerRanking: season.managerRanking ?? null,
  };
}

export function slimPlayerHistoryForCloudUpload(history) {
  if (!history || typeof history !== 'object') return history;
  if (payloadChars(history) <= PLAYER_HISTORY_CLOUD_TARGET) return history;

  const matchLogs = Array.isArray(history.matchLogs) ? history.matchLogs.slice(-120) : [];
  const players = history.players && typeof history.players === 'object' ? history.players : {};
  const slimPlayers = {};
  // Nunca selecionar "os últimos N": a ordem do objeto não representa relevância
  // e eliminava silenciosamente estatísticas da maioria dos jogadores.
  for (const [id, record] of Object.entries(players)) {
    const seasons = Object.entries(record?.seasons || {})
      .sort(([a], [b]) => Number(b) - Number(a))
      .slice(0, 8);
    slimPlayers[id] = { ...record, seasons: Object.fromEntries(seasons) };
  }
  const slimmed = {
    ...syncMetadata(history),
    version: history.version,
    season: history.season ?? null,
    players: slimPlayers,
    matchLogs,
    seasonArchives: Array.isArray(history.seasonArchives) ? history.seasonArchives.slice(-2) : [],
  };
  if (payloadChars(slimmed) <= PLAYER_HISTORY_CLOUD_TARGET) return slimmed;

  return {
    ...syncMetadata(history),
    version: history.version,
    season: history.season ?? null,
    players: slimPlayers,
    matchLogs: [],
    seasonArchives: [],
  };
}

/** Tipo lógico da chave (inclui bundles `brfut-slot-*-career`). */
export function cloudSaveLogicalKind(key) {
  const k = String(key || '');
  if (k === SAVE_KEYS.career || k.endsWith('-career')) return 'career';
  if (k === SAVE_KEYS.season || k.endsWith('-season')) return 'season';
  if (k === SAVE_KEYS.playerHistory || k.endsWith('-player-history')) return 'playerHistory';
  if (k === SAVE_KEYS.liveMatch || k.endsWith('-live-match')) return 'liveMatch';
  return null;
}

export function prepareCloudSavePayload(key, value) {
  if (!value || typeof value !== 'object') return value;
  const kind = cloudSaveLogicalKind(key);
  // Prefere o save completo quando cabe; slim só como fallback de tamanho.
  // Bundles de slot usam o mesmo slim — senão PUT estoura limite/rede e o SALVAR falha.
  if (kind === 'career') {
    if (payloadChars(value) <= CLOUD_PAYLOAD_TARGET) return value;
    return slimCareerForCloudUpload(value);
  }
  if (kind === 'season') {
    if (payloadChars(value) <= CLOUD_PAYLOAD_TARGET) return value;
    return slimSeasonForCloudUpload(value);
  }
  if (kind === 'playerHistory') {
    if (payloadChars(value) <= CLOUD_PAYLOAD_TARGET) return value;
    return slimPlayerHistoryForCloudUpload(value);
  }
  return value;
}

export function estimateCloudBodyChars(key, value) {
  return payloadChars({ value: prepareCloudSavePayload(key, value) });
}

export function rawPayloadChars(value) {
  return payloadChars(value);
}
