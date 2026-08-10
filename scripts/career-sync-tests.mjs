/**
 * Testes do pipeline activateSlot + merge de bundle.
 * Uso: node scripts/career-sync-tests.mjs
 */
import {
  SAVE_KEYS,
  CAREER_INDEX_KEY,
  slotBundleKeys,
} from '../js/core/constants.js';

const store = new Map();

globalThis.localStorage = {
  getItem: key => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: key => store.delete(key),
  key: i => [...store.keys()][i] ?? null,
  get length() {
    return store.size;
  },
  clear: () => store.clear(),
};

globalThis.sessionStorage = {
  getItem: key => null,
  setItem: () => {},
  removeItem: () => {},
};

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

const assert = (cond, message) => {
  if (!cond) throw new Error(message || 'assertion failed');
};

const {
  activateSlot,
  prepareGameSession,
  runCareerBootMigration,
} = await import('../js/core/career-activate.js');

const {
  createNewSlot,
  syncActiveSlotFromCache,
  readCareerIndex,
  setActiveSlotId,
} = await import('../js/core/career-slot-manager.js');

const { canonicalSaveKey, normalizeRemoteSaveKeys } = await import('../js/core/save-key-normalizer.js');

const { clearCareerData } = await import('../js/core/save-clear.js');

const checkAsync = async (label, fn) => {
  try {
    await fn();
    passed += 1;
    console.log(`✓ ${label}`);
  } catch (error) {
    failed += 1;
    console.error(`✗ ${label}`);
    console.error(`  ${error.message}`);
  }
};

check('canonicalSaveKey migra matchday-career → brfut-career', () => {
  assert(canonicalSaveKey('matchday-season') === SAVE_KEYS.season);
  assert(canonicalSaveKey('brfut-career') === SAVE_KEYS.career);
});

check('normalizeRemoteSaveKeys promove legado', () => {
  const out = normalizeRemoteSaveKeys({
    'matchday-new-game': { value: { clubName: 'Test' } },
  });
  assert(out[SAVE_KEYS.career]?.value?.clubName === 'Test');
});

const { resetStorageBackendState } = await import('../js/core/storage-api.js');
const { resetCareerBootMigrationState } = await import('../js/core/career-activate.js');

function resetAll() {
  store.clear();
  resetStorageBackendState();
  resetCareerBootMigrationState();
}

await checkAsync('activateSlot copia bundle → chaves ativas', async () => {
  resetAll();
  runCareerBootMigration();
  const slotId = createNewSlot();
  localStorage.setItem(SAVE_KEYS.career, JSON.stringify({ clubName: 'Bundle FC', division: 'B' }));
  syncActiveSlotFromCache();
  localStorage.removeItem(SAVE_KEYS.career);
  await activateSlot(slotId, { skipProbe: true });
  const active = JSON.parse(localStorage.getItem(SAVE_KEYS.career) || 'null');
  assert(active?.clubName === 'Bundle FC');
});

await checkAsync('activateSlot flush slot anterior ao trocar', async () => {
  resetAll();
  runCareerBootMigration();
  const slotA = createNewSlot();
  localStorage.setItem(SAVE_KEYS.career, JSON.stringify({ clubName: 'Slot A' }));
  syncActiveSlotFromCache();
  const slotB = createNewSlot();
  localStorage.setItem(SAVE_KEYS.career, JSON.stringify({ clubName: 'Slot B saved' }));
  syncActiveSlotFromCache();
  setActiveSlotId(slotA);
  localStorage.setItem(SAVE_KEYS.career, JSON.stringify({ clubName: 'Slot A active' }));
  await activateSlot(slotB, { skipProbe: true });
  const bundleA = slotBundleKeys(slotA);
  const savedA = JSON.parse(localStorage.getItem(bundleA.career) || 'null');
  assert(savedA?.clubName === 'Slot A active');
  const active = JSON.parse(localStorage.getItem(SAVE_KEYS.career) || 'null');
  assert(active?.clubName === 'Slot B saved');
});

await checkAsync('prepareGameSession restaura slot ativo sem expor id na URL', async () => {
  resetAll();
  runCareerBootMigration();
  const slotId = createNewSlot();
  const bundle = slotBundleKeys(slotId);
  localStorage.setItem(bundle.career, JSON.stringify({ clubName: 'Hidden Slot FC', division: 'C' }));
  localStorage.removeItem(SAVE_KEYS.career);
  const session = await prepareGameSession({ skipProbe: true });
  const active = JSON.parse(localStorage.getItem(SAVE_KEYS.career) || 'null');
  assert(session.slotId === slotId, 'slot ativo não foi resolvido');
  assert(active?.clubName === 'Hidden Slot FC', 'bundle do slot não foi reidratado');
});

await checkAsync('clearCareerData session não apaga índice', async () => {
  resetAll();
  runCareerBootMigration();
  createNewSlot();
  assert(readCareerIndex().slots.length === 1);
  localStorage.setItem(SAVE_KEYS.career, JSON.stringify({ clubName: 'X' }));
  await clearCareerData('session');
  assert(!localStorage.getItem(SAVE_KEYS.career));
  assert(readCareerIndex().slots.length === 1);
});

console.log(`\ncareer-sync-tests: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
