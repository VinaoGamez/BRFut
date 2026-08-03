export const TRANSFER_HISTORY_LAYOUT_KEY = 'brfut-transfer-history-card-layout-v1';
export const TRANSFER_HISTORY_LAYOUT_DEFAULTS = Object.freeze({
  width: 560,
  radius: 28,
  frontArtSize: 390,
  backPadX: 28,
  backPadY: 26,
  seasonGap: 14,
});

const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
}[char]));

export function loadTransferHistoryLayout() {
  try {
    return {
      ...TRANSFER_HISTORY_LAYOUT_DEFAULTS,
      ...JSON.parse(localStorage.getItem(TRANSFER_HISTORY_LAYOUT_KEY) || '{}'),
    };
  } catch {
    return { ...TRANSFER_HISTORY_LAYOUT_DEFAULTS };
  }
}

export function transferHistoryLayoutStyle(layout = loadTransferHistoryLayout()) {
  return `--th-width:${Number(layout.width) || 560}px;--th-radius:${Number(layout.radius) || 28}px;--th-art:${Number(layout.frontArtSize) || 390}px;--th-pad-x:${Number(layout.backPadX) || 28}px;--th-pad-y:${Number(layout.backPadY) || 26}px;--th-season-gap:${Number(layout.seasonGap) || 14}px`;
}

function transferRowHtml(item) {
  const incoming = item.direction === 'in';
  return `<li class="transfer-history-move ${incoming ? 'is-in' : 'is-out'}"><strong>${esc(item.playerName || '—')}</strong><span class="transfer-history-arrow" aria-label="${incoming ? 'Chegando' : 'Saindo'}">${incoming ? '←' : '→'}</span><span>${esc(item.club || 'Livre')}</span></li>`;
}

function seasonHtml(season, index) {
  const expanded = index === 0;
  const transfers = Array.isArray(season.transfers) ? season.transfers : [];
  return `<article class="transfer-history-season${expanded ? ' is-expanded' : ''}"><button class="transfer-history-season-toggle" type="button" aria-expanded="${expanded}"><strong>TEMPORADA ${esc(season.year)}</strong><span>${transfers.length} movimenta${transfers.length === 1 ? 'ção' : 'ções'}</span><i aria-hidden="true">⌄</i></button><div class="transfer-history-season-content"${expanded ? '' : ' hidden'}>${transfers.length ? `<ul>${transfers.map(transferRowHtml).join('')}</ul>` : '<p class="transfer-history-empty">Sem transferências na Temporada</p>'}</div></article>`;
}

export function renderTransferHistoryCard({ seasons = [], layout } = {}) {
  return `<div class="transfer-history-card" tabindex="0" role="button" aria-label="Virar card do histórico de transferências" style="${transferHistoryLayoutStyle(layout)}"><div class="transfer-history-card-inner"><section class="transfer-history-face transfer-history-front"><img src="./brand/transfer-history/mercado-da-bola.png" alt="Mercado da Bola"></section><section class="transfer-history-face transfer-history-back"><header><h2>MERCADO DA BOLA</h2><p>HISTÓRICO DE TRANSFERÊNCIAS</p></header><div class="transfer-history-season-list">${seasons.length ? seasons.map(seasonHtml).join('') : '<p class="transfer-history-empty">Nenhuma transferência registrada.</p>'}</div></section></div></div>`;
}
