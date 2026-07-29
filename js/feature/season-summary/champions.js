import { FEATURES } from '../../core/constants.js';
import { FUTURE_COMPETITION_MOLD } from '../../engine/season-calendar-mold.js';
import {
  competitionTrophyUrl,
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
  WORLD_CUP: { label: 'Copa do Mundo', subtitle: 'Campeão da Copa do Mundo', accent: '#ffd24a', cupStyle: false },
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
const NAV_ORDER = ['A', 'B', 'C', 'D', 'CUP', 'WORLD_CUP', 'RECOPA', 'LIBERTADORES', 'SUDAMERICANA'];

const layoutState = new WeakMap();
let documentHandlersBound = false;

function getChampionsSection(root) {
  return root?.closest('.season-champions-section') || root?.parentElement || root;
}

function queryPicker(root) {
  const section = getChampionsSection(root);
  return {
    section,
    btn: section?.querySelector('#seasonChampionsPickerBtn'),
    menu: section?.querySelector('#seasonChampionsPickerMenu'),
  };
}

function resolveTournamentLeadersKey(entry) {
  if (!entry) return null;
  if (entry.key === 'CMU') return 'WORLD_CUP';
  if (['A', 'B', 'C', 'D', 'CUP', 'WORLD_CUP'].includes(entry.key)) return entry.key;
  if (entry.competitionId === 'WORLD_CUP' || entry.competitionId === 'CMU') return 'WORLD_CUP';
  if (entry.key?.startsWith('EST:')) return entry.key;
  if (entry.competitionId && ['A', 'B', 'C', 'D', 'CUP'].includes(entry.competitionId)) {
    return entry.competitionId;
  }
  return null;
}

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
    else if (['WORLD_CUP', 'RECOPA', 'LIBERTADORES', 'SUDAMERICANA'].includes(key)) extra.push(entry);
  });

  const estaduais = [];

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
        tier: item.tier || 1,
        trophyKey: resolveChampionshipTrophyKey('ESTADUAIS'),
      };
      nav.push(entry);
      estaduais.push(entry);
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
    estaduais: withUserFlag(estaduais),
    extra: withUserFlag(extra),
    defaultKey: resolveDefaultKey(nav, userDivision),
  };
}

export function championCardMarkup(entry, { featuredLayout = 'stacked' } = {}) {
  const { key, label, subtitle, accent, cupStyle, clubName, variant, isUserClub, competitionId } = entry;
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

  const trophyKey = resolveChampionshipTrophyKey(competitionId || key);
  const trophyBlock = `<div class="season-champion-trophy" data-trophy-key="${trophyKey}">
        <img class="season-champion-trophy-img" data-competition="${competitionId || key}" data-trophy-key="${trophyKey}" alt="" decoding="async">
      </div>`;
  const crestBlock = `<div class="season-champion-hero">${crest}</div>`;

  // Destaque: troféu e escudo lado a lado; fila inferior: troféu acima do escudo (layout clássico).
  const visualRow = isShowcase
    ? `<div class="season-champion-visual-row">
        ${trophyBlock}
        ${crestBlock}
      </div>`
    : `${trophyBlock}${crestBlock}`;

  return `<article class="${classes}" data-champion-key="${key}" style="--champion-accent:${accent}">
    <span class="season-champion-badge">${label}</span>
    ${isUserClub ? '<span class="season-champion-user-tag">Seu clube</span>' : ''}
    ${visualRow}
    <p class="season-champion-title">${subtitle}</p>
    <p class="season-champion-name">${clubName || '—'}</p>
  </article>`;
}

