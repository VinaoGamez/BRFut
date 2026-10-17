import './security/https-upgrade.js';
import './ui/desktop-updates.js';
import './security/tester-hardening.js';
import { AUTH_REQUIRED, BUILD_VERSION, SAVE_KEYS, SAVE_RESET_EPOCH, SAVE_RESET_MARKER_KEY, BRFUT_API_ORIGIN, SITE_MAINTENANCE } from './core/constants.js';
import { SPONSOR_EXTERNAL_LINKS } from './core/sponsor-links.js';
import { showUpdateAlertIfNeeded } from './ui/update-alert.js';
import { showSaveResetLoginAlert } from './ui/save-reset-login-alert.js';
import { createTesterHubFeature } from './feature/tester-hub/index.js';
import { ensureAccountModals } from './feature/account/inject-modals.js';
import { mountAccountPanel } from './feature/account/index.js';
import { endBrowserSession, getAuthToken } from './core/storage-api.js';
import {
  clearSessionCareerData,
  hasLocalCareerSave,
  markCareerReloadPending,
  markSkipSessionEndOnce,
  applySaveResetMigration,
  purgeAllCareerStorage,
  shouldPreserveAuthOnPageHide,
} from './core/save.js';
import { SPONSOR_LOGO_URLS } from './assets/sponsor-logos.js';
import {
  runCareerBootMigration,
  activateSlot,
  recoverCareerSlotsAfterHydration,
} from './core/career-activate.js';
import { hasPlayableCareerSave } from './core/career-storage-health.js';
import { mountCareerSlotsUi, lastSaveHintText } from './feature/career-slots/index.js';

// Bootstrap restored from a0e1392: bf25779 had removed all button bindings.
const SPONSOR_ORDER = [
  'tekno-cursos', 'nubanco', 'petrobraz', 'magazine-luizao', 'ifome',
  'betregional', 'picpaga', 'sheinpee', 'amazonia-com', 'googol', 'metagol',
  'starbox-coffee', 'havaianinhas', 'naike', 'pumba-sport', 'perdigol',
  'poweraid', 'playstacao', 'fedexpressao',
];

const formatUpdateTime = value => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
  });
};

function applyHomeMeta() {
  const updateEl = document.getElementById('lastUpdate');
  if (updateEl) {
    const stamp = document.querySelector('meta[name="build-time"]')?.content || new Date().toISOString();
    updateEl.textContent = `Última atualização: ${formatUpdateTime(stamp)}`;
  }
  const buildEl = document.getElementById('homeBuildVersion');
  if (buildEl) buildEl.textContent = BUILD_VERSION;
}

function initSponsorRail() {
  const track = document.getElementById('homeSponsorsTrack');
  const viewport = track?.parentElement;
  if (!track || !viewport) return;
  const logos = SPONSOR_ORDER.map(slug => ({
    url: SPONSOR_LOGO_URLS[slug],
    href: SPONSOR_EXTERNAL_LINKS[slug] || '',
    label: slug.replace(/-/g, ' '),
  })).filter(item => item.url);
  if (!logos.length) return;
  track.innerHTML = [...logos, ...logos].map(item => {
    const img = `<img src="${item.url}" alt="${item.label}" width="72" height="72" decoding="async">`;
    return item.href
      ? `<a class="home-sponsor-slot" href="${item.href}" target="_blank" rel="noopener noreferrer" title="${item.label}" aria-label="Abrir site de ${item.label}">${img}</a>`
      : `<span class="home-sponsor-slot" title="${item.label}">${img}</span>`;
  }).join('');
  const gap = 10;
  let index = 0, slotSize = 0, timer = 0;
  const measure = () => {
    slotSize = (viewport.clientWidth - gap * 3) / 4;
    track.querySelectorAll('.home-sponsor-slot').forEach(slot => {
      slot.style.flex = `0 0 ${slotSize}px`;
      slot.style.width = `${slotSize}px`;
      slot.style.height = `${slotSize}px`;
    });
    track.style.transform = `translate3d(-${index * (slotSize + gap)}px,0,0)`;
  };
  const step = () => {
    index += 1;
    track.classList.remove('is-resetting');
    track.style.transform = `translate3d(-${index * (slotSize + gap)}px,0,0)`;
    if (index >= logos.length) window.setTimeout(() => {
      track.classList.add('is-resetting');
      index = 0;
      track.style.transform = 'translate3d(0,0,0)';
    }, 560);
  };
  measure();
  window.addEventListener('resize', measure);
  timer = window.setInterval(step, 2800);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { window.clearInterval(timer); timer = 0; }
    else if (!timer) timer = window.setInterval(step, 2800);
  }, { passive: true });
}

if (SITE_MAINTENANCE.enabled) {
  purgeAllCareerStorage();
  endBrowserSession();
  document.body.classList.add('home-maintenance-mode');
  document.title = 'BR Fut · Manutenção';
  applyHomeMeta();
  const banner = document.getElementById('homeMaintenanceMsg');
  if (banner) { banner.textContent = SITE_MAINTENANCE.message; banner.hidden = false; }
  initSponsorRail();
} else {
  applySaveResetMigration(SAVE_RESET_EPOCH, SAVE_RESET_MARKER_KEY);
  runCareerBootMigration();
}

