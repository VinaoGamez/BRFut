import { MODULE_VERSIONS } from '../../core/constants.js';

export function reconcileLinkedFixtureWithLiveSnapshot(linked, snap) {
  if (!linked || !snap?.fixture) return linked;
  const fixture = snap.fixture;
  if (fixture.penalties != null) linked.penalties = fixture.penalties;
  if (fixture.shootoutWinner != null) linked.shootoutWinner = fixture.shootoutWinner;
  if (fixture.shootoutPenalties != null) linked.shootoutPenalties = fixture.shootoutPenalties;
  if (fixture.homeGoals != null) linked.homeGoals = fixture.homeGoals;
  if (fixture.awayGoals != null) linked.awayGoals = fixture.awayGoals;
  // O snapshot ao vivo é a fonte de verdade enquanto a partida não terminou.
  // Saves interrompidos podiam carregar `fixture.completed=true` do calendário e
  // descartar a sessão válida na restauração, prendendo o usuário no mesmo jogo.
  linked.completed = snap.matchFinished ? !!fixture.completed : false;
  return linked;
}

/**
 * Entrada e restauração da partida ao vivo — handlers de clique (#playMatch, etc.)
 * e hidratação de snapshot persistido.
 * @param {object} deps
 */
export function createMatchLiveEntryFeature(deps) {
  const {
    $,
    $$,
    onClick,
    modal,
    timeline,
    getSavedNewGame,
    getValidSavedSeason,
    getCareerSeason,
    userSchedule,
    getCupCompetition,
    getChampionshipFixtures,
    fixtureIdFromGame,
    WORLD_CUP_COMPETITION,
    isWorldCupSeasonActive,
    loadLiveMatchSave,
    clearLiveMatchSave,
    saveLiveMatchSave,
    buildLiveMatchSnapshot,
    hydrateLiveMatchSnapshot,
    isValidLiveMatchSnapshot,
    isFixtureCompleted,
    simulateRoundMatch,
    getUserClub,
    getMatchClub,
    getClubs,
    getFormations,
    getFormationRoles,
    getFormation,
    setFormation,
    getActiveUserSquad,
    getSquad,
    setSquad,
    getLiveMatchGame,
    setLiveMatchGame,
    getHomeScore,
    setHomeScore,
    getAwayScore,
    setAwayScore,
    getGoals,
    setGoals,
    getStats,
    setStats,
    getMinute,
    setMinute,
    getMatchStarted,
    setMatchStarted,
    getMatchFinished,
    setMatchFinished,
    getPreMatchPreparation,
    setPreMatchPreparation,
    getHalftimeShown,
    setHalftimeShown,
    getSecondHalfStarted,
    setSecondHalfStarted,
    getPauses,
    setPauses,
    getStoppageFirst,
    setStoppageFirst,
    getStoppageSecond,
    setStoppageSecond,
    getStoppageElapsed,
    setStoppageElapsed,
    getStoppageActive,
    setStoppageActive,
    getStoppageHalfSnap,
    setStoppageHalfSnap,
    getActivePreparationTitle,
    setActivePreparationTitle,
    getSubstitutions,
    setSubstitutions,
    getAwaySubstitutions,
    setAwaySubstitutions,
    getAwaySubWindows,
    setAwaySubWindows,
    getSubstitutedOut,
    setSubstitutedOut,
    getDisciplineEvents,
    setDisciplineEvents,
    getAvailabilityCommitted,
    setAvailabilityCommitted,
    getRoundResultMessagePushed,
    setRoundResultMessagePushed,
    getCards,
    setCards,
    getMatchFactors,
    setMatchFactors,
    getLiveInjuries,
    setLiveInjuries,
    getLiveDeferredInjuries,
    setLiveDeferredInjuries,
    getLiveOpeningLineup,
    setLiveOpeningLineup,
    getLiveMinutesPlayed,
    setLiveMinutesPlayed,
    getMatchDiscipline,
    setMatchDiscipline,
    getLiveVolumeSamples,
    setLiveVolumeSamples,
    getLiveVolumePrev,
    setLiveVolumePrev,
    getLiveVolumePulse,
    setLiveVolumePulse,
    getLiveVolumeIncidents,
    setLiveVolumeIncidents,
    getPostMatchMedicalQueue,
    setPostMatchMedicalQueue,
    getShootoutState,
    setShootoutState,
    getPendingPenalty,
    setPendingPenalty,
    getPreMatchTacticSnapshot,
    setPreMatchTacticSnapshot,
    getRoundResults,
    setRoundResults,
    getPositionAssignments,
    setPositionAssignments,
    getLatestLiveMatchSnapshot,
    setLatestLiveMatchSnapshot,
    getPauseLineupBaseline,
    setPauseLineupBaseline,
    getRoundCommitted,
    getUserNationalTeamName,
    isWorldCupUserFixture,
    bindSquadForUserFixtureSync,
    bindSquadForUserFixture,
    blank,
    starters,
    renderLiveMatchHeader,
    score,
    renderFinalSummary,
    showFinalActions,
    reopenMatchWindow,
    openPreparation,
    clearLiveMatchPersist,
    collectLiveMatchPersistState,
    scheduleLiveMatchPersist,
    flushLiveMatchPersist,
    persistSeason,
    bindLiveActions,
    stopMatchClock,
    startMatchClock,
    updateLiveMatchClock,
    renderRoster,
    drawBoard,
    closePenaltyDuel,
    isPenaltyDuelOpen,
    liveKnockoutNeedsShootout,
    startPenaltyShootout,
    renderShootoutTrack,
    resumeShootoutFlow,
    startPenaltyAgainst,
    startPenaltyChoice,
    matchLiveUi,
    matchLiveAudio,
    liveDayMatches,
    getPendingSponsorChoice,
    openSponsorPickerIfPending,
    refreshUserFixtures,
    isUserSeasonIdle,
    renderUserMatchPresentation,
    simulateNonHumanSeasonRemainder,
    seasonFullyComplete,
    seasonComplete,
    nextPendingUserEntry,
    tryPrepareSeasonTransition,
    hasPendingUserFixtures,
    prepareSeasonTransition,
    getNextUserGame,
    pushMatchDayBrief,
    pushMessage,
    getCurrentRound,
    isPendingFixtureOverdue,
    sameCalendarDay,
    getCareerCalendarDate,
    sanitizeUserStartersForMatch,
    orderRosterForFormation,
    resolveUserMatchFormation,
    userSideClubForGame,
    isUserHomeMatch,
    getSeasonContext,
    contextFactor,
    log,
    tacticalKickoffMessage,
    DEFAULT_USER_TACTICS,
    getTactics,
    matchVenueFor,
    resolveMatchAttendance,
    applyPreMatchTraining,
    finalizePauseLineupEdits,
    closeFormationSuggestion,
    profile,
    opponentForMatch,
    planPenaltyOutcome,
    runPenaltyDuelResolve,
    executeShootoutKick,
    currentShootoutClub,
    shootoutLineup,
    shot,
    renderStats,
  } = deps;

  const applyNamedLineupOrder = (roster, names) => {
    if (!roster || !Array.isArray(names) || !names.length) return;
    const byName = new Map(roster.map(player => [player.name, player]));
    const next = [];
    names.forEach(name => {
      const player = byName.get(name);
      if (player) { next.push(player); byName.delete(name); }
    });
    byName.forEach(player => next.push(player));
    roster.splice(0, roster.length, ...next);
  };

  const findFixtureForLiveSnapshot = ref => {
    if (!ref) return null;
    const wanted = fixtureIdFromGame(ref);
    const fromSchedule = userSchedule().find(entry => fixtureIdFromGame(entry.game) === wanted)?.game;
    if (fromSchedule) return fromSchedule;
    for (const stage of getCupCompetition().stages || []) {
      const hit = (stage.fixtures || []).find(game => fixtureIdFromGame(game) === wanted);
      if (hit) return hit;
    }
    for (const roundGames of getChampionshipFixtures() || []) {
      const hit = (roundGames || []).find(game => fixtureIdFromGame(game) === wanted);
      if (hit) return hit;
    }
    return null;
  };

  const resolvePersistedLiveSnapshot = () => {
    const savedNewGame = getSavedNewGame();
    if (!savedNewGame?.seed) return null;
    const discardWorldCupSnap = snap => {
      if (!snap?.fixture) return snap;
      if (snap.fixture.competition === WORLD_CUP_COMPETITION && !isWorldCupSeasonActive(getCareerSeason())) {
        clearLiveMatchSave();
        return null;
      }
      return snap;
    };
    const fromKey = loadLiveMatchSave();
    if (isValidLiveMatchSnapshot(fromKey, savedNewGame.seed)) {
      const hydrated = hydrateLiveMatchSnapshot(fromKey);
      const kept = discardWorldCupSnap(hydrated);
      if (kept) return kept;
    }
    const validSavedSeason = getValidSavedSeason();
    const fromSeason = validSavedSeason ? validSavedSeason.liveMatchSnapshot : null;
    if (isValidLiveMatchSnapshot(fromSeason, savedNewGame.seed)) {
      const hydrated = hydrateLiveMatchSnapshot(fromSeason);
      const kept = discardWorldCupSnap(hydrated);
      if (kept) return kept;
    }
    return null;
  };

  const forceCompleteLockedLiveMatch = lock => {
    if (!lock?.home || !lock?.away) return false;
    const userClub = getUserClub();
    const ref = { home: lock.home, away: lock.away, competition: lock.competition, round: lock.round, tieId: lock.tieId, leg: lock.leg, date: lock.date, gameNumber: lock.gameNumber };
    const game = findFixtureForLiveSnapshot(ref) || ref;
    if (isFixtureCompleted(game)) {
      clearLiveMatchPersist();
      persistSeason(true);
      return false;
    }
    const result = simulateRoundMatch(game.home, game.away, game);
    setLiveMatchGame(game);
    const userAtHome = game.home === userClub;
    setHomeScore(userAtHome ? result.homeGoals : result.awayGoals);
    setAwayScore(userAtHome ? result.awayGoals : result.homeGoals);
    setGoals(result.goals ? { home: [...(result.goals.home || [])], away: [...(result.goals.away || [])] } : { home: [], away: [] });
    setStats(result.data ? {
      home: { ...blank(), possession: result.data.homePossession ?? 50, passes: result.data.homePasses || 0, accurate: result.data.homeAccurate || 0, shots: result.data.homeShots || 0, on: result.data.homeOnTarget || 0, off: result.data.homeOff || 0, saved: result.data.homeSaved || 0, penalties: result.data.homePenalties || 0, offsides: result.data.homeOffsides || 0, keeperSaves: result.data.homeKeeperSaves || 0, tackles: result.data.homeTackles || 0, fouls: result.data.homeFouls || 0, yellow: result.data.homeYellow || 0, red: result.data.homeRed || 0 },
      away: { ...blank(), possession: result.data.awayPossession ?? 50, passes: result.data.awayPasses || 0, accurate: result.data.awayAccurate || 0, shots: result.data.awayShots || 0, on: result.data.awayOnTarget || 0, off: result.data.awayOff || 0, saved: result.data.awaySaved || 0, penalties: result.data.awayPenalties || 0, offsides: result.data.awayOffsides || 0, keeperSaves: result.data.awayKeeperSaves || 0, tackles: result.data.awayTackles || 0, fouls: result.data.awayFouls || 0, yellow: result.data.awayYellow || 0, red: result.data.awayRed || 0 },
    } : { home: blank(), away: blank() });
    setMinute(90);
    setMatchStarted(true);
    setMatchFinished(true);
    setPreMatchPreparation(false);
    setHalftimeShown(true);
    setCards({
      home: starters().map(() => ({ yellow: 0, red: false, dismissal: null, injured: false, playThroughRisk: false })),
      away: getMatchClub().roster.slice(0, 11).map(() => ({ yellow: 0, red: false, dismissal: null, injured: false, playThroughRisk: false })),
    });
    timeline.innerHTML = '<p class="tl-event">Partida interrompida foi concluída automaticamente (anti recomeço).</p>';
    $('#matchStatus').textContent = 'Partida concluída automaticamente após interrupção.';
    renderLiveMatchHeader(getLiveMatchGame());
    modal.classList.remove('hidden');
    score();
    renderFinalSummary();
    showFinalActions({ openRatings: true });
    clearLiveMatchSave();
    setLatestLiveMatchSnapshot(null);
    persistSeason(true);
    return true;
  };

  const restoreLiveMatchFromSnapshot = (raw, { openModal = true } = {}) => {
    const savedNewGame = getSavedNewGame();
    if (!isValidLiveMatchSnapshot(raw, savedNewGame?.seed)) return false;
    const snap = hydrateLiveMatchSnapshot(raw);
    const linked = findFixtureForLiveSnapshot(snap.fixture);
    const game = linked || { ...snap.fixture };
    if (linked) reconcileLinkedFixtureWithLiveSnapshot(linked, snap);
    if (isFixtureCompleted(game) && !snap.matchFinished) {
      clearLiveMatchPersist();
      return false;
    }
    const userClub = getUserClub();
    const clubs = getClubs();
    const formations = getFormations();
    const formationRoles = getFormationRoles();
    const userNationalTeamName = getUserNationalTeamName();
    setLiveMatchGame(game);
    if (!bindSquadForUserFixtureSync(game)) return false;
    if (snap.userFormation && formations[snap.userFormation]) {
      setFormation(snap.userFormation);
      if (!isWorldCupUserFixture(game, userNationalTeamName)) clubs[userClub].formation = getFormation();
    }
    applyNamedLineupOrder(getActiveUserSquad(), snap.userLineupOrder);
    if (!isWorldCupUserFixture(game, userNationalTeamName)) clubs[userClub].roster = getSquad();
    setPositionAssignments([...(formationRoles[getFormation()] || formationRoles['4-3-3'])]);
    const awayClub = getMatchClub();
    if (snap.awayFormation && formations[snap.awayFormation]) awayClub.formation = snap.awayFormation;
    applyNamedLineupOrder(awayClub.roster, snap.awayLineupOrder);
    setMinute(Number(snap.minute) || 0);
    setHomeScore(Number(snap.home) || 0);
    setAwayScore(Number(snap.away) || 0);
    setPauses(Number(snap.pauses) || 0);
    setHalftimeShown(!!snap.halftimeShown);
    setSecondHalfStarted(!!snap.secondHalfStarted || (
      !!snap.halftimeShown &&
      Number(snap.minute) >= 45 &&
      !snap.preMatchPreparation &&
      snap.activePreparationTitle !== 'INTERVALO' &&
      !snap.ui?.pauseOpen
    ));
    setStoppageFirst(Number(snap.stoppageFirst) || 0);
    setStoppageSecond(Number(snap.stoppageSecond) || 0);
    setStoppageElapsed(Number(snap.stoppageElapsed) || 0);
    setStoppageActive(snap.stoppageActive || null);
    setStoppageHalfSnap(snap.stoppageHalfSnap && typeof snap.stoppageHalfSnap === 'object' ? { fouls: Number(snap.stoppageHalfSnap.fouls) || 0, yellow: Number(snap.stoppageHalfSnap.yellow) || 0, red: Number(snap.stoppageHalfSnap.red) || 0, subs: Number(snap.stoppageHalfSnap.subs) || 0, goals: Number(snap.stoppageHalfSnap.goals) || 0 } : null);
    setMatchStarted(true);
    setMatchFinished(!!snap.matchFinished);
    setPreMatchPreparation(!!snap.preMatchPreparation);
    setActivePreparationTitle(snap.activePreparationTitle || '');
    setSubstitutions(Number(snap.substitutions) || 0);
    setAwaySubstitutions(Number(snap.awaySubstitutions) || 0);
    setAwaySubWindows(Number(snap.awaySubWindows) || 0);
    setSubstitutedOut(snap.substitutedOut instanceof Set ? snap.substitutedOut : new Set(snap.substitutedOut || []));
    setDisciplineEvents(Number(snap.disciplineEvents) || 0);
    setAvailabilityCommitted(!!snap.availabilityCommitted);
    setRoundResultMessagePushed(!!snap.roundResultMessagePushed);
    setStats(snap.stats || { home: blank(), away: blank() });
    setCards(snap.cards || { home: starters().map(() => ({ yellow: 0, red: false })), away: awayClub.roster.slice(0, 11).map(() => ({ yellow: 0, red: false })) });
    setGoals(snap.goals || { home: [], away: [] });
    setMatchFactors(snap.matchFactors || null);
    setLiveInjuries(snap.liveInjuries || { home: [], away: [] });
    setLiveDeferredInjuries(snap.liveDeferredInjuries || { home: [], away: [] });
    setLiveOpeningLineup(snap.liveOpeningLineup || { home: [], away: [] });
    setLiveMinutesPlayed(snap.liveMinutesPlayed || { home: new Map(), away: new Map() });
    setMatchDiscipline(snap.matchDiscipline || { home: new Map(), away: new Map() });
    setLiveVolumeSamples(snap.liveVolumeSamples || []);
    setLiveVolumePrev(snap.liveVolumePrev || null);
    setLiveVolumePulse(snap.liveVolumePulse || { home: 0.1, away: 0.1 });
    setLiveVolumeIncidents(snap.liveVolumeIncidents || []);
    setPostMatchMedicalQueue(Array.isArray(snap.postMatchMedicalQueue) ? snap.postMatchMedicalQueue : []);
    setShootoutState(snap.shootoutState || null);
    setPendingPenalty(snap.pendingPenalty || null);
    setPreMatchTacticSnapshot(snap.preMatchTacticSnapshot || null);
    setRoundResults(null);
    liveDayMatches.clearSnapshots();
    matchLiveUi.setLiveClockSeconds?.(Number(snap.liveClockSeconds) || 0);
    if (getPreMatchPreparation()) {
      timeline.innerHTML = '';
      timeline.classList.add('hidden');
      $('#liveVolume')?.classList.add('hidden');
    } else {
      const html = snap.timelineHtml || `<p>${getMinute()}' · Partida retomada após recarregar a página.</p>`;
      timeline.innerHTML = /PRÉ-JOGO\s*·\s*Aguardando/.test(html) ? '' : html;
      timeline.classList.toggle('hidden', !timeline.innerHTML.trim());
    }
    $('#matchStatus').textContent = snap.matchStatusText || (getMatchFinished() ? 'Partida encerrada.' : getPreMatchPreparation() ? 'Organize sua equipe antes de iniciar a partida.' : 'A partida está em andamento…');
    $('#matchActions').innerHTML = '<button id="pauseMatch">Ⅱ PAUSA TÉCNICA <small id="pauseCounter">0/3</small></button><button id="liveStats">ESTATÍSTICAS AO VIVO</button><button id="liveOpponent">VER ADVERSÁRIO</button>';
    bindLiveActions();
    $('#pauseCounter').textContent = `${getPauses()}/3`;
    if (typeof closePenaltyDuel === 'function') closePenaltyDuel();
    else $('#penaltyChoice')?.classList.add('hidden');
    $('#shootoutPanel').classList.add('hidden');
    $('#liveOpponentModal').classList.add('hidden');
    $('#pausePanel').classList.add('hidden');
    $('#stats').classList.add('hidden');
    renderLiveMatchHeader(getLiveMatchGame());
    score();
    updateLiveMatchClock();
    renderRoster();
    drawBoard();
    setLatestLiveMatchSnapshot(buildLiveMatchSnapshot(collectLiveMatchPersistState()));
    saveLiveMatchSave(getLatestLiveMatchSnapshot());
    if (!openModal) return true;
    if (getMatchFinished()) {
      stopMatchClock();
      modal.classList.remove('hidden');
      if (!getShootoutState() && !getLiveMatchGame()?.shootoutWinner && liveKnockoutNeedsShootout()) {
        setMatchFinished(false);
        startPenaltyShootout();
        return true;
      }
      if (getShootoutState()) { renderShootoutTrack(); $('#shootoutPanel').classList.remove('hidden'); }
      else if (getLiveMatchGame()?.penalties) { $('#shootoutTitle').textContent = `Shootout ${getLiveMatchGame().penalties}`; $('#shootoutPanel').classList.remove('hidden'); }
      renderFinalSummary({ processMedical: false });
      showFinalActions({ reopen: true });
      return true;
    }
    modal.classList.remove('hidden');
    const pendingPenalty = getPendingPenalty();
    if (pendingPenalty?.mode === 'against' && pendingPenalty?.current && pendingPenalty?.other) {
      startPenaltyAgainst(pendingPenalty.current, pendingPenalty.other);
      return true;
    }
    if (pendingPenalty?.current && pendingPenalty?.other) {
      startPenaltyChoice(pendingPenalty.current, pendingPenalty.other);
      return true;
    }
    if (getShootoutState() && !getMatchFinished()) {
      stopMatchClock();
      $('#matchActions').classList.add('hidden');
      $('#shootoutPanel').classList.remove('hidden');
      resumeShootoutFlow();
      return true;
    }
    if (getPreMatchPreparation() || snap.ui?.pauseOpen || getActivePreparationTitle()) {
      openPreparation(getActivePreparationTitle() || (getPreMatchPreparation() ? 'PRÉ-JOGO' : 'PAUSA TÉCNICA'));
      return true;
    }
    $('#matchActions').classList.remove('hidden');
    startMatchClock();
    matchLiveAudio.startStadiumAmbient?.();
    scheduleLiveMatchPersist();
    return true;
  };

  const tryRestoreLiveMatch = ({ openModal = true } = {}) => {
    if (getMatchStarted() && getLiveMatchGame()) return reopenMatchWindow();
    const snap = resolvePersistedLiveSnapshot();
    if (snap) return restoreLiveMatchFromSnapshot(snap, { openModal });
    const validSavedSeason = getValidSavedSeason();
    const savedNewGame = getSavedNewGame();
    const lock = validSavedSeason?.activeLiveMatch;
    if (lock && savedNewGame?.seed && (!validSavedSeason.seed || validSavedSeason.seed === savedNewGame.seed)) {
      return forceCompleteLockedLiveMatch(lock);
    }
    return false;
  };

  const openLastPostMatchView = () => {
    if (!(getMatchStarted() && getMatchFinished() && !getRoundCommitted() && getLiveMatchGame())) return false;
    $('#calendarMatchReportModal')?.classList.add('hidden');
    const opened = reopenMatchWindow();
    if (opened) renderUserMatchPresentation();
    return opened;
  };

  let entryHandlersBound = false;
  const bindEntryHandlers = () => {
    if (entryHandlersBound) return;
    entryHandlersBound = true;

    onClick('#playMatch', async () => {
      void matchLiveAudio?.ensure?.();
      if (getPendingSponsorChoice()) {
        openSponsorPickerIfPending();
        return;
      }
      refreshUserFixtures();
      if (isUserSeasonIdle()) {
        renderUserMatchPresentation();
        simulateNonHumanSeasonRemainder();
        return;
      }
      if (seasonFullyComplete() || (seasonComplete() && !nextPendingUserEntry())) {
        renderUserMatchPresentation();
        if (!tryPrepareSeasonTransition()) {
          if (!hasPendingUserFixtures()) prepareSeasonTransition();
        }
        return;
      }
      if (tryRestoreLiveMatch()) return;
      if (reopenMatchWindow()) return;
      if (!nextPendingUserEntry()) {
        renderUserMatchPresentation();
        return;
      }
      const nextEntry = nextPendingUserEntry();
      if (nextEntry && isPendingFixtureOverdue(nextEntry) === false && !sameCalendarDay(nextEntry.details.date, getCareerCalendarDate())) {
        $$('.nav').find(button => button.dataset.view === 'calendar')?.click();
        return;
      }
      pushMatchDayBrief(nextEntry?.game);
      const liveGame = nextEntry?.game || getNextUserGame();
      setLiveMatchGame(liveGame);
      if (!(await bindSquadForUserFixture(getLiveMatchGame()))) {
        pushMessage?.({ category: 'match', type: 'error', title: 'Elenco indisponível', body: 'Não foi possível carregar o elenco da seleção. Recarregue a página e tente novamente.', round: getCurrentRound(), meta: { competition: 'Copa do Mundo' } });
        setLiveMatchGame(null);
        return;
      }
      renderLiveMatchHeader(getLiveMatchGame());
      sanitizeUserStartersForMatch();
      orderRosterForFormation(getMatchClub().roster, getMatchClub().formation);
      const userClub = getUserClub();
      const clubs = getClubs();
      const userNationalTeamName = getUserNationalTeamName();
      const formationRoles = getFormationRoles();
      if (!isWorldCupUserFixture(getLiveMatchGame(), userNationalTeamName)) clubs[userClub].formation = getFormation();
      else setFormation(resolveUserMatchFormation(getLiveMatchGame()));
      setPositionAssignments([...(formationRoles[getFormation()] || formationRoles['4-3-3'])]);
      const userSideClub = userSideClubForGame(getLiveMatchGame()) || clubs[userClub];
      const seasonContext = getSeasonContext();
      setMatchStarted(true);
      setMatchFinished(false);
      setPreMatchPreparation(true);
      setMinute(0);
      setHomeScore(0);
      setAwayScore(0);
      setPauses(0);
      setHalftimeShown(false);
      setSecondHalfStarted(false);
      setPendingPenalty(null);
      setShootoutState(null);
      setDisciplineEvents(0);
      setSubstitutions(0);
      setAwaySubstitutions(0);
      setAwaySubWindows(0);
      setStoppageFirst(0);
      setStoppageSecond(0);
      setStoppageElapsed(0);
      setStoppageActive(null);
      setStoppageHalfSnap(null);
      setSubstitutedOut(new Set());
      setRoundResults(null);
      setRoundResultMessagePushed(false);
      setPostMatchMedicalQueue([]);
      setMatchDiscipline({ home: new Map(), away: new Map() });
      setLiveInjuries({ home: [], away: [] });
      setLiveDeferredInjuries({ home: [], away: [] });
      setLiveOpeningLineup({ home: starters().map(player => player.name), away: getMatchClub().roster.slice(0, 11).map(player => player.name) });
      setLiveMinutesPlayed({ home: new Map(starters().map(player => [player.name, 0])), away: new Map(getMatchClub().roster.slice(0, 11).map(player => [player.name, 0])) });
      setAvailabilityCommitted(false);
      liveDayMatches.clearSnapshots();
      setPreMatchTacticSnapshot(null);
      setMatchFactors({
        home: contextFactor({ ...seasonContext.home, position: userSideClub?.position || userSideClub?.fifaRank || clubs[userClub].position, isHome: isUserHomeMatch(getLiveMatchGame()) }),
        away: contextFactor({ ...seasonContext.away, position: getMatchClub().position, isHome: !isUserHomeMatch(getLiveMatchGame()) }),
      });
      setCards({
        home: starters().map(() => ({ yellow: 0, red: false, dismissal: null, injured: false, playThroughRisk: false })),
        away: getMatchClub().roster.slice(0, 11).map(() => ({ yellow: 0, red: false, dismissal: null, injured: false, playThroughRisk: false })),
      });
      setGoals({ home: [], away: [] });
      setLiveVolumeSamples([]);
      setLiveVolumePrev(null);
      setLiveVolumePulse({ home: 0.1, away: 0.1 });
      setLiveVolumeIncidents([]);
      setStats({ home: blank(), away: blank() });
      score();
      timeline.innerHTML = '';
      timeline.classList.add('hidden');
      $('#liveVolume')?.classList.add('hidden');
      $('#matchActions').innerHTML = '<button id="pauseMatch">Ⅱ PAUSA TÉCNICA <small id="pauseCounter">0/3</small></button><button id="liveStats">ESTATÍSTICAS AO VIVO</button><button id="liveOpponent">VER ADVERSÁRIO</button>';
      bindLiveActions();
      $('#pauseCounter').textContent = '0/3';
      $('#matchStatus').textContent = 'Organize sua equipe antes de iniciar a partida.';
      modal.classList.remove('hidden');
      $('#penaltyChoice').classList.add('hidden');
      $('#shootoutPanel').classList.add('hidden');
      $('#liveOpponentModal').classList.add('hidden');
      updateLiveMatchClock();
      openPreparation('PRÉ-JOGO');
      flushLiveMatchPersist();
      persistSeason(true);
    });

    onClick('#simulateRemainder', () => simulateNonHumanSeasonRemainder());
    onClick('#reopenPostMatch', () => { openLastPostMatchView(); });
    onClick('#closeMatch', () => {
      if (getMatchFinished() && !getRoundCommitted()) {
        flushLiveMatchPersist();
        if (getMatchStarted()) persistSeason(true);
        stopMatchClock();
        matchLiveAudio.stopAll();
        closeFormationSuggestion();
        $('#calendarMatchReportModal')?.classList.add('hidden');
        $('#liveOpponentModal')?.classList.add('hidden');
        modal.classList.add('hidden');
        renderUserMatchPresentation();
        return;
      }
      flushLiveMatchPersist();
      if (getMatchStarted()) persistSeason(true);
      stopMatchClock();
      matchLiveAudio.stopAll();
      modal.classList.add('hidden');
      $('#liveOpponentModal')?.classList.add('hidden');
      closeFormationSuggestion();
      $('#calendarMatchReportModal')?.classList.add('hidden');
      renderUserMatchPresentation();
    });
    onClick('#resumeMatch', () => {
      matchLiveAudio.unlock();
      const startingMatch = getPreMatchPreparation();
      const startingSecondHalf = !startingMatch && getHalftimeShown() && !getMatchFinished() && getMinute() <= 45;
      if (startingMatch) setPauseLineupBaseline(null);
      else finalizePauseLineupEdits();
      setPreMatchPreparation(false);
      setActivePreparationTitle('');
      $('#pausePanel').classList.add('hidden');
      $('#stats').classList.add('hidden');
      $('#matchActions').classList.remove('hidden');
      $('#matchStatus').textContent = 'A partida está em andamento…';
      const resumeClock = () => {
        updateLiveMatchClock();
        matchLiveUi.refreshMatchFeed?.();
        startMatchClock();
        matchLiveAudio.startStadiumAmbient?.();
        flushLiveMatchPersist();
      };
      if (startingMatch) {
        matchLiveUi.resetLiveClockSeconds();
        liveDayMatches.clearSnapshots();
        liveDayMatches.ensure();
        applyPreMatchTraining();
        renderRoster();
        setLiveOpeningLineup({ home: starters().map(player => player.name), away: getMatchClub().roster.slice(0, 11).map(player => player.name) });
        setPreMatchTacticSnapshot({ ...(getTactics()?.getTacticalValues?.() ?? DEFAULT_USER_TACTICS) });
        const venue = matchVenueFor(getLiveMatchGame()?.home || getUserClub());
        const crowd = getLiveMatchGame() ? resolveMatchAttendance(getLiveMatchGame()) : null;
        const crowdLine = crowd
          ? ` Público: ${crowd.attendance.toLocaleString('pt-BR')} (${Math.round(crowd.fillRate * 100)}% da capacidade).`
          : '';
        const kickoff = tacticalKickoffMessage(getPreMatchTacticSnapshot());
        if (kickoff) log(kickoff, 'tactic');
        if (!getLiveVolumeSamples().length) setLiveVolumeSamples([{ minute: 0, home: 0.14, away: 0.14 }]);
        const whistleReady = matchLiveAudio.playKickoff();
        const onKickoffWhistle = () => {
          timeline.classList.remove('hidden');
          timeline.innerHTML = `<p>0' · A bola está rolando no ${venue.name}!${crowdLine}</p>`;
          resumeClock();
        };
        if (whistleReady?.then) whistleReady.then(onKickoffWhistle);
        else onKickoffWhistle();
        return;
      }
      if (startingSecondHalf) {
        setStoppageActive(null);
        setStoppageElapsed(0);
        setMinute(45);
        setSecondHalfStarted(true);
        matchLiveUi.resetLiveClockSeconds();
        log('Início do 2º tempo.', '');
        matchLiveAudio.playSecondHalf?.();
        resumeClock();
        return;
      }
      const whistleReady = matchLiveAudio.playResumeWhistle();
      if (whistleReady?.then) whistleReady.then(resumeClock);
      else resumeClock();
    });
    onClick('#penaltyTakers', e => {
      const button = e.target.closest('button');
      if (!button || button.disabled) return;
      const pendingPenalty = getPendingPenalty();
      if (pendingPenalty?.mode === 'against' || pendingPenalty?.mode === 'shootout-cpu') return;
      const takerName = button.dataset.taker;
      const shootoutKickClub = pendingPenalty?.mode === 'shootout'
        ? pendingPenalty.kickingClub
        : (getShootoutState() && currentShootoutClub() === getUserClub() ? getUserClub() : null);
      if (shootoutKickClub) {
        const lineup = shootoutLineup(shootoutKickClub);
        const taker = lineup.find(player => player.name === takerName);
        if (!taker) return;
        const kickingClub = shootoutKickClub;
        const isUser = kickingClub === getUserClub();
        const current = isUser ? profile() : opponentForMatch();
        const other = isUser ? opponentForMatch() : profile();
        const side = isUser ? 'home' : 'away';
        const plan = planPenaltyOutcome(side, { ...current, attack: current.attack + 9 }, other, { taker: taker.name, penaltySkill: taker.penaltyTaking, shootout: true });
        if (!plan?.outcome) return;
        setPendingPenalty({ mode: 'shootout', kickingClub });
        const beginShootoutDuel = () => {
          runPenaltyDuelResolve(takerName, plan, () => {
            setPendingPenalty(null);
            executeShootoutKick(kickingClub, taker, plan);
          });
        };
        const kickCue = matchLiveAudio.playPenaltyKick();
        if (kickCue?.then) kickCue.then(beginShootoutDuel);
        else beginShootoutDuel();
        return;
      }
      const taker = starters().find(p => p.name === takerName);
      if (!taker || !pendingPenalty) return;
      const pending = { ...pendingPenalty };
      const plan = planPenaltyOutcome('home', { ...pending.current, attack: pending.current.attack + 9 }, pending.other, { taker: taker.name, penaltySkill: taker.penaltyTaking });
      if (!plan?.outcome) return;
      const beginPenaltyDuel = () => {
        runPenaltyDuelResolve(takerName, plan, () => {
          shot('home', { ...pending.current, attack: pending.current.attack + 9 }, pending.other, {
            penalty: true,
            taker: taker.name,
            penaltySkill: taker.penaltyTaking,
            forcedOutcome: plan.outcome,
          });
          closePenaltyDuel();
          $('#matchActions').classList.remove('hidden');
          $('#matchStatus').textContent = 'A partida está em andamento…';
          setPendingPenalty(null);
          renderStats();
          startMatchClock();
        });
      };
      const kickCue = matchLiveAudio.playPenaltyKick();
      if (kickCue?.then) kickCue.then(beginPenaltyDuel);
      else beginPenaltyDuel();
    });
  };

  return {
    moduleVersion: MODULE_VERSIONS.matchLiveEntry ?? 1,
    bindEntryHandlers,
    tryRestoreLiveMatch,
    restoreLiveMatchFromSnapshot,
  };
}
