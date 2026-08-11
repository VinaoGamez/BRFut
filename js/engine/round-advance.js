import { FEATURES, SERIE_D_GROUP_ROUNDS } from '../core/constants.js';
import { clamp } from '../ui/dom.js';
import { compactMatchResult, involvesClub, MEMORY_LIMITS } from '../core/save.js';
import {
  findLeagueFixtureByPair,
  findRecordedGame,
  gameMatchesRecordedCompat,
  resolveLeagueFixtureRound,
} from './competition-calendar.js';
import { recordKnockoutResult, winnerFromGame, loserFromGame } from './world-cup-bracket.js';
import { isKnockoutShootoutCompetition, KNOCKOUT_COMPETITIONS } from './knockout-shootout.js';
import { WORLD_CUP_COMPETITION } from './world-cup-calendar.js';
import { worldCupWindowEndDate } from './world-cup-competition.js';
import { worldCupGroupMatchdayEndDate } from './world-cup-competition.js';

/**
 * Histórico da rodada só conta se a tabela também refletiu o jogo — evita AVANÇAR
 * no-op quando o save foi compactado / dessincronizado.
 */
export function resolveRoundAlreadyRecorded(
  seasonRoundHistory,
  currentRound,
  { userGame, userLeaguePlayed, isFixtureCompleted },
) {
  const historyEntry = (seasonRoundHistory || []).find(item => item.round === currentRound);
  if (!historyEntry) return false;

  const played = userLeaguePlayed?.() ?? 0;
  if (played < currentRound) {
    const idx = seasonRoundHistory.findIndex(item => item.round === currentRound);
    if (idx >= 0) seasonRoundHistory.splice(idx, 1);
    return false;
  }

  if (userGame && typeof isFixtureCompleted === 'function' && !isFixtureCompleted(userGame)) {
    const idx = seasonRoundHistory.findIndex(item => item.round === currentRound);
    if (idx >= 0) seasonRoundHistory.splice(idx, 1);
    return false;
  }

  if (userGame && !findRecordedGame(userGame, historyEntry.games || [])) {
    const idx = seasonRoundHistory.findIndex(item => item.round === currentRound);
    if (idx >= 0) seasonRoundHistory.splice(idx, 1);
    return false;
  }

  return true;
}

export function resolveRoundForLiveCommit(liveMatchGame, currentRound, userClub, championshipFixtures) {
  if (
    liveMatchGame &&
    userClub &&
    (liveMatchGame.home === userClub || liveMatchGame.away === userClub)
  ) {
    const inferred = resolveLeagueFixtureRound(liveMatchGame, championshipFixtures);
    if (inferred != null) return inferred;
    const pairRound = findLeagueFixtureByPair(liveMatchGame, championshipFixtures)?.round;
    if (pairRound != null) return pairRound;
    const liveRound = Number(liveMatchGame.round);
    if (Number.isFinite(liveRound) && liveRound > 0) return liveRound;
  }
  return currentRound;
}

function buildUserLiveLeagueResult(deps, liveMatchGame) {
  const userClub = deps.getUserClub();
  const userAtHome = liveMatchGame.home === userClub;
  const liveGoals = deps.getLiveSideGoals();
  return {
    home: liveMatchGame.home,
    away: liveMatchGame.away,
    homeGoals: userAtHome ? deps.getHomeGoals() : deps.getAwayGoals(),
    awayGoals: userAtHome ? deps.getAwayGoals() : deps.getHomeGoals(),
    user: true,
    fixture: liveMatchGame,
    round: liveMatchGame.round,
    competition: liveMatchGame.competition,
    goals: userAtHome
      ? { home: [...liveGoals.home], away: [...liveGoals.away] }
      : { home: [...liveGoals.away], away: [...liveGoals.home] },
    penalties: liveMatchGame.penalties || liveMatchGame.shootoutPenalties || null,
    shootoutWinner: liveMatchGame.shootoutWinner || null,
    shootoutPenalties: liveMatchGame.shootoutPenalties || liveMatchGame.penalties || null,
    completed: isKnockoutShootoutCompetition(liveMatchGame) ? true : undefined,
  };
}

