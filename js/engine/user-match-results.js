/**
 * Identidade estável de um resultado do usuário (dedup entre histórico, estadual, etc.).
 */
export function userMatchResultIdentityKey(game, meta = {}) {
  if (!game?.home || !game?.away) return '';
  const round = game.round ?? meta.round ?? '';
  const leg = game.leg ?? meta.leg ?? '';
  const phase = game.phase ?? meta.phase ?? '';
  return `${game.home}|${game.away}|${round}|${leg}|${phase}`;
}
