/**
 * Adapta jogador do elenco/jogo para o renderizador de cards.
 */

import { cardDisplayPos, resolveCardRoleKey } from '../../engine/player-card-variant-id.js';
import { playerKey } from '../../engine/player-match-stats.js';
import { resolvePlayerSeasonStats } from '../../engine/player-history.js';

export function resolveCardStatsBucket(localBucket, remoteTotal) {
  if (!localBucket) return remoteTotal || null;
  if (!remoteTotal) return localBucket;
  const localApps = Number(localBucket.apps) || 0;
  const remoteApps = Number(remoteTotal.apps) || 0;
  // A API é eventual: nunca deixa uma resposta atrasada apagar o jogo que
  // acabou de ser consolidado no histórico local.
  if (remoteApps > localApps) return remoteTotal;
  return localBucket;
}

export async function rosterPlayerToCardPlayer(player, { playerHistory, careerSeason, clubName, clubDivision, remoteStats = null } = {}) {
  if (!player) return null;

  const key = playerKey(player);
  const resolvedClub = clubName || player.clubName || player.club || null;
  const localBucket = resolvePlayerSeasonStats(
    playerHistory,
    key,
    careerSeason,
    null,
    { clubId: resolvedClub },
  ) || resolvePlayerSeasonStats(playerHistory, key, careerSeason);
  const remote = remoteStats?.total
    ? {
        apps: remote.apps,
        goals: remote.goals,
        assists: remote.assists,
        yellow: remote.yellow,
        red: remote.red,
        avgRating: remote.avg_rating,
      }
    : null;
  const bucket = resolveCardStatsBucket(localBucket, remote);

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
