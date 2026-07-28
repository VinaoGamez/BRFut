import { FEATURES } from '../core/constants.js';
import { clamp } from '../ui/dom.js';
import { compactMatchResult, involvesClub, MEMORY_LIMITS } from '../core/save.js';
import { recordKnockoutResult, winnerFromGame, loserFromGame } from './world-cup-bracket.js';
import { isKnockoutShootoutCompetition, KNOCKOUT_COMPETITIONS } from './knockout-shootout.js';
import { WORLD_CUP_COMPETITION } from './world-cup-calendar.js';

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
}

function advanceStateLeagueThroughDateCore(deps, date) {
  if (!FEATURES.stateLeague || !deps.getSavedNewGame() || !date || typeof deps.simulateRoundMatch !== 'function') {
    return false;
  }
  const changed = deps.getStateLeagueEngine().advanceThroughDate(date, {
    simulateMatch: deps.simulateRoundMatch,
    userClub: deps.getUserClub(),
  });
  if (changed) {
    deps.rebuildCalendarGames();
    deps.persistPlayerHistory();
    deps.invalidateUserScheduleCache();
  }
  return changed;
}

/**
 * Avanço de rodada: estadual, nacional, pós-jogo e tick de calendário.
 */
export function createRoundAdvanceEngine(deps) {
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
        deps.refreshWorldCupFixtures();
        deps.rebuildCalendarGames();
        advancePostMatchDay();
        deps.persistSeason(true);
        deps.refreshSeasonPresentation();
        deps.renderTeamStatsCard?.();
        resetLiveMatchSession(deps);
        if (deps.evaluateManagerJobRisk()) return;
        if (navigateDashboard) deps.navigateToDashboard();
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

      const currentRound = deps.getCurrentRound();
      const seasonRoundHistory = deps.getSeasonRoundHistory();
      const userClub = deps.getUserClub();
      const alreadyRecorded = (() => {
        const userGame = deps.leagueUserGameForRound(currentRound);
        const historyEntry = seasonRoundHistory.find(item => item.round === currentRound);
        const userDone = !userGame || deps.isFixtureCompleted(userGame);
        if (historyEntry && !userDone) {
          const idx = seasonRoundHistory.findIndex(item => item.round === currentRound);
          if (idx >= 0) seasonRoundHistory.splice(idx, 1);
          return false;
        }
        return seasonRoundHistory.some(item => item.round === currentRound);
      })();

      if (!alreadyRecorded) {
        const nationalCompetitions = deps.getNationalCompetitions();
        const roundParticipants = new Set(
          Object.values(nationalCompetitions).flatMap(competition => {
            const round = (Array.isArray(competition?.fixtures) ? competition.fixtures : [])[currentRound - 1] || [];
            return (Array.isArray(round) ? round : [])
              .filter(game => game?.home && game?.away)
              .flatMap(game => [game.home, game.away]);
          }),
        );
        const restDays = deps.intervalDaysForRoundAdvance();
        deps.commitLiveAvailability();
        const completedGames = deps.simulateRoundResults(true);
        completedGames.forEach(deps.recordGameLeaders);
        if (deps.getUserDivision() !== 'D' || currentRound <= 10) {
          completedGames.forEach(deps.applyRoundToTable);
        }
        try {
          deps.persistPlayerHistory();
        } catch (error) {
          console.warn('[matchday] histórico de jogadores não gravou', error);
        }
        deps.serveDisciplineSuspensionsForRound();
        deps.serveAvailability(restDays, roundParticipants);
        const fillRate = deps.resolveMatchAttendance(liveMatchGame)?.fillRate ?? liveMatchGame?.fillRate ?? null;
        deps.applyClubStatusAfterRound(completedGames, fillRate);
        deps.applyUserWageBillForRound(currentRound);
        deps.creditLeagueHomeTvForGames(completedGames, deps.getUserDivision());
        deps.simulateNationalRound();
        const liveStats = deps.getLiveSideStats();
        const liveGoals = deps.getLiveSideGoals();
        seasonRoundHistory.push({
          round: currentRound,
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
        deps.updateSeriesDKnockout(currentRound);
        deps.orderAllClubFormations();
        deps.renderRoster();
        deps.drawBoard();
        deps.recoverPlayers(Math.max(1, Math.round(restDays * deps.trainingRecoveryMultiplier('after'))));
        advancePostMatchDay();
      }

      const userDivision = deps.getUserDivision();
      const careerSeason = deps.getCareerSeason();
      const completedSeason = currentRound === 38 || (userDivision === 'D' && currentRound === 22);
      if (userDivision === 'D' && currentRound === 22) deps.finishRemainingNationalRounds(23);
      if (!alreadyRecorded) deps.setCurrentRound(currentRound + 1);
      deps.reconcileCurrentRound();
      if (!alreadyRecorded) deps.processAiMarketAfterRound();

      const championshipFixtures = deps.getChampionshipFixtures();
      const cupReferenceDate = completedSeason
        ? new Date(careerSeason, 11, 31, 12)
        : deps.fixtureDate(clamp(deps.getCurrentRound(), 1, championshipFixtures.length));
      deps.advanceCupThroughDate(cupReferenceDate);
      advanceStateLeagueThroughDate(cupReferenceDate);
      deps.advanceWorldCupThroughDateLocal(deps.getCareerCalendarDate());
      deps.maybeSendNationalTeamOffers();
      if (completedSeason) deps.finalizeNationalRankingSeason();
      deps.persistAfterRoundAdvance();
      try {
        deps.refreshSeasonPresentation();
      } catch (error) {
        console.warn('[matchday] falha ao atualizar UI pós-rodada', error);
      }
      resetLiveMatchSession(deps);
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
    deps.orderAllClubFormations();
    deps.renderRoster();
    deps.drawBoard();
    deps.advanceCupComputerTies(deps.getCupCompetition().stages.find(item => !item.completed));
    deps.setRoundCommitted(true);
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
    const alreadyRecorded = (() => {
      const userGame = deps.leagueUserGameForRound(currentRound);
      const historyEntry = seasonRoundHistory.find(item => item.round === currentRound);
      const userDone = !userGame || deps.isFixtureCompleted(userGame);
      if (historyEntry && !userDone) {
        const idx = seasonRoundHistory.findIndex(item => item.round === currentRound);
        if (idx >= 0) seasonRoundHistory.splice(idx, 1);
        return false;
      }
      return (seasonRoundHistory || []).some(item => item.round === currentRound);
    })();
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
        .map(game => deps.simulateRoundMatch(game.home, game.away, game));
      completedGames.forEach(deps.recordGameLeaders);
      deps.persistPlayerHistory();
      if (userDivision !== 'D' || currentRound <= 10) completedGames.forEach(deps.applyRoundToTable);
      deps.serveDisciplineSuspensionsForRound();
      deps.serveAvailability(restDays, roundParticipants);
      deps.applyClubStatusAfterRound(completedGames, null);
      deps.applyUserWageBillForRound(currentRound);
      deps.creditLeagueHomeTvForGames(completedGames, userDivision);
      deps.simulateNationalRound();
      const userClub = deps.getUserClub();
      seasonRoundHistory.push({
        round: currentRound,
        games: completedGames.map(game => compactMatchResult(game, { keepData: involvesClub(game, userClub) })),
        userStats: null,
      });
      deps.updateSeriesDKnockout(currentRound);
      deps.recoverPlayers(Math.max(1, Math.round(restDays * recoveryMod)));
      deps.orderAllClubFormations();
      deps.advanceCareerCalendarTo(deps.fixtureDate(currentRound));
      if (deps.evaluateManagerJobRisk()) return { sacked: true };
    } else {
      deps.updateSeriesDKnockout(currentRound);
    }
    const userDivision = deps.getUserDivision();
    const completedSeasonNow = currentRound === 38 || (userDivision === 'D' && currentRound === 22);
    if (
      userDivision === 'D' &&
      currentRound === 22 &&
      !(deps.getCompetitionRoundHistory().A || []).some(item => item.round >= 23)
    ) {
      deps.finishRemainingNationalRounds(23);
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
    deps.advanceWorldCupThroughDateLocal(deps.getCareerCalendarDate());
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
