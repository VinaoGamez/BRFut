/**
 * Arte do card por jogador — PNGs só carregam ao abrir o modal.
 */

export { cardDisplayPos, resolveCardRoleKey, ensureCardVariantId } from './player-card-variant-id.js';

/** @type {Promise<typeof import('../lab/card-variants.js')> | null} */
let variantsModulePromise = null;

function loadVariantsModule() {
  if (!variantsModulePromise) {
    variantsModulePromise = import('../lab/card-variants.js');
  }
  return variantsModulePromise;
}

export async function cardArtForPlayer(player, random = Math.random) {
  const { ensureCardVariantId, resolveCardRoleKey } = await import('./player-card-variant-id.js');
  const { cardVariantApi } = await loadVariantsModule();
  const roleKey = resolveCardRoleKey(player);
  const api = cardVariantApi(roleKey);
  const variantId = ensureCardVariantId(player, random);
  return api.artForId(variantId);
}
