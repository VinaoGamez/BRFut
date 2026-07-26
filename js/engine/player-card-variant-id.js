/**
 * Variante estável do card por jogador — zero PNGs (boot leve).
 * A arte PNG só carrega ao abrir o modal do card.
 */

import { POS_TO_ROLE_KEY } from './player-card-roles.js';
import { resolvePlayerId } from './player-identity.js';

/** IDs padrão por função (espelha os pools em js/lab/card-*-variants.js). */
const ROLE_VARIANT_IDS = Object.freeze({
  goleiro: ['gol-01', 'gol-02', 'gol-02-clean', 'gol-03', 'gol-04', 'gol-05', 'gol-06', 'gol-07', 'gol-08', 'gol-09', 'gol-10'],
  lateral: ['lat-01', 'lat-02', 'lat-03', 'lat-05', 'lat-06', 'lat-07', 'lat-08', 'lat-10'],
  mei: ['mei-01', 'mei-02', 'mei-03', 'mei-04', 'mei-05', 'mei-06', 'mei-07', 'mei-08', 'mei-09', 'mei-10'],
  mc: ['mc-01', 'mc-02', 'mc-03', 'mc-04', 'mc-05', 'mc-06', 'mc-07', 'mc-08', 'mc-09', 'mc-10'],
  zagueiro: ['zag-01', 'zag-02', 'zag-05', 'zag-06', 'zag-07', 'zag-10', 'zag-11', 'zag-12', 'zag-13', 'zag-14'],
  ponta: ['pon-01', 'pon-02', 'pon-03', 'pon-04', 'pon-05', 'pon-06', 'pon-07', 'pon-08', 'pon-09', 'pon-10'],
  volante: ['vol-01', 'vol-02', 'vol-04', 'vol-05', 'vol-06', 'vol-07', 'vol-09', 'vol-10'],
  atacante: ['ata-04', 'ata-05', 'ata-06', 'ata-07', 'ata-08', 'ata-09', 'ata-10', 'ata-11', 'ata-12', 'ata-13', 'ata-14', 'ata-15'],
});

function hashString(text = '') {
  let hash = 2166136261;
  const str = String(text);
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededUnit(seedText, salt = '') {
  return hashString(`${seedText}:${salt}`) / 4294967295;
}

/** Posição exibida no card — pontas usam PD/PE conforme o pé. */
export function cardDisplayPos(player) {
  const pos = String(player?.pos || '').toUpperCase();
  if (pos === 'PD' || pos === 'PE') return pos;
  if (pos !== 'PON') return pos || 'GOL';

  const foot = String(player?.preferredFoot || '').toLowerCase();
  if (foot.includes('esquer')) return 'PE';
  if (foot.includes('direit')) return 'PD';
  if (foot.includes('ambi')) return seededUnit(resolvePlayerId(player) || player?.name, 'pon-side') < 0.5 ? 'PE' : 'PD';
  return 'PD';
}

/** Bloco de arte PNG (GOL/LAT/ZAG/MC/MEI/VOL/ponta/ATA). */
export function resolveCardRoleKey(player) {
  const pos = cardDisplayPos(player);
  return POS_TO_ROLE_KEY[pos] || POS_TO_ROLE_KEY[player?.pos] || 'goleiro';
}

/** Variante estável por jogador dentro do pool da função. */
export function ensureCardVariantId(player, random = Math.random) {
  if (!player || typeof player !== 'object') return null;
  const roleKey = resolveCardRoleKey(player);
  const variants = ROLE_VARIANT_IDS[roleKey] || ROLE_VARIANT_IDS.goleiro;
  if (!variants.length) return null;

  if (player.cardVariantId && variants.includes(player.cardVariantId)) {
    return player.cardVariantId;
  }

  const seed = resolvePlayerId(player) || `${player.name}:${player.pos}:${player.age}`;
  const idx = Math.floor(seededUnit(seed, roleKey) * variants.length);
  player.cardVariantId = variants[idx] || variants[0];
  return player.cardVariantId;
}
