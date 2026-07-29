/** Reduz payloads antes do PUT na nuvem (limite nginx ~2 MB). */
import { SAVE_KEYS } from './constants.js';

const CLOUD_PAYLOAD_TARGET = 400_000;

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
    seed: career.seed,
    clubName: career.clubName,
    managerName: career.managerName,
    division: career.division,
    season: career.season,
    userUf: career.userUf,
    nationalTeamCode: career.nationalTeamCode,
    preferences: career.preferences,
    userRoster: Array.isArray(career.userRoster) ? career.userRoster.slice(0, 32) : [],
    updatedAt: career.updatedAt,
  };
  if (payloadChars(checkpoint) <= CLOUD_PAYLOAD_TARGET) return checkpoint;

  return {
    seed: checkpoint.seed,
    clubName: checkpoint.clubName,
    managerName: checkpoint.managerName,
    division: checkpoint.division,
    season: checkpoint.season,
    userUf: checkpoint.userUf,
    preferences: checkpoint.preferences,
    updatedAt: checkpoint.updatedAt,
  };
}

export function slimSeasonForCloudUpload(season) {
  if (!season || typeof season !== 'object') return season;

  let checkpoint = {
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
    stateLeagues: slimStateLeaguesForCloud(season.stateLeagues),
    standings: season.standings,
    userClubStatus: season.userClubStatus,
    userBudget: season.userBudget,
    fatigue: season.fatigue,
    availability: season.availability,
    careerMessages: Array.isArray(season.careerMessages) ? season.careerMessages.slice(-60) : [],
    competitionRoundHistory: season.competitionRoundHistory,
    seasonRoundHistory: Array.isArray(season.seasonRoundHistory)
      ? season.seasonRoundHistory.slice(-6)
      : [],
  };
  if (payloadChars(checkpoint) <= CLOUD_PAYLOAD_TARGET) return checkpoint;

  checkpoint = {
    seed: season.seed,
    userClubName: season.userClubName,
    currentRound: season.currentRound,
    careerCalendarDate: season.careerCalendarDate,
    updatedAt: season.updatedAt,
    stateLeagueProgressRound: season.stateLeagueProgressRound,
    stateLeagues: slimStateLeaguesForCloud(season.stateLeagues, { ultra: true }),
    standings: season.standings,
  };
  if (payloadChars(checkpoint) <= CLOUD_PAYLOAD_TARGET) return checkpoint;

  return {
    seed: season.seed,
    userClubName: season.userClubName,
    currentRound: season.currentRound,
    careerCalendarDate: season.careerCalendarDate,
    updatedAt: season.updatedAt,
    stateLeagueProgressRound: season.stateLeagueProgressRound,
    stateLeagues: slimStateLeaguesForCloud(season.stateLeagues, { ultra: true }),
  };
}

export function slimPlayerHistoryForCloudUpload(history) {
  if (!history || typeof history !== 'object') return history;
  if (payloadChars(history) <= CLOUD_PAYLOAD_TARGET) return history;
  const players = history.players;
  if (!players || typeof players !== 'object') {
    return {
      version: history.version,
      updatedAt: history.updatedAt,
      players: {},
    };
  }
  const entries = Object.entries(players);
  const slimPlayers = {};
  for (const [id, record] of entries.slice(-160)) {
    slimPlayers[id] = record;
  }
  const slimmed = { ...history, players: slimPlayers };
  if (payloadChars(slimmed) <= CLOUD_PAYLOAD_TARGET) return slimmed;
  return {
    version: history.version,
    updatedAt: history.updatedAt,
    players: slimPlayers,
  };
}

export function prepareCloudSavePayload(key, value) {
  if (!value || typeof value !== 'object') return value;
  // Prefere o save completo quando cabe; slim só como fallback de tamanho.
  if (key === SAVE_KEYS.career) {
    if (payloadChars(value) <= CLOUD_PAYLOAD_TARGET) return value;
    return slimCareerForCloudUpload(value);
  }
  if (key === SAVE_KEYS.season) {
    if (payloadChars(value) <= CLOUD_PAYLOAD_TARGET) return value;
    return slimSeasonForCloudUpload(value);
  }
  if (key === SAVE_KEYS.playerHistory) {
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
