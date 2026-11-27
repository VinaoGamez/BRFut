/** Sessão web: cookie HttpOnly na API + indicador não secreto no navegador. */
import { storage as brfutStorage } from './storage-backend.js';
export const LEGACY_AUTH_TOKEN_KEY = 'brfut-auth-token';
export const AUTH_SESSION_HINT_KEY = 'brfut-auth-session';
export const AUTH_REMEMBER_KEY = 'brfut-auth-remember';
export const COOKIE_SESSION_MARKER = 'cookie-session';

export function legacyAuthToken() {
  try {
    return brfutStorage.getItem(LEGACY_AUTH_TOKEN_KEY)
      || sessionStorage.getItem(LEGACY_AUTH_TOKEN_KEY)
      || '';
  } catch {
    return '';
  }
}

export function authSessionSignal() {
  const legacy = legacyAuthToken();
  if (legacy) return legacy;
  try {
    return brfutStorage.getItem(AUTH_SESSION_HINT_KEY) === '1'
      || sessionStorage.getItem(AUTH_SESSION_HINT_KEY) === '1'
      ? COOKIE_SESSION_MARKER
      : '';
  } catch {
    return '';
  }
}

export function persistAuthSessionHint({ remember = false } = {}) {
  try {
    brfutStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
    sessionStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
    brfutStorage.removeItem(AUTH_SESSION_HINT_KEY);
    sessionStorage.removeItem(AUTH_SESSION_HINT_KEY);
    if (remember) {
      brfutStorage.setItem(AUTH_SESSION_HINT_KEY, '1');
      brfutStorage.setItem(AUTH_REMEMBER_KEY, '1');
    } else {
      sessionStorage.setItem(AUTH_SESSION_HINT_KEY, '1');
      brfutStorage.removeItem(AUTH_REMEMBER_KEY);
    }
  } catch {
    /* best effort */
  }
}

/** Compatibilidade temporária enquanto a API antiga ainda responde Bearer. */
export function persistLegacyAuthToken(token, { remember = false } = {}) {
  if (!token) return false;
  try {
    brfutStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
    sessionStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
    if (remember) {
      brfutStorage.setItem(LEGACY_AUTH_TOKEN_KEY, token);
      brfutStorage.setItem(AUTH_REMEMBER_KEY, '1');
    } else {
      sessionStorage.setItem(LEGACY_AUTH_TOKEN_KEY, token);
      brfutStorage.removeItem(AUTH_REMEMBER_KEY);
    }
    return true;
  } catch {
    return false;
  }
}

export function clearBrowserAuthSession() {
  try {
    brfutStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
    sessionStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
    brfutStorage.removeItem(AUTH_SESSION_HINT_KEY);
    sessionStorage.removeItem(AUTH_SESSION_HINT_KEY);
    brfutStorage.removeItem(AUTH_REMEMBER_KEY);
  } catch {
    /* best effort */
  }
}

export function authenticatedFetchOptions(options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const headers = { ...(options.headers || {}) };
  const legacy = legacyAuthToken();
  if (legacy) headers.Authorization = `Bearer ${legacy}`;
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) headers['X-BRFut-Request'] = '1';
  return { ...options, headers, credentials: 'include' };
}
