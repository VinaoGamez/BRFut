import {
  TRANSFER_HISTORY_LAYOUT_DEFAULTS,
  TRANSFER_HISTORY_LAYOUT_KEY,
  loadTransferHistoryLayout,
  renderTransferHistoryCard,
} from '../ui/transfer-history-card.js';

let layout = loadTransferHistoryLayout();
const fields = { width: 'Largura', radius: 'Raio', frontArtSize: 'Arte frontal', backPadX: 'Margem horizontal', backPadY: 'Margem vertical', seasonGap: 'Espaço temporadas' };
const sample = { seasons: [
  { year: 2028, transfers: [{ playerName: 'Fábio Neves', direction: 'in', club: 'Santa Cruz' }, { playerName: 'Victor Reis', direction: 'out', club: 'Coritiba' }, { playerName: 'Lucas Moura', direction: 'market', from: 'Bahia', to: 'Fluminense' }] },
  { year: 2027, transfers: [{ playerName: 'Marcos Almeida', direction: 'in', club: 'Floresta' }] },
  { year: 2026, transfers: [], available: false },
] };
const controls = document.querySelector('#labControls');
const preview = document.querySelector('#labPreview');
const status = document.querySelector('#labStatus');
controls.innerHTML = Object.entries(fields).map(([key, label]) => `<div class="lab-control"><label for="${key}">${label}</label><input id="${key}" data-layout="${key}" type="number" value="${layout[key]}"></div>`).join('');

function bindCard(card) {
  card.addEventListener('click', event => {
    const toggle = event.target.closest('.transfer-history-season-toggle');
    if (toggle) {
      const selected = toggle.closest('.transfer-history-season');
      selected.parentElement.querySelectorAll('.transfer-history-season').forEach(season => {
        const active = season === selected;
        season.classList.toggle('is-expanded', active);
        season.querySelector('.transfer-history-season-toggle')?.setAttribute('aria-expanded', String(active));
        const content = season.querySelector('.transfer-history-season-content');
        if (content) content.hidden = !active;
      });
      return;
    }
    card.classList.toggle('is-flipped');
  });
}

function render(flipped = preview.querySelector('.transfer-history-card')?.classList.contains('is-flipped')) {
  preview.innerHTML = renderTransferHistoryCard({ ...sample, layout });
  const card = preview.querySelector('.transfer-history-card');
  if (flipped) card.classList.add('is-flipped');
  bindCard(card);
}
controls.addEventListener('input', event => { const key = event.target.dataset.layout; if (!key) return; layout[key] = Number(event.target.value); render(); });
document.querySelector('#labFlip').onclick = () => preview.querySelector('.transfer-history-card')?.classList.toggle('is-flipped');
document.querySelector('#labSave').onclick = () => { localStorage.setItem(TRANSFER_HISTORY_LAYOUT_KEY, JSON.stringify(layout)); status.textContent = 'Layout salvo para o jogo.'; };
document.querySelector('#labCopy').onclick = async () => { await navigator.clipboard.writeText(JSON.stringify({ type: 'brfut-transfer-history-card-layout', version: 1, layout }, null, 2)); status.textContent = 'JSON copiado.'; };
document.querySelector('#labReset').onclick = () => { layout = { ...TRANSFER_HISTORY_LAYOUT_DEFAULTS }; Object.entries(layout).forEach(([key, value]) => { const input = document.querySelector(`[data-layout="${key}"]`); if (input) input.value = value; }); localStorage.removeItem(TRANSFER_HISTORY_LAYOUT_KEY); render(); status.textContent = 'Layout restaurado.'; };
render();
