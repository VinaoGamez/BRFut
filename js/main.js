import './security/tester-hardening.js';
import '../css/release-notes-viewer.css';
import '../css/live-volume.css';
import { BUILD_VERSION, FEATURES, SAVE_KEYS } from './core/constants.js';
import { registerChunkLoadRecovery } from './core/chunk-load.js';
import { createEventBus } from './core/event-bus.js';
import { bootEngine } from './legacy/engine.js';
import { markBootReady } from './ui/boot-gate.js';
import { showUpdateAlertIfNeeded } from './ui/update-alert.js';
import { initStorageBackend, isCloudStorageActive, probeBackend } from './core/storage-api.js';
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

const hasCareerSave = () => {
  try {
    return !!localStorage.getItem(SAVE_KEYS.career);
  } catch {
    return false;
  }
};

const account = mountAccountPanel({
  modal: document.getElementById('accountModal'),
  hasCareer: hasCareerSave,
  onAuthChange: state => syncCareerWelcomeAuth?.(state),
  onPlayLocal: () => openCareerCreatorRef?.(),
});

const storageInit = initStorageBackend().catch(error => {
  console.warn('[brfut] storage backend indisponível', error);
});

const startBoot = () => {
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

// Com backend cloud, aguarda merge de saves antes de hidratar o motor.
void storageInit.finally(async () => {
  await account.refresh();
  startBoot();
});
