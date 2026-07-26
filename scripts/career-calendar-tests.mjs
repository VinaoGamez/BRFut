import { createCareerCalendar, parseSavedCalendarDate } from '../js/engine/career-calendar.js';

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

check('advanceCareerCalendarTo normalizes noon', () => {
  const holder = { date: null };
  const calendar = createCareerCalendar({ dateHolder: holder, initialDate: new Date(2026, 0, 1, 8, 30) });
  calendar.advanceCareerCalendarTo(new Date(2026, 1, 15, 22, 0));
  assert(calendar.date.getHours() === 12, 'noon');
  assert(calendar.date.getDate() === 15, 'day');
  assert(holder.date === calendar.date, 'holder synced');
});

check('sameCalendarDay compares date parts only', () => {
  const calendar = createCareerCalendar();
  const a = new Date(2026, 3, 10, 8, 0);
  const b = new Date(2026, 3, 10, 20, 0);
  const c = new Date(2026, 3, 11, 12, 0);
  assert(calendar.sameCalendarDay(a, b), 'same day');
  assert(!calendar.sameCalendarDay(a, c), 'different day');
});

check('calendar batch depth tracks nested batches', () => {
  const calendar = createCareerCalendar();
  assert(!calendar.isCalendarBatch(), 'initial');
  calendar.beginCalendarBatch();
  calendar.beginCalendarBatch();
  assert(calendar.isCalendarBatch(), 'nested');
  calendar.endCalendarBatch();
  assert(calendar.isCalendarBatch(), 'one left');
  calendar.endCalendarBatch();
  assert(!calendar.isCalendarBatch(), 'done');
});

check('setOnAdvanced fires after advance', () => {
  let hits = 0;
  const calendar = createCareerCalendar();
  calendar.setOnAdvanced(() => {
    hits += 1;
  });
  calendar.advanceCareerCalendarTo(new Date(2026, 5, 1));
  assert(hits === 1, 'callback');
});

check('parseSavedCalendarDate reads YYYY-MM-DD', () => {
  const date = parseSavedCalendarDate('2026-07-21', new Date(2026, 0, 1));
  assert(date.getFullYear() === 2026 && date.getMonth() === 6 && date.getDate() === 21, 'parsed');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