function championTournamentStatsMarkup(entry, deps = {}) {
  const leadersKey = resolveTournamentLeadersKey(entry);
  const bucket = leadersKey ? deps.leadersByDivision?.[leadersKey] : null;
  const scorer = bucket?.scorers?.[0];
  const assistant = bucket?.assistants?.[0];
  const competitionLabel = entry?.label || 'Torneio';

  const statRow = (kind, label, leader, metric, metricLabel, iconSrc) => {
    if (!leader?.name || leader.name === '—') {
      return `<article class="dashboard-team-stat">
        <img class="dashboard-team-stat-icon" src="${iconSrc}" alt="" width="58" height="58" decoding="async">
        <div class="dashboard-team-stat-copy">
          <small>${label}</small>
          <strong>—</strong>
          <span>Sem dados registrados</span>
        </div>
      </article>`;
    }
    const value = Number(leader[metric]) || 0;
    return `<article class="dashboard-team-stat">
      <img class="dashboard-team-stat-icon" src="${iconSrc}" alt="" width="58" height="58" decoding="async">
      <div class="dashboard-team-stat-copy">
        <small>${label}</small>
        <strong>${leader.name}</strong>
        <span>${leader.club || '—'}</span>
        <em>${value} ${metricLabel}</em>
      </div>
    </article>`;
  };

  return `<article class="card dashboard-team-stats season-champions-team-stats season-champions-tournament-stats">
    <label>ESTATÍSTICAS DO TORNEIO</label>
    <small class="season-champions-tournament-stats-sub">${competitionLabel}</small>
    <div class="dashboard-team-stats-list">
      ${statRow('scorer', 'ARTILHEIRO', scorer, 'goals', scorer?.goals === 1 ? 'gol' : 'gols', './brand/stats-scorer.png')}
      ${statRow('assist', 'ASSISTÊNCIAS', assistant, 'assists', assistant?.assists === 1 ? 'assistência' : 'assistências', './brand/stats-assist.png')}
    </div>
  </article>`;
}

function positionSeasonChampionsPickerMenu(root) {
  const { btn, menu } = queryPicker(root);
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
  const { btn, menu } = queryPicker(root);
  const entry = state.nav.find(item => item.key === state.selectedKey);
  btn?.setAttribute('aria-expanded', state.pickerOpen ? 'true' : 'false');
  if (btn) {
    const label = entry?.label?.toUpperCase() || 'COMPETIÇÃO';
    btn.textContent = state.pickerOpen ? `${label} ▴` : `${label} ▾`;
  }
  menu?.classList.toggle('hidden', !state.pickerOpen);
  if (state.pickerOpen) positionSeasonChampionsPickerMenu(root);
}

function renderSeasonChampionsPicker(root, state) {
  const { btn, menu } = queryPicker(root);
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

function buildCompactChampionRow(state) {
  const { pyramid = [], estaduais = [], selectedKey } = state;
  const byKey = Object.fromEntries(pyramid.map(entry => [entry.key, entry]));
  const primaryEstadual = estaduais[0] || null;
  const isEstadualSelected = String(selectedKey || '').startsWith('EST:');
  const row = [];

  PYRAMID_ORDER.forEach(key => {
    if (key === selectedKey || row.length >= 3) return;
    if (byKey[key]) row.push(byKey[key]);
  });

  if (isEstadualSelected) {
    if (selectedKey !== 'D' && byKey.D) row.push(byKey.D);
  } else if (primaryEstadual && primaryEstadual.key !== selectedKey) {
    row.push(primaryEstadual);
  } else {
    PYRAMID_ORDER.forEach(key => {
      if (key === selectedKey || row.some(entry => entry.key === key)) return;
      if (row.length >= 4) return;
      if (byKey[key]) row.push(byKey[key]);
    });
  }

  return row.slice(0, 4);
}

function renderPyramidRow(root, state) {
  const pyramidEl = root.querySelector('#seasonChampionsPyramid');
  if (!pyramidEl) return;
  const visible = buildCompactChampionRow(state);
  pyramidEl.innerHTML = visible.length
    ? visible.map(entry => championCardMarkup({ ...entry, variant: 'compact' })).join('')
    : '';
  pyramidEl.classList.toggle('hidden', visible.length === 0);
  pyramidEl.style.gridTemplateColumns = 'repeat(4, minmax(0, 1fr))';
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
      ? championTournamentStatsMarkup(entry, state.deps)
      : '<p class="season-champions-empty">Sem estatísticas disponíveis.</p>';
  }

  root.querySelectorAll('[data-champion-key]').forEach(card => {
    card.classList.toggle('is-selected', card.dataset.championKey === state.selectedKey);
  });

  renderPyramidRow(root, state);
  void hydrateChampionTrophies(root);
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
  const { section } = queryPicker(root);
  if (!state || state.handlersBound || !section) return;
  state.handlersBound = true;

  section.addEventListener('click', event => {
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
      return;
    }
    const worldCupCard = event.target.closest('#seasonChampionsWorldCup [data-champion-key]');
    if (worldCupCard) {
      selectSeasonChampion(root, worldCupCard.dataset.championKey);
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
      const section = getChampionsSection(root);
      if (section && event.target.closest('.season-champions-section') === section) {
        if (
          event.target.closest('#seasonChampionsPickerBtn') ||
          event.target.closest('#seasonChampionsPickerMenu') ||
          event.target.closest('.season-champions-picker')
        ) {
          return;
        }
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
        positionSeasonChampionsPickerMenu(root);
      });
    },
    { passive: true },
  );
}

