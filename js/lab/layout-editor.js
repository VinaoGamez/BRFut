/**
 * Editor de layout reutilizável para labs de pré-aprovação.
 */
export function createLayoutEditor({
  stage,
  storageKey,
  editableSelector = '[data-lab-editable]',
  editToggle,
  resetButton,
  copyButton,
  editHint,
  stageEditClass = 'lab-layout-stage--edit',
  editableEditClass = 'lab-editable--drag',
  onEditModeChange,
  showToast = () => {},
}) {
  let editMode = false;
  let dragState = null;

  const getEditableElements = () => [...stage.querySelectorAll(editableSelector)];

  const readLayout = () => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const saveLayout = () => {
    const layout = {};
    for (const el of getEditableElements()) {
      const id = el.dataset.labId || el.dataset.ntolId;
      if (!id) continue;
      layout[id] = {
        left: el.style.left || null,
        top: el.style.top || null,
        width: el.style.width || null,
      };
    }
    localStorage.setItem(storageKey, JSON.stringify(layout));
    return layout;
  };

  const applyLayout = layout => {
    if (!layout) return;
    for (const el of getEditableElements()) {
      const id = el.dataset.labId || el.dataset.ntolId;
      const pos = id ? layout[id] : null;
      if (!pos) continue;
      if (pos.left) el.style.left = pos.left;
      if (pos.top) el.style.top = pos.top;
      if (pos.width) el.style.width = pos.width;
    }
  };

  const resetLayout = () => {
    for (const el of getEditableElements()) {
      el.style.left = '';
      el.style.top = '';
      el.style.width = '';
    }
    localStorage.removeItem(storageKey);
    showToast('Layout restaurado ao padrão.');
  };

  const setEditMode = enabled => {
    editMode = enabled;
    editToggle?.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    stage?.classList.toggle(stageEditClass, enabled);
    editHint?.toggleAttribute('hidden', !enabled);
    resetButton?.toggleAttribute('hidden', !enabled);
    copyButton?.toggleAttribute('hidden', !enabled);
    if (enabled) {
      captureFlowPositions();
      showToast('Modo edição: arraste os elementos destacados.');
    } else {
      saveLayout();
    }
    onEditModeChange?.(enabled);
  };

  const captureFlowPositions = () => {
    if (!stage) return;
    stage.style.position = 'relative';
    const stageRect = stage.getBoundingClientRect();
    let maxBottom = 0;
    for (const el of getEditableElements()) {
      const rect = el.getBoundingClientRect();
      const hasPos = el.style.left && el.style.top;
      if (!hasPos) {
        const left = Math.round(rect.left - stageRect.left);
        const top = Math.round(rect.top - stageRect.top);
        el.style.position = 'absolute';
        el.style.left = `${left}px`;
        el.style.top = `${top}px`;
        if (el.dataset.labLockWidth !== 'false') {
          el.style.width = `${Math.round(rect.width)}px`;
        }
        maxBottom = Math.max(maxBottom, top + rect.height);
      } else {
        maxBottom = Math.max(maxBottom, (parseInt(el.style.top, 10) || 0) + el.offsetHeight);
      }
    }
    stage.style.minHeight = `${Math.max(maxBottom + 32, stage.offsetHeight)}px`;
  };

  const onPointerDown = event => {
    if (!editMode) return;
    const target = event.target.closest(editableSelector);
    if (!target || !stage.contains(target)) return;
    event.preventDefault();

    const rect = target.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
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
  };

  const onPointerMove = event => {
    if (!dragState) return;
    const { el, offsetX, offsetY, stageLeft, stageTop } = dragState;
    const left = Math.max(0, event.clientX - stageLeft - offsetX);
    const top = Math.max(0, event.clientY - stageTop - offsetY);
    el.style.left = `${Math.round(left)}px`;
    el.style.top = `${Math.round(top)}px`;
  };

  const onPointerUp = () => {
    if (!dragState) return;
    dragState.el.classList.remove('is-dragging');
    dragState = null;
    saveLayout();
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  };

  const copyLayoutToClipboard = async () => {
    const layout = saveLayout();
    const text = JSON.stringify(layout, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      showToast('Posições copiadas para a área de transferência.');
    } catch {
      showToast(text);
    }
  };

  editToggle?.addEventListener('click', () => setEditMode(!editMode));
  resetButton?.addEventListener('click', resetLayout);
  copyButton?.addEventListener('click', copyLayoutToClipboard);
  stage?.addEventListener('pointerdown', onPointerDown);

  applyLayout(readLayout());

  return {
    applyLayout,
    saveLayout,
    resetLayout,
    setEditMode,
    isEditMode: () => editMode,
  };
}
