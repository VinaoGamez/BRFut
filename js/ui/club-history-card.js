import { teamCrestHtml } from './team-crest.js';
import { hydratePickerTrophyIcons, resolveChampionshipTrophyKey } from './competition-trophies.js';

export const CLUB_HISTORY_LAYOUT_KEY = 'brfut-club-history-card-layout-v1';
export const CLUB_HISTORY_LAYOUT_DEFAULTS = Object.freeze({ width: 560, radius: 28, frontCrestSize: 190, frontNameSize: 42, backPadX: 28, backPadY: 26, seasonGap: 14, trophySize: 42 });
const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

export function loadClubHistoryLayout() {
  try { return { ...CLUB_HISTORY_LAYOUT_DEFAULTS, ...JSON.parse(localStorage.getItem(CLUB_HISTORY_LAYOUT_KEY) || '{}') }; }
  catch { return { ...CLUB_HISTORY_LAYOUT_DEFAULTS }; }
}

export function clubHistoryLayoutStyle(layout = loadClubHistoryLayout()) {
  return `--ch-width:${Number(layout.width) || 560}px;--ch-radius:${Number(layout.radius) || 28}px;--ch-crest:${Number(layout.frontCrestSize) || 190}px;--ch-name:${Number(layout.frontNameSize) || 42}px;--ch-pad-x:${Number(layout.backPadX) || 28}px;--ch-pad-y:${Number(layout.backPadY) || 26}px;--ch-season-gap:${Number(layout.seasonGap) || 14}px;--ch-trophy:${Number(layout.trophySize) || 42}px`;
}

function seasonHtml(season, index) {
  const titles = Array.isArray(season.titles) ? season.titles : [];
  const expanded = index === 0;
  return `<article class="club-history-season${expanded ? ' is-expanded' : ''}"><button class="club-history-season-toggle" type="button" aria-expanded="${expanded}"><strong>TEMPORADA ${esc(season.year)}</strong><span>${esc((season.competitions || []).join(' · ') || 'Sem competições registradas')}</span><i aria-hidden="true">⌄</i></button><div class="club-history-season-content"${expanded ? '' : ' hidden'}><div class="club-history-stats"><span><b>${season.played || 0}</b>JOGOS</span><span><b>${season.wins || 0}</b>VITÓRIAS</span><span><b>${season.draws || 0}</b>EMPATES</span><span><b>${season.losses || 0}</b>DERROTAS</span></div><div class="club-history-titles"><small>TÍTULOS</small>${titles.length ? `<div class="club-history-trophy-list">${titles.map(title => `<div class="club-history-trophy"><span data-trophy-key="${esc(resolveChampionshipTrophyKey(title.key))}"></span><b>${esc(title.label)}</b></div>`).join('')}</div>` : '<p>Sem títulos no Ano</p>'}</div></div></article>`;
}

export function renderClubHistoryCard({ clubName, seasons = [], layout } = {}) {
  const name = clubName || 'Clube';
  return `<div class="club-history-card" tabindex="0" role="button" aria-label="Virar card do histórico" style="${clubHistoryLayoutStyle(layout)}"><div class="club-history-card-inner"><section class="club-history-face club-history-front"><div class="club-history-front-crest">${teamCrestHtml(name, { className: 'club-history-crest', title: name })}</div><p>HISTÓRICO DO CLUBE</p><h2>${esc(name)}</h2><span>CLIQUE PARA VER AS TEMPORADAS</span></section><section class="club-history-face club-history-back"><header class="club-history-back-head">${teamCrestHtml(name, { className: 'club-history-back-crest', title: name })}<div><p>HISTÓRICO DO CLUBE</p><h2>${esc(name)}</h2></div></header><div class="club-history-season-list">${seasons.length ? seasons.map(seasonHtml).join('') : '<div class="club-history-empty">Nenhuma temporada encerrada ou partida registrada.</div>'}</div></section></div></div>`;
}

export function hydrateClubHistoryCard(root) { hydratePickerTrophyIcons(root); }
