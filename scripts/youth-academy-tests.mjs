import {
  YOUTH_ROSTER_MAX,
  YOUTH_WAGE_FACTOR,
  ensureYouthState,
  generateYouthPlayer,
  isYouthAcademyUnlocked,
  promoteYouthPlayer,
  runSeasonYouthIntake,
  runScoutSearch,
  formatScoutReportBody,
  purgeExpiredScoutReports,
  SCOUT_REPORT_RETENTION_DAYS,
  isScoutLocked,
  youthStarRating,
  computeYouthWage,
  getScoutSlotCount,
  syncScoutSlots,
  rollScoutGrade,
  rollScoutTalentCount,
  rollScoutedTalentStars,
  applyTalentStarProfile,
  scoutGradeLabel,
  SCOUT_TALENT_COUNT_ODDS,
  SCOUT_TALENT_STAR_ODDS,
  isValidScoutRegion,
  pickUfFromRegion,
} from '../js/engine/youth-academy.js';
import { estimatePlayerWage } from '../js/engine/economy.js';

let passed = 0;
let failed = 0;

function ok(cond, msg) {
  if (cond) {
    passed += 1;
    console.log(`  ok: ${msg}`);
  } else {
    failed += 1;
    console.error(`  FAIL: ${msg}`);
  }
}

const club = {
  division: 'B',
  power: 45,
  stadiumStructure: 3,
  roster: Array.from({ length: 20 }, (_, i) => ({ playerId: `p${i}`, name: `Pro ${i}`, overall: 60, age: 25 })),
};

ensureYouthState(club);
ok(isYouthAcademyUnlocked(club), 'unlocked at structure 3');

club.stadiumStructure = 2;
ok(!isYouthAcademyUnlocked(club), 'locked below structure 3');
club.stadiumStructure = 3;

club.youthAcademyLevel = 2;
club.scoutingDeptLevel = 1;
const youth = generateYouthPlayer({ club, clubName: 'Test FC', division: 'B', uf: 'SP', random: () => 0.42 });
ok(youth.age >= 15 && youth.age <= 20, 'youth age in range');
ok(youth.originUf === 'SP', 'origin UF set');

ok(isValidScoutRegion('sudeste'), 'valid region');
ok(!isValidScoutRegion('SP'), 'uf is not region id');
ok(REGION_UFS_FIX(), 'region maps to ufs');

ok(['A', 'B', 'C', 'D'].every(g => SCOUT_TALENT_COUNT_ODDS[g]), 'talent odds for all grades');
ok(
  SCOUT_TALENT_COUNT_ODDS.A.reduce((s, r) => s + r.weight, 0) === 100,
  'class A odds sum to 100',
);
ok(
  SCOUT_TALENT_STAR_ODDS.A.reduce((s, r) => s + r.weight, 0) === 100,
  'class A star odds sum to 100',
);
ok(rollScoutedTalentStars('A', () => 0.99) >= 4, 'class A can roll high stars');
ok(rollScoutedTalentStars('D', () => 0.01) <= 2, 'class D low roll stays low stars');

const starProbe = generateYouthPlayer({ club, clubName: 'Test FC', division: 'B', uf: 'SP', random: () => 0.5 });
applyTalentStarProfile(starProbe, 4, 'B');
ok(youthStarRating(starProbe, 'B') >= 4, 'star profile aligns potential to target stars');

club.scoutingDeptLevel = 0;
club.youthAcademyLevel = 1;
syncScoutSlots(club);
ok(getScoutSlotCount(club) === 1, 'academy lvl 1 grants 1 scout slot');
ok(club.scouts[0].scoutName, 'scout has name');
ok(['A', 'B', 'C', 'D'].includes(scoutGradeLabel(club.scouts[0].scoutGrade)), 'scout has grade');

ok(rollScoutTalentCount('A', () => 0.9) >= 2, 'class A high roll yields more talents');
ok(rollScoutTalentCount('D', () => 0.01) === 0, 'class D low roll can yield zero');

club.scoutingDeptLevel = 0;
club.youthAcademyLevel = 0;
syncScoutSlots(club);
ok(getScoutSlotCount(club) === 1, 'unlocked base grants 1 basic scout slot');

