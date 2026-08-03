const DISCORD_URL = 'https://discord.gg/m86rEBstEE';

const MODAL_HTML = `
  <div id="supportProjectModal" class="modal hidden support-project-modal" role="dialog" aria-modal="true" aria-labelledby="supportProjectTitle">
    <div class="modal-card support-project-card">
      <button id="closeSupportProject" class="close" type="button" aria-label="Fechar">×</button>
      <header class="support-project-heading">
        <h2 id="supportProjectTitle">APOIE O PROJETO - ENTRE EM NOSSA COMUNIDADE</h2>
      </header>
      <div class="support-project-options">
        <section class="support-project-pix">
          <span>CONTRIBUA VIA PIX</span>
          <img src="./brand/support-qrcode.png" alt="QR Code PIX para apoiar o BR Fut" width="240" height="240">
          <small>APONTE A CÂMERA DO CELULAR</small>
        </section>
        <a class="support-project-discord" href="${DISCORD_URL}" target="_blank" rel="noopener noreferrer" aria-label="Entrar na comunidade BR Fut no Discord">
          <svg viewBox="0 0 127.14 96.36" role="img" aria-hidden="true"><path fill="currentColor" d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0a105.89 105.89 0 0 0-26.25 8.09C2.79 32.65-1.71 56.6.54 80.21a105.73 105.73 0 0 0 32.17 16.15 77.7 77.7 0 0 0 6.89-9.39 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2a68.68 68.68 0 0 1-10.87 5.19 77.29 77.29 0 0 0 6.89 9.38 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15ZM42.45 65.69c-6.27 0-11.41-5.74-11.41-12.8s5-12.81 11.41-12.81 11.52 5.74 11.41 12.81-5.05 12.8-11.41 12.8Zm42.24 0c-6.27 0-11.41-5.74-11.41-12.8s5-12.81 11.41-12.81 11.52 5.74 11.41 12.81-5.04 12.8-11.41 12.8Z"/></svg>
          <small>ENTRE NA COMUNIDADE</small>
          <strong>DISCORD</strong>
          <span>ACESSAR SERVIDOR</span>
        </a>
      </div>
    </div>
  </div>`;

export function mountSupportProject() {
  if (!document.getElementById('supportProjectModal')) document.body.insertAdjacentHTML('beforeend', MODAL_HTML);
  const modal = document.getElementById('supportProjectModal');
  const close = () => modal?.classList.add('hidden');
  document.getElementById('openSupportProject')?.addEventListener('click', () => modal?.classList.remove('hidden'));
  document.getElementById('closeSupportProject')?.addEventListener('click', close);
  modal?.addEventListener('click', event => { if (event.target === modal) close(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !modal?.classList.contains('hidden')) close(); });
}
