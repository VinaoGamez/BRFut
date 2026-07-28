import { FEATURES } from '../core/constants.js';
import { parseCalendarDate } from './season-scheduler.js';
import { STATE_LEAGUE_COMPETITION, stateLeaguePhaseLabel } from './state-league-format.js';
import { userMatchResultIdentityKey } from './user-match-results.js';

/**
 * Histórico estadual concluído para dashboard (Últimos Jogos / faixa V-E-D).
 */
export function collectStateLeagueDashboardGames({
  fixtureDetails,
  getSavedNewGame,
  getStateLeagueEngine,
  getUserClub,
}) {
  if (!FEATURES.stateLeague || !getSavedNewGame()) return [];
  const stateLeagueEngine = getStateLeagueEngine();
  const userClub = getUserClub();
  const entries = [];
  const seen = new Set();

  const register = (game, meta) => {
    if (!game?.home || !game?.away) return;
    const scored = game.completed || game.homeGoals != null || game.awayGoals != null;
    if (!scored) return;
    const key = userMatchResultIdentityKey(game, meta);
    if (!key || seen.has(key)) return;
    seen.add(key);
    const enriched = { ...game, competition: game.competition || STATE_LEAGUE_COMPETITION, ...meta };
    const details = fixtureDetails(enriched);
    entries.push({
      ...enriched,
      sortDate: parseCalendarDate(details.date) || parseCalendarDate(game.date),
    });
  };

  const uf = stateLeagueEngine.userUf;
  const liveFixtures = stateLeagueEngine.getUserFixtures(userClub);
  const liveFixtureFor = (game, roundNo) =>
    liveFixtures.find(
      item =>
        item.home === game.home &&
        item.away === game.away &&
        Number(item.round ?? roundNo) === Number(game.round ?? roundNo),
    );

  (stateLeagueEngine.history[uf] || []).forEach(round => {
    (round.games || []).forEach(game => {
      const live = liveFixtureFor(game, round.round);
      register(
        {
          ...game,
          round: game.round ?? live?.round ?? round.round,
          phase: game.phase ?? live?.phase,
          leg: game.leg ?? live?.leg,
        },
        {
          dashboardCompetition: 'state',
          label: `Estadual · Rodada ${round.round}`,
          round: game.round ?? live?.round ?? round.round,
          phase: game.phase ?? live?.phase,
        },
      );
    });
  });

  liveFixtures.forEach(game => {
    if (!stateLeagueEngine.isGameComplete(game, userClub)) return;
    register(game, {
      dashboardCompetition: 'state',
      label: `Estadual · ${stateLeaguePhaseLabel(game)}`,
      round: game.round,
      phase: game.phase,
    });
  });

  return entries;
}