export function renderChampionsLayout(root, bundle, deps = {}) {
  if (!root) return;
  const { nav = [], pyramid = [], estaduais = [], extra = [], defaultKey = null } = bundle || {};

  const state = layoutState.get(root) || {};
  state.nav = nav;
  state.pyramid = pyramid;
  state.estaduais = estaduais;
  state.extra = extra;
  state.deps = deps;
  state.selectedKey = nav.some(entry => entry.key === state.selectedKey)
    ? state.selectedKey
    : defaultKey || nav[0]?.key || null;
  state.pickerOpen = false;
  layoutState.set(root, state);

  const pyramidEl = root.querySelector('#seasonChampionsPyramid');
  const worldCupEl = root.querySelector('#seasonChampionsWorldCup');
  const worldCupWrap = root.querySelector('#seasonChampionsWorldCupWrap');
  const extraEl = root.querySelector('#seasonChampionsExtra');
  const extraWrap = root.querySelector('#seasonChampionsExtraWrap');
  const primaryEstadualKey = estaduais[0]?.key || null;
  const worldCupEntries = extra.filter(entry => entry.key === 'WORLD_CUP');
  const otherExtra = extra.filter(
    entry => entry.key !== 'WORLD_CUP' && entry.key !== primaryEstadualKey && !entry.key?.startsWith('EST:'),
  );
  const secondaryEstaduais = estaduais.slice(1);

  if (pyramidEl) {
    renderPyramidRow(root, state);
  }
  if (worldCupEl) {
    worldCupEl.innerHTML = worldCupEntries
      .map(entry => championCardMarkup({ ...entry, variant: 'extra' }))
      .join('');
  }
  if (worldCupWrap) {
    worldCupWrap.classList.toggle('hidden', worldCupEntries.length === 0);
  }
  if (extraEl) {
    const extraCards = [
      ...secondaryEstaduais.map(entry => championCardMarkup({ ...entry, variant: 'extra' })),
      ...otherExtra.map(entry => championCardMarkup({ ...entry, variant: 'extra' })),
    ];
    extraEl.innerHTML = extraCards.join('');
  }
  if (extraWrap) {
    extraWrap.classList.toggle('hidden', secondaryEstaduais.length === 0 && otherExtra.length === 0);
  }

  renderSeasonChampionsPicker(root, state);
  renderFeaturedShowcase(root, state);
  bindSeasonChampionsHandlers(root);
  bindDocumentHandlers();
  void hydrateChampionTrophies(root);
}

export function hydrateChampionTrophies(root = document) {
  const imgs = [...root.querySelectorAll('.season-champion-trophy-img[data-competition]')];
  if (!imgs.length) return Promise.resolve();

  const keys = [
    ...new Set(
      imgs.map(img => img.dataset.trophyKey || resolveChampionshipTrophyKey(img.dataset.competition || 'A')),
    ),
  ];

  return Promise.all(keys.map(key => preloadCompetitionTrophy(key).catch(() => null))).then(() => {
    imgs.forEach(img => {
      const url = competitionTrophyUrl(img.dataset.competition || 'A');
      if (url) img.setAttribute('src', url);
      else ensureCompetitionTrophy(img.dataset.competition || 'A', img);
    });
  });
}
