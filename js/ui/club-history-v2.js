/**
 * Histórico do clube v2 (Arcade Noturno v2): resumo, temporadas, sala de troféus e recordes.
 * Sem cartão virável e sem rolagem interna (temporadas em páginas).
 */
import { teamCrestHtml } from './team-crest.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const TROPHY = (tone = 'gold', size = 22) =>
  `<svg class="ch2-trophy is-${tone}" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v3a6 6 0 0 1-4 5.7V15h3v3H7v-3h3v-3.3A6 6 0 0 1 6 6z"/><path d="M4 4h2v3H4zM18 4h2v3h-2z" opacity=".6"/></svg>`;

export const CLUB_HISTORY_V2_HTML = `<div id="clubHistoryCardModal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="clubHistoryTitle">
  <div class="modal-card ch2">
    <header class="ch2-head">
      <span class="ch2-crest" id="clubHistoryCrest"></span>
      <div class="ch2-title"><span class="ch2-kicker" id="clubHistoryKicker">HISTÓRICO DO CLUBE</span><h2 id="clubHistoryTitle">Clube</h2></div>
      <button type="button" class="close" id="closeClubHistory" aria-label="Fechar">×</button>
    </header>
    <div class="ch2-body" id="clubHistoryCardBody"></div>
  </div>
</div>`;

const tile = (label, value, sub, tone = '') =>
  `<div class="ch2-tile${tone ? ` is-${tone}` : ''}"><span>${label}</span><strong>${value}</strong><small>${sub}</small></div>`;

const seasonRow = season => {
  const total = season.played || 0;
  const pct = n => (total ? Math.round((n / total) * 100) : 0);
  const position = season.division
    ? `${season.position ? `${season.position}º ` : ''}<small>SÉRIE ${esc(season.division)}</small>`
    : '<small>FORA DO BRASILEIRO</small>';
  const move = season.move === 'up'
    ? '<em class="ch2-move is-up">SUBIU</em>'
    : season.move === 'down'
      ? '<em class="ch2-move is-down">CAIU</em>'
      : season.live
        ? '<em class="ch2-move is-live">EM ANDAMENTO</em>'
        : '<small class="ch2-stay">manteve a divisão</small>';
  const comps = season.comps
    .map(comp => `<span class="ch2-comp"><i>${esc(comp.name)}</i><b class="is-${comp.tone || 'mut'}">${esc(comp.result)}</b></span>`)
    .join('');
  const titles = season.titles.length ? season.titles.map(() => TROPHY('gold', 26)).join('') : '';
  return `<div class="ch2-season${season.titles.length ? ' has-title' : ''}">
    <b class="ch2-year">${esc(season.year)}</b>
    <div class="ch2-pos"><span>${position}</span>${move}</div>
    <div class="ch2-camp"><span><b class="is-win">${season.wins}V</b> <b class="is-draw">${season.draws}E</b> <b class="is-loss">${season.losses}D</b> <i>· ${total} jogos</i></span>
      <i class="ch2-bar"><span class="is-win" style="width:${pct(season.wins)}%"></span><span class="is-draw" style="width:${pct(season.draws)}%"></span><span class="is-loss" style="width:${pct(season.losses)}%"></span></i></div>
    <div class="ch2-comps">${comps || '<small class="ch2-stay">sem jogos registrados</small>'}</div>
    <div class="ch2-titles">${titles}</div>
  </div>`;
};

/**
 * @param {object} p
 * @param {string} p.clubName
 * @param {object} p.history resultado de buildClubHistoryV2
 * @param {string} p.tab 'seasons' | 'trophies' | 'records'
 * @param {number} p.page página de temporadas (0..)
 * @param {object} [p.meta] { uf, sinceLabel, topScorer }
 */
