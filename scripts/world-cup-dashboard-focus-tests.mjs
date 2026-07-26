import {
  resolveDashboardStandingsFocus,
  isWorldCupUserScheduleEntry,
} from '../js/engine/world-cup/dashboard-context.js';
import { WORLD_CUP_COMPETITION } from '../js/engine/world-cup-calendar.js';

const nt = 'Brasil';
const club = 'Vinaz Athletic Futebol';
const clubDay = new Date('2026-04-12T12:00:00');
const wcDay = new Date('2026-06-15T12:00:00');

const clubEntry = {
  game: { home: club, away: 'Internacional', competition: 'A', date: clubDay },
  details: { date: clubDay },
};
const wcEntry = {
  game: { home: nt, away: 'Argentina', competition: WORLD_CUP_COMPETITION, date: wcDay },
  details: { date: wcDay },
};

let failed = 0;
const assert = (label, cond) => {
  if (!cond) {
    console.error(`FAIL: ${label}`);
    failed++;
  } else console.log(`ok: ${label}`);
};

assert('club day → club focus', resolveDashboardStandingsFocus({
  pendingUserSchedule: [wcEntry, clubEntry],
  userNationalTeamName: nt,
  userClub: club,
  careerCalendarDate: clubDay,
}) === 'club');

assert('wc day → worldcup focus', resolveDashboardStandingsFocus({
  pendingUserSchedule: [clubEntry, wcEntry],
  userNationalTeamName: nt,
  userClub: club,
  careerCalendarDate: wcDay,
}) === 'worldcup');

assert('next club when no game today', resolveDashboardStandingsFocus({
  pendingUserSchedule: [clubEntry, wcEntry],
  userNationalTeamName: nt,
  userClub: club,
  careerCalendarDate: new Date('2026-04-01T12:00:00'),
}) === 'club');

assert('wc entry detect', isWorldCupUserScheduleEntry(wcEntry, nt));

process.exit(failed ? 1 : 0);
