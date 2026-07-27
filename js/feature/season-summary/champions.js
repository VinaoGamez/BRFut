import { FEATURES } from '../../core/constants.js';
import { formatMatchRating as defaultFormatMatchRating } from '../../engine/player-match-stats.js';
import { FUTURE_COMPETITION_MOLD } from '../../engine/season-calendar-mold.js';
import {
  ensureCompetitionTrophy,
  hydratePickerTrophyIcons,
  preloadCompetitionTrophy,
  resolveChampionshipTrophyKey,
} from '../../ui/competition-trophies.js';
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
const NAV_ORDER = ['A', 'B', 'C', 'D', 'CUP', 'RECOPA', 'LIBERTADORES', 'SUDAMERICANA'];

const layoutState = new WeakMap();
let documentHandlersBound = false;

function entryFromMeta(key, meta, clubName, { subtitleOverride = null } = {}) {
  if (!clubName) return null;
  return {
    key,
    label: meta.label,
    subtitle: subtitleOverride || meta.subtitle,
    accent: meta.accent,
    cupStyle: meta.cupStyle,
    clubName,
    competitionId: key,
    trophyKey: resolveChampionshipTrophyKey(key),
  };
}

function resolveDefaultKey(nav, userDivision) {
  if (nav.some(entry => entry.key === userDivision)) return userDivision;
  if (nav.some(entry => entry.key === 'CUP')) return 'CUP';
  return nav[0]?.key || null;
}

/** Monta listas de campeões para navegação, pirâmide e extras. */
export function buildChampionEntries({
  champions = {},
  championEstaduais = [],
  userClub = '',
  userDivision = 'A',
  recopaSubtitle = null,
} = {}) {
  const nav = [];
  const pyramid = [];
  const extra = [];

  NAV_ORDER.forEach(key => {
    const meta = LEAGUE_META[key];
    if (!meta) return;
    if (key === 'RECOPA' && !FUTURE_COMPETITION_MOLD.recopa_national.enabled) return;
    if (key === 'LIBERTADORES' && !FUTURE_COMPETITION_MOLD.libertadores.enabled) return;
    if (key === 'SUDAMERICANA' && !FUTURE_COMPETITION_MOLD.sudamericana.enabled) return;
    const clubName = champions[key];
    if (!clubName) return;
    const entry = entryFromMeta(key, meta, clubName, {
      subtitleOverride: key === 'RECOPA' ? recopaSubtitle || meta.subtitle : null,
    });
    nav.push(entry);
    if (PYRAMID_ORDER.includes(key)) pyramid.push(entry);
    else if (['RECOPA', 'LIBERTADORES', 'SUDAMERICANA'].includes(key)) extra.push(entry);
  });

  if (FEATURES.stateLeague) {
    championEstaduais.forEach(item => {
      if (!item?.clubName) return;
      const entry = {
        key: item.key || `EST:${item.uf}`,
        label: item.label || ESTADUAL_META.label,
        subtitle: ESTADUAL_META.subtitle,
        accent: ESTADUAL_META.accent,
        cupStyle: false,
        clubName: item.clubName,
        competitionId: 'ESTADUAIS',
        uf: item.uf || null,
        trophyKey: resolveChampionshipTrophyKey('ESTADUAIS'),
      };
      nav.push(entry);
      extra.push(entry);
    });
  }

  const withUserFlag = list =>
    list.map(entry => ({
      ...entry,
      isUserClub: !!userClub && entry.clubName === userClub,
    }));

  return {
    nav: withUserFlag(nav),
    pyramid: withUserFlag(pyramid),
    extra: withUserFlag(extra),
    defaultKey: resolveDefaultKey(nav, userDivision),
  };
}

function trophySize(variant) {
  if (variant === 'featured') return 58;
  if (variant === 'compact') return 40;
  return 46;
}

