import { createCareerPersistence } from '../js/engine/career-persistence.js';
import { SAVE_KEYS } from '../js/core/constants.js';
import { MEMORY_LIMITS } from '../js/core/save.js';

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

const memory = {};

check('persistCareer writes career save', () => {
  memory.store = {};
  globalThis.localStorage = {
    getItem: key => memory.store[key] ?? null,
    setItem: (key, value) => {
      memory.store[key] = value;
    },
    removeItem: key => {
      delete memory.store[key];
    },
  };
  globalThis.window = { addEventListener: () => {} };
  globalThis.sessionStorage = { getItem: () => null, removeItem: () => {}, setItem: () => {} };

  const career = { seed: 1, clubName: 'Test FC' };
  const persistence = createCareerPersistence({
    getSavedNewGame: () => career,
    getClubs: () => ({}),
    getUserClub: () => 'Test FC',
  });
  assert(persistence.persistCareer({ ...career, division: 'A' }), 'write ok');
  const raw = JSON.parse(memory.store[SAVE_KEYS.career]);
  assert(raw.division === 'A', 'payload stored');
});

check('prepareForNewCareer blocks career writes', () => {
  memory.store = {};
  const career = { seed: 2, clubName: 'Old FC' };
  const persistence = createCareerPersistence({
    getSavedNewGame: () => career,
    getClubs: () => ({}),
    getUserClub: () => 'Old FC',
  });
  persistence.persistCareer({ ...career });
  persistence.prepareForNewCareer();
  assert(persistence.isWriteBlocked(), 'blocked');
  persistence.persistCareer({ seed: 99 });
  const raw = JSON.parse(memory.store[SAVE_KEYS.career]);
  assert(raw.seed === 2, 'career not overwritten');
});

check('persistSeason debounces then flushes immediate', async () => {
  let writes = 0;
  const persistence = createCareerPersistence({
    getSavedNewGame: () => ({ seed: 3 }),
    getClubs: () => ({}),
    getUserClub: () => 'X',
  });
  persistence.bindWriteSeasonSave(() => {
    writes += 1;
    return true;
  });
  persistence.persistSeason(false);
  assert(writes === 0, 'debounced');
  await new Promise(resolve => setTimeout(resolve, MEMORY_LIMITS.persistDebounceMs + 50));
  assert(writes === 1, 'debounce fired');
  persistence.persistSeason(true);
  assert(writes === 2, 'immediate flush');
});

check('syncCareerRosters mirrors user roster to career save', () => {
  const career = { seed: 4, clubName: 'User FC' };
  const clubs = {
    'User FC': {
      roster: [{ name: 'A', injuryHistory: [{ type: 'x' }, { type: 'y' }, { type: 'z' }, { type: 'w' }, { type: 'v' }, { type: 'u' }] }],
    },
    Other: { roster: [{ name: 'B' }] },
  };
  const persistence = createCareerPersistence({
    getSavedNewGame: () => career,
    getClubs: () => clubs,
    getUserClub: () => 'User FC',
    collectWorldRosters: () => [{ club: 'Other', roster: [{ name: 'B' }] }],
  });
  persistence.syncCareerRosters();
  const raw = JSON.parse(memory.store[SAVE_KEYS.career]);
  assert(raw.userRoster?.[0]?.name === 'A', 'roster synced');
  assert(Array.isArray(raw.worldRosters), 'world rosters synced');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
