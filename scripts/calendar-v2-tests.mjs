import { userOutcome, weekLoad, competitionColor, dayDiff } from '../js/feature/calendar-view/calendar-v2-model.js';

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
const eq = (a, b) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`);
};
const d = (y, m, day) => new Date(y, m - 1, day, 12);

check('vitória em casa', () => eq(userOutcome('2—1', true), { outcome: 'V', mine: 2, theirs: 1 }));
check('derrota fora', () => eq(userOutcome('2—1', false), { outcome: 'D', mine: 1, theirs: 2 }));
check('empate', () => eq(userOutcome('0—0', true)?.outcome, 'E'));
check('pênaltis decidem o empate', () => eq(userOutcome('1—1 (4—3 pên.)', false)?.outcome, 'D'));
check('sem placar', () => eq(userOutcome(null, true), null));
check('semana sem jogos', () => eq(weekLoad([]).level, 'rest'));
check('semana com 1 jogo', () => eq(weekLoad([d(2026, 1, 14)]).label, '1 jogo · carga normal'));
check('semana com 2 jogos', () => eq(weekLoad([d(2026, 1, 21), d(2026, 1, 18)]).label, '2 jogos em 4 dias · carga alta'));
check('cores por competição', () => {
  eq(competitionColor('BSA'), 'var(--av-cyan)');
  eq(competitionColor('EST'), 'var(--av-green)');
  eq(competitionColor('CBR'), 'var(--av-orange)');
  eq(competitionColor('LIB'), 'var(--av-gold)');
});
check('diferença de dias', () => eq(dayDiff(d(2026, 1, 30), d(2026, 2, 2)), 3));

console.log(`\ncalendar-v2: ${passed} ok, ${failed} falhas`);
if (failed) process.exit(1);
