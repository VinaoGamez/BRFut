/**
 * Badges do verso do card — especialistas e craque (WebP, lazy por tipo).
 */

import {
  isCraque,
  isDestaque,
  isPenaltySavingSpecialist,
  isSetPieceSpecialist,
} from '../engine/player-generation.js';

const loaders = {
  freeKick: () => import('../../assets/cards/badges/card-badge-especialista-falta.webp'),
  penalty: () => import('../../assets/cards/badges/card-badge-especialista-penalti.webp'),
  penaltySaving: () => import('../../assets/cards/badges/card-badge-especialista-defesa-penalti.webp'),
  specialistStar: () => import('../../assets/cards/badges/card-badge-estrela-prata.webp'),
  craque: () => import('../../assets/cards/badges/card-badge-estrela-dourada.webp'),
};

const cache = new Map();

export const CARD_BADGE_ASSETS = {
  freeKick: {
    id: 'freeKick',
    label: 'Especialista em Falta',
    short: 'Esp. falta',
    url: '',
  },
  penalty: {
    id: 'penalty',
    label: 'Especialista em Cobrança de Pênaltis',
    short: 'Esp. pênalti',
    url: '',
  },
  penaltySaving: {
    id: 'penaltySaving',
    label: 'Especialista em Defesa de Pênaltis',
    short: 'Esp. def. pênalti',
    url: '',
  },
  specialistStar: {
    id: 'specialistStar',
    label: 'Especialista',
    short: 'Estrela prata',
    url: '',
  },
  craque: {
    id: 'craque',
    label: 'Craque',
    short: 'Estrela dourada',
    url: '',
  },
};

export async function preloadCardBadge(id) {
  if (!loaders[id]) return '';
  if (cache.has(id)) return cache.get(id);
  const mod = await loaders[id]();
  const url = mod.default;
  cache.set(id, url);
  if (CARD_BADGE_ASSETS[id]) CARD_BADGE_ASSETS[id].url = url;
  return url;
}

/** Preload só os badges que o card pode exibir. */
export async function preloadCardBadgesForPlayer(player, { preview = false } = {}) {
  const ids = new Set();
  if (preview) {
    ids.add(player?.pos === 'GOL' ? 'penaltySaving' : 'freeKick');
    ids.add('specialistStar');
  } else {
    const hex = resolveSpecialistHexBadge(player);
    if (hex) ids.add(hex.id);
    if (isCraque(player)) ids.add('craque');
    else if (
      isDestaque(player) ||
      isSetPieceSpecialist(player) ||
      isPenaltySavingSpecialist(player)
    ) {
      ids.add('specialistStar');
    }
  }
  await Promise.all([...ids].map(preloadCardBadge));
}

export function hydrateCardBadgeImages(root = document) {
  root.querySelectorAll('img[data-badge-id]').forEach(async img => {
    const id = img.dataset.badgeId;
    if (!id || img.getAttribute('src')) return;
    try {
      const url = await preloadCardBadge(id);
      if (url) img.setAttribute('src', url);
    } catch {
      // Emblema decorativo: uma falha de cache nunca deve bloquear o card.
    }
  });
}

/** Um hex por jogador — conforme flag/atributos de bola parada. */
export function resolveSpecialistHexBadge(player) {
  if (!player) return null;
  if (player.pos === 'GOL') {
    return isPenaltySavingSpecialist(player) ? CARD_BADGE_ASSETS.penaltySaving : null;
  }

  const flag = player.setPieceSpecialist;
  const fkVal = Number(player.freeKick) || 0;
  const penVal = Number(player.penaltyTaking) || 0;
  const fk =
    flag === 'freeKick' || flag === 'both' || flag === true || fkVal > 85;
  const pen =
    flag === 'penalty' || flag === 'both' || flag === true || penVal > 85;

  if (flag === 'freeKick') return CARD_BADGE_ASSETS.freeKick;
  if (flag === 'penalty') return CARD_BADGE_ASSETS.penalty;
  if (flag === 'both') {
    return fkVal >= penVal ? CARD_BADGE_ASSETS.freeKick : CARD_BADGE_ASSETS.penalty;
  }
  if (fk && pen) {
    return fkVal >= penVal ? CARD_BADGE_ASSETS.freeKick : CARD_BADGE_ASSETS.penalty;
  }
  if (fk) return CARD_BADGE_ASSETS.freeKick;
  if (pen) return CARD_BADGE_ASSETS.penalty;
  return null;
}
