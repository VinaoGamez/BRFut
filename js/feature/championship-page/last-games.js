/** Abre o modal de resultados alinhado à competição/fase da página Campeonatos. */
export function createChampionshipLastGamesOpener({
  getPageCompetition,
  getUserClub,
  getCurrentRound,
  stateLeagueEngine,
  getPageState,
  championshipPageIsKnockoutView,
  setChampionshipPagePickerOpen,
  setRoundBrowserLockedCompetition,
  setRoundBrowserDivision,
  setRoundBrowserRound,
  setRoundBrowserGroup,
  setRoundBrowserWorldCupGroup,
  renderRoundResultsBrowser,
  openRoundResultsModal,
}) {
  return () => {
    const pageCompetition = getPageCompetition();
    if (pageCompetition === 'CUP' || pageCompetition === 'CMU') return;

    const page = getPageState();
    const userClub = getUserClub();
    const currentRound = getCurrentRound();

    setRoundBrowserLockedCompetition(pageCompetition);
    setRoundBrowserDivision(pageCompetition);

    if (String(pageCompetition || '').startsWith('EST:')) {
      setRoundBrowserRound(page.pageStateRound || stateLeagueEngine.getCurrentRound(pageCompetition, userClub));
      setRoundBrowserGroup(Math.max(0, page.pageStateGroup));
    } else if (pageCompetition === 'CMU') {
      setRoundBrowserRound(Math.max(1, Number(page.pageWorldCupRound) || 1));
      setRoundBrowserWorldCupGroup(Math.max(0, Number(page.pageWorldCupGroup) || 0));
    } else if (pageCompetition === 'D') {
      if (page.pageSerieDMode === 'knockout' || championshipPageIsKnockoutView()) {
        setRoundBrowserRound(Math.max(currentRound, 11));
        setRoundBrowserGroup(0);
      } else {
        setRoundBrowserGroup(Math.max(0, Number(page.pageSerieDGroup) || 0));
        setRoundBrowserRound(Math.min(currentRound, 10));
      }
    } else {
      setRoundBrowserRound(currentRound);
      setRoundBrowserGroup(0);
    }

    setChampionshipPagePickerOpen(false);
    renderRoundResultsBrowser();
    openRoundResultsModal();
  };
}
