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
import { clearSessionCareerData } from './core/save.js';
import { injectAccountModals } from './feature/account/inject-modals.js';
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

injectAccountModals();

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

const lockGameShell = () => {
  document.body.classList.add('career-locked');
  const shell = document.querySelector('.game-shell');
  if (shell) {
    shell.inert = true;
    shell.setAttribute('aria-hidden', 'true');
  }
};

const injectPreLoginWelcome = () => {
  if (document.getElementById('careerWelcome')) return;
  lockGameShell();
  document.body.insertAdjacentHTML(
    'beforeend',
    '<section id="careerWelcome" class="career-welcome"><div class="career-welcome-content"><div class="career-welcome-brand"><img class="career-welcome-logo" src="./brand/lockup-lg.png" alt="BR Football" width="480" height="72"></div><div class="career-welcome-actions"><button id="welcomeLogin" type="button">ENTRAR</button></div><p id="welcomeHint" class="career-welcome-hint">Entre na sua conta para carregar o save na nuvem.</p></div></section>',
  );
  document.getElementById('welcomeLogin')?.addEventListener('click', () => account.openLogin());
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
      location.reload();
      return;
    }
    await initStorageBackend({ skipProbe: true });
    await account.refresh();
    document.getElementById('careerWelcome')?.remove();
    startBootOnce();
  },
});

const beginAppSession = async () => {
  try {
    await probeBackend();

    if (!getAuthToken()) {
      clearSessionCareerData();
      injectPreLoginWelcome();
      await account.refresh();
      return;
    }

    await initStorageBackend();
    await account.refresh();
    document.getElementById('careerWelcome')?.remove();
    startBootOnce();
  } catch (error) {
    console.error('[brfut] falha ao iniciar sessão', error);
    injectPreLoginWelcome();
  } finally {
    // Sem login o motor não sobe — ocultar splash para exibir tela ENTRAR.
    if (!bootStarted) markBootReady();
  }
};

void beginAppSession();

window.addEventListener('pagehide', event => {
  if (event.persisted || bootStarted) return;
  endBrowserSession();
  clearSessionCareerData();
});
