import './security/https-upgrade.js';
import './security/tester-hardening.js';
import '../css/release-notes-viewer.css';
import '../css/live-volume.css';
import { AUTH_REQUIRED, BUILD_VERSION, FEATURES, SITE_MAINTENANCE } from './core/constants.js';
import { registerChunkLoadRecovery } from './core/chunk-load.js';
import { createEventBus } from './core/event-bus.js';
import { bootEngine } from './legacy/engine.js';
import { markBootReady } from './ui/boot-gate.js';
import { showUpdateAlertIfNeeded } from './ui/update-alert.js';
import {
  endBrowserSession,
  getAuthToken,
  probeBackend,
  validateAuthenticatedSession,
} from './core/storage-api.js';
import {
  clearSessionCareerData,
  consumeCareerReloadPending,
  hasLocalCareerSave,
  markCareerReloadPending,
  markFreshCareerBoot,
  markSkipSessionEndOnce,
  purgeAllCareerStorage,
  shouldPreserveAuthOnPageHide,
} from './core/save.js';
import {
  prepareGameSession,
  runCareerBootMigration,
  hasPersistedCareer,
} from './core/career-activate.js';
import { ensureSlotPlayable } from './core/career-storage-health.js';
import { ensureAccountModals } from './feature/account/inject-modals.js';
import { mountAccountPanel } from './feature/account/index.js';
import { mountSupportProject } from './feature/support-project/index.js';
import '../css/support-project.css';

/** Ponto de entrada modular — Alpha 02 */
if (SITE_MAINTENANCE.enabled) {
  purgeAllCareerStorage();
  endBrowserSession();
  document.documentElement.dataset.build = BUILD_VERSION;
  document.documentElement.dataset.maintenance = '1';
  markBootReady();
  location.replace('home.html');
} else {
  runCareerBootMigration();
  document.documentElement.dataset.build = BUILD_VERSION;
  registerChunkLoadRecovery();
  void showUpdateAlertIfNeeded(BUILD_VERSION);

  if (!FEATURES.transfers) {
    document.querySelector('.nav[data-view="transfers"]')?.classList.add('hidden');
    document.querySelector('#transfers')?.setAttribute('hidden', '');
  }

  const bus = createEventBus();

  ensureAccountModals();
  mountSupportProject();

  let syncCareerWelcomeAuth = null;
  let openCareerCreatorRef = null;
  let bootStarted = false;

  const hasCareerSave = () => hasPersistedCareer();

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
        console.error('BR Fut failed to initialize', error);
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
      await prepareGameSession({ skipProbe: true });
      await account.refresh();
      startBootOnce();
    },
  });

  const beginAppSession = async () => {
    try {
      await probeBackend();

      const params = new URLSearchParams(location.search);
      const slotParam = params.get('slot');
      const isNewCareerBoot = params.has('novo');
      if (isNewCareerBoot) markFreshCareerBoot();

      const token = getAuthToken();

      if (AUTH_REQUIRED) {
        if (!token) {
          redirectToHomeLanding();
          return;
        }
        const auth = await validateAuthenticatedSession();
        if (!auth.authenticated) {
          console.warn('[brfut] boot bloqueado: sessão não confirmada', auth.reason);
          redirectToHomeLanding();
          return;
        }
      }

      if (!token) {
        const reloadPending = consumeCareerReloadPending();
        if (!reloadPending && !hasLocalCareerSave() && !isNewCareerBoot) clearSessionCareerData();
        if (!hasLocalCareerSave() && !isNewCareerBoot) {
          redirectToHomeLanding();
          return;
        }
        const gameSession = await prepareGameSession({
          skipProbe: true,
          slotId: slotParam || null,
          allowSeedFromActive: !isNewCareerBoot,
        });
        if (!isNewCareerBoot) {
          const bootSlotId = slotParam || gameSession.slotId;
          const slotCheck = bootSlotId ? ensureSlotPlayable(bootSlotId) : { ok: hasLocalCareerSave() };
          if (!slotCheck.ok) {
            console.warn('[brfut] save local sem payload de carreira', slotCheck.reason, slotCheck.scan);
            redirectToHomeLanding();
            return;
          }
        }
        await account.refresh();
        startBootOnce();
        return;
      }

      consumeCareerReloadPending();
      const gameSession = await prepareGameSession({
        slotId: slotParam || null,
        allowSeedFromActive: !isNewCareerBoot,
      });
      if (!isNewCareerBoot) {
        const bootSlotId = slotParam || gameSession.slotId;
        const slotCheck = bootSlotId ? ensureSlotPlayable(bootSlotId) : { ok: hasLocalCareerSave() };
        if (!slotCheck.ok) {
          console.warn('[brfut] save local sem payload de carreira', slotCheck.reason, slotCheck.scan);
          redirectToHomeLanding();
          return;
        }
      }

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
    if (shouldPreserveAuthOnPageHide()) return;
    if (bootStarted) return;
    endBrowserSession();
    clearSessionCareerData();
  });
}
