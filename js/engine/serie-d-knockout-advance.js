/**
 * Série D knockout bracket: tie rounds, resolution, phase advance.
 */
export function repairSerieDKnockoutReturnLegs(fixtures = []) {
  const byTie = new Map();
  fixtures
    .filter(Array.isArray)
    .flat()
    .forEach(game => {
      if (!game?.tieId) return;
      const pair = byTie.get(game.tieId) || {};
      if (game.leg === 'IDA') pair.first = game;
      if (game.leg === 'VOLTA') pair.second = game;
      byTie.set(game.tieId, pair);
    });

  let repaired = 0;
  byTie.forEach(({ first, second }) => {
    if (!first || !second) return;
    if (second.completed || second.homeGoals != null || second.awayGoals != null) return;
    if (second.home === first.away && second.away === first.home) return;
    if (second.home !== first.home || second.away !== first.away) return;
    second.home = first.away;
    second.away = first.home;
    repaired += 1;
  });
  return repaired;
}

export function createSerieDKnockoutAdvance(deps) {
  const dKnockout = deps.getDKnockout();
  dKnockout.stages = dKnockout.stages || {};
  // Saves antigos usavam `promoted: 6` (nº de vagas). A lista de clubes promovidos é sempre array.
  if (typeof dKnockout.promoted === 'number') {
    dKnockout.promotionSlots = dKnockout.promotionSlots || dKnockout.promoted;
    dKnockout.promoted = [];
  } else if (!Array.isArray(dKnockout.promoted)) {
    dKnockout.promoted = [];
  }
  if (!Number.isFinite(Number(dKnockout.promotionSlots))) dKnockout.promotionSlots = deps.SERIE_D_PROMOTIONS;

  const serieDPromotedClubs = () => Array.isArray(dKnockout.promoted) ? dKnockout.promoted : [];

  const dRoundResults = round => {
    const userDivision = deps.getUserDivision();
    const history = userDivision === 'D'
      ? deps.getSeasonRoundHistory()
      : (deps.getCompetitionRoundHistory().D || []);
    return (Array.isArray(history) ? history : []).find(item => item.round === round)?.games || [];
  };

  const makeTies = clubsList => {
    if (!Array.isArray(clubsList) || clubsList.length < 2) return [];
    return Array.from({ length: Math.floor(clubsList.length / 2) }, (_, index) => ({
      home: clubsList[index * 2],
      away: clubsList[index * 2 + 1],
    }));
  };

  const installTieRounds = (ties, startRound, { extraTies = [], phase = 'Eliminatórias', extraPhase = phase } = {}) => {
    const nationalCompetitions = deps.getNationalCompetitions();
    const primary = (Array.isArray(ties) ? ties : []).filter(tie => tie?.home && tie?.away);
    const extra = (Array.isArray(extraTies) ? extraTies : []).filter(tie => tie?.home && tie?.away);
    const makeFixture = (tie, tieIndex, round, leg, phaseLabel) => ({
      home: leg === 'VOLTA' ? tie.away : tie.home,
      away: leg === 'VOLTA' ? tie.home : tie.away,
      round,
      competition: deps.KNOCKOUT_COMPETITIONS.SERIE_D,
      tieId: `d-ko-r${startRound}-t${tieIndex}`,
      leg,
      phase: phaseLabel,
      knockoutRound: startRound,
      twoLegged: true,
      completed: false,
    });
    if (!Array.isArray(nationalCompetitions.D.fixtures)) nationalCompetitions.D.fixtures = [];
    nationalCompetitions.D.fixtures[startRound - 1] = [
      ...primary.map((tie, tieIndex) => makeFixture(tie, tieIndex, startRound, 'IDA', phase)),
      ...extra.map((tie, tieIndex) => makeFixture(tie, primary.length + tieIndex, startRound, 'IDA', extraPhase)),
    ];
    nationalCompetitions.D.fixtures[startRound] = [
      ...primary.map((tie, tieIndex) => makeFixture(tie, tieIndex, startRound + 1, 'VOLTA', phase)),
      ...extra.map((tie, tieIndex) => makeFixture(tie, primary.length + tieIndex, startRound + 1, 'VOLTA', extraPhase)),
    ];
  };

  const getSerieDTieGames = game => {
    if (!game?.tieId) return [];
    const nationalCompetitions = deps.getNationalCompetitions();
    const rounds = Array.isArray(nationalCompetitions.D.fixtures) ? nationalCompetitions.D.fixtures : [];
    return rounds.filter(Array.isArray).flat().filter(item => item.tieId === game.tieId)
      .sort((a, b) => (a.leg === 'IDA' ? 0 : 1) - (b.leg === 'IDA' ? 0 : 1));
  };

  const mergeSerieDTieResults = (games, startRound) => {
    const historyGames = [...dRoundResults(startRound), ...dRoundResults(startRound + 1)];
    return games.map(fixture => {
      const played = historyGames.find(item => item.home === fixture.home && item.away === fixture.away);
      if (!played) return { ...fixture };
      return {
        ...fixture,
        ...played,
        completed: true,
        penalties: played.penalties || fixture.penalties,
        shootoutWinner: played.shootoutWinner || fixture.shootoutWinner,
        shootoutPenalties: played.shootoutPenalties || fixture.shootoutPenalties,
      };
    });
  };

  const getKnockoutTieGames = game => {
    if (!game) return [];
    if (game.competition === deps.KNOCKOUT_COMPETITIONS.COPA) {
      const cupCompetition = deps.getCupCompetition();
      const stage = cupCompetition.stages.find(item => item.fixtures.includes(game));
      return stage ? deps.cupTieGames(stage, game.tieId) : [];
    }
    if (deps.isWorldCupKnockout?.(game) || deps.isStateKnockoutPhase(game)) return [game];
    if (deps.isKnockoutShootoutCompetition(game)) return getSerieDTieGames(game);
    return [];
  };

  /** Grava shootout da cópia resolvida de volta nas fixtures oficiais da Série D. */
  const persistSerieDTieShootout = games => {
    const deciding = games?.[games.length - 1];
    if (!deciding?.shootoutWinner) return;
    const nationalCompetitions = deps.getNationalCompetitions();
    (Array.isArray(nationalCompetitions.D?.fixtures) ? nationalCompetitions.D.fixtures : [])
      .filter(Array.isArray).flat().forEach(fixture => {
        if (!deps.sameKnockoutFixture(fixture, deciding)) return;
        fixture.shootoutWinner = deciding.shootoutWinner;
        fixture.shootoutPenalties = deciding.shootoutPenalties || deciding.penalties;
        fixture.penalties = fixture.shootoutPenalties;
        fixture.winner = deciding.shootoutWinner;
      });
    const histRounds = [deciding.knockoutRound, deciding.round, (deciding.knockoutRound || 0) + 1].filter(Boolean);
    histRounds.forEach(round => {
      const userDivision = deps.getUserDivision();
      const history = userDivision === 'D'
        ? deps.getSeasonRoundHistory()
        : (deps.getCompetitionRoundHistory().D || []);
      const entry = (Array.isArray(history) ? history : []).find(item => item.round === round);
      entry?.games?.forEach(game => {
        if (!deps.sameKnockoutFixture(game, deciding)) return;
        game.shootoutWinner = deciding.shootoutWinner;
        game.shootoutPenalties = deciding.shootoutPenalties || deciding.penalties;
        game.penalties = game.shootoutPenalties;
        game.winner = deciding.shootoutWinner;
      });
    });
  };

  const resolveTies = (ties, startRound) => {
    if (!Array.isArray(ties) || !ties.length) return null;
    const nationalCompetitions = deps.getNationalCompetitions();
    const dFixtures = Array.isArray(nationalCompetitions.D?.fixtures) ? nationalCompetitions.D.fixtures : [];
    const idaFixtures = dFixtures[startRound - 1] || [];
    const winners = [];
    const losers = [];
    for (let tieIndex = 0; tieIndex < ties.length; tieIndex++) {
      const tie = ties[tieIndex];
      if (!tie?.home || !tie?.away) return null;
      const tieId = `d-ko-r${startRound}-t${tieIndex}`;
      const linked = getSerieDTieGames({ tieId });
      const raw = linked.length
        ? linked
        : [idaFixtures[tieIndex], (dFixtures[startRound] || [])[tieIndex]].filter(Boolean);
      const games = mergeSerieDTieResults(raw, startRound);
      if (!games.length || games.some(game => game.homeGoals == null && !game.completed)) return null;
      const involvesUser = games.some(deps.isUserFixture);
      // Usuário no confronto + empate no agregado → exige pênaltis jogados (não simula)
      if (involvesUser && deps.knockoutTieNeedsPlayedShootout(games)) return null;
      const winner = deps.resolveKnockoutTieWinner(games, {
        pickWinner: deps.cupPenaltyWinner,
        int: deps.int,
        allowAutoShootout: !involvesUser,
        random: deps.gameRandom,
        getKickPair: deps.knockoutShootoutKickPair,
      });
      if (!winner) return null;
      persistSerieDTieShootout(games);
      winners.push(winner);
      losers.push(winner === tie.home ? tie.away : tie.home);
    }
    return { winners, losers };
  };

  const updateSeriesDKnockout = completedRound => {
    const nationalCompetitions = deps.getNationalCompetitions();
    const serieDGroups = deps.getSerieDGroups();
    if (completedRound === 10 && !dKnockout.stages.second) {
      const qualified = serieDGroups.map(group => (group || [])
        .map(name => nationalCompetitions.D.standings.find(row => row.club === name))
        .filter(Boolean)
        .sort((a, b) => b.points - a.points || b.wins - a.wins || b.goalDiff - a.goalDiff)
        .slice(0, 4)
        .map(row => row.club));
      const ties = [];
      for (let group = 0; group < 16; group += 2) {
        const left = qualified[group] || [];
        const right = qualified[group + 1] || [];
        if (left.length < 4 || right.length < 4) continue;
        ties.push(
          { home: left[0], away: right[3] },
          { home: left[1], away: right[2] },
          { home: left[2], away: right[1] },
          { home: left[3], away: right[0] },
        );
      }
      if (ties.length) {
        dKnockout.stages.second = ties;
        installTieRounds(ties, 11, { phase: '2ª fase eliminatória' });
        deps.notifySerieDKnockoutPhase(11, '2ª fase eliminatória');
      }
    }
    if (completedRound === 12 && !dKnockout.stages.third) { const resolved = resolveTies(dKnockout.stages.second, 11); if (!resolved) return; dKnockout.stages.third = makeTies(resolved.winners); installTieRounds(dKnockout.stages.third, 13, { phase: '3ª fase eliminatória' }); deps.notifySerieDKnockoutPhase(13, '3ª fase eliminatória'); }
    if (completedRound === 14 && !dKnockout.stages.round16) { const resolved = resolveTies(dKnockout.stages.third, 13); if (!resolved) return; dKnockout.stages.round16 = makeTies(resolved.winners); installTieRounds(dKnockout.stages.round16, 15, { phase: 'Oitavas de final' }); deps.notifySerieDKnockoutPhase(15, 'Oitavas de final'); }
    if (completedRound === 16 && !dKnockout.stages.quarter) { const resolved = resolveTies(dKnockout.stages.round16, 15); if (!resolved) return; dKnockout.stages.quarter = makeTies(resolved.winners); installTieRounds(dKnockout.stages.quarter, 17, { phase: 'Quartas de final' }); deps.notifySerieDKnockoutPhase(17, 'Quartas de final'); }
    if (completedRound === 18 && !dKnockout.stages.semi) { const resolved = resolveTies(dKnockout.stages.quarter, 17); if (!resolved) return; dKnockout.promoted = [...resolved.winners]; dKnockout.stages.semi = makeTies(resolved.winners); dKnockout.stages.playoff = makeTies(resolved.losers); installTieRounds(dKnockout.stages.semi, 19, { extraTies: dKnockout.stages.playoff, phase: 'Semifinal', extraPhase: 'Playoff de acesso' }); deps.notifySerieDKnockoutPhase(19, 'Semifinal'); }
    if (completedRound === 20 && !dKnockout.stages.final) { const semifinal = resolveTies(dKnockout.stages.semi, 19); const playoff = resolveTies(dKnockout.stages.playoff, 19); if (!semifinal || !playoff) return; dKnockout.promoted = [...new Set([...serieDPromotedClubs(), ...playoff.winners])]; dKnockout.stages.final = makeTies(semifinal.winners); installTieRounds(dKnockout.stages.final, 21, { phase: 'Final' }); deps.notifySerieDKnockoutPhase(21, 'Final'); }
    if (completedRound === 22 && dKnockout.stages.final && !dKnockout.champion) { const resolved = resolveTies(dKnockout.stages.final, 21); if (!resolved) return; dKnockout.champion = resolved.winners[0] || null; }
    deps.rebuildCalendarGames();
  };

  return {
    serieDPromotedClubs,
    dRoundResults,
    makeTies,
    installTieRounds,
    getSerieDTieGames,
    mergeSerieDTieResults,
    getKnockoutTieGames,
    persistSerieDTieShootout,
    resolveTies,
    updateSeriesDKnockout,
  };
}
