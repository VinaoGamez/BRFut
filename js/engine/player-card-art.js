/**
 * Arte do card por jogador — PNGs só carregam ao abrir o modal.
 */

export { cardDisplayPos, resolveCardRoleKey, ensureCardVariantId } from './player-card-variant-id.js';
import { ensureCardVariantId, resolveCardRoleKey } from './player-card-variant-id.js';
import { cardVariantApi } from '../lab/card-variants.js';

export async function cardArtForPlayer(player, random = Math.random) {
  const roleKey = resolveCardRoleKey(player);
  const api = cardVariantApi(roleKey);
  const variantId = ensureCardVariantId(player, random);
  return api.artForId(variantId);
}
