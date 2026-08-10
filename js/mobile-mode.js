(function setupMobileMode() {
  const uaDataMobile = navigator.userAgentData && navigator.userAgentData.mobile === true;
  const mobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(navigator.userAgent || '');
  const touchTablet = navigator.maxTouchPoints > 1 && /Macintosh/i.test(navigator.userAgent || '');
  const localPreview = /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
    && new URLSearchParams(location.search).get('mobile-preview') === '1';
  const isMobileDevice = Boolean(uaDataMobile || mobileUserAgent || touchTablet || localPreview);

  if (!isMobileDevice) return;

  const root = document.documentElement;
  root.classList.add('is-mobile');
  root.dataset.device = 'mobile';

  document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('mobile-mode');
    const shell = document.querySelector('.game-shell');
    const sidebar = document.querySelector('.sidebar');
    const header = document.querySelector('.app-header');
    if (!shell || !sidebar || !header) return;

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'mobile-menu-toggle';
    toggle.setAttribute('aria-label', 'Abrir menu');
    toggle.setAttribute('aria-controls', 'mobileNavigation');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.innerHTML = '<span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span>';

    const backdrop = document.createElement('button');
    backdrop.type = 'button';
    backdrop.className = 'mobile-menu-backdrop';
    backdrop.setAttribute('aria-label', 'Fechar menu');
    sidebar.id = 'mobileNavigation';
    header.prepend(toggle);
    shell.append(backdrop);

    const closeMenu = () => {
      document.body.classList.remove('mobile-menu-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Abrir menu');
    };
    const openMenu = () => {
      document.body.classList.add('mobile-menu-open');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Fechar menu');
    };

    toggle.addEventListener('click', () => {
      if (document.body.classList.contains('mobile-menu-open')) closeMenu();
      else openMenu();
    });
    backdrop.addEventListener('click', closeMenu);
    sidebar.addEventListener('click', event => {
      if (event.target.closest('.nav')) closeMenu();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeMenu();
    });
  });
})();
