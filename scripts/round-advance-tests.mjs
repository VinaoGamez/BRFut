import { resolveRoundAlreadyRecorded } from '../js/engine/round-advance.js';

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

check('history without standings update is discarded', () => {
  const history = [{ round: 5, games: [{ home: 'A', away: 'B', homeGoals: 2, awayGoals: 1 }] }];
  const userGame = { home: 'A', away: 'B', round: 5 };
  const ok = resolveRoundAlreadyRecorded(history, 5, {
    userGame,
    userLeaguePlayed: () => 4,
  });
  assert(!ok, 'should not treat as recorded');
  assert(!history.some(item => item.round === 5), 'stale history removed');
});

check('history with matching standings counts as recorded', () => {
  const history = [{ round: 5, games: [{ home: 'A', away: 'B', round: 5, homeGoals: 2, awayGoals: 1 }] }];
  const userGame = { home: 'A', away: 'B', round: 5 };
  const ok = resolveRoundAlreadyRecorded(history, 5, {
    userGame,
    userLeaguePlayed: () => 5,
  });
  assert(ok, 'should treat as recorded');
  assert(history.length === 1, 'history kept');
});

check('history with wrong fixture is discarded', () => {
  const history = [{ round: 5, games: [{ home: 'A', away: 'C', homeGoals: 1, awayGoals: 0 }] }];
  const userGame = { home: 'A', away: 'B', round: 5 };
  const ok = resolveRoundAlreadyRecorded(history, 5, {
    userGame,
    userLeaguePlayed: () => 5,
  });
  assert(!ok, 'mismatched fixture should not count');
  assert(!history.some(item => item.round === 5), 'mismatched history removed');
});

check('history discarded when user fixture still pending', () => {
  const history = [{ round: 5, games: [{ home: 'A', away: 'B', round: 5, homeGoals: 2, awayGoals: 1 }] }];
  const userGame = { home: 'A', away: 'B', round: 5 };
  const ok = resolveRoundAlreadyRecorded(history, 5, {
    userGame,
    userLeaguePlayed: () => 5,
    isFixtureCompleted: () => false,
  });
  assert(!ok, 'pending user fixture must re-commit round');
  assert(!history.some(item => item.round === 5), 'stale history removed');
});

console.log(`\nround-advance-tests: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
