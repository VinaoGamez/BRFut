/**
 * Regressão do controlador de sincronização:
 * - uploads em série;
 * - 429 entra em backoff sem tempestade;
 * - evento online recupera a fila sem abrir Opções.
 */
import { SAVE_KEYS } from '../js/core/constants.js';

const local = new Map();
const session = new Map();
const storage = map => ({
  getItem: key => map.get(key) ?? null,
  setItem: (key, value) => map.set(key, String(value)),
  removeItem: key => map.delete(key),
  key: index => [...map.keys()][index] ?? null,
  get length() {
    return map.size;
  },
});

globalThis.localStorage = storage(local);
globalThis.sessionStorage = storage(session);
globalThis.window = globalThis;
globalThis.location = { hostname: 'brfut.com.br', origin: 'https://brfut.com.br' };

const listeners = new Map();
globalThis.addEventListener = (name, fn) => listeners.set(name, fn);
globalThis.document = {
  visibilityState: 'visible',
  addEventListener: (name, fn) => listeners.set(`document:${name}`, fn),
};
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: { onLine: true },
});

let putMode = 'success';
let activePuts = 0;
let maxActivePuts = 0;
let putCalls = 0;

const jsonResponse = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

globalThis.fetch = async (url, options = {}) => {
  const path = new URL(url).pathname;
  if (path === '/api/auth/login') {
    return jsonResponse({ token: 'test-token', user: { id: 'u1', username: 'tester' } });
  }
  if (path === '/api/auth/me') {
    return jsonResponse({ user: { id: 'u1', username: 'tester' } });
  }
  if (path === '/api/saves' && (!options.method || options.method === 'GET')) {
    return jsonResponse({ saves: {} });
  }
  if (path.startsWith('/api/saves/') && options.method === 'PUT') {
    putCalls += 1;
    activePuts += 1;
    maxActivePuts = Math.max(maxActivePuts, activePuts);
    await new Promise(resolve => setTimeout(resolve, 25));
    activePuts -= 1;
    if (putMode === 'rate-limit') {
      return jsonResponse({ code: 'rate_limited', error: 'Too Many Requests' }, 429, {
        'Retry-After': '2',
      });
    }
    return jsonResponse({ ok: true });
  }
  return jsonResponse({ ok: true });
};

const {
  getSaveSyncStatus,
  loginAccount,
  queueCloudSave,
  stopPresenceHeartbeat,
} = await import('../js/core/storage-api.js');

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

await loginAccount('tester', 'secret', { remember: true });
queueCloudSave(SAVE_KEYS.career, { saveRevision: 1, clubName: 'A' });
queueCloudSave(SAVE_KEYS.season, { saveRevision: 1, currentRound: 1 });
queueCloudSave(SAVE_KEYS.playerHistory, { saveRevision: 1, players: {} });
await wait(700);

assert(putCalls === 3, `esperava 3 uploads, recebeu ${putCalls}`);
assert(maxActivePuts === 1, `uploads concorrentes detectados: ${maxActivePuts}`);
console.log('✓ fila envia uploads sequencialmente');

putMode = 'rate-limit';
queueCloudSave(SAVE_KEYS.training, { saveRevision: 2 });
await wait(700);
const callsAfterRateLimit = putCalls;
await wait(700);
assert(putCalls === callsAfterRateLimit, '429 gerou retentativa imediata');
assert(getSaveSyncStatus().authState === 'rate_limited', 'estado 429 não foi exposto');
console.log('✓ 429 aplica backoff e informa limite');

putMode = 'success';
listeners.get('online')?.();
await wait(250);
assert(getSaveSyncStatus().pendingKeys.length === 0, 'evento online não esvaziou a fila');
console.log('✓ retorno online recupera pendências automaticamente');

stopPresenceHeartbeat();
console.log('save-sync-controller-tests: 3 passed, 0 failed');
process.exit(0);
