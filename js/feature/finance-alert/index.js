/**
 * Cobranças financeiras v2 — um único pop-up para cobrança da diretoria,
 * aviso de insolvência e restrição de mercado (escada da crise).
 */
import { escapeHtml as esc } from '../../core/html-safe.js';

export const FINANCE_STAGES = [
  { key: 'alert', label: 'ALERTA', color: 'cyan' },
  { key: 'charge', label: 'COBRANÇA', color: 'orange' },
  { key: 'insolvency', label: 'INSOLVÊNCIA', color: 'red' },
  { key: 'restriction', label: 'RESTRIÇÃO', color: 'red' },
  { key: 'bankrupt', label: 'FALÊNCIA', color: 'red' },
];

const MODAL_HTML = `
<div id="financeAlertModal" class="modal hidden">
  <div class="modal-card fa2" role="dialog" aria-modal="true" aria-labelledby="financeAlertTitle">
    <header class="fa2-head">
      <div id="financeAlertCrest" class="fa2-crest"></div>
      <div class="fa2-head-copy">
        <span class="fa2-kicker" id="financeAlertKicker"></span>
        <h2 id="financeAlertTitle"></h2>
        <small id="financeAlertQuote"></small>
      </div>
    </header>
    <div class="fa2-body" id="financeAlertBody"></div>
    <footer class="fa2-foot">
      <span class="fa2-foot-note">Também na caixa de mensagens · acompanhe em Clube › Finanças</span>
      <button id="financeAlertDismiss" type="button" class="fa2-btn is-ghost">ENTENDI</button>
      <button id="financeAlertOffice" type="button" class="fa2-btn is-primary">IR ÀS FINANÇAS →</button>
    </footer>
  </div>
</div>`;

const ladder = active =>
  `<div class="fa2-ladder">${FINANCE_STAGES.map((stage, index) => {
    const state = index === active ? 'is-on' : index < active ? 'is-past' : '';
    return `<span class="fa2-step c-${stage.color} ${state}">${stage.label}</span>`;
  }).join('')}</div>`;

const tile = (label, value, detail = '', tone = '') =>
  `<div class="fa2-tile${tone ? ` t-${tone}` : ''}"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${detail ? esc(detail) : '&nbsp;'}</small></div>`;

const action = (index, item) =>
  `<button type="button" class="fa2-action c-${item.color || 'lime'}" data-finance-go="${esc(item.go || 'office')}">
    <span class="fa2-action-kicker">OPÇÃO ${index + 1} · ${esc(item.kicker)}</span>
    <strong class="${item.amount < 0 ? 'is-neg' : 'is-pos'}">${esc(item.value)}</strong>
    <small>${esc(item.detail)}</small>
    <em>${esc(item.cta)} ›</em>
  </button>`;

/**
 * @param {{ $: Function, teamCrestHtml?: Function, onNavigate?: (view:string)=>void }} deps
 */
export function createFinanceAlertFeature({ $, teamCrestHtml, onNavigate }) {
  let bound = false;
  const close = () => $('#financeAlertModal')?.classList.add('hidden');
  const bind = () => {
    if (bound) return;
    bound = true;
    document.addEventListener('click', event => {
      if (event.target.closest('#financeAlertDismiss')) {
        event.preventDefault();
        close();
        return;
      }
      const go = event.target.closest('#financeAlertOffice, #financeAlertModal [data-finance-go]');
      if (go) {
        event.preventDefault();
        close();
        onNavigate?.(go.dataset.financeGo || 'office');
      }
    });
  };
  const init = () => {
    if (!$('#financeAlertModal')) document.body.insertAdjacentHTML('beforeend', MODAL_HTML);
    bind();
  };

  /**
   * @param {object} d dados montados pelo engine (buildFinanceAlert)
   */
  const open = d => {
    init();
    const stage = FINANCE_STAGES[d.stage] || FINANCE_STAGES[1];
    const card = $('#financeAlertModal .fa2');
    if (card) card.dataset.tone = stage.color;
    const crest = $('#financeAlertCrest');
    if (crest) crest.innerHTML = typeof teamCrestHtml === 'function' ? teamCrestHtml(d.clubName) : '';
    $('#financeAlertKicker').textContent = d.kicker;
    $('#financeAlertTitle').textContent = d.title;
    $('#financeAlertQuote').textContent = d.quote ? `Presidente: “${d.quote}”` : '';
    const meter = d.meter
      ? `<div class="fa2-meter">
          <div class="fa2-meter-top"><span>SAÚDE FINANCEIRA</span><b class="t-${d.meter.tone}">${d.meter.value}%</b></div>
          <div class="fa2-meter-bar"><i style="width:${d.meter.value}%" class="t-${d.meter.tone}"></i><em style="left:${d.meter.limit}%"></em></div>
          <small>${esc(d.meter.note)}</small>
        </div>`
      : '';
    const board = d.board
      ? `<div class="fa2-meter"><div class="fa2-meter-top"><span>CONFIANÇA DA DIRETORIA</span><b class="t-${d.board.tone}">${d.board.value}%</b></div><p>${esc(d.board.note)}</p></div>`
      : '';
    const deadline = d.deadline
      ? `<div class="fa2-deadline"><b>PRAZO</b><div class="fa2-deadline-bar">${Array.from({ length: d.deadline.total }, (_, i) => `<i class="${i < d.deadline.used ? 'is-used' : ''}"></i>`).join('')}</div><span>${esc(d.deadline.text)}</span></div>`
      : '';
    const note = d.note ? `<p class="fa2-note">${d.note}</p>` : '';
    $('#financeAlertBody').innerHTML = `
      ${ladder(d.stage)}
      <div class="fa2-tiles">${d.tiles.map(t => tile(t.label, t.value, t.detail, t.tone)).join('')}</div>
      ${meter || board ? `<div class="fa2-split">${meter}${board}</div>` : ''}
      ${note}
      ${d.actions?.length ? `<header class="fa2-sec"><h3>${esc(d.actionsTitle || 'Como sair')}</h3></header><div class="fa2-actions n-${d.actions.length}">${d.actions.map((item, i) => action(i, item)).join('')}</div>` : ''}
      ${deadline}`;
    const office = $('#financeAlertOffice');
    if (office) {
      office.textContent = d.primaryLabel || 'IR ÀS FINANÇAS →';
      office.dataset.financeGo = d.primaryGo || 'office';
    }
    $('#financeAlertModal').classList.remove('hidden');
  };

  return { init, open, close };
}