club.stadiumStructure = 2;
syncScoutSlots(club);
ok(getScoutSlotCount(club) === 0, 'no scouts when base locked');

club.stadiumStructure = 3;
club.youthAcademyLevel = 0;
club.scoutReports = [];
syncScoutSlots(club);
club.scouts[0].scoutGrade = 'A';
club.scouts[0].lockedUntil = null;

const userIntake = runSeasonYouthIntake(club, 'Test FC', { isUserClub: true, division: 'B', season: 2026, random: () => 0.5 });
ok(userIntake.reports === 0, 'user no longer gets auto reports at season start');

const search = runScoutSearch(club, {
  region: 'sudeste',
  scoutSlot: 1,
  clubName: 'Test FC',
  division: 'B',
  season: 2026,
  careerDate: new Date('2026-06-25T12:00:00'),
  random: () => 0.85,
});
ok(search.ok, 'manual scout search works');
ok(search.talentCount >= 2, 'class A search can return multiple talents');
ok(club.scoutReports.length === search.talentCount, 'reports match talent count');
ok(isScoutLocked(club.scouts[0], new Date('2026-06-25T12:00:00')), 'scout locked after search');
ok(club.scouts[0].lastMissionReport?.summary?.includes('Test FC') || club.scouts[0].lastMissionReport?.summary?.includes('Olheiro'), 'last mission report saved');
const searchDate = new Date('2026-06-25T12:00:00');
ok(formatScoutReportBody(club, club.scouts[0], searchDate).includes('talento'), 'report modal shows pending talents');
ok(club.scouts[0].lastMissionReport?.expiresAt, 'mission report has expiry');

const purged = purgeExpiredScoutReports(club, new Date('2026-07-15T12:00:00'));
ok(purged.purgedLogs === 0, 'report still valid before 3 weeks');
const purgedLate = purgeExpiredScoutReports(club, new Date('2026-07-16T12:00:00'));
ok(purgedLate.purgedLogs === 1, 'mission report purged after 3 weeks');
ok(!club.scouts[0].lastMissionReport, 'expired mission report removed');
ok(formatScoutReportBody(club, club.scouts[0], new Date('2026-07-16T12:00:00')).includes('ainda não realizou'), 'empty after expiry');

const blocked = runScoutSearch(club, {
  region: 'sul',
  scoutSlot: 1,
  clubName: 'Test FC',
  careerDate: new Date('2026-06-25T12:00:00'),
});
ok(!blocked.ok && blocked.error === 'scout_locked', 'locked scout cannot search again');

ok(rollScoutGrade(3, () => 0) === 'A', 'dept 3 can roll class A');

club.youthAcademyLevel = 2;
club.scoutingDeptLevel = 1;
const wage = computeYouthWage(youth, 'B');
const full = estimatePlayerWage(youth, 'B');
ok(wage === Math.max(100, Math.round(full * YOUTH_WAGE_FACTOR)), 'youth wage discount');

club.youthRoster = [];
const intake = runSeasonYouthIntake(club, 'Test FC', { isUserClub: false, division: 'B', random: () => 0.5 });
ok(intake.intake > 0, 'CPU direct intake');
ok(club.youthRoster.length <= YOUTH_ROSTER_MAX, 'respects max roster');

const stars = youthStarRating(youth, 'B');
ok(stars >= 1 && stars <= 5, 'star rating range');

club.youthRoster[0].age = 17;
const promo = promoteYouthPlayer(club, club.youthRoster[0].playerId, {
  division: 'B',
  evaluateRosterPayroll: () => ({ ok: true }),
});
ok(promo.ok, 'promote at 17');
ok(club.roster.length === 21, 'added to pro roster');
ok(club.youthRoster.length === intake.intake - 1, 'removed from youth');

console.log(`\nyouth-academy-tests: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

function REGION_UFS_FIX() {
  const uf = pickUfFromRegion('sudeste', () => 0);
  return ['ES', 'MG', 'RJ', 'SP'].includes(uf);
}
