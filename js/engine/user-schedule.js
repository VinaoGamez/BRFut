import { FEATURES, SERIE_D_GROUP_ROUNDS } from '../core/constants.js';
import { clamp } from '../ui/dom.js';
import { findRecordedGame, findRecordedGameByPair, gameMatchesRecorded, resolveLeagueFixtureRound } from './competition-calendar.js';
import { isKnockoutShootoutCompetition, formatKnockoutFixtureScore } from './knockout-shootout.js';
import { parseCalendarDate } from './season-scheduler.js';
import { isRecopaNationalGame } from './recopa-national.js';
import { isStateLeagueGame } from './state-league-format.js';
import { WORLD_CUP_COMPETITION } from './world-cup-calendar.js';
import { isClubCalendarBlackout } from './season-calendar-cycle.js';

/**
 * Agenda do usuário: fixtures pendentes/concluídos e helpers de calendário.
 */
export function createUserScheduleEngine({
  fixtureDetails,
  getUserClub,
  getUserDivision,
  getUserNationalTeamName,
  getChampionshipFixtures,
  getCopaDoBrasilFixtures,
  getRecopaFixtures,
  getWorldCupCompetition,
  getWorldCupAllFixtures,
  getStateLeagueEngine,
  getSavedNewGame,
  getSeasonRoundHistory,
  userLeaguePlayed,
  userGroupStageComplete,
  getNationalCompetitionsD,
  getCareerCalendarDate,
  advanceCareerCalendarTo,
  rescheduleAllCupFixtures,
}) {
  let userScheduleCache = null;
  let pendingUserScheduleCache = null;
  const invalidateUserScheduleCache = () => {
    userScheduleCache = null;
    pendingUserScheduleCache = null;
  };

  const isUserFixture = game => {
    const userClub = getUserClub();
    const userNationalTeamName = getUserNationalTeamName();
    if (game.competition === WORLD_CUP_COMPETITION && userNationalTeamName) {
      return game.home === userNationalTeamName || game.away === userNationalTeamName;
    }
    return game.home === userClub || game.away === userClub;
  };

  const leagueFixtureRecorded = game => {
    if (!game?.home || !game?.away) return false;
    const seasonRoundHistory = getSeasonRoundHistory();
    const championshipFixtures = getChampionshipFixtures();
    const resolvedRound = resolveLeagueFixtureRound(game, championshipFixtures);
    const byRound =
      resolvedRound != null
        ? seasonRoundHistory.find(item => item.round === resolvedRound)
        : game.round && seasonRoundHistory.find(item => item.round === game.round);
    if (byRound?.games?.some(entry => gameMatchesRecorded(game, entry) || findRecordedGameByPair(game, entry))) {
      return true;
    }
    return seasonRoundHistory.some(item =>
      item.games?.some(entry => gameMatchesRecorded(game, entry) || findRecordedGameByPair(game, entry)),
    );
  };

  const isSerieDGroupStageGame = game =>
    getUserDivision() !== 'D'
    || (!isKnockoutShootoutCompetition(game) && (game.round || 0) <= SERIE_D_GROUP_ROUNDS);

  const isFixtureCompleted = game => {
    const userClub = getUserClub();
    const stateLeagueEngine = getStateLeagueEngine();
    if (isStateLeagueGame(game)) return stateLeagueEngine.isGameComplete(game, userClub);
    if (isRecopaNationalGame(game)) return !!game.completed;
    if (game.competition === WORLD_CUP_COMPETITION) return !!game.completed || game.homeGoals != null;
    if (game.competition === 'COPA DO BRASIL' || isKnockoutShootoutCompetition(game)) {
      if (game.completed) return true;
      if (Number.isFinite(Number(game.homeGoals)) && Number.isFinite(Number(game.awayGoals))) return true;
      // Idle/sim pode ter gravado o placar no histórico sem marcar completed.
      const roundRecord = getSeasonRoundHistory().find(item => item.round === game.round);
      return !!findRecordedGame(game, roundRecord?.games || []);
    }
    if (leagueFixtureRecorded(game)) return true;
    if (Number.isFinite(Number(game.homeGoals)) && Number.isFinite(Number(game.awayGoals))) return true;
    const played = userLeaguePlayed();
    const resolvedRound = resolveLeagueFixtureRound(game, getChampionshipFixtures());
    if (resolvedRound != null) return resolvedRound <= played;
    if (Number.isFinite(Number(game.round)) && Number(game.round) > 0) return Number(game.round) <= played;
    return false;
  };

  const userKnockoutFixtures = () =>
    getUserDivision() === 'D'
      ? (Array.isArray(getNationalCompetitionsD()?.fixtures) ? getNationalCompetitionsD().fixtures : [])
        .filter(Array.isArray)
        .flat()
        .filter(isKnockoutShootoutCompetition)
      : [];

  const userSchedule = () => {
    if (userScheduleCache) return userScheduleCache;
    const userClub = getUserClub();
    const savedNewGame = getSavedNewGame();
    const stateLeagueEngine = getStateLeagueEngine();
    const championshipFixtures = getChampionshipFixtures();

    const league = championshipFixtures.flat().filter(isUserFixture).filter(isSerieDGroupStageGame);
    const knockout = userGroupStageComplete() ? userKnockoutFixtures().filter(isUserFixture) : [];
    const cup = getCopaDoBrasilFixtures().filter(isUserFixture);
    const recopa = getRecopaFixtures().filter(isUserFixture);
    const worldCupCompetition = getWorldCupCompetition();
    const worldCup = worldCupCompetition
      ? getWorldCupAllFixtures(worldCupCompetition).filter(isUserFixture)
      : [];
    const stateEntries = FEATURES.stateLeague && savedNewGame
      ? stateLeagueEngine.getUserFixtures(userClub).map(game => ({ game, details: fixtureDetails(game) }))
      : [];

    userScheduleCache = [
      ...stateEntries,
      ...league.map(game => ({ game, details: fixtureDetails(game) })),
      ...knockout.map(game => ({ game, details: fixtureDetails(game) })),
      ...cup.map(game => ({ game, details: fixtureDetails(game) })),
      ...recopa.map(game => ({ game, details: fixtureDetails(game) })),
      ...worldCup.map(game => ({ game, details: fixtureDetails(game) })),
    ].sort((a, b) => {
      const aTs = parseCalendarDate(a.details?.date)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bTs = parseCalendarDate(b.details?.date)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aTs - bTs
        || ((a.game.round || 0) - (b.game.round || 0))
        || String(a.game.leg || '').localeCompare(String(b.game.leg || ''));
    });
    pendingUserScheduleCache = null;
    return userScheduleCache;
  };

  const isWorldCupFixture = game => game?.competition === WORLD_CUP_COMPETITION;

  const isClubFixtureBlockedByWorldCup = entry => {
    if (!entry?.game || isWorldCupFixture(entry.game)) return false;
    const date = entry.details?.date;
    if (!date) return false;
    const year = Number(date.getFullYear?.() || getCareerCalendarDate()?.getFullYear?.());
    return isClubCalendarBlackout(date, year);
  };

  const pendingUserSchedule = () => {
    if (pendingUserScheduleCache) return pendingUserScheduleCache;
    // Durante a janela CMU, jogos de clube (Série D etc.) não entram na fila —
    // slots travados; a Copa tem prioridade absoluta.
    pendingUserScheduleCache = userSchedule()
      .filter(entry => !isFixtureCompleted(entry.game))
      .filter(entry => !isClubFixtureBlockedByWorldCup(entry));
    return pendingUserScheduleCache;
  };

  const lastCompletedUserEntry = () => userSchedule().filter(entry => isFixtureCompleted(entry.game)).pop();

  const leagueUserGameForRound = round => {
    const fromGroup = (getChampionshipFixtures()[round - 1] || []).find(isUserFixture);
    if (fromGroup) return fromGroup;
    if (getUserDivision() === 'D' && round > SERIE_D_GROUP_ROUNDS) {
      const knockoutRound = getNationalCompetitionsD()?.fixtures?.[round - 1];
      if (Array.isArray(knockoutRound)) return knockoutRound.find(isUserFixture) || null;
    }
    return null;
  };

  const firstPendingLeagueRound = () => Math.max(1, userLeaguePlayed() + 1);

  const nextLeagueUserEntry = () => {
    const championshipFixtures = getChampionshipFixtures();
    const maxRound = getUserDivision() === 'D' && !userGroupStageComplete()
      ? SERIE_D_GROUP_ROUNDS
      : championshipFixtures.length;
    for (let round = firstPendingLeagueRound(); round <= maxRound; round++) {
      const game = leagueUserGameForRound(round);
      if (game && !isFixtureCompleted(game)) {
        const entry = { game, details: fixtureDetails(game) };
        if (isClubFixtureBlockedByWorldCup(entry)) continue;
        return entry;
      }
    }
    return null;
  };

  const nextPendingUserEntry = () => {
    const pending = pendingUserSchedule();
    const careerDate = getCareerCalendarDate();
    const year = Number(careerDate?.getFullYear?.());
    // No meio da janela CMU, prioriza sempre a próxima partida da Copa.
    if (year && isClubCalendarBlackout(careerDate, year)) {
      const wc = pending.find(entry => isWorldCupFixture(entry.game));
      if (wc) return wc;
    }
    const next = pending[0];
    if (next && !isWorldCupFixture(next.game)) {
      const wc = pending.find(entry => isWorldCupFixture(entry.game));
      if (wc) return wc;
    }
    return next || nextLeagueUserEntry();
  };

  const isPendingFixtureOverdue = entry => {
    if (!entry?.details?.date) return false;
    const target = new Date(entry.details.date);
    target.setHours(12, 0, 0, 0);
    const today = new Date(getCareerCalendarDate());
    today.setHours(12, 0, 0, 0);
    return today.getTime() > target.getTime();
  };

  const daysBetweenDates = (from, to) =>
    Math.max(1, Math.round(Math.abs(to.getTime() - from.getTime()) / 86400000));

  const daysUntilNextFixtureFromToday = () => {
    const next = nextPendingUserEntry();
    if (!next) return 0;
    return Math.max(0, Math.round((next.details.date.getTime() - getCareerCalendarDate().getTime()) / 86400000));
  };

  const restDaysUntilNextFixture = () => {
    const last = lastCompletedUserEntry();
    const next = nextPendingUserEntry();
    if (!next) return 3;
    if (!last) return daysBetweenDates(getCareerCalendarDate(), next.details.date);
    return daysBetweenDates(last.details.date, next.details.date);
  };

  const intervalDaysForRoundAdvance = () => clamp(restDaysUntilNextFixture(), 2, 12);

  const normalizeCalendarBeforeNextMatch = () => {
    const next = nextPendingUserEntry();
    if (!next || isFixtureCompleted(next.game)) return false;
    if (!isPendingFixtureOverdue(next)) return false;
    const target = new Date(next.details.date);
    target.setHours(12, 0, 0, 0);
    advanceCareerCalendarTo(target);
    return true;
  };

  const ensureCalendarMatchConsistency = () => {
    const next = nextPendingUserEntry();
    if (!next || !isPendingFixtureOverdue(next)) return false;
    if (next.game?.competition === 'COPA DO BRASIL') rescheduleAllCupFixtures();
    return normalizeCalendarBeforeNextMatch();
  };

  const fixtureResultLabel = game => {
    const seasonRoundHistory = getSeasonRoundHistory();
    if (game.competition === 'COPA DO BRASIL' || isKnockoutShootoutCompetition(game)) {
      if (!game.completed && !game.homeGoals && game.homeGoals !== 0) {
        const roundRecord = seasonRoundHistory.find(item => item.round === game.round);
        const result = findRecordedGame(game, roundRecord?.games || []);
        if (result) return formatKnockoutFixtureScore(result, { separator: '—' });
        return null;
      }
      return formatKnockoutFixtureScore(game, { separator: '—' });
    }
    const roundRecord = seasonRoundHistory.find(item => item.round === game.round);
    const result = findRecordedGame(game, roundRecord?.games || []);
    if (!result) return null;
    return `${result.homeGoals}—${result.awayGoals}`;
  };

  const syncCareerCalendarAfterRoundAdvance = () => {
    const last = lastCompletedUserEntry();
    if (last?.details?.date) {
      const afterMatch = new Date(last.details.date);
      afterMatch.setDate(afterMatch.getDate() + 1);
      afterMatch.setHours(12, 0, 0, 0);
      if (getCareerCalendarDate().getTime() < afterMatch.getTime()) {
        advanceCareerCalendarTo(afterMatch);
      }
    }
    normalizeCalendarBeforeNextMatch();
  };

  return {
    invalidateUserScheduleCache,
    isUserFixture,
    leagueFixtureRecorded,
    isSerieDGroupStageGame,
    isFixtureCompleted,
    userKnockoutFixtures,
    userSchedule,
    pendingUserSchedule,
    lastCompletedUserEntry,
    leagueUserGameForRound,
    firstPendingLeagueRound,
    nextLeagueUserEntry,
    nextPendingUserEntry,
    isPendingFixtureOverdue,
    daysBetweenDates,
    daysUntilNextFixtureFromToday,
    restDaysUntilNextFixture,
    intervalDaysForRoundAdvance,
    normalizeCalendarBeforeNextMatch,
    syncCareerCalendarAfterRoundAdvance,
    ensureCalendarMatchConsistency,
    fixtureResultLabel,
  };
}
