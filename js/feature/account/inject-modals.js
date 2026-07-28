import '../../../css/account-modal.css';
import { ACCOUNT_MODALS_HTML } from './modals-html.js';

/** Injeta modais de conta uma vez por página (home / index). */
export function injectAccountModals() {
  if (document.getElementById('accountGoogleBtn')) return;
  document.getElementById('accountModal')?.remove();
  document.getElementById('accountProfileModal')?.remove();
  document.body.insertAdjacentHTML('beforeend', ACCOUNT_MODALS_HTML);
}
