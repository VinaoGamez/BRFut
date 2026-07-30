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

function ensureModalRoot() {
  let root = document.getElementById('careerSlotsModalRoot');
  if (root) return root;
  root = document.createElement('div');
  root.id = 'careerSlotsModalRoot';
  root.innerHTML = `
    <div id="loadCareerModal" class="career-slots-modal hidden" role="dialog" aria-modal="true" aria-labelledby="loadCareerTitle">
      <div class="career-slots-card">
        <header class="career-slots-header">
          <h2 id="loadCareerTitle">Suas carreiras</h2>
          <button type="button" id="closeLoadCareer" class="career-slots-close" aria-label="Fechar">×</button>
        </header>
        <div id="loadCareerList" class="career-slots-list"></div>
        <footer class="career-slots-footer">
          <small id="loadCareerLimit"></small>
          <button type="button" id="loadCareerNewBtn" class="career-slots-new">+ Nova carreira</button>
        </footer>
      </div>
    </div>
  `;
  document.body.appendChild(root);
  return root;
}

function slotCardMarkup(slot, { isLast = false } = {}) {
  const division = formatSlotDivision(slot.division);
  const year = slot.seasonYear ? `Temp. ${slot.seasonYear}` : 'Sem temporada';
  const round = slot.currentRound != null ? ` · Rod. ${slot.currentRound}` : '';
  const badge = isLast ? '<span class="career-slots-badge">último</span>' : '';
  return `
    <article class="career-slots-item" data-slot-id="${slot.id}">
      <div class="career-slots-item-head">
        <strong>${slot.name || 'Carreira'}</strong>
        ${badge}
        <button type="button" class="career-slots-delete" data-delete-slot="${slot.id}" aria-label="Excluir ${slot.name || 'carreira'}" title="Excluir save">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h10l-1 11H8L7 9Zm3 2v7h2v-7h-2Zm4 0v7h2v-7h-2Z"/>
          </svg>
        </button>
      </div>
      <p class="career-slots-item-meta">${slot.clubName} · ${division} · ${year}${round}</p>
      <p class="career-slots-item-date">Atualizado: ${formatSlotUpdatedAt(slot.updatedAt)}</p>
      <button type="button" class="career-slots-play" data-play-slot="${slot.id}">JOGAR</button>
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

  const removeSlot = async slotId => {
    const slot = readCareerIndex().slots.find(entry => entry.id === slotId);
    if (!slot) return;
    const confirmed = window.confirm(
      `Excluir o save "${slot.name || 'Carreira'}"?\n\nEsta ação removerá a carreira deste navegador e da nuvem.`,
    );
    if (!confirmed) return;
    const button = listEl?.querySelector(`[data-delete-slot="${slotId}"]`);
    if (button) button.disabled = true;
    const result = await deleteCareerSlot(slotId);
    if (!result.ok) {
      window.alert('Não foi possível confirmar a exclusão na nuvem. Verifique sua conexão e tente novamente.');
    }
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
      void removeSlot(deleteBtn.getAttribute('data-delete-slot'));
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
