/**
 * Testes do ciclo quadrienal e blackouts travados (CMU).
 */
import {
  CALENDAR_ANCHOR_YEAR,
  CALENDAR_CYCLE_YEARS,
  calendarCycleOffset,
  calendarAnchorYear,
  isCalendarAnchorYear,
  moldToDate,
  isWorldCupClubCalendarLocked,
  isClubCalendarBlackout,
  describeCalendarCycle,
} from '../js/engine/season-calendar-cycle.js';
import {
  getSeasonBlackouts,
  listFutureCompetitionMold,
  RECOPA_NATIONAL_CALENDAR_SLOTS,
  RECOPA_SUDAMERICANA_CALENDAR_SLOTS,
} from '../js/engine/season-calendar-mold.js';
import { buildWorldCupLockedDates } from '../js/engine/world-cup-calendar.js';
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

check('âncora 2026 · ciclo 4 anos', () => {
  assert(CALENDAR_ANCHOR_YEAR === 2026);
  assert(CALENDAR_CYCLE_YEARS === 4);
});

check('calendarAnchorYear agrupa 2027–2029 em 2026', () => {
  assert(calendarAnchorYear(2026) === 2026);
  assert(calendarAnchorYear(2027) === 2026);
  assert(calendarAnchorYear(2029) === 2026);
  assert(calendarAnchorYear(2030) === 2030);
});

check('anos-âncora do ciclo (2026, 2030, 2034)', () => {
  assert(isCalendarAnchorYear(2026));
  assert(isCalendarAnchorYear(2030));
  assert(isCalendarAnchorYear(2034));
  assert(!isCalendarAnchorYear(2027));
  assert(calendarCycleOffset(2030) === 0);
});

check('moldToDate usa ano civil da temporada', () => {
  assert(moldToDate(2030, 0, 28).getFullYear() === 2030);
  assert(moldToDate(2030, 0, 28).getMonth() === 0);
});

check('CMU trava clubes em 2026 mesmo sem FEATURES.worldCup', () => {
  assert(isWorldCupClubCalendarLocked(2026));
  assert(!isWorldCupClubCalendarLocked(2027));
  const wc = getSeasonBlackouts(2026).find(b => b.id === 'world_cup');
  assert(wc?.hard === true);
  assert(wc?.locked === true);
  assert(isClubCalendarBlackout(moldToDate(2026, 5, 11), 2026));
  assert(!isClubCalendarBlackout(moldToDate(2026, 5, 10), 2026));
  assert(!isClubCalendarBlackout(moldToDate(2026, 4, 30), 2026));
});

check('listFutureCompetitionMold inclui world_cup em ano de copa', () => {
  const ids = listFutureCompetitionMold({ seasonYear: 2026 }).map(s => s.competitionId);
  assert(ids.includes('world_cup'));
  assert(!listFutureCompetitionMold({ seasonYear: 2027 }).some(s => s.competitionId === 'world_cup'));
});

check('datas travadas CMU (grupos + mata-mata)', () => {
  const locked = buildWorldCupLockedDates(2026);
  assert(locked.length >= 30);
  assert(locked.every(d => d.getFullYear() === 2026));
  assert(!buildWorldCupLockedDates(2027).length);
});

check('Recopas — slots salvos', () => {
  assert(RECOPA_NATIONAL_CALENDAR_SLOTS.length === 1);
  assert(RECOPA_SUDAMERICANA_CALENDAR_SLOTS.length === 2);
  assert(getCompetitionSlotKey('recopa_national') === 'recopa_national');
  assert(getCompetitionSlotKey('recopa_sudamericana') === 'continental_conmebol');
});

check('describeCalendarCycle 2031', () => {
  const d = describeCalendarCycle(2031);
  assert(d.anchorYear === 2030);
  assert(d.cycleOffset === 1);
  assert(!d.isAnchorYear);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
