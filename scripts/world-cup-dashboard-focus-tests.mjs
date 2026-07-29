import {
  resolveDashboardStandingsFocus,
  isWorldCupCommandWindow,
  isWorldCupUserScheduleEntry,
} from '../js/engine/world-cup/dashboard-context.js';
import { WORLD_CUP_COMPETITION } from '../js/engine/world-cup-calendar.js';
import { createUserScheduleEngine } from '../js/engine/user-schedule.js';

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

assert('accepting selection before WC window keeps club focus', resolveDashboardStandingsFocus({
  pendingUserSchedule: [wcEntry],
  nextPendingEntry: wcEntry,
  userNationalTeamName: nt,
  userClub: club,
  careerCalendarDate: new Date('2026-04-30T12:00:00'),
}) === 'club');

assert('inside WC window next selection match activates WC focus', resolveDashboardStandingsFocus({
  pendingUserSchedule: [wcEntry],
  nextPendingEntry: wcEntry,
  userNationalTeamName: nt,
  userClub: club,
  careerCalendarDate: new Date('2026-06-11T12:00:00'),
}) === 'worldcup');

assert('WC command window includes official boundaries',
  isWorldCupCommandWindow(new Date('2026-06-11T00:00:00')) &&
  isWorldCupCommandWindow(new Date('2026-07-19T23:59:59')));

assert('WC command window excludes dates before and after',
  !isWorldCupCommandWindow(new Date('2026-06-10T23:59:59')) &&
  !isWorldCupCommandWindow(new Date('2026-07-20T00:00:00')));

assert('wc entry detect', isWorldCupUserScheduleEntry(wcEntry, nt));

const aprilClubGame = {
  home: club,
  away: 'Náuas',
  competition: 'D',
  round: 4,
  date: new Date('2026-04-30T20:00:00'),
};
const juneWorldCupGame = {
  home: nt,
  away: 'Paraguai',
  competition: WORLD_CUP_COMPETITION,
  round: 1,
  date: new Date('2026-06-12T22:00:00'),
};
const leagueRounds = Array.from({ length: 10 }, () => []);
leagueRounds[3] = [aprilClubGame];
let savedCareerDate = new Date('2026-04-30T12:00:00');
const scheduleEngine = createUserScheduleEngine({
  fixtureDetails: game => ({ date: new Date(game.date) }),
  getUserClub: () => club,
  getUserDivision: () => 'D',
  getUserNationalTeamName: () => nt,
  getChampionshipFixtures: () => leagueRounds,
  getCopaDoBrasilFixtures: () => [],
  getRecopaFixtures: () => [],
  getWorldCupCompetition: () => ({ groupFixtures: [juneWorldCupGame], knockoutFixtures: [] }),
  getWorldCupAllFixtures: competition => [
    ...(competition.groupFixtures || []),
    ...(competition.knockoutFixtures || []),
  ],
  getStateLeagueEngine: () => ({
    getUserFixtures: () => [],
    isGameComplete: () => false,
  }),
  getSavedNewGame: () => null,
  getSeasonRoundHistory: () => [],
  userLeaguePlayed: () => 3,
  userGroupStageComplete: () => false,
  getNationalCompetitionsD: () => ({ fixtures: leagueRounds }),
  getCareerCalendarDate: () => savedCareerDate,
  advanceCareerCalendarTo: date => {
    savedCareerDate = new Date(date);
  },
  rescheduleAllCupFixtures: () => {},
});

assert(
  'accepted selection does not jump over pending club fixture',
  scheduleEngine.nextPendingUserEntry()?.game === aprilClubGame,
);

savedCareerDate = new Date('2026-05-01T12:00:00');
assert(
  'affected save rewinds to overdue club fixture',
  scheduleEngine.ensureCalendarMatchConsistency() &&
  savedCareerDate.toISOString().slice(0, 10) === '2026-04-30',
);

process.exit(failed ? 1 : 0);
