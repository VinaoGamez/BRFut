import assert from 'node:assert/strict';
import {
  createSerieDKnockoutAdvance,
  repairSerieDKnockoutReturnLegs,
} from '../js/engine/serie-d-knockout-advance.js';

const fixtures = [];
const knockout = { stages: {}, promoted: [], promotionSlots: 6 };
const deps = {
  getDKnockout: () => knockout,
  getNationalCompetitions: () => ({ D: { fixtures } }),
  getUserDivision: () => 'D',
  getSeasonRoundHistory: () => [],
  getCompetitionRoundHistory: () => ({ D: [] }),
  SERIE_D_PROMOTIONS: 6,
  KNOCKOUT_COMPETITIONS: { SERIE_D: 'SÉRIE D ELIMINATÓRIAS' },
};

const { installTieRounds } = createSerieDKnockoutAdvance(deps);
installTieRounds(
  [
    { home: 'Clube A', away: 'Clube B' },
    { home: 'Clube C', away: 'Clube D' },
  ],
  15,
  { phase: 'Oitavas de final' },
);

assert.deepEqual(
  fixtures[14].map(game => [game.home, game.away, game.leg]),
  [
    ['Clube A', 'Clube B', 'IDA'],
    ['Clube C', 'Clube D', 'IDA'],
  ],
);
assert.deepEqual(
  fixtures[15].map(game => [game.home, game.away, game.leg]),
  [
    ['Clube B', 'Clube A', 'VOLTA'],
    ['Clube D', 'Clube C', 'VOLTA'],
  ],
);
console.log('✓ novas fases alternam o mando entre ida e volta');

const legacyFixtures = [
  [{
    home: 'Clube A',
    away: 'Clube B',
    tieId: 'legacy-1',
    leg: 'IDA',
    completed: true,
    homeGoals: 1,
    awayGoals: 0,
  }],
  [{
    home: 'Clube A',
    away: 'Clube B',
    tieId: 'legacy-1',
    leg: 'VOLTA',
    completed: false,
  }],
];
assert.equal(repairSerieDKnockoutReturnLegs(legacyFixtures), 1);
assert.equal(legacyFixtures[1][0].home, 'Clube B');
assert.equal(legacyFixtures[1][0].away, 'Clube A');
assert.equal(repairSerieDKnockoutReturnLegs(legacyFixtures), 0);
console.log('✓ save existente corrige a volta pendente de forma idempotente');

const playedLegacy = [[
  { home: 'A', away: 'B', tieId: 'played', leg: 'IDA', completed: true, homeGoals: 1, awayGoals: 0 },
  { home: 'A', away: 'B', tieId: 'played', leg: 'VOLTA', completed: true, homeGoals: 2, awayGoals: 1 },
]];
assert.equal(repairSerieDKnockoutReturnLegs(playedLegacy), 0);
assert.equal(playedLegacy[0][1].home, 'A');
console.log('✓ resultado histórico concluído não é reinterpretado');

console.log('serie-d-knockout-legs-tests: 3 passed, 0 failed');
