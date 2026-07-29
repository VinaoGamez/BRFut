import './security/https-upgrade.js';
import './security/tester-hardening.js';
import '../css/release-notes-viewer.css';
import '../css/live-volume.css';
import { BUILD_VERSION, FEATURES, SAVE_KEYS } from './core/constants.js';
import { registerChunkLoadRecovery } from './core/chunk-load.js';
import { createEventBus } from './core/event-bus.js';
import { bootEngine } from './legacy/engine.js';
import { markBootReady } from './ui/boot-gate.js';
import { showUpdateAlertIfNeeded } from './ui/update-alert.js';
import {
  endBrowserSession,
  getAuthToken,
  initStorageBackend,
  probeBackend,
} from './core/storage-api.js';
import {
  clearSessionCareerData,
  consumeCareerReloadPending,
  hasLocalCareerSave,
  markCareerReloadPending,
  markSkipSessionEndOnce,
} from './core/save.js';
import { ensureAccountModals } from './feature/account/inject-modals.js';
import { mountAccountPanel } from './feature/account/index.js';

/** Ponto de entrada modular — Alpha 02 */
document.documentElement.dataset.build = BUILD_VERSION;
registerChunkLoadRecovery();
void showUpdateAlertIfNeeded(BUILD_VERSION);

if (!FEATURES.transfers) {
  document.querySelector('.nav[data-view="transfers"]')?.classList.add('hidden');
  document.querySelector('#transfers')?.setAttribute('hidden', '');
}

const bus = createEventBus();

ensureAccountModals();

let syncCareerWelcomeAuth = null;
let openCareerCreatorRef = null;
let bootStarted = false;

const hasCareerSave = () => {
  try {
    return !!localStorage.getItem(SAVE_KEYS.career);
  } catch {
    return false;
  }
};

const redirectToHomeLanding = () => {
  markBootReady();
  const dest = new URL('home.html', location.href);
  if (new URLSearchParams(location.search).has('novo')) dest.searchParams.set('novo', '1');
  location.replace(`${dest.pathname}${dest.search}`);
};

const startBootOnce = () => {
  if (bootStarted) return;
  bootStarted = true;
  bootEngine({
    bus,
    features: FEATURES,
    buildVersion: BUILD_VERSION,
    openAccountLogin: () => account.openLogin(),
    registerWelcomeAuthSync: fn => {
      syncCareerWelcomeAuth = fn;
    },
    registerCareerCreator: fn => {
      openCareerCreatorRef = fn;
    },
  })
    .then(() => markBootReady())
    .catch(error => {
      markBootReady();
      document.documentElement.dataset.bootError = String(error?.stack || error);
      console.error('BR Football failed to initialize', error);
    });
};

const account = mountAccountPanel({
  modal: document.getElementById('accountModal'),
  hasCareer: hasCareerSave,
  onAuthChange: state => syncCareerWelcomeAuth?.(state),
  onPlayLocal: () => openCareerCreatorRef?.(),
  onLoginSuccess: async () => {
    if (bootStarted) {
      markSkipSessionEndOnce();
      location.reload();
      return;
    }
    await initStorageBackend({ skipProbe: true });
    await account.refresh();
    startBootOnce();
  },
});

const beginAppSession = async () => {
  try {
    await probeBackend();

    const token = getAuthToken();

    if (!token) {
      const reloadPending = consumeCareerReloadPending();
      if (!reloadPending) clearSessionCareerData();
      redirectToHomeLanding();
      return;
    }

    consumeCareerReloadPending();
    await initStorageBackend();
    await account.refresh();
    startBootOnce();
  } catch (error) {
    console.error('[brfut] falha ao iniciar sessão', error);
    redirectToHomeLanding();
  }
};

void beginAppSession();

window.addEventListener('pagehide', event => {
  if (event.persisted) return;
  const hasCareer = hasLocalCareerSave();
  if (hasCareer) {
    markCareerReloadPending();
    markSkipSessionEndOnce();
    return;
  }
  if (bootStarted) return;
  endBrowserSession();
  clearSessionCareerData();
});