(() => {
  if (SITE_MAINTENANCE.enabled) return;
  ensureAccountModals();
  void showUpdateAlertIfNeeded(BUILD_VERSION);
  const $ = selector => document.querySelector(selector);
  applyHomeMeta();
  const continueBtn = $('#continueBtn');
  const newGameBtn = $('#newGameBtn');
  const loadCareerBtn = $('#loadCareerBtn');
  const lastSaveHint = $('#lastSaveHint');
  const loginBtn = $('#loginBtn');
  const storageHint = $('#homeStorageHint');
  const hasCareer = () => {
    try { return !!localStorage.getItem(SAVE_KEYS.career) || careerSlots.hasAnySlot(); }
    catch { return false; }
  };
  const goToGame = ({ novo = false } = {}) => {
    const url = new URL('index.html', location.href);
    if (novo) url.searchParams.set('novo', '1');
    markSkipSessionEndOnce();
    location.href = `${url.pathname}${url.search}`;
  };
  let authUiState = { loggedIn: false, hasBackend: AUTH_REQUIRED || !!BRFUT_API_ORIGIN };
  const careerSlots = mountCareerSlotsUi({
    onSlotsChanged: () => syncCareerActions(authUiState),
    onStartSlot: () => goToGame(),
    onNewCareer: () => goToGame({ novo: true }),
  });
  const syncCareerActions = (state = authUiState) => {
    const { loggedIn = null, hasBackend = null } = state || {};
    const last = careerSlots.getLastPlayedSlot();
    const lastPlayable = last ? hasPlayableCareerSave(last.id) : false;
    const requiresLogin = AUTH_REQUIRED || hasBackend === true;
    const showCareer = careerSlots.hasAnySlot() && (!requiresLogin || loggedIn === true);
    continueBtn?.classList.toggle('hidden', !showCareer || !last || !lastPlayable);
    loadCareerBtn?.classList.toggle('hidden', requiresLogin && !loggedIn);
    if (continueBtn && last) continueBtn.href = 'index.html';
    if (lastSaveHint) {
      lastSaveHint.textContent = last && showCareer
        ? lastPlayable ? lastSaveHintText(last) : 'Não foi possível restaurar esta carreira. Tente novamente ou inicie uma nova carreira.'
        : '';
      lastSaveHint.classList.toggle('hidden', !(last && showCareer));
    }
  };
  const syncHeroActions = ({ loggedIn, hasBackend }) => {
    authUiState = { loggedIn: loggedIn === true, hasBackend: hasBackend === true };
    const wantsLogin = AUTH_REQUIRED || hasBackend || !!BRFUT_API_ORIGIN;
    loginBtn?.classList.toggle('hidden', !wantsLogin || loggedIn);
    newGameBtn?.classList.toggle('hidden', !!wantsLogin && !loggedIn);
    loadCareerBtn?.classList.toggle('hidden', !!wantsLogin && !loggedIn);
    if (storageHint) {
      storageHint.classList.toggle('hidden', !!loggedIn);
      storageHint.textContent = wantsLogin && hasBackend ? 'Entre para salvar sua carreira' : 'Carreira salva neste navegador';
    }
    syncCareerActions({ loggedIn, hasBackend: wantsLogin && hasBackend });
  };
  const account = mountAccountPanel({
    modal: document.getElementById('accountModal'),
    hasCareer,
    onAuthChange: syncHeroActions,
    onLoginSuccess: async () => {
      recoverCareerSlotsAfterHydration();
      careerSlots.renderList();
      await showSaveResetLoginAlert();
    },
  });
  syncHeroActions(authUiState);
  account.refresh().then(state => {
    const loggedIn = AUTH_REQUIRED ? state.mode === 'cloud'
      : state.mode === 'cloud' || (!state.authRejected && (!!getAuthToken() || !!state.tokenPreserved));
    recoverCareerSlotsAfterHydration();
    syncHeroActions({ loggedIn, hasBackend: !!state.backend || state.mode === 'cloud' || !!BRFUT_API_ORIGIN });
    careerSlots.renderList();
  });
  loginBtn?.addEventListener('click', () => account.openLogin());
  newGameBtn?.addEventListener('click', () => void careerSlots.startNewCareer());
  loadCareerBtn?.addEventListener('click', () => careerSlots.openLoadModal());
  continueBtn?.addEventListener('click', async event => {
    event.preventDefault();
    const last = careerSlots.getLastPlayedSlot();
    if (!last || !hasPlayableCareerSave(last.id)) return;
    markSkipSessionEndOnce();
    try { await activateSlot(last.id, { skipProbe: true, reason: 'home-continue' }); }
    catch { /* local */ }
    goToGame();
  });
  initSponsorRail();
  const testerHub = createTesterHubFeature();
  document.getElementById('openTesterGuide')?.addEventListener('click', () => testerHub.openGuide());
  document.getElementById('openTesterFeedback')?.addEventListener('click', () => testerHub.openFeedback());
  window.addEventListener('beforeunload', () => {
    if (hasCareer() || getAuthToken()) markSkipSessionEndOnce();
  });
  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    if (hasCareer() || hasLocalCareerSave() || getAuthToken()) {
      markCareerReloadPending();
      markSkipSessionEndOnce();
      return;
    }
    if (shouldPreserveAuthOnPageHide()) return;
    endBrowserSession();
    clearSessionCareerData();
  });
})();
