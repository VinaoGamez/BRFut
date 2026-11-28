/**
 * Modais — lista de carreiras e nova carreira (MVP fase 1).
 */
import {
  canCreateSlot,
  createNewSlot,
  deleteCareerSlot,
  formatSlotDivision,
  formatSlotUpdatedAt,
  getLastPlayedSlot,
  readCareerIndex,
  slotLimitLabel,
} from '../../core/career-slot-manager.js';
import { activateSlot } from '../../core/career-activate.js';
import { clearCareerData } from '../../core/save-clear.js';
import { markSkipSessionEndOnce, markFreshCareerBoot } from '../../core/save.js';
import { CAREER_SLOT_LIMIT } from '../../core/constants.js';
import { deleteCareerStats } from '../../core/player-stats-sync.js';
import { escapeHtml, escapeHtmlAttribute } from '../../core/html-safe.js';
import { teamCrestHtml } from '../../ui/team-crest.js';

function ensureModalRoot() {
  let root = document.getElementById('careerSlotsModalRoot');
  if (root) return root;
  root = document.createElement('div');
  root.id = 'careerSlotsModalRoot';
  root.innerHTML = `
    <div id="loadCareerModal" class="career-slots-modal cs2-modal hidden" role="dialog" aria-modal="true" aria-labelledby="loadCareerTitle">
      <div class="career-slots-card cs2">
        <header class="cs2-head">
          <div class="cs2-title"><span class="cs2-kicker" id="loadCareerKicker">CARREIRAS</span><h2 id="loadCareerTitle">Suas carreiras</h2></div>
          <button type="button" id="closeLoadCareer" class="career-slots-close cs2-x" aria-label="Fechar">×</button>
        </header>
        <div id="loadCareerList" class="cs2-list"></div>
        <footer class="cs2-foot">
          <small id="loadCareerLimit"></small>
          <button type="button" id="loadCareerNewBtn" class="cs2-btn is-primary">NOVA CARREIRA</button>
        </footer>
      </div>
    </div>
  `;
  document.body.appendChild(root);
  return root;
}

function slotCardMarkup(slot, { isLast = false } = {}) {
  const division = escapeHtml(formatSlotDivision(slot.division));
  const year = slot.seasonYear ? `temporada ${escapeHtml(slot.seasonYear)}` : 'sem temporada';
  const round = slot.currentRound != null ? ` · rodada ${escapeHtml(slot.currentRound)}` : '';
  const slotId = escapeHtmlAttribute(slot.id);
  const clubName = escapeHtml(slot.clubName || 'Clube');
  const updatedAt = escapeHtml(formatSlotUpdatedAt(slot.updatedAt));
  const label = slot.name && slot.name !== slot.clubName ? `<small class="cs2-name">${escapeHtml(slot.name)}</small>` : '';
  return `
    <article class="cs2-slot${isLast ? ' is-last' : ''}" data-slot-id="${slotId}">
      <span class="cs2-crest">${slot.clubName ? teamCrestHtml(slot.clubName, { className: 'cs2-crest-img' }) : ''}</span>
      <div class="cs2-info">
        <strong>${clubName}</strong>${label}
        <small>${division} · ${year}${round}</small>
        <small>salvo ${updatedAt}</small>
      </div>
      ${isLast ? '<em class="cs2-badge">ÚLTIMA JOGADA</em>' : ''}
      <div class="cs2-actions">
        <button type="button" class="cs2-btn cs2-delete" data-delete-slot="${slotId}" aria-label="Excluir ${escapeHtmlAttribute(slot.name || slot.clubName || 'carreira')}">EXCLUIR</button>
        <button type="button" class="cs2-btn is-primary" data-play-slot="${slotId}">JOGAR</button>
      </div>
    </article>
  `;
}

/**
 * @param {object} opts
 * @param {() => void} [opts.onSlotsChanged]
 * @param {(slotId: string) => void | Promise<void>} [opts.onStartSlot]
 * @param {() => void | Promise<void>} [opts.onNewCareer]
 */