/** Garante placar/tabela/histórico do jogo ao vivo — evita loop quando currentRound ≠ game.round. */
export function ensureLiveNationalRoundCommitted(deps, { liveMatchGame, roundForCommit, seasonRoundHistory }) {
  if (!liveMatchGame) return false;
  const userClub = deps.getUserClub();
  if (liveMatchGame.home !== userClub && liveMatchGame.away !== userClub) return false;

  const championshipFixtures = deps.getChampionshipFixtures?.() || [];
  const pairMatch = findLeagueFixtureByPair(liveMatchGame, championshipFixtures);
  const resolvedRound =
    resolveLeagueFixtureRound(liveMatchGame, championshipFixtures)
    ?? pairMatch?.round
    ?? roundForCommit;
  const effectiveRound = resolvedRound || roundForCommit;

  if (!Number.isFinite(Number(liveMatchGame.round)) || Number(liveMatchGame.round) <= 0) {
    liveMatchGame.round = effectiveRound;
  }

  const userResult = buildUserLiveLeagueResult(deps, liveMatchGame);
  userResult.round = effectiveRound;
  const userGame = pairMatch?.game || deps.leagueUserGameForRound(effectiveRound) || liveMatchGame;

  const userDivision = deps.getUserDivision();
  const historyHasResult =
    seasonRoundHistory.some(item =>
      findRecordedGame(userGame, item.games || [])
      || (item.games || []).some(entry => gameMatchesRecordedCompat(userGame, entry)),
    );
  if (userDivision !== 'D' || effectiveRound <= SERIE_D_GROUP_ROUNDS) {
    if (!historyHasResult) deps.applyRoundToTable(userResult);
  }

  let entry = seasonRoundHistory.find(item => item.round === effectiveRound);
  if (!entry) {
    entry = { round: effectiveRound, games: [], userStats: null };
    seasonRoundHistory.push(entry);
  }
  if (
    !findRecordedGame(userGame, entry.games || [])
    && !(entry.games || []).some(recorded => gameMatchesRecordedCompat(userGame, recorded))
  ) {
    entry.games = [
      ...(entry.games || []),
      compactMatchResult(userResult, { keepData: involvesClub(userResult, userClub) }),
    ];
  }

  liveMatchGame.homeGoals = userResult.homeGoals;
  liveMatchGame.awayGoals = userResult.awayGoals;

  const canon = pairMatch?.game
    || findLeagueFixtureByPair(liveMatchGame, deps.getNationalCompetitions()?.[userDivision]?.fixtures || championshipFixtures)?.game;
  if (canon) {
    if (!Number.isFinite(Number(canon.round)) || Number(canon.round) <= 0) canon.round = effectiveRound;
    canon.homeGoals = userResult.homeGoals;
    canon.awayGoals = userResult.awayGoals;
    // O snapshot ao vivo pode ser um objeto separado do fixture salvo no
    // calendário. Sempre conclui o canônico antes de limpar a sessão; caso
    // contrário ele reaparece como próximo jogo e prende o avanço em loop.
    canon.completed = true;
  }

  deps.invalidateUserScheduleCache?.();
  return true;
}

export function nationalSeasonLastRound(deps, division) {
  if (division === 'D') return 22;
  const fixtures = deps.getChampionshipFixtures?.();
  return Math.max(1, Array.isArray(fixtures) ? fixtures.length : 38);
}

