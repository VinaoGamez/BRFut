/** Jogo com mandante e visitante válidos para exibir em tabelas de rodada. */
export const isPlayableRoundGame = game => !!(game?.home && game?.away);

export const filterPlayableRoundGames = games =>
  (Array.isArray(games) ? games : []).filter(isPlayableRoundGame);
