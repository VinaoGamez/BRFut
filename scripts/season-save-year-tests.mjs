/**
 * Valida isSeasonValidForCareer / seasonSaveLooksCorrupt (virada de temporada).
 * Run: node scripts/season-save-year-tests.mjs
 */
import {
  isSeasonValidForCareer,
  resolveSeasonSaveYear,
  seasonSaveLooksCorrupt,
} from '../js/core/save.js';

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error('FAIL:', msg);
  } else {
    console.log('ok:', msg);
  }
}

const career2028 = { seed: 42, season: 2028 };

assert(resolveSeasonSaveYear({ careerSeason: 2027 }) === 2027, 'stamp careerSeason');
assert(resolveSeasonSaveYear({ careerCalendarDate: '2027-12-01' }) === 2027, 'infer from calendar');

assert(
  !isSeasonValidForCareer(career2028, { seed: 42, careerSeason: 2027, careerCalendarDate: '2027-12-01' }),
  'reject season year !== career year',
);

assert(
  isSeasonValidForCareer(career2028, {
    seed: 42,
    careerSeason: 2028,
    careerCalendarDate: '2028-01-12',
    currentRound: 1,
    standings: { A: [{ club: 'X', played: 0 }] },
  }),
  'accept matching fresh 2028',
);

assert(
  seasonSaveLooksCorrupt({
    currentRound: 1,
    standings: { A: [{ club: 'Inter', played: 42, points: 89 }] },
  }, 2028),
  'J=42 on Serie A is corrupt',
);

assert(
  seasonSaveLooksCorrupt({
    currentRound: 1,
    standings: {
      D: [
        { club: 'Anápolis', played: 10, points: 18 },
        { club: 'Novo', played: 0, points: 0 },
      ],
    },
  }, 2028),
  'Serie D round 1 with J=10 is corrupt',
);

assert(
  seasonSaveLooksCorrupt({
    cupCompetition: {
      stages: [{ fixtures: [{ date: '2027-12-01', home: 'A', away: 'B' }] }],
    },
  }, 2028),
  'cup fixture in prior year is corrupt',
);

assert(
  !seasonSaveLooksCorrupt({
    currentRound: 20,
    standings: { A: [{ club: 'X', played: 19 }] },
  }, 2028),
  'mid-season A is fine',
);

assert(
  !isSeasonValidForCareer(career2028, {
    seed: 42,
    careerSeason: 2028,
    careerCalendarDate: '2028-01-12',
    currentRound: 1,
    standings: { A: [{ club: 'Inter', played: 42 }] },
  }),
  'reject corrupt matching-year blob',
);

if (failed) {
  console.error(`\n${failed} failure(s)`);
  process.exit(1);
}
console.log('\nAll season-save year tests passed.');
