import { SAVE_KEYS } from '../js/core/constants.js';
import {
  LOCAL_CHECKPOINT_FLAG,
  buildCareerLocalCheckpoint,
  buildSeasonLocalCheckpoint,
  buildPlayerHistoryLocalCheckpoint,
  applyLocalCheckpointTrim,
  isLocalStorageCheckpoint,
  setCloudLocalTrimEnabled,
} from '../js/core/local-save-checkpoint.js';
import { mergeSeasonSaves, mergeCareerSaves, pickNewerSave } from '../js/core/save-sync.js';

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

check('isLocalStorageCheckpoint detects stamped payload', () => {
  const cp = buildSeasonLocalCheckpoint({ seed: 1, userClubName: 'FC', currentRound: 3 });
  assert(isLocalStorageCheckpoint(cp), 'checkpoint flag expected');
  assert(!isLocalStorageCheckpoint({ seed: 1 }), 'plain save is not checkpoint');
});

check('buildCareerLocalCheckpoint keeps identity fields', () => {
  const career = {
    seed: 42,
    clubName: 'Vinaz Athletic',
    division: 'D',
    userRoster: Array.from({ length: 20 }, (_, i) => ({ name: `P${i}` })),
    worldRosters: { 'Vinaz Athletic': [{ name: 'P0' }] },
    divisionTeams: { D: ['Vinaz Athletic'] },
    updatedAt: '2026-07-29T12:00:00.000Z',
  };
  const cp = buildCareerLocalCheckpoint(career);
  assert(cp[LOCAL_CHECKPOINT_FLAG] === true, 'flag set');
  assert(cp.clubName === 'Vinaz Athletic', 'club preserved');
  assert(cp.userRoster.length === 20, 'roster trimmed to 22 max');
  assert(!cp.divisionTeams?.D?.length, 'pyramid offloaded');
});

check('buildPlayerHistoryLocalCheckpoint strips heavy data', () => {
  const history = {
    version: 1,
    season: 2026,
    players: { a: { name: 'A' } },
    matchLogs: [{ id: 1 }],
    seasonArchives: [{ season: 2025 }],
    updatedAt: '2026-07-29T12:00:00.000Z',
  };
  const cp = buildPlayerHistoryLocalCheckpoint(history);
  assert(isLocalStorageCheckpoint(cp), 'checkpoint');
  assert(Object.keys(cp.players).length === 0, 'players cleared');
  assert(cp.matchLogs.length === 0, 'logs cleared');
  assert(cp.season === 2026, 'season kept');
});

check('applyLocalCheckpointTrim no-op when cloud trim disabled', () => {
  setCloudLocalTrimEnabled(false);
  const season = { seed: 1, userClubName: 'X', currentRound: 1 };
  assert(!applyLocalCheckpointTrim(SAVE_KEYS.season, season), 'trim disabled');
});

check('mergeSeasonSaves prefers remote when local is checkpoint', () => {
  const local = buildSeasonLocalCheckpoint({
    seed: 1,
    userClubName: 'Local FC',
    currentRound: 2,
    stateLeagues: null,
  });
  const remote = {
    seed: 1,
    userClubName: 'Local FC',
    currentRound: 5,
    careerCalendarDate: { day: 1, month: 3, year: 2026 },
    updatedAt: '2026-07-29T12:00:00.000Z',
    stateLeagues: { competitions: { MT: [{ fixtures: [[{ completed: true, round: 1 }]] }] } },
  };
  const merged = mergeSeasonSaves(local, remote, 0);
  assert(merged.currentRound === 5, 'remote progress wins');
  assert(!isLocalStorageCheckpoint(merged), 'merged is full save');
});

check('mergeCareerSaves prefers remote when local is checkpoint', () => {
  const local = buildCareerLocalCheckpoint({
    seed: 9,
    clubName: 'Local FC',
    division: 'D',
    userRoster: Array.from({ length: 18 }, (_, i) => ({ name: `L${i}` })),
  });
  const remote = {
    seed: 9,
    clubName: 'Local FC',
    division: 'D',
    divisionTeams: { D: ['Local FC', 'Other'] },
    userRoster: Array.from({ length: 18 }, (_, i) => ({ name: `R${i}` })),
    updatedAt: '2026-07-29T12:00:00.000Z',
  };
  const merged = mergeCareerSaves(local, remote, 0);
  assert(Array.isArray(merged.divisionTeams?.D), 'remote pyramid restored');
  assert(merged.userRoster[0].name === 'R0', 'remote roster restored');
});

check('pickNewerSave prefers full remote over local checkpoint', () => {
  const local = buildSeasonLocalCheckpoint({ seed: 1, currentRound: 9, updatedAt: '2026-07-30T00:00:00.000Z' });
  const remote = { seed: 1, currentRound: 4, updatedAt: '2026-07-29T00:00:00.000Z' };
  const winner = pickNewerSave(local, remote, SAVE_KEYS.season, 0);
  assert(winner === remote, 'full remote beats newer checkpoint');
});

console.log(`\nLocal save checkpoint tests: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