export function renderClubHistoryV2({ clubName, history, tab = 'seasons', page = 0, perPage = 5, meta = {} }) {
  const { seasons = [], trophies = [], totals = {}, best, records = {} } = history || {};
  const titleCount = trophies.reduce((sum, item) => sum + item.count, 0);
  const titleSub = trophies.filter(item => item.count).map(item => `${item.count} ${item.name}`).join(' · ') || 'nenhum título na carreira';
  const pctPoints = totals.played ? Math.round(((totals.wins * 3 + totals.draws) / (totals.played * 3)) * 100) : 0;
  const first = seasons.length ? seasons[seasons.length - 1].year : null;
  const summary = `<div class="ch2-summary">
    ${tile('NA CARREIRA', `${seasons.length} temporada${seasons.length === 1 ? '' : 's'}`, first ? `desde ${first}${meta.sinceLabel ? ` · ${esc(meta.sinceLabel)}` : ''}` : 'primeira temporada')}
    ${tile('CAMPANHA', `<b class="is-win">${totals.wins || 0}V</b> <b class="is-draw">${totals.draws || 0}E</b> <b class="is-loss">${totals.losses || 0}D</b>`, `${totals.played || 0} jogos · ${pctPoints}% de aproveitamento`)}
    ${tile('TÍTULOS', `${TROPHY('gold', 20)} ${titleCount}`, esc(titleSub), 'gold')}
    ${tile('MELHOR CAMPANHA', best ? esc(best.label) : '—', best ? `${best.year}` : 'no Brasileiro', 'cyan')}
  </div>`;
  const tabs = `<nav class="ch2-tabs" role="tablist">${[['seasons', 'TEMPORADAS'], ['trophies', 'SALA DE TROFÉUS'], ['records', 'RECORDES']]
    .map(([id, label]) => `<button type="button" role="tab" data-ch2-tab="${id}" class="${tab === id ? 'is-active' : ''}" aria-selected="${tab === id}">${label}</button>`)
    .join('')}</nav>`;
  let pane = '';
  if (tab === 'seasons') {
    const start = page * perPage;
    const shown = seasons.slice(start, start + perPage);
    const pager = seasons.length > perPage
      ? `<div class="ch2-pager">${page > 0 ? '<button type="button" class="ch2-more" data-ch2-page="-1">MAIS RECENTES</button>' : ''}<small>${start + 1}–${start + shown.length} de ${seasons.length} temporadas</small>${start + perPage < seasons.length ? '<button type="button" class="ch2-more" data-ch2-page="1">MAIS ANTIGAS</button>' : ''}</div>`
      : `<div class="ch2-pager"><small>${seasons.length} temporada${seasons.length === 1 ? '' : 's'} na carreira</small></div>`;
    pane = shown.length ? `<div class="ch2-seasons">${shown.map(seasonRow).join('')}</div>${pager}` : '<div class="ch2-empty">Nenhuma temporada registrada ainda.</div>';
  } else if (tab === 'trophies') {
    pane = trophies.length
      ? `<div class="ch2-cabinet">${trophies.map(item => `<div class="ch2-cup${item.count ? ' has-title' : ''}">${TROPHY(item.count ? 'gold' : 'off', 44)}<div><strong>${esc(item.name)}</strong><small>${item.count ? esc(item.years.join(' · ')) : `melhor: ${esc(item.best || '—')}`}</small></div><b>${item.count}×</b></div>`).join('')}</div>`
      : '<div class="ch2-empty">Nenhuma competição disputada ainda.</div>';
  } else {
    const rec = (label, value, sub, tone) => tile(label, value, sub, tone);
    const win = records.biggestWin;
    const loss = records.worstLoss;
    pane = `<div class="ch2-records">
      ${rec('MAIOR GOLEADA', win ? esc(win.score) : '—', win ? `vs ${esc(win.opponent)} · ${win.year}` : 'sem vitórias registradas', 'green')}
      ${rec('PIOR DERROTA', loss ? esc(loss.score) : '—', loss ? `vs ${esc(loss.opponent)} · ${loss.year}` : 'sem derrotas registradas', 'red')}
      ${rec('GOLS PRÓ · CONTRA', `${totals.goalsFor || 0} · ${totals.goalsAgainst || 0}`, `saldo ${(totals.goalsFor || 0) - (totals.goalsAgainst || 0) >= 0 ? '+' : ''}${(totals.goalsFor || 0) - (totals.goalsAgainst || 0)} nos jogos registrados`, 'cyan')}
      ${rec('ARTILHEIRO DO ELENCO', meta.topScorer ? esc(meta.topScorer.name) : '—', meta.topScorer ? `${meta.topScorer.goals} gols pelo clube na carreira` : 'sem gols registrados', 'gold')}
    </div><p class="ch2-note">Recordes calculados com os jogos guardados na carreira.</p>`;
  }
  return `${summary}${tabs}${pane}`;
}

export function clubHistoryCrestHtml(clubName) {
  return teamCrestHtml(clubName, { className: 'ch2-crest-img' });
}
