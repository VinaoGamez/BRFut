/**
 * Fixtures da Copa: sorteio de entrantes, jogos do confronto e simulação IA.
 */
export function createCupFixtureRuntime(deps) {
  const nextCupEntrants = (phase, winners) => {
    if (phase === 1) return [...winners, ...deps.getCupSecondDirect()];
    if (phase === 2) return [...winners, ...deps.getCupSpecialEntrants()];
    if (phase === 4) return [...winners, ...deps.getCupSerieAEntrants()];
    return [...winners];
  };

  const cupTieGames = (stage, tieId) => {
    const fixtures = Array.isArray(stage?.fixtures) ? stage.fixtures : [];
    return fixtures
      .filter(game => game?.tieId === tieId)
      .sort((a, b) => a.date - b.date || a.gameNumber - b.gameNumber);
  };

  const cupTieAggregate = games => {
    const aggregate = new Map();
    games.forEach(game => {
      if (!game.completed) return;
      aggregate.set(game.home, (aggregate.get(game.home) || 0) + (game.homeGoals || 0));
      aggregate.set(game.away, (aggregate.get(game.away) || 0) + (game.awayGoals || 0));
    });
    return aggregate;
  };

  const simulateCupComputerGame = game => {
    if (game.completed || deps.isUserFixture(game)) return null;
    const result = deps.simulateRoundMatch(game.home, game.away, game);
    game.homeGoals = result.homeGoals;
    game.awayGoals = result.awayGoals;
    game.completed = true;
    game.data = result.data;
    game.goals = result.goals;
    deps.applyCupFatigue(game, result);
    deps.recordPlayerHistoryMatch(
      {
        ...result,
        home: game.home,
        away: game.away,
        round: game.phaseIndex || game.round,
        competition: game.competition || 'COPA DO BRASIL',
        leg: game.leg,
        tieId: game.tieId,
      },
      {
        persist: false,
        competition: 'COPA DO BRASIL',
        round: game.phaseIndex || game.round,
        leg: game.leg,
        id: `cup-${game.tieId || 'x'}-${game.leg || 'u'}-${game.gameNumber || ''}`,
      },
    );
    return result;
  };

  return { nextCupEntrants, cupTieGames, cupTieAggregate, simulateCupComputerGame };
}
