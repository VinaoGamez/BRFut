/**
 * Testes do gerenciador de slots de carreira.
 * Uso: node scripts/career-slot-tests.mjs
 */
import {
  SAVE_KEYS,
  CAREER_INDEX_KEY,
  slotBundleKeys,
  isSlotBundleKey,
  isSyncableSaveKey,
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

const {
  migrateLegacySingleSaveToSlots,
  createNewSlot,
  readCareerIndex,
  hydrateSlot,
  syncActiveSlotFromCache,
  defaultSlotName,
  canCreateSlot,
  getActiveSlotId,
  setActiveSlotId,
  deleteCareerSlot,
} = await import('../js/core/career-slot-manager.js');
const { purgeObsoleteCareerStorage, readJson } = await import('../js/core/save.js');
const { buildCareerLocalCheckpoint } = await import('../js/core/local-save-checkpoint.js');
const { recoverCareerSlotsAfterHydration } = await import('../js/core/career-activate.js');

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

check('isSlotBundleKey accepts brfut-slot keys', () => {
  assert(isSlotBundleKey('brfut-slot-abc-career'));
  assert(!isSlotBundleKey('brfut-career'));
});

check('isSyncableSaveKey includes index and slots', () => {
  assert(isSyncableSaveKey(CAREER_INDEX_KEY));
  assert(isSyncableSaveKey('brfut-slot-x-season'));
  assert(isSyncableSaveKey(SAVE_KEYS.career));
});

check('migrateLegacySingleSaveToSlots creates first slot', () => {
  store.clear();
  localStorage.setItem(SAVE_KEYS.career, JSON.stringify({ version: 7, clubName: 'Santos', division: 'A', season: 2028 }));
  localStorage.setItem(SAVE_KEYS.season, JSON.stringify({ year: 2028, currentRound: 5 }));
  const index = migrateLegacySingleSaveToSlots();
  assert(index.slots.length === 1);
  assert(index.slots[0].clubName === 'Santos');
  assert(index.slots[0].name === defaultSlotName({ clubName: 'Santos' }, { year: 2028 }));
  const bundle = slotBundleKeys(index.slots[0].id);
  assert(localStorage.getItem(bundle.career));
});

check('hydrateSlot copies bundle to active keys', () => {
  store.clear();
  const slotId = createNewSlot();
  localStorage.setItem(SAVE_KEYS.career, JSON.stringify({ version: 7, clubName: 'Test FC', division: 'B' }));
  syncActiveSlotFromCache();
  localStorage.removeItem(SAVE_KEYS.career);
  hydrateSlot(slotId);
  const active = JSON.parse(localStorage.getItem(SAVE_KEYS.career) || 'null');
  assert(active?.clubName === 'Test FC');
});

check('hydrateSlot never overwrites a selected slot with another active career', () => {
  localStorage.clear();
  const firstId = createNewSlot({ name: 'Carreira A' });
  localStorage.setItem(SAVE_KEYS.career, JSON.stringify({ version: 7, clubName: 'Clube A', saveRevision: 99 }));
  localStorage.setItem(SAVE_KEYS.season, JSON.stringify({ year: 2032, currentRound: 30, saveRevision: 99 }));
  syncActiveSlotFromCache({ slotId: firstId });

  const secondId = createNewSlot({ name: 'Carreira B' });
  const secondBundle = slotBundleKeys(secondId);
  localStorage.setItem(secondBundle.career, JSON.stringify({ version: 7, clubName: 'Clube B', saveRevision: 10 }));
  localStorage.setItem(secondBundle.season, JSON.stringify({ year: 2029, currentRound: 8, saveRevision: 10 }));

  setActiveSlotId(firstId);
  hydrateSlot(secondId, { allowSeedFromActive: false });

  assert(readJson(SAVE_KEYS.career)?.clubName === 'Clube B', 'selected career must win');
  assert(readJson(secondBundle.career)?.clubName === 'Clube B', 'selected bundle must stay intact');
});

check('canCreateSlot respects limit of 5', () => {
  store.clear();
  for (let i = 0; i < 5; i += 1) createNewSlot();
  assert(!canCreateSlot());
  assert(readCareerIndex().slots.length === 5);
});

check('getActiveSlotId follows index activeSlotId', () => {
  store.clear();
  const id = createNewSlot();
  assert(getActiveSlotId() === id);
});

check('readCareerIndex hides obsolete slot bundles', () => {
  store.clear();
  localStorage.setItem(CAREER_INDEX_KEY, JSON.stringify({
    version: 1,
    activeSlotId: 'legacy',
    slots: [{ id: 'legacy', name: 'Save antigo' }],
  }));
  localStorage.setItem(slotBundleKeys('legacy').career, JSON.stringify({
    version: 6,
    clubName: 'Clube antigo',
  }));
  const index = readCareerIndex();
  assert(index.slots.length === 0, 'obsolete slot must not be listed');
  assert(index.activeSlotId === null, 'obsolete active slot must be cleared');
});

check('obsolete career purge removes dependent saves and preserves update notice marker', () => {
  store.clear();
  localStorage.setItem(SAVE_KEYS.lastSeenBuild, 'Alpha V.6.00');
  localStorage.setItem(SAVE_KEYS.career, JSON.stringify({ version: 6, clubName: 'Antigo' }));
  localStorage.setItem(SAVE_KEYS.season, JSON.stringify({ year: 2026 }));
  localStorage.setItem(CAREER_INDEX_KEY, JSON.stringify({ version: 1, slots: [{ id: 'old' }] }));
  localStorage.setItem(slotBundleKeys('old').career, JSON.stringify({ version: 6 }));
  assert(purgeObsoleteCareerStorage(), 'obsolete set should be detected');
  assert(!localStorage.getItem(SAVE_KEYS.career), 'active career must be removed');
  assert(!localStorage.getItem(SAVE_KEYS.season), 'dependent season must be removed');
  assert(!localStorage.getItem(CAREER_INDEX_KEY), 'slot index must be removed');
  assert(!localStorage.getItem(slotBundleKeys('old').career), 'slot bundle must be removed');
  assert(localStorage.getItem(SAVE_KEYS.lastSeenBuild) === 'Alpha V.6.00', 'update marker must remain');
});

check('current career survives save, logout and login hydration checkpoints', () => {
  store.clear();
  const slotId = 'current-login-cycle';
  const bundle = slotBundleKeys(slotId);
  const career = { version: 7, seed: 20260809, clubName: 'Novo FC', division: 'D', season: 2026 };
  localStorage.setItem(bundle.career, JSON.stringify(career));
  localStorage.setItem(SAVE_KEYS.career, JSON.stringify(buildCareerLocalCheckpoint(career)));
  localStorage.setItem(CAREER_INDEX_KEY, JSON.stringify({
    version: 2,
    saveEpoch: '2026-08-09',
    activeSlotId: slotId,
    slots: [{ id: slotId, name: 'Novo FC 2026', pendingCreation: false }],
  }));
  assert(!purgeObsoleteCareerStorage(), 'current checkpoint must not trigger purge');
  const index = readCareerIndex();
  assert(index.slots.length === 1, 'current slot remains visible after login');
  assert(readJson(bundle.career)?.clubName === 'Novo FC', 'full playable bundle remains intact');
});

check('late cloud career rebuilds a playable slot after authentication', () => {
  store.clear();
  localStorage.setItem(SAVE_KEYS.career, JSON.stringify({
    version: 7,
    clubName: 'Recuperado FC',
    division: 'C',
    season: 2029,
  }));
  localStorage.setItem(SAVE_KEYS.season, JSON.stringify({ year: 2029, currentRound: 12 }));
  const result = recoverCareerSlotsAfterHydration();
  const index = readCareerIndex();
  assert(result.recovered, 'career should be recovered');
  assert(index.slots.length === 1, 'slot manifest should be reconstructed');
  assert(localStorage.getItem(slotBundleKeys(index.slots[0].id).career), 'slot bundle should be restored');
});

try {
  store.clear();
  const firstId = createNewSlot();
  localStorage.setItem(SAVE_KEYS.career, JSON.stringify({ version: 7, clubName: 'Delete FC' }));
  syncActiveSlotFromCache();
  const firstBundle = slotBundleKeys(firstId);
  localStorage.setItem(`brfut-slot-${firstId}-season-archive-2026`, JSON.stringify({ year: 2026 }));
  const secondId = createNewSlot();
  const result = await deleteCareerSlot(firstId);
  assert(result.ok, 'delete should succeed locally');
  assert(!readCareerIndex().slots.some(slot => slot.id === firstId), 'manifest must be removed');
  assert(!localStorage.getItem(firstBundle.career), 'career bundle must be removed');
  assert(!localStorage.getItem(`brfut-slot-${firstId}-season-archive-2026`), 'archives must be removed');
  assert(readCareerIndex().slots.some(slot => slot.id === secondId), 'other slot must remain');
  passed += 1;
  console.log('✓ deleteCareerSlot removes only the selected slot and its archives');
} catch (error) {
  failed += 1;
  console.error('✗ deleteCareerSlot removes only the selected slot and its archives');
  console.error(`  ${error.message}`);
}

console.log(`\ncareer-slot-tests: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
