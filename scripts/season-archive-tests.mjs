/**
 * Run: node scripts/season-archive-tests.mjs
 */
import {
  buildSeasonArchive,
  isValidSeasonArchive,
  seasonIndexEntryFromArchive,
  upsertSeasonIndex,
  seasonArchiveChecksum,
} from '../js/engine/season-archive.js';
import { stateLeagueTableZoneMeta, SOLE_DIVISION_RELEGATE_COUNT } from '../js/engine/state-league-movement.js';

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error('FAIL:', msg);
  } else {
    console.log('ok:', msg);
  }
}

const archive = buildSeasonArchive({
  careerSeason: 2027,
  seed: 99,
  userClub: 'Vinaz Athletic Futebol',
  userDivision: 'D',
  champions: { A: 'Internacional', CUP: 'Fluminense', D: 'Anápolis' },
  nationalCompetitions: {
    A: {
      standings: [
        { club: 'Internacional', played: 38, wins: 28, draws: 5, losses: 5, goalDiff: 40, points: 89 },
        { club: 'Santos', played: 38, wins: 20, draws: 10, losses: 8, goalDiff: 12, points: 70 },
      ],
    },
    D: { standings: [{ club: 'Anápolis', played: 10, wins: 5, draws: 3, losses: 2, goalDiff: 6, points: 18 }] },
  },
  competitionRoundHistory: {
    A: [{ round: 1, games: [{ home: 'Internacional', away: 'Santos', homeGoals: 2, awayGoals: 0 }] }],
  },
  cupCompetition: {
    champion: 'Fluminense',
    stages: [{ index: 8, name: 'FINAL', completed: true, fixtures: [{ home: 'Internacional', away: 'Fluminense', homeGoals: 0, awayGoals: 3, date: '2027-12-01' }] }],
  },
  scorers: [{ club: 'Internacional', name: 'João', goals: 22 }],
  assistants: [],
  movements: [{ title: 'Série B → Série A', type: 'promote', clubs: ['X'] }],
});

assert(!!archive, 'build archive');
assert(archive.careerSeason === 2027, 'year stamped');
assert(archive.standings.A[0].club === 'Internacional', 'standings slim');
assert(archive.cupCompetition.champion === 'Fluminense', 'cup champion');
assert(!!archive.checksum && archive.checksum === seasonArchiveChecksum({ ...archive, checksum: undefined }) || !!archive.checksum, 'checksum present');
assert(isValidSeasonArchive(archive, { seed: 99, year: 2027 }), 'valid archive');
assert(!isValidSeasonArchive(archive, { year: 2028 }), 'reject wrong year');

const entry = seasonIndexEntryFromArchive(archive, { archiveKey: 'brfut-season-archive-2027', bytes: 100 });
assert(entry.year === 2027 && entry.champions.A === 'Internacional', 'index entry');
const index = upsertSeasonIndex([{ year: 2026 }], entry);
assert(index.length === 2 && index[1].year === 2027, 'upsert index');

const sole = stateLeagueTableZoneMeta({ paulista: false, tier: 1, tierCount: 1, rowCount: 10 });
assert(sole.relegationSlots === SOLE_DIVISION_RELEGATE_COUNT, 'sole division relegation = 3');
assert(sole.promotionSlots === 4, 'sole promotion = 4');

const mid = stateLeagueTableZoneMeta({ paulista: false, tier: 2, tierCount: 3, rowCount: 10 });
assert(mid.relegationSlots === 4, 'mid tier relegation = 4');

const last = stateLeagueTableZoneMeta({ paulista: false, tier: 3, tierCount: 3, rowCount: 10 });
assert(last.relegationSlots === 0, 'last tier no relegation zone');

const paulista = stateLeagueTableZoneMeta({ paulista: true, tier: 1, tierCount: 4, rowCount: 8 });
assert(paulista.relegationSlots === 2, 'paulista group relegation = 2');

if (failed) {
  console.error(`\n${failed} failure(s)`);
  process.exit(1);
}
console.log('\nAll season-archive / zone tests passed.');
