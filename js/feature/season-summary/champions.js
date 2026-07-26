import { FEATURES } from '../../core/constants.js';
import { FUTURE_COMPETITION_MOLD } from '../../engine/season-calendar-mold.js';
import { ensureCompetitionTrophy, preloadCompetitionTrophy, resolveChampionshipTrophyKey } from '../../ui/competition-trophies.js';
import { teamCrestHtml } from '../../ui/team-crest.js';

const LEAGUE_META = Object.freeze({
  A: { label: 'Série A', subtitle: 'Campeão do Brasileirão', accent: '#63d9ff', cupStyle: false },
  B: { label: 'Série B', subtitle: 'Campeão da Série B', accent: '#7ee787', cupStyle: false },
  C: { label: 'Série C', subtitle: 'Campeão da Série C', accent: '#ffc94f', cupStyle: false },
  D: { label: 'Série D', subtitle: 'Campeão da Série D', accent: '#ff9f6b', cupStyle: false },
  CUP: { label: 'Copa do Brasil', subtitle: 'Campeão da Copa do Brasil', accent: '#b6ff38', cupStyle: true },
  RECOPA: { label: 'Recopa Nacional', subtitle: 'Campeão da Recopa Nacional', accent: '#ffd24a', cupStyle: false },
  LIBERTADORES: { label: 'Libertadores', subtitle: 'Campeão da Libertadores', accent: '#c9a227', cupStyle: false },
  SUDAMERICANA: { label: 'Sul-Americana', subtitle: 'Campeão da Sul-Americana', accent: '#ff7a52', cupStyle: false },
});

const ESTADUAL_META = Object.freeze({
  label: 'Estadual',
  subtitle: 'Campeão estadual',
  accent: '#d4af37',
  cupStyle: false,
});

const PYRAMID_ORDER = ['A', 'B', 'C', 'D'];

function entryFromMeta(key, meta, clubName, { variant, subtitleOverride = null } = {}) {
  if (!clubName) return null;
  return {
    key,
    label: meta.label,
    subtitle: subtitleOverride || meta.subtitle,
    accent: meta.accent,
    cupStyle: meta.cupStyle,
    clubName,
    variant,
    competitionId: key,
  };
}

/** Monta lista de cards para layout B (pódio + pirâmide + extras). */
export function buildChampionEntries({
  champions = {},
  championEstaduais = [],
  userClub = '',
  userDivision = 'A',
  recopaSubtitle = null,
} = {}) {
  const entries = [];
  const featuredKeys = new Set(['CUP', userDivision]);

  const cupEntry = entryFromMeta('CUP', LEAGUE_META.CUP, champions.CUP, { variant: 'featured' });
  if (cupEntry) entries.push(cupEntry);

  if (userDivision !== 'CUP') {
    const leagueMeta = LEAGUE_META[userDivision];
    if (leagueMeta) {
      const userLeague = entryFromMeta(userDivision, leagueMeta, champions[userDivision], { variant: 'featured' });
      if (userLeague) entries.push(userLeague);
    }
  }

  PYRAMID_ORDER.forEach(key => {
    const meta = LEAGUE_META[key];
    const clubName = champions[key];
    if (!clubName) return;
    entries.push(
      entryFromMeta(key, meta, clubName, {
        variant: featuredKeys.has(key) ? 'featured-dup' : 'compact',
      }),
    );
  });

  if (FUTURE_COMPETITION_MOLD.recopa_national.enabled && champions.RECOPA) {
    entries.push(
      entryFromMeta('RECOPA', LEAGUE_META.RECOPA, champions.RECOPA, {
        variant: 'extra',
        subtitleOverride: recopaSubtitle || LEAGUE_META.RECOPA.subtitle,
      }),
    );
  }

  if (FUTURE_COMPETITION_MOLD.libertadores.enabled && champions.LIBERTADORES) {
    entries.push(entryFromMeta('LIBERTADORES', LEAGUE_META.LIBERTADORES, champions.LIBERTADORES, { variant: 'extra' }));
  }

  if (FUTURE_COMPETITION_MOLD.sudamericana.enabled && champions.SUDAMERICANA) {
    entries.push(entryFromMeta('SUDAMERICANA', LEAGUE_META.SUDAMERICANA, champions.SUDAMERICANA, { variant: 'extra' }));
  }

  if (FEATURES.stateLeague) {
    championEstaduais.forEach(item => {
      if (!item?.clubName) return;
      entries.push({
        key: item.key || `EST:${item.uf}`,
        label: item.label || ESTADUAL_META.label,
        subtitle: ESTADUAL_META.subtitle,
        accent: ESTADUAL_META.accent,
        cupStyle: false,
        clubName: item.clubName,
        variant: 'extra',
        competitionId: 'ESTADUAIS',
        uf: item.uf || null,
      });
    });
  }

  return entries.map(entry => ({
    ...entry,
    isUserClub: !!userClub && entry.clubName === userClub,
  }));
}