function resetLiveMatchSession(deps) {
  deps.closeRoundResultsModal();
  deps.closeMatchModal();
  deps.stopMatchClock();
  deps.setMatchStarted(false);
  deps.setMatchFinished(false);
  deps.setLiveMatchGame(null);
  deps.releaseWorldCupSquadBinding();
  deps.clearLiveDaySnapshots();
  deps.setRoundResults(null);
  deps.setRoundResultMessagePushed(false);
  deps.setRoundPreviewResults({});
  deps.clearLiveMatchPersist();
  deps.invalidateUserScheduleCache?.();
}

function advanceStateLeagueThroughDateCore(deps, date) {
  if (!FEATURES.stateLeague || !deps.getSavedNewGame() || !date || typeof deps.simulateRoundMatch !== 'function') {
    return false;
  }
  const changed = deps.getStateLeagueEngine().advanceThroughDate(date, {
    simulateMatch: deps.simulateRoundMatch,
    userClub: deps.getUserClub(),
    recordLeaders: deps.recordGameLeaders,
    getManagerForClub: deps.getManagerForClub,
  });
  if (changed) {
    deps.rebuildCalendarGames();
    // Os jogos processados aqui nunca envolvem o clube do usuário e seus
    // detalhes seguem diretamente para a API. Regravar o histórico local
    // inteiro após cada catch-up apenas pressiona a cota do navegador.
    deps.invalidateUserScheduleCache();
  }
  return changed;
}

/**
 * Avanço de rodada: estadual, nacional, pós-jogo e tick de calendário.
 */
