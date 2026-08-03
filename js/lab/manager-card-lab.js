import {
  loadManagerCardLayout,
  managerCardLayoutExport,
  managerCardLayoutStyle,
  resetManagerCardLayout,
  saveManagerCardLayout,
} from '../ui/manager-card-layout.js';

const ART_COUNT = 17;
const ART_STORAGE_KEY = 'brfut-manager-card-lab-art';
const fields = {
  front: [
    ['Arte', 'artX', 'Posição horizontal (%)', 0.5], ['Arte', 'artY', 'Posição vertical (%)', 0.5], ['Arte', 'artScale', 'Zoom da arte', 0.01],
    ['Identidade', 'infoLeft', 'Margem esquerda (px)', 1], ['Identidade', 'infoRight', 'Margem direita (px)', 1], ['Identidade', 'infoBottom', 'Distância inferior (px)', 1],
    ['Identidade', 'clubWidth', 'Largura do clube (px)', 1], ['Tipografia', 'nameSize', 'Tamanho do nome (px)', 1], ['Tipografia', 'crestSize', 'Tamanho do escudo (px)', 1], ['Moldura', 'radius', 'Arredondamento (px)', 1],
  ],
  back: [
    ['Estrutura', 'backPadX', 'Margem lateral (px)', 1], ['Estrutura', 'backPadY', 'Margem superior (px)', 1], ['Estrutura', 'sectionGap', 'Espaço das conquistas (px)', 1],
    ['Tipografia', 'backNameSize', 'Tamanho do nome (px)', 1], ['Moldura', 'radius', 'Arredondamento (px)', 1],
  ],
};

let layout = loadManagerCardLayout();
let face = 'front';
let artIndex = loadArtIndex();

const gallery = document.getElementById('managerLabGallery');
const form = document.getElementById('managerLabForm');
const stage = document.getElementById('managerLabStage');
const jsonOut = document.getElementById('managerLabJson');
const stageLabel = document.getElementById('managerLabStageLabel');

function artUrl(index) { return `./manager-cards/manager-${String(index).padStart(2, '0')}.png`; }
function loadArtIndex() {
  try { return Math.min(ART_COUNT, Math.max(1, Number(localStorage.getItem(ART_STORAGE_KEY)) || 1)); } catch { return 1; }
}
function saveArtIndex(index) { try { localStorage.setItem(ART_STORAGE_KEY, String(index)); } catch { /* ignore */ } }

function cardMarkup() {
  return `<div class="manager-card-scene" style="${managerCardLayoutStyle(layout)}">
    <div class="manager-card-flipper" data-manager-card>
      <article class="manager-card-face manager-card-front">
        <img class="manager-card-art" src="${artUrl(artIndex)}" alt="Modelo ${artIndex}">
        <div class="manager-card-front-glow"></div>
        <div class="manager-card-front-info">
          <div class="manager-card-name-block"><small>TÉCNICO</small><strong>Alexandre Menezes</strong><span>POSSE DE BOLA</span></div>
          <div class="manager-card-club-block"><div class="manager-card-club-crest"><i class="crest manager-card-team-crest">BR</i></div><small>BR FUTEBOL CLUBE</small></div>
        </div>
        <button type="button" class="manager-card-flip-button manager-card-front-button"><span>VER SALA DE TROFÉUS</span><b>↻</b></button>
      </article>
      <article class="manager-card-face manager-card-back">
        <header class="manager-card-back-header"><div><small>SALA DE TROFÉUS</small><h3>Alexandre Menezes</h3><p>BR FUTEBOL CLUBE</p></div><div class="manager-card-back-rank"><small>RANKING</small><strong>#12</strong></div></header>
        <div class="manager-career-summary"><span><strong>4</strong>TÍTULOS</span><span><strong>138</strong>JOGOS</span><span><strong>5</strong>TEMPORADAS</span></div>
        <div class="manager-career-record"><span><strong>79</strong>VITÓRIAS</span><span><strong>34</strong>EMPATES</span><span><strong>25</strong>DERROTAS</span><span><strong>65%</strong>APROVEIT.</span></div>
        <section class="manager-card-trophy-list"><h4><span>CONQUISTAS</span><small>4 REGISTRADAS</small></h4>
          <article><span class="manager-card-trophy-icon">🏆</span><div><strong>Campeonato Brasileiro</strong><small>BR Futebol Clube · 2030</small></div></article>
          <article><span class="manager-card-trophy-icon">🏆</span><div><strong>Copa Nacional</strong><small>BR Futebol Clube · 2029</small></div></article>
          <article><span class="manager-card-trophy-icon">🏆</span><div><strong>Campeonato Estadual</strong><small>BR Futebol Clube · 2028</small></div></article>
        </section>
        <footer class="manager-card-back-footer"><span>BR FOOTBALL</span><small>118.4 PONTOS</small></footer>
        <button type="button" class="manager-card-flip-button manager-card-back-button"><b>↺</b><span>VER CARD</span></button>
      </article>
    </div>
  </div>`;
}

