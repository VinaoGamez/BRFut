import '../../../css/account-modal.css';
import { ACCOUNT_MODALS_HTML } from './modals-html.js';

/** Garante modais de conta no DOM (home / index). */
export function ensureAccountModals() {
  if (document.getElementById('accountModal')) return;
  document.getElementById('accountGoogleBtn')?.remove();
  document.getElementById('accountProfileModal')?.remove();
  document.body.insertAdjacentHTML('beforeend', ACCOUNT_MODALS_HTML);
}

/** @deprecated Prefer ensureAccountModals */
export function injectAccountModals() {
  ensureAccountModals();
}
