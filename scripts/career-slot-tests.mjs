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
  deleteCareerSlot,
} = await import('../js/core/career-slot-manager.js');

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
  localStorage.setItem(SAVE_KEYS.career, JSON.stringify({ clubName: 'Santos', division: 'A', season: 2028 }));
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
  localStorage.setItem(SAVE_KEYS.career, JSON.stringify({ clubName: 'Test FC', division: 'B' }));
  syncActiveSlotFromCache();
  localStorage.removeItem(SAVE_KEYS.career);
  hydrateSlot(slotId);
  const active = JSON.parse(localStorage.getItem(SAVE_KEYS.career) || 'null');
  assert(active?.clubName === 'Test FC');
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

try {
  store.clear();
  const firstId = createNewSlot();
  localStorage.setItem(SAVE_KEYS.career, JSON.stringify({ clubName: 'Delete FC' }));
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
