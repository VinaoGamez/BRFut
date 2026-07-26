/**
 * Testes da simulação de calendário BR 2026.
 */
import {
  runBrGridSeasonSimulation,
  runBrGridValidationMatrix,
  quadrennialSeasonYearsThrough,
  brGridPhaseForDate,
  BR_GRID_PHASE,
  CONTINENTAL_CALENDAR_SLOTS,
  getBrGridWeekdays,
} from '../js/engine/season-calendar-br-grid.js';
import { WEEKDAY } from '../js/engine/season-week-slots.js';
import { FUTURE_COMPETITION_MOLD } from '../js/engine/season-calendar-mold.js';
import { getCompetitionSlotKey } from '../js/engine/season-week-slots.js';

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

check('internacionais desligadas in-game', () => {
  assert(FUTURE_COMPETITION_MOLD.libertadores.enabled === false);
  assert(FUTURE_COMPETITION_MOLD.sudamericana.enabled === false);
  assert(FUTURE_COMPETITION_MOLD.libertadores.matchCount === 13);
});

check('slot CONMEBOL compartilhado LIB/CSU', () => {
  assert(getCompetitionSlotKey('libertadores') === 'continental_conmebol');
  assert(getCompetitionSlotKey('sudamericana') === 'continental_conmebol');
});

check('13 slots continentais salvos', () => {
  assert(CONTINENTAL_CALENDAR_SLOTS.length === 13);
});

check('fases jan/mar/dez', () => {
  assert(brGridPhaseForDate(new Date(2026, 0, 18), 2026) === BR_GRID_PHASE.EST_ONLY);
  assert(brGridPhaseForDate(new Date(2026, 1, 15), 2026) === BR_GRID_PHASE.OVERLAP);
  assert(brGridPhaseForDate(new Date(2026, 3, 12), 2026) === BR_GRID_PHASE.NATIONAL_FULL);
});

check('grade: A qua no overlap, dom depois', () => {
  assert(getBrGridWeekdays('league_a', new Date(2026, 1, 4), 2026).includes(WEEKDAY.WED));
  assert(getBrGridWeekdays('league_a', new Date(2026, 3, 12), 2026).includes(WEEKDAY.SUN));
});

check('simulação completa sem conflitos de descanso', () => {
  const report = runBrGridSeasonSimulation(2026);
  assert(report.internationalInGame === false);
  assert(report.worldCupClubLocked === true);
  assert(report.worldCupLockedDateCount >= 30);
  assert(report.calendarCounts.recopa_national === 1);
  assert(report.calendarCounts.recopa_sudamericana === 2);
  assert(report.calendarCounts.state_league === 11);
  assert(report.calendarCounts.league_a === 38);
  assert(report.calendarCounts.league_b === 38);
  assert(report.calendarCounts.league_c === 38);
  assert(report.calendarCounts.league_d === 10);
  assert(report.calendarCounts.continentalSlots === 13);
  assert(report.quadrennialCycleValid === true);
  assert(report.allScenariosPass === true);
  assert(report.validationMatrix.allPass === true);
});

check('ciclo quadrienal 2026–2030 (100 cenários)', () => {
  const years = quadrennialSeasonYearsThrough(2030);
  assert(years.length === 5);
  const matrix = runBrGridValidationMatrix(years);
  assert(matrix.scenarioCount === 100);
  assert(matrix.allPass === true);
  assert(matrix.quadrennialParity.valid === true);
  assert(matrix.calendarByYear[2030].worldCupClubLocked === true);
  assert(matrix.calendarByYear[2027].worldCupClubLocked === false);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