export function mountCareerSlotsUi({ onSlotsChanged, onStartSlot, onNewCareer } = {}) {
  ensureModalRoot();
  const modal = document.getElementById('loadCareerModal');
  const listEl = document.getElementById('loadCareerList');
  const limitEl = document.getElementById('loadCareerLimit');
  const newBtn = document.getElementById('loadCareerNewBtn');

  const close = () => modal?.classList.add('hidden');

  const renderList = () => {
    const index = readCareerIndex();
    const lastId = getLastPlayedSlot()?.id;
    const sorted = [...index.slots].sort(
      (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime(),
    );
    if (!listEl) return;
    if (!sorted.length) {
      listEl.innerHTML = '<p class="career-slots-empty">Nenhuma carreira salva ainda.</p>';
    } else {
      listEl.innerHTML = sorted
        .map(slot => slotCardMarkup(slot, { isLast: slot.id === lastId }))
        .join('');
    }
    const free = Math.max(0, CAREER_SLOT_LIMIT - sorted.length);
    if (sorted.length && free > 0) listEl.insertAdjacentHTML('beforeend', `<div class="cs2-free">Espaço livre para mais ${free} carreira${free === 1 ? '' : 's'}</div>`);
    const kicker = document.getElementById('loadCareerKicker');
    if (kicker) kicker.textContent = `CARREIRAS · ${sorted.length} DE ${CAREER_SLOT_LIMIT}`;
    if (limitEl) limitEl.textContent = slotLimitLabel();
    if (newBtn) newBtn.disabled = !canCreateSlot();
    onSlotsChanged?.();
  };

  const openLoadModal = () => {
    renderList();
    modal?.classList.remove('hidden');
  };

  const startSlot = async slotId => {
    if (!slotId) return;
    markSkipSessionEndOnce();
    try {
      await activateSlot(slotId, { skipProbe: true, reason: 'home-load' });
    } catch {
      /* offline/local */
    }
    close();
    await onStartSlot?.(slotId);
  };

  const startNewCareer = async () => {
    if (!canCreateSlot()) {
      window.alert(`Limite de ${CAREER_SLOT_LIMIT} saves por conta. Excluir saves entra na fase 2.`);
      return;
    }
    markSkipSessionEndOnce();
    markFreshCareerBoot();
    await clearCareerData('session');
    const slotId = createNewSlot();
    if (!slotId) return;
    close();
    await onNewCareer?.(slotId);
  };

  const removeSlot = async (slotId, button) => {
    const slot = readCareerIndex().slots.find(entry => entry.id === slotId);
    if (!slot) return;
    // Exclusão em duas etapas: o primeiro toque arma, o segundo confirma.
    if (button && button.dataset.armed !== '1') {
      listEl?.querySelectorAll('[data-delete-slot][data-armed="1"]').forEach(other => { other.dataset.armed = ''; other.textContent = 'EXCLUIR'; });
      button.dataset.armed = '1';
      button.textContent = 'TOQUE DE NOVO PARA EXCLUIR';
      clearTimeout(button._disarm);
      button._disarm = setTimeout(() => { button.dataset.armed = ''; button.textContent = 'EXCLUIR'; }, 4000);
      return;
    }
    if (button) button.disabled = true;
    const result = await deleteCareerSlot(slotId);
    if (!result.ok) {
      window.alert('Não foi possível confirmar a exclusão na nuvem. Verifique sua conexão e tente novamente.');
    }
    if (result.ok) void deleteCareerStats(slotId);
    renderList();
  };

  document.getElementById('closeLoadCareer')?.addEventListener('click', close);
  modal?.addEventListener('click', event => {
    if (event.target === modal) close();
  });
  newBtn?.addEventListener('click', () => void startNewCareer());
  listEl?.addEventListener('click', event => {
    const deleteBtn = event.target.closest('[data-delete-slot]');
    if (deleteBtn) {
      void removeSlot(deleteBtn.getAttribute('data-delete-slot'), deleteBtn);
      return;
    }
    const btn = event.target.closest('[data-play-slot]');
    if (!btn) return;
    void startSlot(btn.getAttribute('data-play-slot'));
  });

  return {
    openLoadModal,
    startNewCareer,
    startSlot,
    renderList,
    getLastPlayedSlot: () => getLastPlayedSlot(),
    hasAnySlot: () => readCareerIndex().slots.length > 0,
  };
}

export function lastSaveHintText(slot) {
  if (!slot) return '';
  const division = formatSlotDivision(slot.division);
  const year = slot.seasonYear ? `${slot.seasonYear}` : '—';
  const round = slot.currentRound != null ? ` · Rod. ${slot.currentRound}` : '';
  return `Último save: "${slot.name}" · ${division} · ${year}${round}`;
}
