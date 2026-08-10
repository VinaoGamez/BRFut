import {
  AUTH_SESSION_HINT_KEY,
  LEGACY_AUTH_TOKEN_KEY,
  authSessionSignal,
  authenticatedFetchOptions,
  clearBrowserAuthSession,
  persistAuthSessionHint,
  persistLegacyAuthToken,
} from '../js/core/auth-session.js';

class MemoryStorage {
  constructor() { this.data = new Map(); }
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
}

globalThis.localStorage = new MemoryStorage();
globalThis.sessionStorage = new MemoryStorage();

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

persistAuthSessionHint({ remember: true });
assert(localStorage.getItem(AUTH_SESSION_HINT_KEY) === '1', 'indicador persistente ausente');
assert(!localStorage.getItem(LEGACY_AUTH_TOKEN_KEY), 'indicador não pode conter token');
assert(authSessionSignal() === 'cookie-session', 'sessão cookie não sinalizada');

const put = authenticatedFetchOptions({ method: 'PUT', headers: { 'Content-Type': 'application/json' } });
assert(put.credentials === 'include', 'cookie não será enviado');
assert(put.headers['X-BRFut-Request'] === '1', 'proteção CSRF ausente');
assert(!put.headers.Authorization, 'sessão cookie não deve criar Bearer falso');

persistLegacyAuthToken('legacy-token-for-migration', { remember: false });
const legacy = authenticatedFetchOptions({ method: 'GET' });
assert(legacy.headers.Authorization === 'Bearer legacy-token-for-migration', 'migração Bearer quebrada');

clearBrowserAuthSession();
assert(!authSessionSignal(), 'logout não limpou indicador e token legado');

console.log('✓ cookie HttpOnly, indicador não secreto, CSRF e migração Bearer validados');