export function createRoundAdvanceEngine(deps) {
  const syncNationalRoundsDuringSerieDKnockout = round => {
    if (deps.getUserDivision() !== 'D' || round <= SERIE_D_GROUP_ROUNDS) return;
    // Distribui as rodadas restantes das Séries A, B e C pelos 12 jogos do
    // mata-mata da Série D, evitando centenas de simulações no clique da final.
    const knockoutProgress = round - SERIE_D_GROUP_ROUNDS;
    const targetRound = SERIE_D_GROUP_ROUNDS + Math.round((knockoutProgress * 28) / 12);
    deps.finishRemainingNationalRounds(SERIE_D_GROUP_ROUNDS + 1, targetRound);
  };

  const advanceStateLeagueThroughDate = date => advanceStateLeagueThroughDateCore(deps, date);

  const advancePostMatchDay = () => {
    const nextDay = new Date(deps.getCareerCalendarDate());
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(12, 0, 0, 0);
    if (nextDay > deps.seasonEndDate()) return;
    deps.applyCalendarTrainingDay(deps.trainingTypeForDate(nextDay));
    deps.advanceCareerCalendarTo(nextDay);
    deps.advanceCupThroughDate(nextDay);
    advanceStateLeagueThroughDate(nextDay);
    deps.advanceWorldCupThroughDateLocal(nextDay);
    deps.setSelectedCalendarDate(deps.getCareerCalendarDate());
  };

  const advanceStateLeagueRound = ({ navigateDashboard = true } = {}) => {
    const liveMatchGame = deps.getLiveMatchGame();
    if (!liveMatchGame || !deps.getStateLeagueEngine().isStateGame(liveMatchGame) || deps.getRoundCommitted()) {
      return false;
    }
    deps.setRoundCommitted(true);
    try {
      const gateResult = deps.creditUserHomeGate(liveMatchGame);
      deps.pushUserMatchResultMessage(liveMatchGame, gateResult);
      deps.commitLiveAvailability();
      const userClub = deps.getUserClub();
      const userAtHome = liveMatchGame.home === userClub;
      const userLiveGame = {
        ...liveMatchGame,
        homeGoals: userAtHome ? deps.getHomeGoals() : deps.getAwayGoals(),
        awayGoals: userAtHome ? deps.getAwayGoals() : deps.getHomeGoals(),
        round: liveMatchGame.round,
        penalties: liveMatchGame.penalties || liveMatchGame.shootoutPenalties || null,
        shootoutPenalties: liveMatchGame.shootoutPenalties || liveMatchGame.penalties || null,
        shootoutWinner: liveMatchGame.shootoutWinner || null,
      };
      deps.getStateLeagueEngine().commitRound(liveMatchGame.round, {
        simulateMatch: deps.simulateRoundMatch,
        userClub,
        recordLeaders: deps.recordGameLeaders,
        userLiveGame,
        scopeUf: liveMatchGame.stateUf,
        getManagerForClub: deps.getManagerForClub,
      });
      deps.persistPlayerHistory();
      const fillRate = deps.resolveMatchAttendance(liveMatchGame)?.fillRate ?? liveMatchGame.fillRate ?? null;
      deps.applyClubStatusAfterRound([userLiveGame], fillRate);
      deps.orderAllClubFormations();
      deps.renderRoster();
      deps.drawBoard();
      deps.recoverPlayers(Math.max(1, Math.round(deps.intervalDaysForRoundAdvance() * deps.trainingRecoveryMultiplier('after'))));
      advancePostMatchDay();
      deps.invalidateUserScheduleCache();
      deps.persistSeason(true);
      deps.refreshSeasonPresentation({ skipChampionshipPage: true });
      resetLiveMatchSession(deps);
      if (deps.evaluateManagerJobRisk()) return true;
      if (navigateDashboard) deps.navigateToDashboard();
    } finally {
      deps.setRoundCommitted(false);
    }
    return true;
  };

  const advanceSeasonRound = ({ navigateDashboard = true } = {}) => {
    const liveMatchGame = deps.getLiveMatchGame();
    if (liveMatchGame && deps.getStateLeagueEngine().isStateGame(liveMatchGame)) {
      advanceStateLeagueRound({ navigateDashboard });
      return;
    }
    if (deps.getRoundCommitted()) return;

    if (liveMatchGame?.competition === WORLD_CUP_COMPETITION) {
      deps.setRoundCommitted(true);
      try {
        const gateResult = deps.creditUserHomeGate(liveMatchGame);
        deps.pushUserMatchResultMessage(liveMatchGame, gateResult);
        const stats = deps.buildLiveKnockoutStats();
        Object.assign(liveMatchGame, stats, { completed: true });
        if (liveMatchGame.shootoutWinner) {
          liveMatchGame.winner = liveMatchGame.shootoutWinner;
        } else {
          const winner = winnerFromGame(liveMatchGame);
          if (winner?.name) liveMatchGame.winner = winner.name;
        }
        const worldCupCompetition = deps.getWorldCupCompetition();
        if (liveMatchGame.knockout && worldCupCompetition?.knockoutContext) {
          const winner = winnerFromGame(liveMatchGame);
          const loser = loserFromGame(liveMatchGame, winner);
          if (winner) recordKnockoutResult(worldCupCompetition.knockoutContext, liveMatchGame.id, winner, loser);
        }
        if (!deps.getAvailabilityCommitted()) deps.commitLiveAvailability();
        deps.recordGameLeaders(liveMatchGame);
        deps.persistPlayerHistory();
        if (!liveMatchGame.knockout && worldCupCompetition?.groupFixtures?.length) {
          const matchday = Number(liveMatchGame.matchday || liveMatchGame.round || 1);
          const matchdayEnd = worldCupGroupMatchdayEndDate(worldCupCompetition, matchday);
          if (matchdayEnd) deps.advanceWorldCupThroughDateLocal(matchdayEnd);
        }
        deps.refreshWorldCupFixtures?.();
        deps.rebuildCalendarGames();
        deps.invalidateUserScheduleCache?.();
        advancePostMatchDay();
        deps.persistAfterRoundAdvance();
        try {
          deps.refreshSeasonPresentation();
        } catch (error) {
          console.warn('[brfut] falha ao atualizar UI pós-jogo CMU', error);
        }
        deps.renderTeamStatsCard?.();
        resetLiveMatchSession(deps);
        if (deps.evaluateManagerJobRisk()) return;
        if (navigateDashboard) deps.navigateToDashboard();
      } catch (error) {
        console.warn('[brfut] falha ao avançar pós-jogo CMU', error);
        resetLiveMatchSession(deps);
      } finally {
        deps.setRoundCommitted(false);
      }
      return;
    }

    if (liveMatchGame?.competition === KNOCKOUT_COMPETITIONS.COPA) {
      deps.commitLiveKnockoutResult();
      advanceCupRound();
      return;
    }

    if (liveMatchGame?.competition === KNOCKOUT_COMPETITIONS.RECOPA) {
      deps.commitLiveKnockoutResult();
      deps.setRoundCommitted(true);
      try {
        const gateResult = deps.creditUserHomeGate(liveMatchGame);
        deps.pushUserMatchResultMessage(liveMatchGame, gateResult);
        if (!deps.getAvailabilityCommitted()) deps.commitLiveAvailability();
        advancePostMatchDay();
        deps.persistSeason(true);
        deps.refreshSeasonPresentation();
        resetLiveMatchSession(deps);
        if (deps.evaluateManagerJobRisk()) return;
        deps.navigateToDashboard();
      } finally {
        deps.setRoundCommitted(false);
      }
      return;
    }

    deps.setRoundCommitted(true);
    try {
      const gateResult = deps.creditUserHomeGate(liveMatchGame);
      if (liveMatchGame && isKnockoutShootoutCompetition(liveMatchGame)) deps.commitLiveKnockoutResult();
      deps.pushUserMatchResultMessage(liveMatchGame, gateResult);

      const userClub = deps.getUserClub();
      const seasonRoundHistory = deps.getSeasonRoundHistory();
      let roundForCommit = resolveRoundForLiveCommit(
        liveMatchGame,
        deps.getCurrentRound(),
        userClub,
        deps.getChampionshipFixtures?.(),
      );
      if (roundForCommit !== deps.getCurrentRound()) deps.setCurrentRound(roundForCommit);
      const roundAtStart = roundForCommit;
      const userGame = deps.leagueUserGameForRound(roundAtStart) || liveMatchGame;
      let alreadyRecorded = resolveRoundAlreadyRecorded(seasonRoundHistory, roundAtStart, {
        userGame,
        userLeaguePlayed: deps.userLeaguePlayed,
        isFixtureCompleted: deps.isFixtureCompleted,
      });

      if (!alreadyRecorded) {
        const nationalCompetitions = deps.getNationalCompetitions();
        const roundParticipants = new Set(
          Object.values(nationalCompetitions).flatMap(competition => {
            const round = (Array.isArray(competition?.fixtures) ? competition.fixtures : [])[roundAtStart - 1] || [];
            return (Array.isArray(round) ? round : [])
              .filter(game => game?.home && game?.away)
              .flatMap(game => [game.home, game.away]);
          }),
        );
        const restDays = deps.intervalDaysForRoundAdvance();
        deps.commitLiveAvailability();
        const completedGames = deps.simulateRoundResults(true);
        completedGames.forEach(deps.recordGameLeaders);
        if (deps.getUserDivision() !== 'D' || roundAtStart <= SERIE_D_GROUP_ROUNDS) {
          completedGames.forEach(deps.applyRoundToTable);
        }
        deps.serveDisciplineSuspensionsForRound();
        deps.serveAvailability(restDays, roundParticipants);
        const fillRate = deps.resolveMatchAttendance(liveMatchGame)?.fillRate ?? liveMatchGame?.fillRate ?? null;
        deps.applyClubStatusAfterRound(completedGames, fillRate);
        deps.applyUserWageBillForRound(roundAtStart);
        deps.creditLeagueHomeTvForGames(completedGames, deps.getUserDivision());
        deps.simulateNationalRound();
        syncNationalRoundsDuringSerieDKnockout(roundAtStart);
        const liveStats = deps.getLiveSideStats();
        const liveGoals = deps.getLiveSideGoals();
        seasonRoundHistory.push({
          round: roundAtStart,
          games: completedGames.map(game => compactMatchResult(game, { keepData: involvesClub(game, userClub) })),
          userStats: {
            home: { ...liveStats.home },
            away: { ...liveStats.away },
            goals: { home: [...liveGoals.home], away: [...liveGoals.away] },
          },
        });
        if (seasonRoundHistory.length > MEMORY_LIMITS.seasonRoundHistory) {
          seasonRoundHistory.splice(0, seasonRoundHistory.length - MEMORY_LIMITS.seasonRoundHistory);
        }
        deps.updateSeriesDKnockout(roundAtStart);
        deps.orderAllClubFormations(roundParticipants);
        deps.renderRoster();
        deps.drawBoard();
        deps.recoverPlayers(Math.max(1, Math.round(restDays * deps.trainingRecoveryMultiplier('after'))));
        advancePostMatchDay();
      } else if (liveMatchGame) {
        advancePostMatchDay();
      }

      if (liveMatchGame) {
        ensureLiveNationalRoundCommitted(deps, { liveMatchGame, roundForCommit: roundAtStart, seasonRoundHistory });
      }

      const userDivision = deps.getUserDivision();
      const careerSeason = deps.getCareerSeason();
      const completedSeason = roundAtStart >= nationalSeasonLastRound(deps, userDivision);
      if (userDivision === 'D' && roundAtStart === 22) deps.finishRemainingNationalRounds(11, 38);
      if (userDivision === 'D' && (deps.userLeaguePlayed?.() ?? 0) < SERIE_D_GROUP_ROUNDS) {
        deps.setCurrentRound((deps.userLeaguePlayed?.() ?? 0) + 1);
      } else if (!alreadyRecorded || liveMatchGame) {
        deps.setCurrentRound(roundAtStart + 1);
      } else if ((deps.userLeaguePlayed?.() ?? 0) >= roundAtStart) {
        deps.setCurrentRound(roundAtStart + 1);
      }
      deps.reconcileCurrentRound();
      deps.syncCareerCalendarAfterRoundAdvance?.();
      if (!alreadyRecorded) deps.processAiMarketAfterRound();

      const championshipFixtures = deps.getChampionshipFixtures();
      const cupReferenceDate = completedSeason
        ? new Date(careerSeason, 11, 31, 12)
        : deps.fixtureDate(clamp(deps.getCurrentRound(), 1, championshipFixtures.length));
      deps.advanceCupThroughDate(cupReferenceDate);
      advanceStateLeagueThroughDate(cupReferenceDate);
      const wcReferenceDate = completedSeason
        ? worldCupWindowEndDate(careerSeason)
        : deps.getCareerCalendarDate();
      deps.advanceWorldCupThroughDateLocal(wcReferenceDate);
      if (completedSeason) deps.refreshWorldCupFixtures?.();
      deps.maybeSendNationalTeamOffers();
      if (completedSeason) deps.finalizeNationalRankingSeason();
      if (liveMatchGame && (liveMatchGame.home === userClub || liveMatchGame.away === userClub)) {
        deps.notifyUserMatchPlayed?.();
      }
      resetLiveMatchSession(deps);
      deps.persistAfterRoundAdvance();
      try {
        deps.refreshSeasonPresentation();
      } catch (error) {
        console.warn('[brfut] falha ao atualizar UI pós-rodada', error);
      }
      const sackedNow = deps.evaluateManagerJobRisk();
      if (sackedNow) {
        /* modal bloqueia avanço */
      } else if (completedSeason) {
        if (!deps.tryPrepareSeasonTransition()) {
          if (navigateDashboard) deps.navigateToDashboard();
        }
      } else if (deps.isUserSeasonIdle()) {
        deps.simulateNonHumanSeasonRemainder();
      } else if (navigateDashboard) {
        deps.navigateToDashboard();
      }
    } finally {
      deps.setRoundCommitted(false);
    }
  };

  const advanceCupRound = () => {
    if (deps.getRoundCommitted()) return;
    const liveMatchGame = deps.getLiveMatchGame();
    const gateResult = deps.creditUserHomeGate(liveMatchGame);
    deps.pushUserMatchResultMessage(liveMatchGame, gateResult);
    if (
      liveMatchGame &&
      Number.isFinite(Number(liveMatchGame.homeGoals)) &&
      Number.isFinite(Number(liveMatchGame.awayGoals))
    ) {
      const fillRate = deps.resolveMatchAttendance(liveMatchGame)?.fillRate ?? liveMatchGame.fillRate ?? null;
      deps.applyClubStatusAfterRound([liveMatchGame], fillRate);
    }
    if (!deps.getAvailabilityCommitted()) deps.commitLiveAvailability();
    if (liveMatchGame) {
      const cupParticipants = new Set([liveMatchGame.home, liveMatchGame.away].filter(Boolean));
      deps.serveCompetitionSuspensions(cupParticipants, 'COPA', deps.getCurrentRound());
    }
    advancePostMatchDay();
    deps.orderAllClubFormations(new Set([liveMatchGame?.home, liveMatchGame?.away].filter(Boolean)));
    deps.renderRoster();
    deps.drawBoard();
    deps.advanceCupComputerTies(deps.getCupCompetition().stages.find(item => !item.completed));
    deps.setRoundCommitted(true);
    const userClub = deps.getUserClub();
    if (liveMatchGame && (liveMatchGame.home === userClub || liveMatchGame.away === userClub)) {
      deps.notifyUserMatchPlayed?.();
    }
    deps.persistAfterRoundAdvance();
    deps.refreshSeasonPresentation();
    deps.closeRoundResultsModal();
    deps.closeMatchModal();
    deps.stopMatchClock();
    deps.setMatchStarted(false);
    deps.setMatchFinished(false);
    deps.setLiveMatchGame(null);
    deps.releaseWorldCupSquadBinding();
    deps.clearLiveDaySnapshots();
    deps.setRoundResults(null);
    deps.setRoundResultMessagePushed(false);
    deps.setRoundPreviewResults({});
    deps.setRoundCommitted(false);
    deps.clearLiveMatchPersist();
    if (deps.evaluateManagerJobRisk()) return;
    if (deps.seasonComplete() && deps.tryPrepareSeasonTransition()) return;
    deps.navigateToDashboard();
  };

  const simulateIdleRound = () => {
    const fixturesOf = competition => (Array.isArray(competition?.fixtures) ? competition.fixtures : []);
    const currentRound = deps.getCurrentRound();
    const seasonRoundHistory = deps.getSeasonRoundHistory();
    const alreadyRecorded = resolveRoundAlreadyRecorded(seasonRoundHistory, currentRound, {
      userGame: deps.leagueUserGameForRound(currentRound),
      userLeaguePlayed: deps.userLeaguePlayed,
      isFixtureCompleted: deps.isFixtureCompleted,
    });
    if (!alreadyRecorded) {
      const userDivision = deps.getUserDivision();
      const nationalCompetitions = deps.getNationalCompetitions();
      const roundFixtures = fixturesOf(nationalCompetitions[userDivision])[currentRound - 1] || [];
      const roundParticipants = new Set(
        Object.values(nationalCompetitions).flatMap(competition =>
          (fixturesOf(competition)[currentRound - 1] || [])
            .filter(game => game?.home && game?.away)
            .flatMap(game => [game.home, game.away]),
        ),
      );
      const restDays = clamp(3, 2, 12);
      const recoveryMod = deps.trainingRecoveryMultiplier('after');
      const completedGames = roundFixtures
        .filter(game => game?.home && game?.away && deps.getClubs()[game.home] && deps.getClubs()[game.away])
        .map(game => {
          const result = deps.simulateRoundMatch(game.home, game.away, game);
          // Marca o fixture: senão o placar fica só no histórico e o jogo continua “jogável”.
          if (game && typeof game === 'object') {
            game.homeGoals = result.homeGoals;
            game.awayGoals = result.awayGoals;
            game.completed = true;
            if (result.penalties) game.penalties = result.penalties;
            if (result.shootoutWinner) game.shootoutWinner = result.shootoutWinner;
            if (result.shootoutPenalties) game.shootoutPenalties = result.shootoutPenalties;
          }
          return result;
        });
      completedGames.forEach(deps.recordGameLeaders);
      if (userDivision !== 'D' || currentRound <= 10) completedGames.forEach(deps.applyRoundToTable);
      deps.serveDisciplineSuspensionsForRound();
      deps.serveAvailability(restDays, roundParticipants);
      deps.applyClubStatusAfterRound(completedGames, null);
      deps.applyUserWageBillForRound(currentRound);
      deps.creditLeagueHomeTvForGames(completedGames, userDivision);
      deps.simulateNationalRound();
      syncNationalRoundsDuringSerieDKnockout(currentRound);
      const userClub = deps.getUserClub();
      seasonRoundHistory.push({
        round: currentRound,
        games: completedGames.map(game => compactMatchResult(game, { keepData: involvesClub(game, userClub) })),
        userStats: null,
      });
      deps.updateSeriesDKnockout(currentRound);
      deps.recoverPlayers(Math.max(1, Math.round(restDays * recoveryMod)));
      deps.orderAllClubFormations(roundParticipants);
      deps.advanceCareerCalendarTo(deps.fixtureDate(currentRound));
      deps.invalidateUserScheduleCache?.();
      if (deps.evaluateManagerJobRisk()) return { sacked: true };
    } else {
      deps.updateSeriesDKnockout(currentRound);
      deps.invalidateUserScheduleCache?.();
    }
    const userDivision = deps.getUserDivision();
    const completedSeasonNow = currentRound >= nationalSeasonLastRound(deps, userDivision);
    if (
      userDivision === 'D' &&
      currentRound === 22 &&
      !(deps.getCompetitionRoundHistory().A || []).some(item => item.round >= 23)
    ) {
      deps.finishRemainingNationalRounds(11, 38);
    }
    deps.setCurrentRound(currentRound + 1);
    deps.reconcileCurrentRound();
    deps.processAiMarketAfterRound();
    const championshipFixtures = deps.getChampionshipFixtures();
    const fixtureCap = Math.max(
      Array.isArray(championshipFixtures) ? championshipFixtures.length : 0,
      fixturesOf(deps.getNationalCompetitions()[userDivision]).length,
      deps.getCurrentRound(),
      1,
    );
    const careerSeason = deps.getCareerSeason();
    const cupReferenceDate = completedSeasonNow
      ? new Date(careerSeason, 11, 31, 12)
      : deps.fixtureDate(clamp(deps.getCurrentRound(), 1, fixtureCap));
    deps.advanceCupThroughDate(cupReferenceDate);
    advanceStateLeagueThroughDate(cupReferenceDate);
    const wcReferenceDate = completedSeasonNow
      ? worldCupWindowEndDate(careerSeason)
      : deps.getCareerCalendarDate();
    deps.advanceWorldCupThroughDateLocal(wcReferenceDate);
    if (completedSeasonNow) deps.refreshWorldCupFixtures?.();
    deps.maybeSendNationalTeamOffers();
    deps.setRoundPreviewResults({});
    deps.persistAfterRoundAdvance();
    return { sacked: false, finished: completedSeasonNow };
  };

  return {
    advanceStateLeagueThroughDate,
    advancePostMatchDay,
    advanceStateLeagueRound,
    advanceSeasonRound,
    advanceCupRound,
    simulateIdleRound,
  };
}

export { advanceStateLeagueThroughDateCore };
