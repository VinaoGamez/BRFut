import './security/https-upgrade.js';
import './security/tester-hardening.js';
import { BUILD_VERSION, SAVE_KEYS, BRFUT_API_ORIGIN, SITE_MAINTENANCE } from './core/constants.js';
import { SPONSOR_EXTERNAL_LINKS } from './core/sponsor-links.js';
import { showUpdateAlertIfNeeded } from './ui/update-alert.js';
import { createTesterHubFeature } from './feature/tester-hub/index.js';
import { fetchPlayerStats, probeBackend } from './core/storage-api.js';
import { ensureAccountModals } from './feature/account/inject-modals.js';
import { mountAccountPanel } from './feature/account/index.js';
import { endBrowserSession } from './core/storage-api.js';
import {
  clearSessionCareerData,
  consumeSkipSessionEndOnce,
  hasLocalCareerSave,
  markCareerReloadPending,
  markSkipSessionEndOnce,
  migrateLegacyStorageKeys,
  purgeAllCareerStorage,
} from './core/save.js';
import {
  migrateLegacySingleSaveToSlots,
  setActiveSlotId,
  hydrateSlot,
} from './core/career-slot-manager.js';
import { mountCareerSlotsUi, lastSaveHintText } from './feature/career-slots/index.js';
import { hydrateSlotBundleFromCloud, initStorageBackend } from './core/storage-api.js';

function renderMaintenanceShell() {
  document.body.classList.add('home-maintenance-mode');
  document.title = 'BR Fut · Manutenção';
  applyHomeMeta();
  const banner = document.getElementById('homeMaintenanceMsg');
  if (banner) {
    banner.textContent = SITE_MAINTENANCE.message;
    banner.hidden = false;
  }
  initSponsorRail();
}

const SPONSOR_LOGO_URLS = Object.fromEntries(
  Object.entries(
    import.meta.glob('../assets/sponsors/icons/*.png', {
      eager: true,
      query: '?url',
      import: 'default',
    }),
  ).map(([path, url]) => {
    const file = path.split('/').pop()?.replace(/\.png$/i, '') || '';
    return [file, url];
  }),
);

const SPONSOR_ORDER = [
  'tekno-cursos',
  'nubanco',
  'petrobraz',
  'magazine-luizao',
  'ifome',
  'betregional',
  'picpaga',
  'sheinpee',
  'amazonia-com',
  'googol',
  'metagol',
  'starbox-coffee',
  'havaianinhas',
  'naike',
  'pumba-sport',
  'perdigol',
  'poweraid',
  'playstacao',
  'fedexpressao',
];

const formatUpdateTime = value => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
};

function applyHomeMeta() {
  const updateEl = document.getElementById('lastUpdate');
  if (updateEl) {
    const buildMeta = document.querySelector('meta[name="build-time"]');
    const stamp = buildMeta?.content || new Date().toISOString();
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
    slug,
    url: SPONSOR_LOGO_URLS[slug],
    href: SPONSOR_EXTERNAL_LINKS[slug] || '',
    label: slug.replace(/-/g, ' '),
  })).filter(item => item.url);

  if (!logos.length) return;

  const slotMarkup = item => {
    const img = `<img src="${item.url}" alt="${item.label}" width="72" height="72" decoding="async">`;
    if (item.href) {
      return `<a class="home-sponsor-slot" href="${item.href}" target="_blank" rel="noopener noreferrer" title="${item.label}" aria-label="Abrir site de ${item.label}">${img}</a>`;
    }
    return `<span class="home-sponsor-slot" title="${item.label}">${img}</span>`;
  };

  const sequence = [...logos, ...logos];
  track.innerHTML = sequence.map(slotMarkup).join('');

  const gap = 10;
  const visible = 4;
  let index = 0;
  let slotSize = 0;
  let timer = 0;

  const measure = () => {
    const width = viewport.clientWidth;
    slotSize = (width - gap * (visible - 1)) / visible;
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
    if (index >= logos.length) {
      window.setTimeout(() => {
        track.classList.add('is-resetting');
        index = 0;
        track.style.transform = 'translate3d(0,0,0)';
      }, 560);
    }
  };

  measure();
  window.addEventListener('resize', measure);
  timer = window.setInterval(step, 2800);

  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) {
        window.clearInterval(timer);
        timer = 0;
      } else if (!timer) {
        timer = window.setInterval(step, 2800);
      }
    },
    { passive: true },
  );
}

if (SITE_MAINTENANCE.enabled) {
  purgeAllCareerStorage();
  endBrowserSession();
  renderMaintenanceShell();
} else {
  migrateLegacyStorageKeys();
  migrateLegacySingleSaveToSlots();
}

