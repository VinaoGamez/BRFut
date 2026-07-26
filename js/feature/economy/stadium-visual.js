/**
 * Visual do estádio — ilustrações WebP por tier (1–8).
 * Carrega só a imagem do tier ativo (lazy glob).
 */
import {
  resolveStadiumVisualTier,
  tierMeta,
  sectorCaption,
  nextTierUnlock,
  maxStadiumVisualTier,
  STADIUM_STRUCTURE_LABELS,
} from './stadium-visual-tier.js';
import { getSectorStructureLevel } from '../../engine/stadium-sectors.js';

export {
  resolveStadiumVisualTier,
  STADIUM_VISUAL_TIERS,
  maxStadiumVisualTier,
  nextTierUnlock,
  tierMeta,
} from './stadium-visual-tier.js';

const STADIUM_TIER_LOADERS = import.meta.glob('../../../assets/stadium/stadium-*-tier-*.webp', {
  query: '?url',
  import: 'default',
});

/** @type {Map<string, string>} */
const stadiumUrlCache = new Map();

function stadiumGlobPath(division, tier) {
  const div = String(division || 'A').toLowerCase();
  const t = String(Number(tier) || 1).padStart(2, '0');
  return `../../../assets/stadium/stadium-${div}-tier-${t}.webp`;
}

export async function stadiumImageUrl(division, tier) {
  const div = String(division || 'A').toUpperCase();
  const key = `${div}:${tier}`;
  if (stadiumUrlCache.has(key)) return stadiumUrlCache.get(key);

  const tryLoad = async t => {
    const path = stadiumGlobPath(div, t);
    const loader = STADIUM_TIER_LOADERS[path];
    if (!loader) return null;
    const url = await loader();
    stadiumUrlCache.set(`${div}:${t}`, url);
    return url;
  };

  const url = (await tryLoad(tier)) || (await tryLoad(1)) || '';
  stadiumUrlCache.set(key, url);
  return url;
}

/** Chave estável do tier visual (evita recarregar a mesma imagem). */
export function stadiumPreviewKeyForClub(club, division) {
  if (!club) return '';
  const div = division || club.division || 'A';
  const tier = resolveStadiumVisualTier(club, div);
  return `${div}:${tier}`;
}

/** URL da ilustração do tier visual atual do clube (dashboard, cards, etc.). */
export async function stadiumPreviewUrlForClub(club, division) {
  if (!club) return '';
  const div = division || club.division || 'A';
  const tier = resolveStadiumVisualTier(club, div);
  return stadiumImageUrl(div, tier);
}

/** HTML da ilustração + legenda. */
export async function buildStadiumVisualHtml(club, division, { getStructureLevel, getPitchLevel } = {}) {
  if (!club) return '';

  const div = division || club.division || 'A';
  const tier = resolveStadiumVisualTier(club, div);
  const maxTier = maxStadiumVisualTier(div);
  const meta = tierMeta(tier);
  const structure = getStructureLevel?.(club) ?? getSectorStructureLevel(club);
  const structureLabel = STADIUM_STRUCTURE_LABELS[structure] || STADIUM_STRUCTURE_LABELS[0];
  const imageUrl = await stadiumImageUrl(div, tier);
  const sectors = sectorCaption(club);
  const pitch = getPitchLevel?.(club) ?? 1;
  const unlock = nextTierUnlock(tier, div);
  const nextLine =
    tier >= maxTier
      ? `Arena no nível visual máximo para a Série ${div}.`
      : `Próximo visual: ${tierMeta(tier + 1).label} — ${unlock}`;

  return `<div class="stadium-visual stadium-visual--tier-${tier}" data-tier="${tier}" data-structure="${structure}" data-division="${div}" role="img" aria-label="${meta.label}">
    <div class="stadium-visual-frame">
      <img class="stadium-visual-img" src="${imageUrl}" alt="${meta.label}" width="640" height="360" loading="lazy" decoding="async" fetchpriority="low"/>
      <div class="stadium-visual-badge"><span>TIER ${tier}/${maxTier} · Série ${div}</span><strong>${meta.label.toUpperCase()}</strong></div>
    </div>
    <p class="stadium-visual-caption">${meta.hint} · ${structureLabel} (${structure}/5) · gramado nível ${pitch}${sectors ? ` · ${sectors}` : ''}</p>
    <p class="stadium-visual-next">${nextLine}</p>
  </div>`;
}

export async function mountStadiumVisual(container, club, division, helpers) {
  if (!container) return;
  const div = division || club?.division || 'A';
  const tier = resolveStadiumVisualTier(club, div);
  const visualKey = `${div}:${tier}`;
  const prevTier = Number(container.dataset.lastTier || 0);
  if (container.dataset.visualKey === visualKey && container.querySelector('.stadium-visual-img')) {
    return;
  }
  container.dataset.visualKey = visualKey;
  container.dataset.lastTier = String(tier);
  container.innerHTML = await buildStadiumVisualHtml(club, div, helpers);
  if (prevTier && prevTier !== tier) {
    const root = container.querySelector('.stadium-visual');
    root?.classList.add('stadium-visual--upgraded');
    window.setTimeout(() => root?.classList.remove('stadium-visual--upgraded'), 700);
  }
}
