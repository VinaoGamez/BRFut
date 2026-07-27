export function createRoundResultsBrowser(deps) {
  document.body.insertAdjacentHTML('beforeend', `<div id="roundResultsModal" class="modal hidden"><div class="modal-card round-results-modal"><button id="closeRoundResults" class="close">×</button><label id="roundResultsKicker">RODADA CONCLUÍDA</label><h2 id="roundResultsTitle">Tabela de Jogos</h2><p id="roundResultsMeta"></p><div class="round-results-toolbar"><div id="roundDivisionTabs" class="round-division-tabs"></div><div class="round-context-nav"><div id="roundGroupNav" class="round-group-nav"></div><span id="roundFormat" class="round-format"></span><div id="roundSelector" class="round-selector"></div></div></div><div id="roundGames" class="round-games"></div></div></div>`);
  let roundBrowserDivision = deps.getUserDivision();
  let roundBrowserRound = deps.getCurrentRound();
  let roundBrowserGroup = deps.getUserDivision() === 'D' ? deps.getUserSerieDGroupIndex() : 0;
  let roundBrowserWorldCupGroup = 0;
  let roundBrowserLockedCompetition = null;
  const normalizeRoundGames = deps.normalizeRoundGames || deps.filterPlayableRoundGames;
  const divisionRoundHistory = division => {
    const userDivision = deps.getUserDivision();
    return (division === userDivision ? deps.getSeasonRoundHistory() : deps.getCompetitionRoundHistory()[division]) || [];
  };
  const availableResultRounds = division => {
    const worldCupCompetition = deps.getWorldCupCompetition();
    const nationalCompetitions = deps.getNationalCompetitions();
    const currentRound = deps.getCurrentRound();
    if (division === 'CMU') {
      if (!worldCupCompetition) return [1, 2, 3];
      const rounds = new Set();
      deps.getWorldCupAllFixtures(worldCupCompetition).forEach(game => { if (game.round) rounds.add(Number(game.round)); });
      return [...rounds].sort((a, b) => a - b);
    }
    if (deps.isStateChampionshipDivision(division)) {
      const limit = deps.stateLeagueEngine.getRoundLimit(division);
      const rounds = [];
      for (let round = 1; round <= limit; round += 1) rounds.push(round);
      return rounds;
    }
    const fixtureCount = Math.max(0, Array.isArray(nationalCompetitions[division]?.fixtures) ? nationalCompetitions[division].fixtures.length : 0);
    const rounds = [];
    for (let round = 1; round <= fixtureCount; round += 1) rounds.push(round);
    divisionRoundHistory(division).forEach(item => { if (item?.round && !rounds.includes(item.round)) rounds.push(item.round); });
    if (!rounds.length && currentRound) rounds.push(currentRound);
    return rounds.sort((a, b) => a - b);
  };
  const previewRoundGames = (division, round) => {
    const userDivision = deps.getUserDivision();
    const currentRound = deps.getCurrentRound();
    const worldCupCompetition = deps.getWorldCupCompetition();
    const nationalCompetitions = deps.getNationalCompetitions();
    const roundPreviewResults = deps.getRoundPreviewResults();
    if (division === 'CMU') {
      if (!worldCupCompetition) return [];
      return normalizeRoundGames(deps.getWorldCupAllFixtures(worldCupCompetition).filter(game => Number(game.round) === Number(round)));
    }
    if (deps.isStateChampionshipDivision(division)) {
      return normalizeRoundGames(deps.stateLeagueEngine.getRoundGamesForBrowse(division, round, { simulateMatch: deps.simulateRoundMatch }));
    }
    if (division === userDivision && round === currentRound) return normalizeRoundGames(deps.simulateRoundResults());
    const stored = divisionRoundHistory(division).find(item => item.round === round);
    if (stored?.games?.length) return normalizeRoundGames(stored.games);
    const fixtures = normalizeRoundGames(nationalCompetitions[division]?.fixtures?.[round - 1] || []);
    if (!fixtures.length) return [];
    if (round > currentRound) {
      return fixtures.map(game => ({ home: game.home, away: game.away, homeGoals: null, awayGoals: null, scheduled: true, round: game.round ?? round, fixture: game }));
    }
    const key = `${division}-${round}`;
    if (!roundPreviewResults[key]) {
      roundPreviewResults[key] = fixtures.map(game => {
        const result = deps.simulateRoundMatch(game.home, game.away, game);
        return { ...result, fixture: game, home: game.home, away: game.away, round: game.round ?? round, competition: game.competition };
      });
    }
    return normalizeRoundGames(roundPreviewResults[key]);
  };
  const roundBrowserCompetitionLabel = division => {
    if (division === 'CMU') return 'Copa do Mundo';
    if (deps.isStateChampionshipDivision(division)) {
      const stateDivision = deps.stateLeagueEngine.getDivisionForBrowse(division, deps.getUserClub());
      return stateDivision?.label || 'Campeonato Estadual';
    }
    if (division === 'CUP') return 'Copa do Brasil';
    return `Brasileirão Série ${division}`;
  };
  const renderRoundGameScore = game => {
    if (game?.scheduled || game?.homeGoals == null || game?.awayGoals == null) return '<i>× — ×</i>';
    const pen = game.penalties ? ` (${game.penalties})` : '';
    return `${game.homeGoals} — ${game.awayGoals}${pen}`;
  };
  const renderRoundResultsBrowser = () => {
    const divisions = ['A', 'B', 'C', 'D'];
    const divisionTabs = deps.$('#roundDivisionTabs');
    const userClub = deps.getUserClub();
    const userNationalTeamName = deps.getUserNationalTeamName();
    const worldCupCompetition = deps.getWorldCupCompetition();
    const currentRound = deps.getCurrentRound();
    const serieDGroups = deps.getSerieDGroups();
    const wcMode = deps.isWorldCupDashboard() && !roundBrowserLockedCompetition;
    if (divisionTabs) {
      if ((roundBrowserLockedCompetition && roundBrowserLockedCompetition !== 'CUP') || wcMode) {
        const lockedId = wcMode ? 'CMU' : roundBrowserLockedCompetition;
        if (wcMode) roundBrowserDivision = 'CMU';
        divisionTabs.innerHTML = `<div class="round-division-tabs-locked">${roundBrowserCompetitionLabel(lockedId)}</div>`;
        divisionTabs.classList.add('is-locked');
      } else {
        divisionTabs.classList.remove('is-locked');
        const tabs = [
          ...(worldCupCompetition && userNationalTeamName ? [{ id: 'CMU', label: 'COPA DO MUNDO' }] : []),
          ...divisions.map(division => ({ id: division, label: `SÉRIE ${division}` })),
        ];
        divisionTabs.innerHTML = tabs.map(tab => `<button class="${tab.id === roundBrowserDivision ? 'active' : ''}" data-round-division="${tab.id}">${tab.label}</button>`).join('');
      }
    }
    const rounds = availableResultRounds(roundBrowserDivision);
    const roundIndex = Math.max(0, rounds.indexOf(roundBrowserRound));
    if (!rounds.includes(roundBrowserRound)) roundBrowserRound = rounds.at(-1) || currentRound;
    let games = normalizeRoundGames(previewRoundGames(roundBrowserDivision, roundBrowserRound));
    let format = 'PONTOS CORRIDOS · TURNO E RETORNO';
    if (deps.isStateChampionshipDivision(roundBrowserDivision)) {
      format = deps.stateLeagueEngine.getKnockoutPhaseTitle(roundBrowserDivision, roundBrowserRound)
        || deps.stateLeagueEngine.getRoundPhaseLabel(roundBrowserDivision, roundBrowserRound).toUpperCase();
      deps.$('#roundGroupNav').innerHTML = '';
    } else if (roundBrowserDivision === 'CMU') {
      if (roundBrowserRound <= 3) {
        const groupLetter = deps.WORLD_CUP_GROUP_LETTERS[roundBrowserWorldCupGroup] || 'A';
        games = games.filter(game => game.group === groupLetter);
        format = `FASE DE GRUPOS · GRUPO ${groupLetter}`;
        deps.$('#roundGroupNav').innerHTML = `<button data-wc-group-step="-1" aria-label="Grupo anterior">‹</button><strong>GRUPO ${groupLetter}</strong><button data-wc-group-step="1" aria-label="Próximo grupo">›</button>`;
      } else {
        format = deps.KNOCKOUT_SCHEDULE.find(item => item.round === roundBrowserRound)?.phase || 'MATA-MATA';
        deps.$('#roundGroupNav').innerHTML = '';
      }
    } else if (roundBrowserDivision === 'D' && roundBrowserRound <= 10) {
      const group = serieDGroups[roundBrowserGroup] || [];
      games = games.filter(game => group.includes(game.home) && group.includes(game.away));
      format = `1ª FASE · GRUPO A${roundBrowserGroup + 1}`;
      deps.$('#roundGroupNav').innerHTML = `<button data-group-step="-1" aria-label="Grupo anterior">‹</button><strong>GRUPO A${roundBrowserGroup + 1}</strong><button data-group-step="1" aria-label="Próximo grupo">›</button>`;
    } else {
      deps.$('#roundGroupNav').innerHTML = '';
      if (roundBrowserDivision === 'D') format = roundBrowserRound <= 12 ? '2ª FASE · MATA-MATA' : roundBrowserRound <= 14 ? '3ª FASE · MATA-MATA' : roundBrowserRound <= 16 ? 'OITAVAS DE FINAL' : roundBrowserRound <= 18 ? 'QUARTAS DE FINAL' : roundBrowserRound <= 20 ? 'SEMIFINAL' : roundBrowserRound <= 22 ? 'FINAL' : 'MATA-MATA';
    }
    deps.$('#roundFormat').textContent = format;
    const roundLabel = deps.isStateChampionshipDivision(roundBrowserDivision)
      ? deps.stateLeagueEngine.getRoundPhaseLabel(roundBrowserDivision, roundBrowserRound)
      : roundBrowserDivision === 'CMU' && roundBrowserRound >= 4
        ? (deps.KNOCKOUT_SCHEDULE.find(item => item.round === roundBrowserRound)?.phase || `Rodada ${roundBrowserRound}`)
        : `RODADA ${roundBrowserRound}`;
    deps.$('#roundSelector').innerHTML = `<button data-round-step="-1" ${roundIndex <= 0 ? 'disabled' : ''} aria-label="Rodada anterior">‹</button><strong>${roundLabel}</strong><button data-round-step="1" ${roundIndex >= rounds.length - 1 ? 'disabled' : ''} aria-label="Próxima rodada">›</button>`;
    const kicker = deps.$('#roundResultsKicker');
    const title = deps.$('#roundResultsTitle');
    if (roundBrowserLockedCompetition) {
      if (kicker) kicker.textContent = 'CAMPEONATOS';
      if (title) title.textContent = 'Últimos Jogos';
      deps.$('#roundResultsMeta').textContent = `${roundBrowserCompetitionLabel(roundBrowserLockedCompetition)} · calendário ao vivo · navegue entre rodadas para consultar confrontos e placares.`;
    } else if (roundBrowserDivision === 'CMU') {
      if (kicker) kicker.textContent = 'RODADA CONCLUÍDA';
      if (title) title.textContent = 'Tabela de Jogos';
      deps.$('#roundResultsMeta').textContent = 'Copa do Mundo · resultados organizados conforme o formato da competição.';
    } else {
      if (kicker) kicker.textContent = 'RODADA CONCLUÍDA';
      if (title) title.textContent = 'Tabela de Jogos';
      deps.$('#roundResultsMeta').textContent = `Série ${roundBrowserDivision} · resultados preservados e organizados conforme o formato da competição.`;
    }
    const playableGames = deps.filterPlayableRoundGames(games);
    const bindTeam = name => {
      const nt = deps.resolveNationalTeam(name);
      if (nt) return `<b class="club-link" data-national-team="${nt.code}" role="button" tabindex="0">${name}</b>`;
      return `<b class="club-link" data-club="${name}" role="button" tabindex="0">${name}</b>`;
    };
    deps.$('#roundGames').innerHTML = `<div class="round-games-head"><span>MANDANTE</span><span>PLACAR</span><span>VISITANTE</span></div>${playableGames.length ? playableGames.map(game => { const isUser = game.home === userClub || game.away === userClub || (userNationalTeamName && (game.home === userNationalTeamName || game.away === userNationalTeamName)); return `<div class="round-game-row ${isUser ? 'user-game' : ''} ${game.scheduled ? 'scheduled' : ''}"><span>${bindTeam(game.home)}${isUser ? '<small class="user-game-tag">SEU JOGO</small>' : ''}</span><strong>${renderRoundGameScore(game)}</strong><span>${bindTeam(game.away)}</span></div>`; }).join('') : '<div class="round-games-empty">Nenhum jogo disponível para esta rodada.</div>'}`;
  };
  const openRoundResults = () => {
    const userDivision = deps.getUserDivision();
    const currentRound = deps.getCurrentRound();
    const worldCupCompetition = deps.getWorldCupCompetition();
    const userNationalTeamName = deps.getUserNationalTeamName();
    roundBrowserLockedCompetition = null;
    if (deps.isWorldCupDashboard() && worldCupCompetition) {
      roundBrowserDivision = 'CMU';
      const letter = deps.findUserWorldCupGroup(worldCupCompetition, userNationalTeamName);
      roundBrowserWorldCupGroup = Math.max(0, deps.WORLD_CUP_GROUP_LETTERS.indexOf(letter || 'A'));
      const userFixtures = deps.getWorldCupAllFixtures(worldCupCompetition).filter(game => game.home === userNationalTeamName || game.away === userNationalTeamName);
      const pending = userFixtures.find(game => !game.completed && game.homeGoals == null);
      roundBrowserRound = pending?.round || userFixtures.filter(game => game.completed || game.homeGoals != null).at(-1)?.round || 1;
    } else {
      roundBrowserDivision = userDivision;
      roundBrowserRound = currentRound;
      roundBrowserGroup = userDivision === 'D' ? deps.getUserSerieDGroupIndex() : 0;
    }
    renderRoundResultsBrowser();
    deps.$('#roundResultsModal').classList.remove('hidden');
  };
  deps.$('#roundResultsModal').addEventListener('click', event => {
    const userClub = deps.getUserClub();
    const currentRound = deps.getCurrentRound();
    const worldCupCompetition = deps.getWorldCupCompetition();
    const userNationalTeamName = deps.getUserNationalTeamName();
    const serieDGroups = deps.getSerieDGroups();
    const division = event.target.closest('[data-round-division]')?.dataset.roundDivision;
    if (division) {
      roundBrowserDivision = division;
      const rounds = availableResultRounds(division);
      if (division === 'CMU') {
        const letter = deps.findUserWorldCupGroup(worldCupCompetition, userNationalTeamName);
        roundBrowserWorldCupGroup = Math.max(0, deps.WORLD_CUP_GROUP_LETTERS.indexOf(letter || 'A'));
        const userFixtures = worldCupCompetition ? deps.getWorldCupAllFixtures(worldCupCompetition).filter(game => game.home === userNationalTeamName || game.away === userNationalTeamName) : [];
        const pending = userFixtures.find(game => !game.completed && game.homeGoals == null);
        roundBrowserRound = pending?.round || rounds.at(-1) || 1;
      } else {
        roundBrowserRound = rounds.includes(currentRound) ? currentRound : (rounds.at(-1) || currentRound);
        if (division === 'D') roundBrowserGroup = serieDGroups.findIndex(group => group.includes(userClub));
        if (roundBrowserGroup < 0) roundBrowserGroup = 0;
      }
      renderRoundResultsBrowser();
      return;
    }
    const wcGroupStep = Number(event.target.closest('[data-wc-group-step]')?.dataset.wcGroupStep || 0);
    if (wcGroupStep) {
      roundBrowserWorldCupGroup = (roundBrowserWorldCupGroup + wcGroupStep + deps.WORLD_CUP_GROUP_LETTERS.length) % deps.WORLD_CUP_GROUP_LETTERS.length;
      renderRoundResultsBrowser();
      return;
    }
    const groupStep = Number(event.target.closest('[data-group-step]')?.dataset.groupStep || 0);
    if (groupStep) {
      roundBrowserGroup = (roundBrowserGroup + groupStep + serieDGroups.length) % serieDGroups.length;
      renderRoundResultsBrowser();
      return;
    }
    const roundStep = Number(event.target.closest('[data-round-step]')?.dataset.roundStep || 0);
    if (roundStep) {
      const rounds = availableResultRounds(roundBrowserDivision);
      const index = rounds.indexOf(roundBrowserRound);
      const next = rounds[index + roundStep];
      if (next) { roundBrowserRound = next; renderRoundResultsBrowser(); }
    }
  });
  const bindCloseHandler = onClose => {
    deps.onClick('#closeRoundResults', () => {
      deps.$('#roundResultsModal').classList.add('hidden');
      roundBrowserLockedCompetition = null;
      onClose?.();
    });
  };
  return {
    openRoundResults,
    renderRoundResultsBrowser,
    setRoundBrowserLockedCompetition: value => { roundBrowserLockedCompetition = value; },
    setRoundBrowserDivision: value => { roundBrowserDivision = value; },
    setRoundBrowserRound: value => { roundBrowserRound = value; },
    setRoundBrowserGroup: value => { roundBrowserGroup = value; },
    setRoundBrowserWorldCupGroup: value => { roundBrowserWorldCupGroup = value; },
    bindCloseHandler,
  };
}
