import {
  generateNextNationalTeamOffer,
  NATIONAL_TEAM_OFFER_TEAMS_PER_PROPOSAL,
} from '../engine/national-team-offers.js';
import { NATIONAL_TEAMS, nationalTeamFlagUrl, nationalTeamPower } from '../engine/national-teams.js';
import { preloadCompetitionTrophy } from '../ui/competition-trophies.js';

const LAYOUT_KEY = 'brfut-nt-offers-lab-layout-v3';

const WEEK_LABELS = {
  1: 'Março · semana da 1ª proposta',
  2: 'Março · +1 semana (2ª proposta)',
  3: 'Março · +2 semanas (3ª proposta)',
};

const modal = document.getElementById('ntOfferModal');
const openBtn = document.getElementById('ntolOpenBtn');
const closeBtn = document.getElementById('ntolCloseBtn');
const denyAllBtn = document.getElementById('ntolDenyAll');
const editToggle = document.getElementById('ntolEditToggle');
const resetLayoutBtn = document.getElementById('ntolResetLayout');
const copyLayoutBtn = document.getElementById('ntolCopyLayout');
const editHint = document.getElementById('ntolEditHint');
const layoutStage = document.getElementById('ntolLayoutStage');
const weekSelect = document.getElementById('ntolWeekSelect');
const divisionSelect = document.getElementById('ntolDivisionSelect');
const offersBody = document.getElementById('ntolOffersBody');
const footnote = document.getElementById('ntolFootnote');
const offersSub = document.getElementById('ntolOffersSub');
const trophyImg = document.getElementById('ntolTrophy');

let toastTimer = 0;
let editMode = false;
let dragState = null;

