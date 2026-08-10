/** Sessão web: cookie HttpOnly na API + indicador não secreto no navegador. */
export const LEGACY_AUTH_TOKEN_KEY = 'brfut-auth-token';
export const AUTH_SESSION_HINT_KEY = 'brfut-auth-session';
export const AUTH_REMEMBER_KEY = 'brfut-auth-remember';
export const COOKIE_SESSION_MARKER = 'cookie-session';

export function legacyAuthToken() {
  try {
    return localStorage.getItem(LEGACY_AUTH_TOKEN_KEY)
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
    return localStorage.getItem(AUTH_SESSION_HINT_KEY) === '1'
      || sessionStorage.getItem(AUTH_SESSION_HINT_KEY) === '1'
      ? COOKIE_SESSION_MARKER
      : '';
  } catch {
    return '';
  }
}

export function persistAuthSessionHint({ remember = false } = {}) {
  try {
    localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
    sessionStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_SESSION_HINT_KEY);
    sessionStorage.removeItem(AUTH_SESSION_HINT_KEY);
    if (remember) {
      localStorage.setItem(AUTH_SESSION_HINT_KEY, '1');
      localStorage.setItem(AUTH_REMEMBER_KEY, '1');
    } else {
      sessionStorage.setItem(AUTH_SESSION_HINT_KEY, '1');
      localStorage.removeItem(AUTH_REMEMBER_KEY);
    }
  } catch {
    /* best effort */
  }
}

/** Compatibilidade temporária enquanto a API antiga ainda responde Bearer. */
export function persistLegacyAuthToken(token, { remember = false } = {}) {
  if (!token) return false;
  try {
    localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
    sessionStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
    if (remember) {
      localStorage.setItem(LEGACY_AUTH_TOKEN_KEY, token);
      localStorage.setItem(AUTH_REMEMBER_KEY, '1');
    } else {
      sessionStorage.setItem(LEGACY_AUTH_TOKEN_KEY, token);
      localStorage.removeItem(AUTH_REMEMBER_KEY);
    }
    return true;
  } catch {
    return false;
  }
}

export function clearBrowserAuthSession() {
  try {
    localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
    sessionStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_SESSION_HINT_KEY);
    sessionStorage.removeItem(AUTH_SESSION_HINT_KEY);
    localStorage.removeItem(AUTH_REMEMBER_KEY);
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
