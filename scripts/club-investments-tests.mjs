/**
 * Persistência de investimentos do Escritório entre temporadas.
 * node scripts/club-investments-tests.mjs
 */
import {
  serializeUserClubInvestments,
  applySavedUserClubInvestments,
} from '../js/engine/economy.js';

let passed = 0;
let failed = 0;
const check = (label, fn) => {
  try {
    fn();
    passed += 1;
    console.log(`✓ ${label}`);
  } catch (e) {
    failed += 1;
    console.error(`✗ ${label}`);
    console.error(`  ${e.message}`);
  }
};
const assertEq = (a, b, m) => {
  if (a !== b) throw new Error(m || `expected ${b}, got ${a}`);
};

check('serialize captura níveis atuais', () => {
  const snap = serializeUserClubInvestments({ medicalInvestment: 3, preventionProgram: 2 });
  assertEq(snap.medicalInvestment, 3);
  assertEq(snap.preventionProgram, 2);
});

check('apply restaura após reset simulado de virada', () => {
  const club = { medicalInvestment: 0, preventionProgram: 0 };
  const ok = applySavedUserClubInvestments(club, { medicalInvestment: 4, preventionProgram: 1 });
  assertEq(ok, true);
  assertEq(club.medicalInvestment, 4);
  assertEq(club.preventionProgram, 1);
});

check('serialize limita faixas válidas', () => {
  const snap = serializeUserClubInvestments({ medicalInvestment: 99, preventionProgram: -2 });
  assertEq(snap.medicalInvestment, 5);
  assertEq(snap.preventionProgram, 0);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
