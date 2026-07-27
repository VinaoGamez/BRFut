import { clearStaleKnockoutShootout, isKnockoutShootoutCompetition, KNOCKOUT_COMPETITIONS } from './knockout-shootout.js';

/**
 * Consolida stats ao vivo e grava resultado de mata-mata (Copa, Recopa, Série D).
 */
export function createLiveKnockoutCommit(deps) {
  const buildLiveKnockoutStats = () => {
    const { home: h, away: a } = deps.calendarLiveSideStats();
    const { home: homeGoals, away: awayGoals } = deps.calendarLiveScores();
    const sideGoals = deps.calendarLiveSideGoals();
    const { home: hp, away: ap } = deps.calendarPossessionPair();
    return {
      homeGoals,
      awayGoals,
      goals: { home: [...sideGoals.home], away: [...sideGoals.away] },
      data: {
        homePossession: hp,
        awayPossession: ap,
        homePasses: h.passes,
        awayPasses: a.passes,
        homeAccurate: h.accurate,
        awayAccurate: a.accurate,
        homeShots: h.shots,
        awayShots: a.shots,
        homeOnTarget: h.on,
        awayOnTarget: a.on,
        homeOff: h.off,
        awayOff: a.off,
        homeSaved: h.saved,
        awaySaved: a.saved,
        homePenalties: h.penalties,
        awayPenalties: a.penalties,
        homeOffsides: h.offsides,
        awayOffsides: a.offsides,
        homeKeeperSaves: h.keeperSaves,
        awayKeeperSaves: a.keeperSaves,
        homeTackles: h.tackles,
        awayTackles: a.tackles,
        homeFouls: h.fouls,
        awayFouls: a.fouls,
        homeYellow: h.yellow,
        awayYellow: a.yellow,
        homeRed: h.red,
        awayRed: a.red,
      },
    };
  };

  const commitLiveKnockoutResult = () => {
    const liveMatchGame = deps.getLiveMatchGame();
    if (!liveMatchGame || liveMatchGame.completed || !isKnockoutShootoutCompetition(liveMatchGame)) {
      return false;
    }
    Object.assign(liveMatchGame, buildLiveKnockoutStats(), { completed: true });
    clearStaleKnockoutShootout(liveMatchGame);
    if (!deps.getAvailabilityCommitted()) deps.commitLiveAvailability();
    deps.recordGameLeaders(liveMatchGame);
    deps.persistPlayerHistory();
    if (liveMatchGame.competition === KNOCKOUT_COMPETITIONS.COPA) {
      const cupCompetition = deps.getCupCompetition();
      const stage = cupCompetition.stages.find(item => item.fixtures.includes(liveMatchGame));
      if (stage) {
        deps.resolveCupTie(stage, liveMatchGame.tieId);
        deps.finalizeCupStageIfReady(stage);
      }
    }
    if (liveMatchGame.competition === KNOCKOUT_COMPETITIONS.RECOPA) {
      deps.completeRecopaNationalFixture(deps.getRecopaCompetition(), liveMatchGame);
      deps.refreshRecopaFixtures();
      deps.rebuildCalendarGames();
    }
    return true;
  };

  return { buildLiveKnockoutStats, commitLiveKnockoutResult };
}
