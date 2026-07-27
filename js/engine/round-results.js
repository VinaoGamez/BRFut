import { isPlayableRoundGame } from './round-game-filter.js';
import { isKnockoutShootoutCompetition } from './knockout-shootout.js';

/**
 * Monta resultados da rodada atual: simula jogos da IA e injeta placar ao vivo do usuário.
 */
export function createRoundResultsSimulator(deps) {
  return (force = false) => {
    if (deps.getRoundResults() && !force) return deps.getRoundResults();
    const userClub = deps.getUserClub();
    const liveMatchGame = deps.getLiveMatchGame();
    const liveGoals = deps.getLiveSideGoals();
    const results = deps
      .currentRoundFixtures()
      .filter(isPlayableRoundGame)
      .map(game => {
        if (!deps.isUserFixture(game)) {
          const result = deps.simulateRoundMatch(game.home, game.away, game);
          return {
            ...result,
            fixture: game,
            home: game.home,
            away: game.away,
            round: game.round,
            competition: game.competition,
          };
        }
        const userAtHome = game.home === userClub;
        const result = {
          home: game.home,
          away: game.away,
          homeGoals: userAtHome ? deps.getHomeGoals() : deps.getAwayGoals(),
          awayGoals: userAtHome ? deps.getAwayGoals() : deps.getHomeGoals(),
          user: true,
          fixture: game,
          round: game.round,
          competition: game.competition,
          goals: userAtHome
            ? { home: [...liveGoals.home], away: [...liveGoals.away] }
            : { home: [...liveGoals.away], away: [...liveGoals.home] },
        };
        if (liveMatchGame && liveMatchGame.home === game.home && liveMatchGame.away === game.away) {
          Object.assign(result, {
            penalties: liveMatchGame.penalties,
            shootoutWinner: liveMatchGame.shootoutWinner,
            tieId: game.tieId,
            leg: game.leg,
            competition: game.competition,
            data: liveMatchGame.data,
            completed: isKnockoutShootoutCompetition(game) ? true : undefined,
          });
        }
        return result;
      });
    deps.setRoundResults(results);
    return results;
  };
}
