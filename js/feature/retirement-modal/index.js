const MODAL_HTML = `
<div id="retirementModal" class="modal hidden av2-modal">
  <div class="modal-card av2 retirement-modal-card" data-tone="info">
    <header class="av2-head"><span class="av2-icon is-star" aria-hidden="true">★</span><div class="av2-titles"><span class="av2-kicker" id="retirementModalKicker">FIM DE TEMPORADA · DESPEDIDAS</span><h2 id="retirementModalTitle" class="av2-title">Aposentadorias</h2></div></header>
    <div class="av2-body">
      <p id="retirementModalLead" class="av2-lead"></p>
      <ul id="retirementModalList" class="av2-list"></ul>
      <p id="retirementModalFootnote" class="av2-note hidden"></p>
    </div>
    <footer class="av2-foot"><button id="confirmRetirementContinue" type="button" class="av2-btn is-primary">CONTINUAR TEMPORADA →</button></footer>
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
    $('#retirementModalTitle').textContent = departures.length === 1 ? 'Um jogador se aposentou' : `${departures.length} jogadores se aposentaram`;
    const kicker = $('#retirementModalKicker');
    if (kicker) kicker.textContent = `FIM DE TEMPORADA · DESPEDIDAS ${year}`;
    $('#retirementModalLead').textContent =
      departures.length === 1
        ? 'Ele encerrou a carreira no seu elenco ao fim da temporada.'
        : 'Eles encerraram a carreira no seu elenco ao fim da temporada.';
    const list = $('#retirementModalList');
    if (list) {
      list.innerHTML = departures
        .map(
          row => `<li class="av2-item">
            <i class="av2-pos">${posLabel(row.pos)}</i>
            <strong>${row.name}</strong>
            <span>${row.retiredAge} anos · OVR ${row.lastOverall}</span>
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