function showToast(text) {
  const existing = document.querySelector('.ntol-toast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = 'ntol-toast';
  el.textContent = text;
  document.body.appendChild(el);
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.remove(), 2600);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getEditableElements() {
  return [...layoutStage.querySelectorAll('[data-ntol-id]')];
}

function readLayout() {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveLayout() {
  const layout = {};
  for (const el of getEditableElements()) {
    layout[el.dataset.ntolId] = {
      left: el.style.left || null,
      top: el.style.top || null,
      width: el.style.width || null,
    };
  }
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
  return layout;
}

function applyLayout(layout) {
  if (!layout) return;
  for (const el of getEditableElements()) {
    const pos = layout[el.dataset.ntolId];
    if (!pos) continue;
    if (pos.left) el.style.left = pos.left;
    if (pos.top) el.style.top = pos.top;
    if (pos.width) el.style.width = pos.width;
  }
}

function resetLayout() {
  for (const el of getEditableElements()) {
    el.style.left = '';
    el.style.top = '';
    el.style.width = '';
  }
  localStorage.removeItem(LAYOUT_KEY);
  showToast('Layout restaurado ao padrão.');
}

function setEditMode(enabled) {
  editMode = enabled;
  editToggle?.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  layoutStage?.classList.toggle('ntol-layout-stage--edit', enabled);
  editHint?.toggleAttribute('hidden', !enabled);
  resetLayoutBtn?.toggleAttribute('hidden', !enabled);
  copyLayoutBtn?.toggleAttribute('hidden', !enabled);
  if (enabled) {
    showToast('Modo edição: arraste os elementos destacados.');
  } else {
    saveLayout();
  }
}

function onPointerDown(event) {
  if (!editMode) return;
  const target = event.target.closest('[data-ntol-id]');
  if (!target || !layoutStage.contains(target)) return;
  event.preventDefault();

  const rect = target.getBoundingClientRect();
  const stageRect = layoutStage.getBoundingClientRect();
  dragState = {
    el: target,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    stageLeft: stageRect.left,
    stageTop: stageRect.top,
  };
  target.classList.add('is-dragging');
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
}

function onPointerMove(event) {
  if (!dragState) return;
  const { el, offsetX, offsetY, stageLeft, stageTop } = dragState;
  const left = Math.max(0, event.clientX - stageLeft - offsetX);
  const top = Math.max(0, event.clientY - stageTop - offsetY);
  el.style.left = `${Math.round(left)}px`;
  el.style.top = `${Math.round(top)}px`;
}

function onPointerUp() {
  if (!dragState) return;
  dragState.el.classList.remove('is-dragging');
  dragState = null;
  saveLayout();
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
}

async function copyLayoutToClipboard() {
  const layout = saveLayout();
  const text = JSON.stringify(layout, null, 2);
  try {
    await navigator.clipboard.writeText(text);
    showToast('Posições copiadas para a área de transferência.');
  } catch {
    showToast(text);
  }
}

function buildProposalBatches(weekCount) {
  const batches = [];
  for (let issueIndex = 0; issueIndex < weekCount; issueIndex += 1) {
    const batch = generateNextNationalTeamOffer({
      year: 2026,
      userDivision: divisionSelect.value,
      seed: 4242,
      issueIndex,
      existingOffers: batches,
    });
    if (batch) batches.push(batch);
  }
  return batches;
}

function renderOffers() {
  const week = Number(weekSelect.value) || 1;
  const batches = buildProposalBatches(week);
  const teams = batches.length ? batches[batches.length - 1].teams : [];
  const isLastProposalWindow = week >= 3;

  offersSub.textContent =
    !isLastProposalWindow
      ? `Nova proposta disponível · ${NATIONAL_TEAM_OFFER_TEAMS_PER_PROPOSAL} seleções para escolher`
      : 'Última proposta — escolha uma seleção para comandar.';

  footnote.textContent = isLastProposalWindow
    ? 'Você não receberá mais convite(s) nesta temporada de Copa.'
    : 'Próxima proposta chega em 7 dias. Você ainda receberá convite(s) nesta temporada de Copa.';

  offersBody.innerHTML = teams
    .map(offer => {
      const meta = NATIONAL_TEAMS[offer.code];
      const flagUrl = meta ? nationalTeamFlagUrl(meta.iso) : '';
      const ovr = meta ? nationalTeamPower(meta.block) : 88;
      return `<tr>
        <td><div class="ntol-flag"><img src="${escapeHtml(flagUrl)}" alt=""></div></td>
        <td>
          <span class="ntol-team-name">${escapeHtml(offer.name)}</span>
          <span class="ntol-team-rank">FIFA ${escapeHtml(offer.fifaRank)}º</span>
        </td>
        <td class="ntol-col-ovr"><span class="ntol-ovr">${ovr}</span></td>
        <td class="ntol-col-actions">
          <div class="ntol-row-actions">
            <button type="button" class="ntol-action ntol-action--accept" data-action="accept" data-code="${escapeHtml(offer.code)}">Aceitar</button>
            <button type="button" class="ntol-action ntol-action--view" data-action="view" data-code="${escapeHtml(offer.code)}">Ver Time</button>
          </div>
        </td>
      </tr>`;
    })
    .join('');
}

function openModal() {
  renderOffers();
  modal.classList.remove('hidden');
}

function closeModal() {
  if (editMode) setEditMode(false);
  modal.classList.add('hidden');
}

openBtn?.addEventListener('click', openModal);
closeBtn?.addEventListener('click', closeModal);
denyAllBtn?.addEventListener('click', () => {
  showToast('[Lab] Negar todos — proposta adiada; retorna na próxima semana.');
  closeModal();
});
editToggle?.addEventListener('click', () => setEditMode(!editMode));
resetLayoutBtn?.addEventListener('click', resetLayout);
copyLayoutBtn?.addEventListener('click', copyLayoutToClipboard);
layoutStage?.addEventListener('pointerdown', onPointerDown);

weekSelect?.addEventListener('change', () => {
  if (!modal.classList.contains('hidden')) renderOffers();
});
divisionSelect?.addEventListener('change', () => {
  if (!modal.classList.contains('hidden')) renderOffers();
});

modal?.addEventListener('click', event => {
  if (event.target === modal && !editMode) closeModal();
});

offersBody?.addEventListener('click', event => {
  if (editMode) return;
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const code = button.dataset.code || '';
  const action = button.dataset.action;
  if (action === 'accept') {
    showToast(`[Lab] Aceitar ${code} — integração virá após sua aprovação.`);
    closeModal();
    return;
  }
  if (action === 'view') {
    showToast(`[Lab] Ver elenco de ${code} — abrirá tela de seleção no jogo.`);
  }
});

applyLayout(readLayout());

preloadCompetitionTrophy('world-cup').then(url => {
  if (trophyImg && url) {
    trophyImg.src = url;
    trophyImg.alt = 'Troféu Copa do Mundo';
    trophyImg.dataset.trophyKey = 'world-cup';
    trophyImg.classList.add('competition-trophy-art--world-cup');
  }
});

openModal();
