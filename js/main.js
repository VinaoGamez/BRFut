import './security/tester-hardening.js';
import '../css/release-notes-viewer.css';
import '../css/live-volume.css';
import { BUILD_VERSION, FEATURES } from './core/constants.js';
import { createEventBus } from './core/event-bus.js';
import { bootEngine } from './legacy/engine.js';
import { markBootReady } from './ui/boot-gate.js';
import { showUpdateAlertIfNeeded } from './ui/update-alert.js';
import { initStorageBackend } from './core/storage-api.js';

/** Ponto de entrada modular — Alpha 02 */
document.documentElement.dataset.build = BUILD_VERSION;
showUpdateAlertIfNeeded(BUILD_VERSION);

if (!FEATURES.transfers) {
  document.querySelector('.nav[data-view="transfers"]')?.classList.add('hidden');
  document.querySelector('#transfers')?.setAttribute('hidden', '');
}

const bus = createEventBus();

initStorageBackend()
  .catch(error => {
    console.warn('[brfut] storage backend indisponível', error);
  })
  .finally(() => {
    bootEngine({
      bus,
      features: FEATURES,
      buildVersion: BUILD_VERSION,
    })
      .then(() => markBootReady())
      .catch(error => {
        markBootReady();
        document.documentElement.dataset.bootError = String(error?.stack || error);
        console.error('BR Football failed to initialize', error);
      });
  });
