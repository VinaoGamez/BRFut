/**
 * Slim progressivo do save de temporada quando a cota do localStorage aperta.
 */
import { SAVE_KEYS } from '../core/constants.js';
import { isCloudLocalTrimEnabled } from '../core/local-save-checkpoint.js';
import { writeJsonResilient } from '../core/save.js';

function slimScoresOnlyHistory(history = []) {
  return (history || []).map(item => ({
    round: item.round,
    games: (item.games || []).map(game => ({
      home: game.home,
      away: game.away,
      homeGoals: game.homeGoals,
      awayGoals: game.awayGoals,
      ...(game.penalties ? { penalties: game.penalties } : {}),
      ...(game.winner ? { winner: game.winner } : {}),
    })),
    userStats: null,
  }));
}

export function slimSeasonPayloadLevel1(payload, { savedMessages } = {}) {
  const messages = savedMessages || payload.careerMessages || [];
  return {
    ...payload,
    careerMessages: messages.slice(0, 40),
    seasonTransferDeals: [],
    userSeasonCrowds: [],
    pendingTransferOffers: Array.isArray(payload.pendingTransferOffers)
      ? payload.pendingTransferOffers.slice(0, 12)
      : [],
  };
}

export function slimSeasonPayloadLevel2(payload, { compactCompetitions } = {}) {
  const next = slimSeasonPayloadLevel1(payload, { savedMessages: payload.careerMessages });
  const source = compactCompetitions || payload.competitionRoundHistory || {};
  next.competitionRoundHistory = Object.fromEntries(
    Object.entries(source).map(([division, history]) => [division, slimScoresOnlyHistory(history)]),
  );
  next.seasonRoundHistory = Array.isArray(next.seasonRoundHistory)
    ? next.seasonRoundHistory.slice(-12)
    : [];
  return next;
}

export function slimSeasonPayloadLevel3(payload, context = {}) {
  const next = slimSeasonPayloadLevel2(payload, context);
  if (next.worldCupCompetition) {
    next.worldCupCompetition = {
      ...next.worldCupCompetition,
      groupFixtures: (next.worldCupCompetition.groupFixtures || []).map(game => ({
        home: game.home,
        away: game.away,
        homeCode: game.homeCode,
        awayCode: game.awayCode,
        competition: game.competition,
        phase: game.phase,
        group: game.group,
        round: game.round,
        matchday: game.matchday,
        date: game.date,
        time: game.time,
        gameNumber: game.gameNumber,
        completed: !!game.completed,
        homeGoals: game.homeGoals,
        awayGoals: game.awayGoals,
      })),
      knockoutFixtures: (next.worldCupCompetition.knockoutFixtures || []).map(game => ({
        home: game.home,
        away: game.away,
        homeCode: game.homeCode,
        awayCode: game.awayCode,
        competition: game.competition,
        phase: game.phase,
        stage: game.stage,
        id: game.id,
        round: game.round,
        date: game.date,
        time: game.time,
        gameNumber: game.gameNumber,
        completed: !!game.completed,
        homeGoals: game.homeGoals,
        awayGoals: game.awayGoals,
        winner: game.winner,
        winnerCode: game.winnerCode,
      })),
      knockoutContext: null,
      teamStrength: null,
    };
  }
  next.nationalFixtures = { A: [], B: [], C: [], D: [] };
  next.dFixtures = Array.isArray(next.dFixtures) ? next.dFixtures.slice(-4) : [];
  if (next.cupCompetition) {
    next.cupCompetition = {
      currentPhase: next.cupCompetition.currentPhase,
      champion: next.cupCompetition.champion,
      stages: (next.cupCompetition.stages || []).map(stage => ({
        index: stage.index,
        name: stage.name,
        completed: stage.completed,
        fixtures: (stage.fixtures || [])
          .filter(game => game.completed)
          .map(game => ({
            home: game.home,
            away: game.away,
            homeGoals: game.homeGoals,
            awayGoals: game.awayGoals,
            completed: true,
          })),
      })),
    };
  }
  return next;
}

export function slimSeasonPayloadLevel4(payload, context = {}) {
  const next = slimSeasonPayloadLevel3(payload, context);
  next.competitionRoundHistory = {};
  next.seasonRoundHistory = Array.isArray(next.seasonRoundHistory)
    ? next.seasonRoundHistory.slice(-6)
    : [];
  next.userBudgetLedger = Array.isArray(next.userBudgetLedger)
    ? next.userBudgetLedger.slice(-40)
    : [];
  next.managerRanking = null;
  if (next.stateLeagues) {
    next.stateLeagues = {
      ...next.stateLeagues,
      historyByUf: {},
    };
  }
  if (next.playerDevelopment) {
    next.playerDevelopment = {
      season: next.playerDevelopment.season,
      pulsesDone: [],
      yearDeltaByPlayer: {},
      ovrMarkByPlayer: {},
      snapByPlayer: {},
    };
  }
  return next;
}

/**
 * Persiste temporada com slim progressivo e liberação de chaves secundárias.
 * @returns {{ ok: boolean, value: object, slimmed: boolean }}
 */
export function persistSeasonPayload(seasonPayload, context = {}) {
  try {
    localStorage.removeItem(SAVE_KEYS.liveMatch);
  } catch {
    /* ignore */
  }

  const slimSteps = isCloudLocalTrimEnabled()
    ? [
        payload => slimSeasonPayloadLevel2(payload, context),
        payload => {
          try {
            localStorage.removeItem(SAVE_KEYS.playerHistory);
          } catch {
            /* ignore */
          }
          return slimSeasonPayloadLevel3(payload, context);
        },
        payload => slimSeasonPayloadLevel4(payload, context),
      ]
    : [
        payload => slimSeasonPayloadLevel1(payload, context),
        payload => slimSeasonPayloadLevel2(payload, context),
        payload => {
          try {
            localStorage.removeItem(SAVE_KEYS.playerHistory);
          } catch {
            /* ignore */
          }
          return slimSeasonPayloadLevel3(payload, context);
        },
        payload => slimSeasonPayloadLevel4(payload, context),
      ];

  return writeJsonResilient(SAVE_KEYS.season, seasonPayload, {
    preserveKeys: [SAVE_KEYS.season, SAVE_KEYS.career],
    slimSteps,
  });
}
