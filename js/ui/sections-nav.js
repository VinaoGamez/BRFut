/**
 * Navegação v2: cinco seções fixas (Central · Elenco · Táticas · Jogos · Clube)
 * com sub-abas, Mensagens/Perfil/⚙ no topo e CONTINUAR sempre no mesmo lugar.
 * As sub-abas são os botões `.nav[data-view]` de sempre, então todo o código
 * que navega clicando neles continua funcionando.
 */

const SECTION_ORDER = ['central', 'elenco', 'taticas', 'jogos', 'clube'];
const SECTION_DEFAULT_VIEW = { central: 'dashboard', elenco: 'squad', taticas: 'tactics', jogos: 'calendar', clube: 'office' };
const STORAGE_KEY = 'brfut-nav-last-subtab';

function readMemory() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}; } catch { return {}; }
}

function writeMemory(memory) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(memory)); } catch { /* armazenamento indisponível */ }
}

/**
 * @param {object} deps
 * @param {(sel:string)=>Element[]} deps.$$
 * @param {ReturnType<import('./router.js').createRouter>} deps.router
 * @param {() => {label:string, hint?:string, run:() => void} | null} deps.getContinueAction
 * @param {() => void} [deps.openOptions]
 */
export function createSectionsNav({ $$, router, getContinueAction, openOptions = () => {} }) {
  const memory = readMemory();
  const tabs = () => $$('#sectionTabs .nav');
  const sectionOfView = viewId => tabs().find(tab => tab.dataset.view === viewId)?.dataset.section || null;

  const sync = viewId => {
    const section = sectionOfView(viewId);
    document.body.dataset.section = section || 'none';
    $$('.section-btn').forEach(button => {
      const active = button.dataset.section === section;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    let visible = 0;
    tabs().forEach(tab => {
      const show = !!section && tab.dataset.section === section && !tab.classList.contains('hidden');
      tab.hidden = !show;
      if (show) visible += 1;
    });
    // Seção com uma tela só (Central) não mostra barra de sub-abas.
    document.getElementById('sectionTabs')?.classList.toggle('is-empty', visible <= 1);
    if (section && section !== 'central') {
      memory[section] = viewId;
      writeMemory(memory);
    }
    refreshContinue();
  };

  const openSection = section => {
    const remembered = memory[section];
    const target = remembered && tabs().some(tab => tab.dataset.view === remembered && !tab.classList.contains('hidden'))
      ? remembered
      : SECTION_DEFAULT_VIEW[section];
    router.openView(target);
  };

  const cycleSection = step => {
    const current = document.body.dataset.section;
    const index = Math.max(0, SECTION_ORDER.indexOf(current));
    openSection(SECTION_ORDER[(index + step + SECTION_ORDER.length) % SECTION_ORDER.length]);
  };

  const refreshContinue = () => {
    const button = document.getElementById('headerContinue');
    const hint = document.getElementById('headerContinueHint');
    if (!button) return;
    const action = getContinueAction();
    button.disabled = !action;
    button.querySelector('span').textContent = action?.label || 'CONTINUAR';
    if (hint) hint.textContent = action?.hint || '';
  };

  const runContinue = () => {
    const action = getContinueAction();
    if (action) action.run();
  };

  const bindGamepad = () => {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
    const previous = {};
    const pressed = (pad, index) => !!pad.buttons[index]?.pressed;
    const tick = () => {
      const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
      pads.forEach(pad => {
        const was = previous[pad.index] || {};
        const now = {};
        [3, 4, 5, 8, 9].forEach(index => { now[index] = pressed(pad, index); });
        const down = index => now[index] && !was[index];
        if (down(4)) cycleSection(-1); // LB
        if (down(5)) cycleSection(1); // RB
        if (down(9)) runContinue(); // Start / ☰
        if (down(3)) router.openView('messages'); // Y
        if (down(8)) openOptions(); // View
        previous[pad.index] = now;
      });
      if (pads.length) requestAnimationFrame(tick);
    };
    window.addEventListener('gamepadconnected', () => requestAnimationFrame(tick));
  };

  const bind = () => {
    // Celular: CONTINUAR largo acima da barra inferior (fora do cabeçalho, que
    // tem backdrop-filter e prenderia o position: fixed).
    if (document.documentElement.classList.contains('is-mobile')) {
      const continueButton = document.getElementById('headerContinue');
      if (continueButton) document.body.append(continueButton);
    }
    $$('.section-btn').forEach(button => {
      button.addEventListener('click', () => openSection(button.dataset.section));
    });
    document.getElementById('headerContinue')?.addEventListener('click', runContinue);
    document.addEventListener('keydown', event => {
      const typing = event.target?.closest?.('input, textarea, select, [contenteditable="true"]');
      if (typing || event.altKey || event.ctrlKey || event.metaKey) return;
      if (document.querySelector('.modal:not(.hidden), .match-modal.open, #matchModal:not(.hidden)')) return;
      if (event.key === '[') cycleSection(-1);
      else if (event.key === ']') cycleSection(1);
    });
    router.onActivate(sync);
    // Os botões do card de próximo jogo mudam com o calendário: CONTINUAR acompanha.
    const actions = document.querySelector('.match-actions-buttons');
    if (actions && typeof MutationObserver !== 'undefined') {
      new MutationObserver(() => refreshContinue()).observe(actions, { subtree: true, attributes: true, attributeFilter: ['class', 'disabled', 'hidden'], childList: true, characterData: true });
    }
    bindGamepad();
    sync(router.currentView());
  };

  return { bind, sync, openSection, cycleSection, refreshContinue, sectionOfView };
}