function renderGallery() {
  gallery.innerHTML = Array.from({ length: ART_COUNT }, (_, offset) => {
    const index = offset + 1;
    return `<button type="button" class="mcl-art-btn${index === artIndex ? ' is-active' : ''}" data-art="${index}" title="Modelo ${index}"><img loading="lazy" src="${artUrl(index)}" alt="Modelo ${index}"></button>`;
  }).join('');
  gallery.querySelectorAll('[data-art]').forEach(button => button.addEventListener('click', () => {
    artIndex = Number(button.dataset.art);
    saveArtIndex(artIndex);
    renderGallery();
    stage.querySelector('.manager-card-art')?.setAttribute('src', artUrl(artIndex));
  }));
}

function renderForm() {
  let currentGroup = '';
  form.innerHTML = fields[face].map(([group, key, label, step]) => {
    const legend = group !== currentGroup ? `<legend>${group}</legend>` : '';
    currentGroup = group;
    return `${legend}<label class="mcl-field"><span>${label}</span><input type="number" step="${step}" data-layout-key="${key}" value="${layout[key]}"></label>`;
  }).join('');
  form.querySelectorAll('[data-layout-key]').forEach(input => input.addEventListener('input', () => {
    const value = Number(input.value);
    if (Number.isFinite(value)) layout[input.dataset.layoutKey] = value;
    applyLayout();
  }));
}

function renderStage() {
  stage.innerHTML = cardMarkup();
  applyFace();
  renderGuides();
}

function applyLayout() {
  stage.querySelector('.manager-card-scene')?.setAttribute('style', managerCardLayoutStyle(layout));
  syncJson();
  renderGuides();
}

function applyFace() {
  stage.querySelector('[data-manager-card]')?.classList.toggle('is-flipped', face === 'back');
  stageLabel.textContent = `${face === 'back' ? 'VERSO' : 'FRENTE'} · PRÉ-VISUALIZAÇÃO`;
  document.querySelectorAll('[data-face]').forEach(button => button.classList.toggle('is-active', button.dataset.face === face));
}

function renderGuides() {
  stage.querySelectorAll('.mcl-guide').forEach(el => el.remove());
  const target = stage.querySelector(face === 'back' ? '.manager-card-back' : '.manager-card-front');
  if (!target) return;
  const guide = document.createElement('div');
  guide.className = 'mcl-guide';
  if (face === 'front') {
    guide.dataset.label = 'IDENTIDADE';
    guide.style.cssText = `left:${layout.infoLeft}px;right:${layout.infoRight}px;bottom:${layout.infoBottom}px;height:92px`;
  } else {
    guide.dataset.label = 'ÁREA INTERNA';
    guide.style.cssText = `left:${layout.backPadX}px;right:${layout.backPadX}px;top:${layout.backPadY}px;bottom:27px`;
  }
  target.appendChild(guide);
}

function syncJson() { jsonOut.value = JSON.stringify(managerCardLayoutExport(layout), null, 2); }
function setFace(next) { face = next; renderForm(); applyFace(); renderGuides(); }
function flash(button, text) { const old = button.textContent; button.textContent = text; setTimeout(() => { button.textContent = old; }, 1000); }

document.querySelectorAll('[data-face]').forEach(button => button.addEventListener('click', () => setFace(button.dataset.face)));
document.getElementById('managerLabFlip')?.addEventListener('click', () => setFace(face === 'front' ? 'back' : 'front'));
document.getElementById('managerLabSave')?.addEventListener('click', event => { layout = saveManagerCardLayout(layout); syncJson(); flash(event.currentTarget, 'Salvo!'); });
document.getElementById('managerLabReset')?.addEventListener('click', () => { if (!confirm('Voltar ao layout padrão do código?')) return; layout = resetManagerCardLayout(); renderForm(); renderStage(); syncJson(); });
document.getElementById('managerLabCopy')?.addEventListener('click', async event => {
  syncJson();
  try { await navigator.clipboard.writeText(jsonOut.value); flash(event.currentTarget, 'Copiado!'); }
  catch { jsonOut.select(); document.execCommand('copy'); }
});

renderGallery();
renderForm();
renderStage();
syncJson();
