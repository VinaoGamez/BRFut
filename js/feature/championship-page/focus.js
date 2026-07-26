/** Foca a aba Campeonatos na competição/fase do próximo jogo do usuário. */
import { serieDPhaseIndexForRound } from '../../engine/serie-d-format.js';

export function createChampionshipPageFocus({
  getUserDivision,
  getUserClub,
  getClubs,
  clamp,
  cupPhaseDefinitions,
  stateLeagueEngine,
  isStateLeagueGame,
  isStateChampionshipPage,
  isKnockoutShootoutCompetition,
  isUserFixture,
  getRealClub,
  stateCompetitionKey,
  getPageState,
  patchPageState,
  selectChampionshipPageCompetition,
  renderChampionshipPage,
  getCurrentRound,
}) {
  const championshipPageIdForGame = game => {
    const userDivision = getUserDivision();
    const userClub = getUserClub();
    const clubs = getClubs();
    if (!game) return userDivision;
    if (game.competition === 'COPA DO BRASIL') return 'CUP';
    if (game.competition === 'RECOPA NACIONAL') return 'RECOPA';
    if (isStateLeagueGame(game)) {
      const userState = stateLeagueEngine.getUserDivision(userClub);
      const uf = String(game.stateUf || userState?.uf || getRealClub(userClub)?.uf || 'SP').toUpperCase();
      const tier = Number(game.stateTier) || userState?.tier || 1;
      return stateCompetitionKey(uf, tier);
    }
    if (typeof isKnockoutShootoutCompetition === 'function' && isKnockoutShootoutCompetition(game) && userDivision === 'D') {
      return 'D';
    }
    if (isUserFixture(game)) return userDivision;
    return clubs[game.home]?.division || clubs[game.away]?.division || userDivision;
  };

  const focusChampionshipPageForUserGame = game => {
    if (!game) {
      selectChampionshipPageCompetition(getUserDivision());
      return;
    }
    const competitionId = championshipPageIdForGame(game);
    selectChampionshipPageCompetition(competitionId);
    if (competitionId === 'CUP') {
      const page = getPageState();
      const phaseIdx = cupPhaseDefinitions.findIndex(def => def.name === game.phase);
      const phase = Number(game.phaseIndex) || (phaseIdx >= 0 ? phaseIdx + 1 : 0) || page.pageCupPhase;
      if (phase >= 1) {
        patchPageState({ pageCupPhase: clamp(phase, 1, cupPhaseDefinitions.length) });
      }
      renderChampionshipPage();
      return;
    }
    if (isStateChampionshipPage(competitionId)) {
      const roundLimit = stateLeagueEngine.getRoundLimit(competitionId) || 1;
      const patch = {};
      if (Number(game.round) > 0) patch.pageStateRound = clamp(Number(game.round), 1, roundLimit);
      if (game.stateGroupIndex != null) patch.pageStateGroup = Math.max(0, Math.min(1, Number(game.stateGroupIndex) || 0));
      if (Object.keys(patch).length) patchPageState(patch);
      renderChampionshipPage();
      return;
    }
    if (competitionId === 'D' && typeof isKnockoutShootoutCompetition === 'function' && isKnockoutShootoutCompetition(game)) {
      patchPageState({
        pageSerieDMode: 'knockout',
        pageSerieDPhase: serieDPhaseIndexForRound(Number(game.round) || getCurrentRound()),
      });
      renderChampionshipPage();
    }
  };

  const focusChampionshipPageForNextUserGame = nextPendingUserEntry => {
    const entry = typeof nextPendingUserEntry === 'function' ? nextPendingUserEntry() : null;
    focusChampionshipPageForUserGame(entry?.game || null);
  };

  return { championshipPageIdForGame, focusChampionshipPageForUserGame, focusChampionshipPageForNextUserGame };
}
