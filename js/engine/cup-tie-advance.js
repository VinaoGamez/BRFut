import { resolveKnockoutTieWinner, formatKnockoutFixtureScore, clearStaleKnockoutShootout } from './knockout-shootout.js';

/**
 * Resolução de chaves da Copa do Brasil: simulação IA, pênaltis e avanço por data.
 */
export function createCupTieAdvanceEngine(deps) {
  const resolveCupTieWinner = (games, aggregate) => {
    const clubsInTie = [games[0].home, games[0].away];
    const firstGoals = aggregate.get(clubsInTie[0]) || 0;
    const secondGoals = aggregate.get(clubsInTie[1]) || 0;
    let winner = firstGoals > secondGoals ? clubsInTie[0] : secondGoals > firstGoals ? clubsInTie[1] : null;
    if (firstGoals === secondGoals) {
      const involvesUser = games.some(deps.isUserFixture);
      winner = resolveKnockoutTieWinner(games, {
        pickWinner: deps.cupPenaltyWinner,
        int: deps.int,
        allowAutoShootout: !involvesUser,
        random: deps.gameRandom,
        getKickPair: deps.knockoutShootoutKickPair,
      });
    } else {
      games.forEach(clearStaleKnockoutShootout);
    }
    if (winner) games.forEach(game => { game.winner = winner; });
    return winner;
  };

  const notifyCupTieResult = (games, winner) => {
    const userClub = deps.getUserClub();
    games.forEach(game => {
      if (game.home !== userClub && game.away !== userClub) return;
      const opponent = game.home === userClub ? game.away : game.home;
      const scoreLabel = formatKnockoutFixtureScore(game);
      const qualified = winner === userClub;
      deps.pushMessage({
        category: 'competition',
        type: 'cup',
        title: `Copa do Brasil · ${game.phase}`,
        body: `${game.home} ${scoreLabel} ${game.away} · ${qualified ? `${userClub} avança de fase` : `${userClub} eliminado por ${opponent}`}`,
        round: deps.getCurrentRound(),
        meta: { competition: 'Copa do Brasil', phase: game.phase },
      });
    });
  };

  const notifyCupPhaseAdvance = (completedStage, nextStage) => {
    const userClub = deps.getUserClub();
    if (!nextStage?.entrants?.includes(userClub)) return;
    deps.pushMessage({
      category: 'competition',
      type: 'phase-advance',
      title: `Copa do Brasil · ${nextStage.name}`,
      body: `${userClub} classificado para ${nextStage.name} (${nextStage.entrants.length} clubes). Confira o calendário dos confrontos.`,
      round: deps.getCurrentRound(),
      meta: { competition: 'Copa do Brasil', phase: nextStage.name },
    });
  };

  const stagePendingUserFixtures = stage =>
    stage?.fixtures?.some(game => deps.isUserFixture(game) && !game.completed);

  const resolveCupTie = (stage, tieId) => {
    const games = deps.cupTieGames(stage, tieId);
    if (!games.length) return null;
    if (games.some(game => deps.isUserFixture(game) && !game.completed)) return null;
    games.forEach(game => { if (!game.completed) deps.simulateCupComputerGame(game); });
    if (games.some(game => !game.completed)) return null;
    const winner = resolveCupTieWinner(games, deps.cupTieAggregate(games));
    if (games.some(deps.isUserFixture)) notifyCupTieResult(games, winner);
    return winner;
  };

  const finalizeCupStageIfReady = stage => {
    if (!stage || stage.completed) return null;
    const fixtures = Array.isArray(stage.fixtures) ? stage.fixtures : [];
    if (!fixtures.length) return null;
    const ties = [...new Set(fixtures.map(game => game.tieId).filter(Boolean))];
    const winners = [];
    for (const tieId of ties) {
      const winner = resolveCupTie(stage, tieId);
      if (winner === null) return null;
      winners.push(winner);
    }
    stage.winners = winners;
    stage.completed = true;
    const cupCompetition = deps.getCupCompetition();
    if (stage.index === 9) {
      cupCompetition.champion = winners[0] || null;
      cupCompetition.currentPhase = 9;
    } else {
      const entrants = deps.nextCupEntrants(stage.index, winners);
      if (Array.isArray(entrants) && entrants.length >= 2) {
        const nextStage = deps.createCupStage(stage.index + 1, entrants);
        notifyCupPhaseAdvance(stage, nextStage);
      }
    }
    deps.onCupScheduleChanged();
    return winners;
  };

  const advanceCupComputerTies = stage => {
    if (!stage || stage.completed) return false;
    const fixtures = Array.isArray(stage.fixtures) ? stage.fixtures : [];
    if (!fixtures.length) return false;
    let changed = false;
    [...new Set(fixtures.map(game => game.tieId).filter(Boolean))].forEach(tieId => {
      const games = deps.cupTieGames(stage, tieId);
      if (games.some(game => deps.isUserFixture(game) && !game.completed)) return;
      games.forEach(game => { if (deps.simulateCupComputerGame(game)) changed = true; });
      if (games.length && games.every(game => game.completed)) {
        resolveCupTieWinner(games, deps.cupTieAggregate(games));
        changed = true;
      }
    });
    if (finalizeCupStageIfReady(stage)) changed = true;
    return changed;
  };

  const completeCupStage = stage => {
    if (!stage || stage.completed) return stage?.winners || [];
    if (stagePendingUserFixtures(stage)) return stage?.winners || [];
    advanceCupComputerTies(stage);
    return stage?.winners || [];
  };

  const advanceCupThroughDate = date => {
    if (!date) return false;
    let changed = false;
    const cupCompetition = deps.getCupCompetition();
    let stage = cupCompetition.stages.find(item => !item.completed);
    while (stage) {
      const fixtures = Array.isArray(stage.fixtures) ? stage.fixtures : [];
      if (!fixtures.length) break;
      const latest = Math.max(...fixtures.map(game => new Date(game.date || 0).getTime()));
      const stageDue = latest <= date.getTime();
      if (!stageDue) break;
      if (advanceCupComputerTies(stage)) changed = true;
      if (stagePendingUserFixtures(stage)) break;
      if (!stage.completed) break;
      stage = cupCompetition.stages.find(item => !item.completed);
    }
    if (changed) {
      deps.persistPlayerHistory();
      deps.invalidateUserScheduleCache();
    }
    return changed;
  };

  return {
    resolveCupTieWinner,
    resolveCupTie,
    finalizeCupStageIfReady,
    advanceCupComputerTies,
    completeCupStage,
    advanceCupThroughDate,
    stagePendingUserFixtures,
  };
}
