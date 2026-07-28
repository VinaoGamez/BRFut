import { buildCompetitionRoundRobinFixtures } from '../js/engine/competition-calendar.js';
import { divisionFixturesIncludeClub } from '../js/engine/career-club-replacement.js';
import {
  rebalanceSerieDGroups,
  serieDGroupsNeedRebalance,
} from '../js/engine/serie-d-formation.js';

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

check('serieDGroupsNeedRebalance detecta grupo ímpar', () => {
  assert(serieDGroupsNeedRebalance([[ 'A', 'B', 'C' ]]), '3 clubes');
  assert(!serieDGroupsNeedRebalance([[ 'A', 'B', 'C', 'D' ]]), '4 clubes ok');
});

check('rebalanceSerieDGroups gera grupos pares com fixtures do usuário', () => {
  const divisionTeams = {
    D: [
      'Vinaz Athletic Futebol',
      'Blumenau',
      'Marcílio Dias',
      'São Joseense',
      'São José',
      'Brasil de Pelotas',
      'Azuriz',
      'Andirá',
    ],
  };
  const broken = [
    ['Blumenau', 'Marcílio Dias', 'São Joseense', 'São José', 'Brasil de Pelotas', 'Azuriz', 'Vinaz Athletic Futebol'],
    ['Andirá'],
  ];
  assert(serieDGroupsNeedRebalance(broken), 'layout quebrado');
  const fixed = rebalanceSerieDGroups(divisionTeams, broken, 2);
  assert(!serieDGroupsNeedRebalance(fixed), 'grupos pares');
  const fixtures = fixed.flatMap(group => buildCompetitionRoundRobinFixtures(group, 'serie-d-groups').flat());
  assert(divisionFixturesIncludeClub([fixtures], 'Vinaz Athletic Futebol'), 'usuário no calendário');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