export function championCardMarkup(entry, { featuredLayout = 'stacked' } = {}) {
  const { key, label, subtitle, accent, cupStyle, clubName, variant, isUserClub, competitionId } = entry;
  const size = trophySize(variant);
  const crest = clubName ? teamCrestHtml(clubName, { className: 'season-champion-crest' }) : '—';
  const isShowcase = featuredLayout === 'horizontal' && variant === 'featured';
  const classes = [
    'season-champion-card',
    cupStyle ? 'cup' : '',
    variant === 'featured' ? 'is-featured' : '',
    isShowcase ? 'is-featured-showcase' : '',
    variant === 'compact' ? 'is-compact' : '',
    variant === 'extra' ? 'is-extra' : '',
    isUserClub ? 'is-user-club' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const visualRow = isShowcase
    ? `<div class="season-champion-visual-row">
        <div class="season-champion-trophy">
          <img class="season-champion-trophy-img" data-competition="${competitionId || key}" alt="" width="${size}" height="${size}" decoding="async" loading="lazy">
        </div>
        <div class="season-champion-hero">${crest}</div>
      </div>`
    : `<div class="season-champion-trophy">
        <img class="season-champion-trophy-img" data-competition="${competitionId || key}" alt="" width="${size}" height="${size}" decoding="async" loading="lazy">
      </div>
      <div class="season-champion-hero">${crest}</div>`;

  return `<article class="${classes}" data-champion-key="${key}" style="--champion-accent:${accent}">
    <span class="season-champion-badge">${label}</span>
    ${isUserClub ? '<span class="season-champion-user-tag">Seu clube</span>' : ''}
    ${visualRow}
    <p class="season-champion-title">${subtitle}</p>
    <p class="season-champion-name">${clubName || '—'}</p>
  </article>`;
}

function championTeamStatsMarkup(clubName, deps = {}) {
  const {
    clubSeasonLeaders,
    clubSeasonRatingSummary,
    formatMatchRating = defaultFormatMatchRating,
  } = deps;
  const leaders =
    typeof clubSeasonLeaders === 'function'
      ? clubSeasonLeaders(clubName)
      : { scorer: { name: '—' }, goals: 0, assistant: { name: '—' }, assists: 0 };
  const teamRating =
    typeof clubSeasonRatingSummary === 'function'
      ? clubSeasonRatingSummary(clubName)
      : { average: null, matches: 0 };
  const matches = Number(teamRating.matches) || 0;
  const overallMeta =
    matches === 1 ? '1 partida' : matches > 1 ? `${matches} partidas` : 'nota média';

  return `<article class="card dashboard-team-stats season-champions-team-stats">
    <label>ESTATISTICAS DO TIME</label>
    <div class="dashboard-team-stats-list">
      <article class="dashboard-team-stat">
        <img class="dashboard-team-stat-icon" src="./brand/stats-scorer.png" alt="" width="46" height="46" decoding="async">
        <div class="dashboard-team-stat-copy">
          <small>ARTILHEIRO</small>
          <strong>${leaders.scorer?.name || '—'}</strong>
          <span>${leaders.goals || 0} gol${leaders.goals === 1 ? '' : 's'}</span>
        </div>
      </article>
      <article class="dashboard-team-stat">
        <img class="dashboard-team-stat-icon" src="./brand/stats-assist.png" alt="" width="46" height="46" decoding="async">
        <div class="dashboard-team-stat-copy">
          <small>ASSISTÊNCIAS</small>
          <strong>${leaders.assistant?.name || '—'}</strong>
          <span>${leaders.assists || 0} assist.</span>
        </div>
      </article>
      <article class="dashboard-team-stat">
        <img class="dashboard-team-stat-icon" src="./brand/stats-overall.png" alt="" width="46" height="46" decoding="async">
        <div class="dashboard-team-stat-copy">
          <small>MÉDIA DO TIME</small>
          <strong>${formatMatchRating(teamRating.average)}</strong>
          <span>${overallMeta}</span>
        </div>
      </article>
    </div>
  </article>`;
}

function positionSeasonChampionsPickerMenu(btn, menu) {
  if (!btn || !menu) return;
  const rect = btn.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.top = `${Math.round(rect.bottom + 6)}px`;
  menu.style.right = `${Math.round(Math.max(8, window.innerWidth - rect.right))}px`;
  menu.style.left = 'auto';
  menu.style.minWidth = `${Math.round(rect.width)}px`;
}

function setSeasonChampionsPickerOpen(root, open) {
  const state = layoutState.get(root);
  if (!state) return;
  state.pickerOpen = !!open;
  const btn = root.querySelector('#seasonChampionsPickerBtn');
  const menu = root.querySelector('#seasonChampionsPickerMenu');
  const entry = state.nav.find(item => item.key === state.selectedKey);
  btn?.setAttribute('aria-expanded', state.pickerOpen ? 'true' : 'false');
  if (btn) {
    const label = entry?.label?.toUpperCase() || 'COMPETIÇÃO';
    btn.textContent = state.pickerOpen ? `${label} ▴` : `${label} ▾`;
  }
  menu?.classList.toggle('hidden', !state.pickerOpen);
  if (state.pickerOpen) positionSeasonChampionsPickerMenu(btn, menu);
}

function renderSeasonChampionsPicker(root, state) {
  const btn = root.querySelector('#seasonChampionsPickerBtn');
  const menu = root.querySelector('#seasonChampionsPickerMenu');
  if (!menu) return;
  menu.innerHTML = state.nav
    .map(entry => {
      const active = entry.key === state.selectedKey;
      return `<button type="button" role="option" data-season-champion-key="${entry.key}" class="${active ? 'is-active' : ''}" aria-selected="${active ? 'true' : 'false'}"><span class="championship-page-picker-trophy-slot" data-trophy-key="${entry.trophyKey || resolveChampionshipTrophyKey(entry.competitionId || entry.key)}" aria-hidden="true"></span><span>${entry.label}</span></button>`;
    })
    .join('');
  hydratePickerTrophyIcons(menu);
  setSeasonChampionsPickerOpen(root, state.pickerOpen);
  btn?.toggleAttribute('disabled', state.nav.length <= 1);
}

function renderFeaturedShowcase(root, state) {
  const featuredEl = root.querySelector('#seasonChampionsFeatured');
  const statsEl = root.querySelector('#seasonChampionsTeamStats');
  const entry = state.nav.find(item => item.key === state.selectedKey);

  if (featuredEl) {
    featuredEl.innerHTML = entry
      ? championCardMarkup({ ...entry, variant: 'featured' }, { featuredLayout: 'horizontal' })
      : '<p class="season-champions-empty">Nenhum campeão registrado nesta temporada.</p>';
  }
  if (statsEl) {
    statsEl.innerHTML = entry
      ? championTeamStatsMarkup(entry.clubName, state.deps)
      : '<p class="season-champions-empty">Sem estatísticas disponíveis.</p>';
  }

  root.querySelectorAll('[data-champion-key]').forEach(card => {
    card.classList.toggle('is-selected', card.dataset.championKey === state.selectedKey);
  });

  hydrateChampionTrophies(root);
}

function selectSeasonChampion(root, key) {
  const state = layoutState.get(root);
  if (!state || !state.nav.some(entry => entry.key === key)) return;
  state.selectedKey = key;
  renderSeasonChampionsPicker(root, state);
  renderFeaturedShowcase(root, state);
}

function bindSeasonChampionsHandlers(root) {
  const state = layoutState.get(root);
  if (!state || state.handlersBound) return;
  state.handlersBound = true;

  root.addEventListener('click', event => {
    const pickerBtn = event.target.closest('#seasonChampionsPickerBtn');
    if (pickerBtn) {
      event.stopPropagation();
      setSeasonChampionsPickerOpen(root, !state.pickerOpen);
      return;
    }
    const pickerOption = event.target.closest('[data-season-champion-key]');
    if (pickerOption && event.target.closest('#seasonChampionsPickerMenu')) {
      event.preventDefault();
      selectSeasonChampion(root, pickerOption.dataset.seasonChampionKey);
      setSeasonChampionsPickerOpen(root, false);
      return;
    }
    const pyramidCard = event.target.closest('#seasonChampionsPyramid [data-champion-key]');
    if (pyramidCard) {
      selectSeasonChampion(root, pyramidCard.dataset.championKey);
      return;
    }
    const extraCard = event.target.closest('#seasonChampionsExtra [data-champion-key]');
    if (extraCard) {
      selectSeasonChampion(root, extraCard.dataset.championKey);
    }
  });
}

function bindDocumentHandlers() {
  if (documentHandlersBound) return;
  documentHandlersBound = true;
  document.addEventListener('click', event => {
    document.querySelectorAll('#seasonChampions.season-champions-layout').forEach(root => {
      const state = layoutState.get(root);
      if (!state?.pickerOpen) return;
      if (
        event.target.closest('#seasonChampionsPickerBtn') ||
        event.target.closest('#seasonChampionsPickerMenu') ||
        event.target.closest('.season-champions-picker')
      ) {
        return;
      }
      setSeasonChampionsPickerOpen(root, false);
    });
  });
  window.addEventListener(
    'resize',
    () => {
      document.querySelectorAll('#seasonChampions.season-champions-layout').forEach(root => {
        const state = layoutState.get(root);
        if (!state?.pickerOpen) return;
        positionSeasonChampionsPickerMenu(
          root.querySelector('#seasonChampionsPickerBtn'),
          root.querySelector('#seasonChampionsPickerMenu'),
        );
      });
    },
    { passive: true },
  );
}

export function renderChampionsLayout(root, bundle, deps = {}) {
  if (!root) return;
  const { nav = [], pyramid = [], extra = [], defaultKey = null } = bundle || {};

  const state = layoutState.get(root) || {};
  state.nav = nav;
  state.pyramid = pyramid;
  state.extra = extra;
  state.deps = deps;
  state.selectedKey = nav.some(entry => entry.key === state.selectedKey)
    ? state.selectedKey
    : defaultKey || nav[0]?.key || null;
  state.pickerOpen = false;
  layoutState.set(root, state);

  const pyramidEl = root.querySelector('#seasonChampionsPyramid');
  const extraEl = root.querySelector('#seasonChampionsExtra');
  const extraWrap = root.querySelector('#seasonChampionsExtraWrap');

  if (pyramidEl) {
    pyramidEl.innerHTML = pyramid.length
      ? pyramid
          .map(entry => championCardMarkup({ ...entry, variant: 'compact' }))
          .join('')
      : '';
    pyramidEl.classList.toggle('hidden', pyramid.length === 0);
  }
  if (extraEl) {
    extraEl.innerHTML = extra.map(entry => championCardMarkup({ ...entry, variant: 'extra' })).join('');
  }
  if (extraWrap) {
    extraWrap.classList.toggle('hidden', extra.length === 0);
  }

  renderSeasonChampionsPicker(root, state);
  renderFeaturedShowcase(root, state);
  bindSeasonChampionsHandlers(root);
  bindDocumentHandlers();
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
