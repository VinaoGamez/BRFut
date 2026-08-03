import { CLUB_HISTORY_LAYOUT_DEFAULTS, CLUB_HISTORY_LAYOUT_KEY, loadClubHistoryLayout, renderClubHistoryCard, hydrateClubHistoryCard } from '../ui/club-history-card.js';

let layout = loadClubHistoryLayout();
const fields = { width: 'Largura', radius: 'Raio', frontCrestSize: 'Escudo frente', frontNameSize: 'Nome frente', backPadX: 'Margem horizontal', backPadY: 'Margem vertical', seasonGap: 'Espaço temporadas', trophySize: 'Tamanho troféu' };
const sample = { clubName: 'Vinaz Athletic Futebol', seasons: [
  { year: 2028, competitions: ['Campeonato Brasileiro Série C', 'Copa do Brasil'], played: 31, wins: 18, draws: 7, losses: 6, titles: [{ key: 'CUP', label: 'Copa do Brasil' }] },
  { year: 2027, competitions: ['Campeonato Brasileiro Série D', 'Campeonato Estadual'], played: 29, wins: 17, draws: 6, losses: 6, titles: [{ key: 'D', label: 'Campeonato Brasileiro Série D' }, { key: 'ESTADUAIS', label: 'Campeonato Estadual' }] },
  { year: 2026, competitions: ['Campeonato Brasileiro Série D'], played: 22, wins: 9, draws: 8, losses: 5, titles: [] },
] };
const controls = document.querySelector('#labControls'); const preview = document.querySelector('#labPreview'); const status = document.querySelector('#labStatus');
controls.innerHTML = Object.entries(fields).map(([key, label]) => `<div class="lab-control"><label for="${key}">${label}</label><input id="${key}" data-layout="${key}" type="number" value="${layout[key]}"></div>`).join('');
function render(flipped = preview.querySelector('.club-history-card')?.classList.contains('is-flipped')) { preview.innerHTML = renderClubHistoryCard({ ...sample, layout }); const card = preview.querySelector('.club-history-card'); if (flipped) card.classList.add('is-flipped'); card.addEventListener('click', event => { const toggle=event.target.closest('.club-history-season-toggle'); if(toggle){const selected=toggle.closest('.club-history-season');selected.parentElement.querySelectorAll('.club-history-season').forEach(season=>{const active=season===selected;season.classList.toggle('is-expanded',active);season.querySelector('.club-history-season-toggle')?.setAttribute('aria-expanded',String(active));const content=season.querySelector('.club-history-season-content');if(content)content.hidden=!active;});return;} card.classList.toggle('is-flipped'); }); hydrateClubHistoryCard(preview); }
controls.addEventListener('input', event => { const key = event.target.dataset.layout; if (!key) return; layout[key] = Number(event.target.value); render(); });
document.querySelector('#labFlip').onclick = () => preview.querySelector('.club-history-card')?.classList.toggle('is-flipped');
document.querySelector('#labSave').onclick = () => { localStorage.setItem(CLUB_HISTORY_LAYOUT_KEY, JSON.stringify(layout)); status.textContent = 'Layout salvo para o jogo.'; };
document.querySelector('#labCopy').onclick = async () => { await navigator.clipboard.writeText(JSON.stringify({ type: 'brfut-club-history-card-layout', version: 1, layout }, null, 2)); status.textContent = 'JSON copiado.'; };
document.querySelector('#labReset').onclick = () => { layout = { ...CLUB_HISTORY_LAYOUT_DEFAULTS }; Object.entries(layout).forEach(([key, value]) => { const input = document.querySelector(`[data-layout="${key}"]`); if (input) input.value = value; }); localStorage.removeItem(CLUB_HISTORY_LAYOUT_KEY); render(); status.textContent = 'Layout restaurado.'; };
render();