(() => {
  if (SITE_MAINTENANCE.enabled) return;

  ensureAccountModals();
  showUpdateAlertIfNeeded(BUILD_VERSION);
  const $ = selector => document.querySelector(selector);

  applyHomeMeta();

  const hasCareer = () => {
    try {
      return !!localStorage.getItem(SAVE_KEYS.career) || careerSlots.hasAnySlot();
    } catch {
      return false;
    }
  };

  const goToGame = ({ slotId, novo = false } = {}) => {
    const url = new URL('index.html', location.href);
    if (slotId) url.searchParams.set('slot', slotId);
    if (novo) url.searchParams.set('novo', '1');
    markSkipSessionEndOnce();
    location.href = `${url.pathname}${url.search}`;
  };

  const careerSlots = mountCareerSlotsUi({
    onSlotsChanged: () => syncCareerActions(),
    onStartSlot: slotId => goToGame({ slotId }),
    onNewCareer: slotId => goToGame({ slotId, novo: true }),
  });

  const syncCareerActions = ({ loggedIn = null, hasBackend = null } = {}) => {
    const last = careerSlots.getLastPlayedSlot();
    const hasSlot = careerSlots.hasAnySlot();
    const requiresLogin = hasBackend === true;
    const showCareer = hasSlot && (!requiresLogin || loggedIn === true);

    continueBtn?.classList.toggle('hidden', !showCareer || !last);
    loadCareerBtn?.classList.toggle('hidden', !showCareer && requiresLogin);
    if (requiresLogin) {
      loadCareerBtn?.classList.toggle('hidden', !loggedIn);
    }

    if (continueBtn && last) {
      continueBtn.href = `index.html?slot=${encodeURIComponent(last.id)}`;
    }
    if (lastSaveHint) {
      if (last && showCareer) {
        lastSaveHint.textContent = lastSaveHintText(last);
        lastSaveHint.classList.remove('hidden');
      } else {
        lastSaveHint.textContent = '';
        lastSaveHint.classList.add('hidden');
      }
    }
  };

  const continueBtn = $('#continueBtn');
  const newGameBtn = $('#newGameBtn');
  const loadCareerBtn = $('#loadCareerBtn');
  const lastSaveHint = $('#lastSaveHint');
  const loginBtn = $('#loginBtn');
  const careerHint = $('#careerHint');
  const storageHint = $('#homeStorageHint');
  const playerStatsEl = $('#homePlayerStats');
  let playerStatsTimer = 0;

  const renderPlayerStats = stats => {
    if (!playerStatsEl) return;
    if (!stats || typeof stats.registered !== 'number') {
      playerStatsEl.classList.add('hidden');
      playerStatsEl.textContent = '';
      return;
    }
    const online = Number(stats.online) || 0;
    const registered = Number(stats.registered) || 0;
    playerStatsEl.innerHTML =
      `<span class="stat-on">${online} ON</span> · ${registered} cadastrado${registered === 1 ? '' : 's'}`;
    playerStatsEl.classList.remove('hidden');
  };

  const refreshPlayerStats = async () => {
    if (!(await probeBackend())) {
      renderPlayerStats(null);
      return;
    }
    renderPlayerStats(await fetchPlayerStats());
  };

  const startPlayerStatsPolling = () => {
    if (playerStatsTimer || typeof window === 'undefined') return;
    void refreshPlayerStats();
    playerStatsTimer = window.setInterval(refreshPlayerStats, 60_000);
  };

  const syncStorageHint = ({ loggedIn, hasBackend }) => {
    if (!storageHint) return;
    if (loggedIn) {
      storageHint.classList.add('hidden');
      return;
    }
    storageHint.classList.remove('hidden');
    storageHint.textContent = hasBackend
      ? 'Entre para salvar sua carreira'
      : 'Carreira salva neste navegador';
  };

  const syncHeroActions = ({ loggedIn, hasBackend }) => {
    const wantsLogin = hasBackend || !!BRFUT_API_ORIGIN;
    if (wantsLogin) {
      loginBtn?.classList.toggle('hidden', loggedIn);
      newGameBtn?.classList.toggle('hidden', !loggedIn);
      loadCareerBtn?.classList.toggle('hidden', !loggedIn);
    } else {
      loginBtn?.classList.add('hidden');
      newGameBtn?.classList.remove('hidden');
      loadCareerBtn?.classList.remove('hidden');
    }
    syncStorageHint({ loggedIn, hasBackend: wantsLogin && hasBackend });
    syncCareerActions({ loggedIn, hasBackend: wantsLogin && hasBackend });
  };

  const account = mountAccountPanel({
    modal: document.getElementById('accountModal'),
    hasCareer,
    onAuthChange: syncHeroActions,
  });

  account.refresh().then(state => {
    syncHeroActions({
      loggedIn: state.mode === 'cloud',
      hasBackend: !!state.backend || state.mode === 'cloud',
    });
    if (state.backend || state.mode === 'cloud') startPlayerStatsPolling();
    careerSlots.renderList();
  });

  loginBtn?.addEventListener('click', () => account.openLogin());

  newGameBtn?.addEventListener('click', () => void careerSlots.startNewCareer());
  loadCareerBtn?.addEventListener('click', () => careerSlots.openLoadModal());
  continueBtn?.addEventListener('click', async event => {
    event.preventDefault();
    const last = careerSlots.getLastPlayedSlot();
    if (!last) return;
    markSkipSessionEndOnce();
    try {
      await initStorageBackend({ skipProbe: true });
      await hydrateSlotBundleFromCloud(last.id);
    } catch {
      /* local */
    }
    setActiveSlotId(last.id);
    hydrateSlot(last.id);
    goToGame({ slotId: last.id });
  });

  initSponsorRail();

  const testerHub = createTesterHubFeature();
  document.getElementById('openTesterGuide')?.addEventListener('click', () => testerHub.openGuide());
  document.getElementById('openTesterFeedback')?.addEventListener('click', () => testerHub.openFeedback());

  window.addEventListener('beforeunload', () => {
    if (hasCareer()) markSkipSessionEndOnce();
  });

  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    if (hasCareer() || hasLocalCareerSave()) {
      markCareerReloadPending();
      markSkipSessionEndOnce();
      return;
    }
    if (consumeSkipSessionEndOnce()) return;
    endBrowserSession();
    clearSessionCareerData();
  });
})();
