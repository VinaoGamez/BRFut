/** Navegação entre views — desacopla sidebar do motor. */
export function createRouter({ $$, onClick }) {
  const viewHandlers = new Map();
  const listeners = new Set();
  let current = 'dashboard';

  const activate = viewId => {
    current = viewId;
    $$('.nav').forEach(nav => nav.classList.toggle('active', nav.dataset.view === viewId));
    $$('.view').forEach(view => view.classList.toggle('active', view.id === viewId));
    viewHandlers.get(viewId)?.();
    listeners.forEach(listener => {
      try { listener(viewId); } catch (error) { console.warn('[brfut] listener de navegação', error); }
    });
  };

  const onView = (viewId, handler) => {
    viewHandlers.set(viewId, handler);
  };

  /** Avisado a cada troca de tela (seções, sub-abas, topo). */
  const onActivate = listener => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const bindNav = () => {
    $$('.nav').forEach(button => {
      onClick(button, () => activate(button.dataset.view));
    });
  };

  const openView = viewId => {
    const button = $$('.nav').find(nav => nav.dataset.view === viewId);
    if (button) button.click();
    else activate(viewId);
  };

  return { activate, onView, onActivate, bindNav, openView, currentView: () => current };
}
