/**
 * Smoke test — ordem de boot/migração (sem DOM).
 * Uso: node scripts/boot-order-tests.mjs
 */
import { SAVE_KEYS, CAREER_INDEX_KEY } from '../js/core/constants.js';

const store = new Map();
globalThis.localStorage = {
  getItem: key => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: key => store.delete(key),
  key: i => [...store.keys()][i] ?? null,
  get length() {
    return store.size;
  },
};
globalThis.sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
globalThis.window = globalThis;

let passed = 0;
let failed = 0;

const check = (label, fn) => {
  try {
    fn();
    passed += 1;
    console.log(`✓ ${label}`);
  } catch (error) {
    failed += 1;
    console.error(`✗ ${label}`);
    console.error(`  ${error.message}`);
  }
};

const assert = (cond, msg) => {
  if (!cond) throw new Error(msg || 'fail');
};

const { runCareerBootMigration, hasPersistedCareer } = await import('../js/core/career-activate.js');
const { migrateLegacyStorageKeys } = await import('../js/core/save.js');

const { resetStorageBackendState } = await import('../js/core/storage-api.js');
const { resetCareerBootMigrationState } = await import('../js/core/career-activate.js');

function resetAll() {
  store.clear();
  resetStorageBackendState();
  resetCareerBootMigrationState();
}

check('runCareerBootMigration é idempotente', () => {
  resetAll();
  localStorage.setItem('matchday-new-game', JSON.stringify({ clubName: 'Legacy' }));
  runCareerBootMigration();
  runCareerBootMigration();
  assert(localStorage.getItem(SAVE_KEYS.career));
  const career = JSON.parse(localStorage.getItem(SAVE_KEYS.career));
  assert(career.clubName === 'Legacy');
});

check('hasPersistedCareer detecta índice sem chave ativa', () => {
  resetAll();
  localStorage.setItem(
    CAREER_INDEX_KEY,
    JSON.stringify({ version: 1, slots: [{ id: 'abc', name: 'Test' }], activeSlotId: 'abc' }),
  );
  assert(hasPersistedCareer());
  assert(!localStorage.getItem(SAVE_KEYS.career));
});

check('migrateLegacyStorageKeys migra session flags', () => {
  store.clear();
  sessionStorage.setItem = (k, v) => store.set(`s:${k}`, v);
  sessionStorage.getItem = k => store.get(`s:${k}`) ?? null;
  store.set('s:matchday-career-reload', '1');
  migrateLegacyStorageKeys();
  assert(store.get('s:brfut-career-reload') === '1');
});

console.log(`\nboot-order-tests: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
