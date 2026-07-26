const MODAL_HTML = `
<div id="retirementModal" class="modal hidden">
  <div class="modal-card retirement-modal-card">
    <label>DESPEDIDAS</label>
    <h2 id="retirementModalTitle">Aposentadorias</h2>
    <p id="retirementModalLead" class="retirement-modal-lead"></p>
    <ul id="retirementModalList" class="retirement-modal-list"></ul>
    <p id="retirementModalFootnote" class="retirement-modal-footnote hidden"></p>
    <div class="retirement-modal-actions">
      <button id="confirmRetirementContinue" type="button">CONTINUAR TEMPORADA →</button>
    </div>
  </div>
</div>
`;

const posLabel = pos => pos || '—';

export function createRetirementModalFeature(deps) {
  const { $ } = deps;
  let onContinue = null;
  let bound = false;

  const injectDom = () => {
    if (!$('#retirementModal')) {
      document.body.insertAdjacentHTML('beforeend', MODAL_HTML);
    }
    if (bound) return;
    bound = true;
    document.addEventListener('click', event => {
      const btn = event.target.closest('#confirmRetirementContinue');
      if (!btn) return;
      event.preventDefault();
      event.stopPropagation();
      $('#retirementModal')?.classList.add('hidden');
      const cb = onContinue;
      onContinue = null;
      cb?.();
    });
  };

  const open = ({ season, departures = [], worldCount = 0, continueFn } = {}) => {
    injectDom();
    onContinue = typeof continueFn === 'function' ? continueFn : null;
    const year = Number(season) || '—';
    $('#retirementModalTitle').textContent = `Despedidas · ${year}`;
    $('#retirementModalLead').textContent =
      departures.length === 1
        ? 'Um jogador encerrou a carreira no seu elenco.'
        : `${departures.length} jogadores encerraram a carreira no seu elenco.`;
    const list = $('#retirementModalList');
    if (list) {
      list.innerHTML = departures
        .map(
          row => `<li>
            <strong>${row.name}</strong>
            <span>${row.retiredAge} anos · ${posLabel(row.pos)} · OVR ${row.lastOverall}</span>
          </li>`,
        )
        .join('');
    }
    const foot = $('#retirementModalFootnote');
    if (foot) {
      if (worldCount > 0) {
        foot.textContent = `+ ${worldCount} aposentadoria${worldCount === 1 ? '' : 's'} no restante do campeonato.`;
        foot.classList.remove('hidden');
      } else {
        foot.classList.add('hidden');
        foot.textContent = '';
      }
    }
    $('#retirementModal')?.classList.remove('hidden');
  };

  const close = () => {
    $('#retirementModal')?.classList.add('hidden');
    onContinue = null;
  };

  return { open, close, injectDom };
}
