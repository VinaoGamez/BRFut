import './security/https-upgrade.js';
import './security/tester-hardening.js';
import { BUILD_VERSION, SAVE_KEYS, BRFUT_API_ORIGIN } from './core/constants.js';
import { SPONSOR_EXTERNAL_LINKS } from './core/sponsor-links.js';
import { showUpdateAlertIfNeeded } from './ui/update-alert.js';
import { createTesterHubFeature } from './feature/tester-hub/index.js';
import { fetchPlayerStats, probeBackend } from './core/storage-api.js';
import { ensureAccountModals } from './feature/account/inject-modals.js';
import { mountAccountPanel } from './feature/account/index.js';
import { endBrowserSession } from './core/storage-api.js';
import { clearSessionCareerData, markSkipSessionEndOnce, consumeSkipSessionEndOnce } from './core/save.js';

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

(() => {
  ensureAccountModals();
  showUpdateAlertIfNeeded(BUILD_VERSION);
  const $ = selector => document.querySelector(selector);

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

  const updateEl = $('#lastUpdate');
  if (updateEl) {
    const buildMeta = document.querySelector('meta[name="build-time"]');
    const stamp = buildMeta?.content || new Date().toISOString();
    updateEl.textContent = `Última atualização: ${formatUpdateTime(stamp)}`;
  }

  const buildEl = $('#homeBuildVersion');
  if (buildEl) buildEl.textContent = BUILD_VERSION;

  const hasCareer = () => {
    try {
      return !!localStorage.getItem(SAVE_KEYS.career);
    } catch {
      return false;
    }
  };

  const continueBtn = $('#continueBtn');
  const newGameBtn = $('#newGameBtn');
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
    } else {
      loginBtn?.classList.add('hidden');
      newGameBtn?.classList.remove('hidden');
    }
    syncStorageHint({ loggedIn, hasBackend: wantsLogin && hasBackend });
  };

  const account = mountAccountPanel({
    modal: document.getElementById('accountModal'),
    hasCareer,
    onAuthChange: syncHeroActions,
    onContinueVisible: visible => continueBtn?.classList.toggle('hidden', !visible),
    onCareerHint: text => {
      if (!careerHint) return;
      if (!text) {
        careerHint.textContent = '';
        careerHint.classList.add('hidden');
        return;
      }
      careerHint.textContent = text;
      careerHint.classList.remove('hidden');
    },
  });

  account.refresh().then(state => {
    syncHeroActions({
      loggedIn: state.mode === 'cloud',
      hasBackend: !!state.backend || state.mode === 'cloud',
    });
    if (state.backend || state.mode === 'cloud') startPlayerStatsPolling();
  });

  loginBtn?.addEventListener('click', () => account.openLogin());

  newGameBtn?.addEventListener('click', () => markSkipSessionEndOnce());
  continueBtn?.addEventListener('click', () => markSkipSessionEndOnce());

  const initSponsorRail = () => {
    const track = $('#homeSponsorsTrack');
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

    // Duplica a lista para loop contínuo sem salto.
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
  };

  initSponsorRail();

  const testerHub = createTesterHubFeature();
  document.getElementById('openTesterGuide')?.addEventListener('click', () => testerHub.openGuide());
  document.getElementById('openTesterFeedback')?.addEventListener('click', () => testerHub.openFeedback());

  window.addEventListener('beforeunload', () => {
    if (hasCareer()) markSkipSessionEndOnce();
  });

  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    // Hard refresh nem sempre dispara beforeunload — preservar sessão se há save local.
    if (hasCareer()) markSkipSessionEndOnce();
    if (consumeSkipSessionEndOnce()) return;
    endBrowserSession();
    clearSessionCareerData();
  });
})();
