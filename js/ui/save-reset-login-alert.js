import '../../css/save-reset-login-alert.css';

const MODAL_ID = 'saveResetLoginAlert';
const EXPIRES_AT = Date.parse('2026-08-17T00:00:00-04:00');
const MESSAGE = `TODOS OS SAVES ANTERIORES A 10/08 FORAM EXCLUÍDOS AFIM DE EVITAR ERROS.
A EQUIPE BRFUT PEDE DESCULPAS.
APROVEITEM O JOGO E NÃO ESQUEÇA: SEU FEEDBACK É IMPORTANTE!`;

let activePromise = null;

export function isSaveResetLoginAlertActive(now = Date.now()) {
  return Number(now) < EXPIRES_AT;
}

function ensureModal() {
  let modal = document.getElementById(MODAL_ID);
  if (modal) return modal;
  document.body.insertAdjacentHTML('beforeend', `
    <div id="${MODAL_ID}" class="save-reset-login-alert-wrap hidden" role="alertdialog" aria-modal="true" aria-describedby="saveResetLoginAlertMessage">
      <div class="save-reset-login-alert-card">
        <p id="saveResetLoginAlertMessage">${MESSAGE}</p>
        <button id="confirmSaveResetLoginAlert" type="button">OK</button>
      </div>
    </div>
  `);
  modal = document.getElementById(MODAL_ID);
  return modal;
}

/** Exibido após cada autenticação confirmada; expira automaticamente em uma semana. */
export function showSaveResetLoginAlert() {
  if (!isSaveResetLoginAlertActive()) return Promise.resolve(false);
  if (activePromise) return activePromise;

  const modal = ensureModal();
  const button = document.getElementById('confirmSaveResetLoginAlert');
  if (!modal || !button) return Promise.resolve(false);

  activePromise = new Promise(resolve => {
    button.addEventListener('click', () => {
      modal.classList.add('hidden');
      activePromise = null;
      resolve(true);
    }, { once: true });
    modal.classList.remove('hidden');
    window.setTimeout(() => button.focus(), 40);
  });
  return activePromise;
}
