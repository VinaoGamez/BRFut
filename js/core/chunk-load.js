/** Detecta falha de import dinâmico por cache/build desatualizada. */
export function isStaleChunkLoadError(error) {
  const msg = String(error?.message || error || '').toLowerCase();
  return (
    msg.includes('failed to fetch dynamically imported module')
    || msg.includes('importing a module script failed')
    || msg.includes('error loading dynamically imported module')
    || msg.includes('err_empty_response')
  );
}

let bannerShown = false;

/** Banner fixo pedindo hard refresh quando chunks do Vite não batem. */
export function showStaleChunkBanner() {
  if (bannerShown || typeof document === 'undefined') return;
  bannerShown = true;
  if (document.getElementById('chunkStaleBanner')) return;

  const banner = document.createElement('div');
  banner.id = 'chunkStaleBanner';
  banner.setAttribute('role', 'alert');
  banner.style.cssText =
    'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:100001;' +
    'max-width:min(92vw,520px);padding:14px 18px;background:#1a2a30;border:1px solid #14d5f3;' +
    'color:#e8f4f5;font:500 13px "DM Sans",system-ui,sans-serif;border-radius:8px;' +
    'box-shadow:0 8px 32px rgba(0,0,0,.45);line-height:1.45;text-align:center;';
  banner.innerHTML =
    '<strong>Build desatualizada no navegador.</strong> ' +
    'Pressione <kbd style="padding:2px 6px;border:1px solid #4a6a72;border-radius:4px;background:#0d181c">Ctrl+Shift+R</kbd> ' +
    '(Mac: <kbd style="padding:2px 6px;border:1px solid #4a6a72;border-radius:4px;background:#0d181c">Cmd+Shift+R</kbd>) ' +
    'para recarregar os arquivos do jogo.';
  document.body.appendChild(banner);
}

export function registerChunkLoadRecovery() {
  if (typeof window === 'undefined') return;
  window.addEventListener('unhandledrejection', event => {
    if (!isStaleChunkLoadError(event.reason)) return;
    event.preventDefault();
    showStaleChunkBanner();
  });
}
