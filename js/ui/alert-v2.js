/**
 * Aviso v2 (Arcade Noturno v2): um único desenho para avisos curtos.
 * Tom pela cor e ícone: ok (verde), warn (ouro), info (ciano), bad (vermelho).
 * Mostra números do impacto (tiles/rows) e um atalho opcional.
 */
const esc = value => String(value ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const ICON = { ok: '✓', warn: '!', info: 'i', bad: '×' };

const ensure = id => {
  let modal = document.getElementById(id);
  if (modal && !modal.classList.contains('av2-modal')) { modal.remove(); modal = null; }
  if (modal) return modal;
  document.body.insertAdjacentHTML('beforeend', `<div id="${id}" class="modal hidden av2-modal" role="alertdialog" aria-modal="true" aria-labelledby="${id}Title">
    <div class="modal-card av2" data-tone="info">
      <header class="av2-head"><span class="av2-icon" aria-hidden="true"></span><div class="av2-titles"><span class="av2-kicker"></span><h2 id="${id}Title" class="av2-title"></h2></div><button type="button" class="close av2-x" aria-label="Fechar">×</button></header>
      <div class="av2-body"></div>
      <footer class="av2-foot"></footer>
    </div>
  </div>`);
  modal = document.getElementById(id);
  modal.addEventListener('click', event => {
    if (event.target === modal || event.target.closest('.av2-x')) { modal.classList.add('hidden'); return; }
    const action = event.target.closest('[data-av2-action]');
    if (!action) return;
    const handler = modal._av2Actions?.[Number(action.dataset.av2Action)];
    modal.classList.add('hidden');
    handler?.();
  });
  return modal;
};

/**
 * @param {object} o
 * @param {string} o.id id do modal (mantém o id antigo da tela)
 * @param {'ok'|'warn'|'info'|'bad'} [o.tone]
 * @param {string} o.kicker
 * @param {string} o.title
 * @param {string} [o.lead]
 * @param {Array<[string,string,string?,string?]>} [o.tiles] [rótulo, valor, sub, tom]
 * @param {Array<[string,string,string?]>} [o.rows] [rótulo, valor, tom]
 * @param {string} [o.html] conteúdo extra (já escapado)
 * @param {Array<{label:string, primary?:boolean, onClick?:Function}>} [o.actions]
 */
export function showAlertV2({ id, tone = 'info', kicker = '', title = '', lead = '', tiles = [], rows = [], html = '', actions = [] }) {
  const modal = ensure(id);
  const card = modal.querySelector('.av2');
  card.dataset.tone = tone;
  modal.querySelector('.av2-icon').textContent = ICON[tone] || 'i';
  modal.querySelector('.av2-kicker').textContent = kicker;
  modal.querySelector('.av2-title').textContent = title;
  const tileHtml = tiles.length
    ? `<div class="av2-tiles" style="--av2-cols:${Math.min(3, tiles.length)}">${tiles.map(([label, value, sub, t]) => `<div class="av2-tile${t ? ` is-${t}` : ''}"><span>${esc(label)}</span><strong>${esc(value)}</strong>${sub ? `<small>${esc(sub)}</small>` : ''}</div>`).join('')}</div>`
    : '';
  const rowHtml = rows.length
    ? `<div class="av2-rows">${rows.map(([label, value, t]) => `<div class="av2-row"><span>${esc(label)}</span><b${t ? ` class="is-${t}"` : ''}>${esc(value)}</b></div>`).join('')}</div>`
    : '';
  modal.querySelector('.av2-body').innerHTML = `${lead ? `<p class="av2-lead">${esc(lead)}</p>` : ''}${tileHtml}${rowHtml}${html}`;
  const list = actions.length ? actions : [{ label: 'ENTENDI', primary: true }];
  modal._av2Actions = list.map(action => action.onClick || null);
  modal.querySelector('.av2-foot').innerHTML = list
    .map((action, index) => `<button type="button" class="av2-btn${action.primary ? ' is-primary' : ''}" data-av2-action="${index}">${esc(action.label)}</button>`)
    .join('');
  modal.classList.remove('hidden');
  return modal;
}
