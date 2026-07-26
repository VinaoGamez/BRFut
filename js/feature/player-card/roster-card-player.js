/**
 * Adapta jogador do elenco/jogo para o renderizador de cards.
 */

import { cardDisplayPos, resolveCardRoleKey } from '../../engine/player-card-variant-id.js';
import { playerKey } from '../../engine/player-match-stats.js';

export async function rosterPlayerToCardPlayer(player, { playerHistory, careerSeason, clubName, clubDivision } = {}) {
  if (!player) return null;

  const key = playerKey(player);
  const bucket = playerHistory?.getPlayer?.(key)?.seasons?.[String(careerSeason)];

  const cardPlayer = {
    ...player,
    pos: cardDisplayPos(player),
    roleKey: resolveCardRoleKey(player),
    nationality: player.nationality || player.nationalTeamName || 'Brasil',
    nationalityIso: player.nationalityIso,
    clubName: clubName || player.clubName || player.club || null,
    clubDivision: clubDivision || player.clubDivision || player.division || null,
    cardStats: {
      avgRating: bucket?.avgRating ?? player?.avgRating ?? player?.seasonAvg ?? null,
      clubApps: bucket?.apps ?? 0,
      goals: bucket?.goals ?? 0,
      assists: bucket?.assists ?? 0,
      yellowCards: bucket?.yellow ?? player?.discipline?.yellowCards ?? 0,
      redCards: bucket?.red ?? player?.discipline?.redCards ?? 0,
    },
  };

  const { cardArtForPlayer } = await import('../../engine/player-card-art.js');
  cardPlayer._cardArt = await cardArtForPlayer(cardPlayer);
  return cardPlayer;
}
