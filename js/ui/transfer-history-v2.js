/**
 * Histórico de transferências v2: balanço da temporada, abas por ano,
 * filtro entradas/saídas e linhas completas (posição, clube, tipo, valor).
 */
import { teamCrestHtml } from './team-crest.js';

const esc = value => String(value ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const TYPE_LABEL = { buy: 'COMPRA', sell: 'VENDA', loan: 'EMPRÉSTIMO', loan_in: 'EMPRÉSTIMO', loan_out: 'EMPRÉSTIMO', loan_buy: 'COMPRA APÓS EMPRÉSTIMO', free: 'LIVRE', release: 'RESCISÃO', youth: 'BASE' };

export const TRANSFER_HISTORY_V2_HTML = `<div id="transferHistoryCardModal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="transferHistoryTitle">
  <div class="modal-card th2">
    <header class="th2-head"><div class="th2-title"><span class="th2-kicker">MERCADO · HISTÓRICO</span><h2 id="transferHistoryTitle">Transferências do clube</h2></div><button type="button" class="close" id="closeTransferHistory" aria-label="Fechar">×</button></header>
    <div class="th2-body" id="transferHistoryCardBody"></div>
  </div>
</div>`;

const money = value => {
  const n = Math.round(Number(value) || 0);
  if (!n) return 'sem custo';
  if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (Math.abs(n) >= 1_000) return `R$ ${Math.round(n / 1_000).toLocaleString('pt-BR')} mil`;
  return `R$ ${n.toLocaleString('pt-BR')}`;
};

/**
 * @param {object} p
 * @param {Array<{year:number, available:boolean, transfers:Array}>} p.seasons transfers: {playerName, direction:'in'|'out', club, fee, type, pos}
 */
export function renderTransferHistoryV2({ seasons = [], year = null, filter = 'all', page = 0, perPage = 8 }) {
  const season = seasons.find(item => Number(item.year) === Number(year)) || seasons[0];
  if (!season) return '<div class="th2-empty">Nenhuma temporada registrada.</div>';
  const list = season.transfers || [];
  const ins = list.filter(item => item.direction === 'in');
  const outs = list.filter(item => item.direction === 'out');
  const spent = ins.reduce((sum, item) => sum + (Number(item.fee) || 0), 0);
  const received = outs.reduce((sum, item) => sum + (Number(item.fee) || 0), 0);
  const balance = received - spent;
  const top = [...ins].sort((a, b) => (Number(b.fee) || 0) - (Number(a.fee) || 0))[0];
  const tile = (label, value, sub, tone = '') => `<div class="th2-tile${tone ? ` is-${tone}` : ''}"><span>${label}</span><strong>${value}</strong><small>${sub}</small></div>`;
  const summary = `<div class="th2-summary">
    ${tile('CONTRATAÇÕES', String(ins.length), spent ? `${money(spent)} gastos` : 'sem gastos', 'green')}
    ${tile('SAÍDAS', String(outs.length), received ? `${money(received)} recebidos` : 'sem receitas', 'red')}
    ${tile('SALDO', `${balance >= 0 ? '+' : '−'}${money(Math.abs(balance)).replace('sem custo', 'R$ 0')}`, balance > 0 ? 'vendeu mais do que comprou' : balance < 0 ? 'investiu mais do que vendeu' : 'equilibrado', balance >= 0 ? 'lime' : 'gold')}
    ${tile('MAIOR COMPRA', top && top.fee ? money(top.fee) : '—', top && top.fee ? esc(top.playerName) : 'nenhuma compra paga', 'gold')}
  </div>`;
  const years = `<nav class="th2-tabs" role="tablist">${seasons.map(item => `<button type="button" data-th2-year="${item.year}" class="${Number(item.year) === Number(season.year) ? 'is-active' : ''}">${item.year}</button>`).join('')}</nav>`;
  const filters = `<nav class="th2-tabs th2-filters">${[['all', `TODAS · ${list.length}`], ['in', `ENTRADAS · ${ins.length}`], ['out', `SAÍDAS · ${outs.length}`]].map(([id, label]) => `<button type="button" data-th2-filter="${id}" class="${filter === id ? 'is-active' : ''}">${label}</button>`).join('')}</nav>`;
  const filtered = filter === 'all' ? list : list.filter(item => item.direction === filter);
  const shown = filtered.slice(0, perPage * (page + 1));
  const rows = !season.available
    ? '<div class="th2-empty">As transferências desta temporada não foram guardadas.</div>'
    : shown.length
      ? shown.map(item => `<div class="th2-row is-${item.direction}">
          <b class="th2-dir" aria-label="${item.direction === 'in' ? 'Entrada' : 'Saída'}">${item.direction === 'in' ? '↓' : '↑'}</b>
          <i class="th2-pos">${esc(item.pos || '—')}</i>
          <strong class="th2-name">${esc(item.playerName)}</strong>
          <span class="th2-club">${item.direction === 'in' ? 'de' : 'para'} ${item.club && item.club !== 'Livre' ? teamCrestHtml(item.club, { className: 'th2-crest' }) : ''}<b>${esc(item.club || 'Livre')}</b></span>
          <em class="th2-type">${esc(TYPE_LABEL[item.type] || (item.direction === 'in' ? 'COMPRA' : 'VENDA'))}</em>
          <b class="th2-fee">${money(item.fee)}</b>
        </div>`).join('')
      : '<div class="th2-empty">Nenhuma transferência neste filtro.</div>';
  const more = filtered.length > shown.length ? `<button type="button" class="th2-more" data-th2-more>VER MAIS ${Math.min(perPage, filtered.length - shown.length)}</button>` : '';
  return `${summary}<div class="th2-bar">${years}${filters}</div><div class="th2-list">${rows}</div><div class="th2-pager"><small>Mostrando ${shown.length} de ${filtered.length}</small>${more}</div>`;
}
