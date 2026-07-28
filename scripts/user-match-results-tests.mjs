import { userMatchResultIdentityKey } from '../js/engine/user-match-results.js';

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

check('histórico compacto e fixture ao vivo deduplicam', () => {
  const historyGame = { home: 'A', away: 'B', homeGoals: 1, awayGoals: 1 };
  const liveGame = { home: 'A', away: 'B', homeGoals: 1, awayGoals: 1, round: 4, phase: 'groups' };
  const keyA = userMatchResultIdentityKey(historyGame, { round: 4, phase: 'groups' });
  const keyB = userMatchResultIdentityKey(liveGame, { round: 4, phase: 'groups' });
  if (keyA !== keyB) throw new Error(`keys differ: ${keyA} vs ${keyB}`);
});

check('rodadas diferentes não colidem', () => {
  const a = userMatchResultIdentityKey({ home: 'A', away: 'B' }, { round: 3 });
  const b = userMatchResultIdentityKey({ home: 'A', away: 'B' }, { round: 4 });
  if (a === b) throw new Error('rounds should differ');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
