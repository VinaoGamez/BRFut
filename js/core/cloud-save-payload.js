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
      competitions: {},
      historyByUf: {},
      results: {},
    };
  }

  const slimDivisions = divisions.map(division => {
    const fixtures = (division.fixtures || [])
      .map(round =>
        (round || [])
          .filter(game => game?.played || game?.completed || game?.homeGoals != null)
          .map(game => ({
            home: game.home,
            away: game.away,
            homeGoals: game.homeGoals,
            awayGoals: game.awayGoals,
            played: true,
            round: game.round,
            date: game.date,
          })),
      )
      .filter(round => round.length);
    if (ultra) {
      return {
        uf,
        tier: division.tier,
        currentRound: division.currentRound,
        fixtures: fixtures.slice(-4),
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
    stateLeagues: slimStateLeaguesForCloud(season.stateLeagues),
    standings: season.standings,
    userClubStatus: season.userClubStatus,
    userBudget: season.userBudget,
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
    stateLeagues: slimStateLeaguesForCloud(season.stateLeagues, { ultra: true }),
  };
}

export function prepareCloudSavePayload(key, value) {
  if (key === SAVE_KEYS.career) return slimCareerForCloudUpload(value);
  if (key === SAVE_KEYS.season) return slimSeasonForCloudUpload(value);
  return value;
}

export function estimateCloudBodyChars(key, value) {
  return payloadChars({ value: prepareCloudSavePayload(key, value) });
}

export function rawPayloadChars(value) {
  return payloadChars(value);
}
