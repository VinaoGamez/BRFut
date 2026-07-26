import {
  buildSerieDRosterCBF,
  collectSerieDSecondPhaseClubs,
  rnfSlotTotal,
  RNF_SERIE_D_SLOTS_BY_UF,
} from '../js/engine/serie-d-formation.js';
import { SERIE_C_RELEGATION_TO_D, SERIE_D_CLUBS } from '../js/engine/serie-c-calendar.js';

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

check('RNF soma 64 vagas estaduais', () => {
  assert(rnfSlotTotal(RNF_SERIE_D_SLOTS_BY_UF) === 64, `soma=${rnfSlotTotal()}`);
});

check('collectSerieDSecondPhaseClubs pega top 4 por grupo', () => {
  const groups = [['A', 'B', 'C', 'D', 'E', 'F']];
  const standings = [
    { club: 'A', points: 10, wins: 3, goalDiff: 5 },
    { club: 'B', points: 9, wins: 3, goalDiff: 3 },
    { club: 'C', points: 8, wins: 2, goalDiff: 2 },
    { club: 'D', points: 7, wins: 2, goalDiff: 1 },
    { club: 'E', points: 4, wins: 1, goalDiff: -1 },
    { club: 'F', points: 1, wins: 0, goalDiff: -4 },
  ];
  const qualified = collectSerieDSecondPhaseClubs(groups, { standings });
  assert(qualified.length === 4, '4 classificados');
  assert(qualified.includes('A') && qualified.includes('D'), 'top e 4º');
  assert(!qualified.includes('E'), '5º fora');
});

check('buildSerieDRosterCBF aplica 4 critérios na ordem', () => {
  const regionalPool = [];
  Object.entries(RNF_SERIE_D_SLOTS_BY_UF).forEach(([uf, count]) => {
    for (let i = 0; i < count; i += 1) regionalPool.push(`Regional ${uf} ${i + 1}`);
  });
  for (let i = 0; i < 40; i += 1) regionalPool.push(`Extra REG ${i}`);

  const clubs = {};
  regionalPool.forEach(name => {
    clubs[name] = { name, division: 'REG', uf: name.split(' ')[1], roster: [{ overall: 50 }], power: 50 };
  });
  ['Rel C1', 'Rel C2', 'Rel C3', 'Rel C4', 'Perm 1', 'Old D'].forEach(name => {
    clubs[name] = { name, division: 'D', uf: 'SP', roster: [{ overall: 55 }], power: 55 };
  });

  const { roster, breakdown } = buildSerieDRosterCBF({
    relegatedFromC: ['Rel C1', 'Rel C2', 'Rel C3', 'Rel C4'],
    promotedFromD: ['Promovido'],
    previousD: ['Perm 1', 'Old D', 'Promovido'],
    permanenceClubs: ['Perm 1'],
    regionalPool,
    nationalRankingEntries: {},
    clubs,
  });

  assert(roster.length === SERIE_D_CLUBS, `roster=${roster.length}`);
  assert(breakdown.relegatedC.length === SERIE_C_RELEGATION_TO_D, '4 rebaixados C');
  assert(breakdown.stateRnf.length === 64, `RNF=${breakdown.stateRnf.length}`);
  assert(breakdown.permanence.includes('Perm 1'), 'permanência');
  assert(!roster.includes('Promovido'), 'promovido sai');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
