import { FEATURES } from '../core/constants.js';
import { parseCalendarDate } from './season-scheduler.js';
import { STATE_LEAGUE_COMPETITION, stateLeaguePhaseLabel } from './state-league-format.js';

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
    const key = `${game.home}|${game.away}|${game.round || ''}|${game.phase || ''}|state`;
    if (seen.has(key)) return;
    seen.add(key);
    const enriched = { ...game, competition: game.competition || STATE_LEAGUE_COMPETITION, ...meta };
    const details = fixtureDetails(enriched);
    entries.push({
      ...enriched,
      sortDate: parseCalendarDate(details.date) || parseCalendarDate(game.date),
    });
  };

  const uf = stateLeagueEngine.userUf;
  (stateLeagueEngine.history[uf] || []).forEach(round => {
    (round.games || []).forEach(game => register(game, {
      dashboardCompetition: 'state',
      label: `Estadual · Rodada ${round.round}`,
      round: game.round ?? round.round,
    }));
  });

  stateLeagueEngine.getUserFixtures(userClub).forEach(game => {
    if (!stateLeagueEngine.isGameComplete(game, userClub)) return;
    register(game, {
      dashboardCompetition: 'state',
      label: `Estadual · ${stateLeaguePhaseLabel(game)}`,
    });
  });

  return entries;
}