function trophySize(variant) {
  if (variant === 'featured') return 58;
  if (variant === 'compact') return 40;
  return 46;
}

export function championCardMarkup(entry) {
  const { key, label, subtitle, accent, cupStyle, clubName, variant, isUserClub, competitionId } = entry;
  const size = trophySize(variant);
  const crest = clubName ? teamCrestHtml(clubName, { className: 'season-champion-crest' }) : '—';
  const classes = [
    'season-champion-card',
    cupStyle ? 'cup' : '',
    variant === 'featured' ? 'is-featured' : '',
    variant === 'compact' ? 'is-compact' : '',
    variant === 'extra' ? 'is-extra' : '',
    isUserClub ? 'is-user-club' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return `<article class="${classes}" data-champion-key="${key}" style="--champion-accent:${accent}">
    <span class="season-champion-badge">${label}</span>
    ${isUserClub ? '<span class="season-champion-user-tag">Seu clube</span>' : ''}
    <div class="season-champion-trophy">
      <img class="season-champion-trophy-img" data-competition="${competitionId || key}" alt="" width="${size}" height="${size}" decoding="async" loading="lazy">
    </div>
    <div class="season-champion-hero">${crest}</div>
    <p class="season-champion-title">${subtitle}</p>
    <p class="season-champion-name">${clubName || '—'}</p>
  </article>`;
}

export function renderChampionsLayout(root, entries) {
  if (!root) return;
  const featured = entries.filter(entry => entry.variant === 'featured');
  const pyramid = entries.filter(entry => entry.variant === 'compact' || entry.variant === 'featured-dup');
  const extra = entries.filter(entry => entry.variant === 'extra');

  const featuredEl = root.querySelector('#seasonChampionsFeatured');
  const pyramidEl = root.querySelector('#seasonChampionsPyramid');
  const extraEl = root.querySelector('#seasonChampionsExtra');
  const extraWrap = root.querySelector('#seasonChampionsExtraWrap');

  if (featuredEl) {
    featuredEl.innerHTML = featured.length
      ? featured.map(championCardMarkup).join('')
      : '<p class="season-champions-empty">Nenhum destaque disponível.</p>';
  }
  if (pyramidEl) {
    pyramidEl.innerHTML = pyramid.length
      ? pyramid.map(championCardMarkup).join('')
      : '';
    pyramidEl.classList.toggle('hidden', pyramid.length === 0);
  }
  if (extraEl) {
    extraEl.innerHTML = extra.map(championCardMarkup).join('');
  }
  if (extraWrap) {
    extraWrap.classList.toggle('hidden', extra.length === 0);
  }

  hydrateChampionTrophies(root);
}

export function hydrateChampionTrophies(root = document) {
  const keys = new Set();
  root.querySelectorAll('.season-champion-trophy-img[data-competition]').forEach(img => {
    const competition = img.dataset.competition || 'A';
    const trophyKey = resolveChampionshipTrophyKey(competition);
    keys.add(trophyKey);
    ensureCompetitionTrophy(competition, img);
  });
  keys.forEach(key => {
    preloadCompetitionTrophy(key).catch(() => {});
  });
}
