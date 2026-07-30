import {
  mergeSeasonSaves,
  pickNewerSave,
  maxStateLeagueRound,
  hasUsableStateLeagueSave,
  pickRicherStateLeagues,
  mergeCareerSaves,
  isSlimCareerCheckpoint,
  careerPayloadWeight,
  stampSyncableSave,
} from '../js/core/save-sync.js';
import { slimCareerForCloudUpload, slimSeasonForCloudUpload } from '../js/core/cloud-save-payload.js';
import { slimSeasonPayloadLevel4 } from '../js/engine/season-save-quota.js';
import { SAVE_KEYS } from '../js/core/constants.js';
import { isSeasonValidForCareer } from '../js/core/save.js';

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

function buildStateLeagues(roundCount, { playedThrough = roundCount - 1 } = {}) {
  const fixtures = [];
  for (let round = 1; round <= roundCount; round += 1) {
    const completed = round <= playedThrough;
    fixtures.push([
      {
        home: 'Vinaz Athletic',
        away: `Opponent R${round}`,
        round,
        completed,
        homeGoals: completed ? 2 : null,
        awayGoals: completed ? 0 : null,
      },
    ]);
  }
  return {
    seasonYear: 2026,
    userUf: 'MT',
    competitions: {
      MT: [{ uf: 'MT', tier: 1, currentRound: playedThrough + 1, fixtures }],
    },
    historyByUf: {},
    results: {},
  };
}

function buildFullSeason(roundCount) {
  return {
    seed: 123,
    userClubName: 'Vinaz Athletic',
    currentRound: 3,
    careerCalendarDate: { day: 8, month: 2, year: 2026 },
    updatedAt: '2026-02-08T12:00:00.000Z',
    stateLeagues: buildStateLeagues(roundCount, { playedThrough: roundCount - 1 }),
    fatigue: { 'Vinaz Athletic': { 'Player A': 55 } },
    careerMessages: [{ id: 1, title: 'Test' }],
  };
}

check('maxStateLeagueRound reads fixture progress', () => {
  const season = buildFullSeason(7);
  assert(maxStateLeagueRound(season) === 7, `expected 7 got ${maxStateLeagueRound(season)}`);
});

check('hasUsableStateLeagueSave rejects empty competitions', () => {
  assert(!hasUsableStateLeagueSave({ competitions: {} }), 'empty object should fail');
  assert(hasUsableStateLeagueSave(buildStateLeagues(3)), 'valid fixtures should pass');
});

check('pickRicherStateLeagues keeps full fixture schedule', () => {
  const full = buildStateLeagues(7);
  const slim = buildStateLeagues(4);
  const picked = pickRicherStateLeagues(full, slim);
  assert(picked === full, 'should pick full schedule');
  assert(picked.competitions.MT[0].fixtures.length === 7, '7 rounds expected');
});

check('mergeSeasonSaves keeps local state leagues over slim remote', () => {
  const local = buildFullSeason(7);
  const remote = slimSeasonForCloudUpload({
    ...buildFullSeason(7),
    updatedAt: '2026-02-08T13:00:00.000Z',
  });
  remote.stateLeagues.competitions.MT[0].fixtures =
    remote.stateLeagues.competitions.MT[0].fixtures.slice(-4);

  const merged = mergeSeasonSaves(local, remote, Date.parse('2026-02-08T14:00:00.000Z'));
  assert(maxStateLeagueRound(merged) >= 6, `merged should keep progress, got ${maxStateLeagueRound(merged)}`);
  assert(
    merged.stateLeagues.competitions.MT[0].fixtures.length === 7,
    'merged should keep 7 fixture rounds',
  );
  assert(merged.fatigue?.['Vinaz Athletic']?.['Player A'] === 55, 'fatigue preserved');
});

check('pickNewerSave tie prefers local season on equal progress', () => {
  const local = buildFullSeason(7);
  const remote = { ...buildFullSeason(7), updatedAt: '2026-02-08T20:00:00.000Z' };
  const winner = pickNewerSave(local, remote, SAVE_KEYS.season, Date.parse('2026-02-08T21:00:00.000Z'));
  assert(winner === local, 'local should win tie');
});

check('slot season merge prefers real progress over newer remote timestamp', () => {
  const local = {
    ...buildFullSeason(7),
    currentRound: 8,
    careerCalendarDate: { day: 30, month: 4, year: 2026 },
    updatedAt: '2026-04-30T12:00:00.000Z',
  };
  const remote = {
    ...buildFullSeason(5),
    currentRound: 5,
    careerCalendarDate: { day: 9, month: 4, year: 2026 },
    updatedAt: '2026-07-29T20:00:00.000Z',
  };
  const winner = pickNewerSave(
    local,
    remote,
    'brfut-slot-save123-season',
    Date.parse('2026-07-29T21:00:00.000Z'),
  );
  assert(winner === local, 'advanced local slot must survive hard refresh');
});

check('slimSeasonPayloadLevel4 no longer drops stateLeagues', () => {
  const season = buildFullSeason(7);
  const slim = slimSeasonPayloadLevel4(season, {});
  assert(slim.stateLeagues != null, 'stateLeagues must survive quota level 4');
  assert(hasUsableStateLeagueSave(slim.stateLeagues), 'state leagues still usable after slim');
});

check('cloud slim keeps all fixture rounds for user UF', () => {
  const season = buildFullSeason(7);
  const cloud = slimSeasonForCloudUpload(season);
  assert(
    cloud.stateLeagues.competitions.MT[0].fixtures.length === 7,
    `cloud should keep 7 rounds, got ${cloud.stateLeagues.competitions.MT[0].fixtures.length}`,
  );
});

check('cloud slim keeps Copa do Brasil fixtures', () => {
  const season = {
    ...buildFullSeason(7),
    cupCompetition: {
      currentPhase: 1,
      champion: null,
      stages: [
        {
          index: 1,
          name: '1ª FASE',
          completed: false,
          entrants: ['A', 'B'],
          winners: [],
          fixtures: [
            {
              home: 'A',
              away: 'B',
              competition: 'COPA DO BRASIL',
              phase: '1ª FASE',
              date: '2026-01-20',
              completed: false,
              tieId: 'F1-G1',
            },
          ],
        },
      ],
    },
  };
  const cloud = slimSeasonForCloudUpload(season);
  assert(cloud.cupCompetition?.stages?.length === 1, 'cup stages kept');
  assert(cloud.cupCompetition.stages[0].fixtures.length === 1, 'cup fixtures kept');
});

check('cloud slim keeps scorers and assistants', () => {
  const season = {
    ...buildFullSeason(7),
    scorers: [{ name: 'Artilheiro', club: 'Vinaz Athletic', goals: 4 }],
    assistants: [{ name: 'Garçom', club: 'Vinaz Athletic', assists: 3 }],
  };
  const cloud = slimSeasonForCloudUpload(season);
  assert(cloud.scorers?.[0]?.goals === 4, 'scorers kept');
  assert(cloud.assistants?.[0]?.assists === 3, 'assistants kept');
});

check('cloud ultra slim keeps World Cup and national fixtures', () => {
  const season = {
    ...buildFullSeason(7),
    userNationalTeamCode: 'USA',
    worldCupCompetition: {
      phase: 'GROUP',
      fixtures: [{ home: 'USA', away: 'PAR', completed: false }],
      recoveryPadding: 'x'.repeat(450_000),
    },
    nationalFixtures: [{ home: 'USA', away: 'PAR', date: '2026-06-12' }],
  };
  const cloud = slimSeasonForCloudUpload(season);
  assert(cloud.worldCupCompetition?.phase === 'GROUP', 'World Cup state must survive ultra slim');
  assert(cloud.nationalFixtures?.length === 1, 'national fixtures must survive ultra slim');
});

check('mergeCareerSaves keeps full local over slim remote checkpoint', () => {
  const local = {
    seed: 999,
    clubName: 'Vinaz Athletic',
    division: 'D',
    freshWorld: true,
    updatedAt: '2026-07-29T12:00:00.000Z',
    divisionTeams: { A: ['A1'], B: ['B1'], C: ['C1'], D: ['Vinaz Athletic'] },
    userRoster: Array.from({ length: 18 }, (_, i) => ({ name: `P${i}` })),
    worldRosters: { Rivals: [{ name: 'X' }] },
  };
  const remote = slimCareerForCloudUpload({
    seed: 111,
    clubName: 'Vinaz Athletic',
    division: 'A',
    updatedAt: '2026-07-29T20:00:00.000Z',
  });
  const merged = mergeCareerSaves(local, remote, Date.parse('2026-07-29T21:00:00.000Z'));
  assert(merged === local, 'fresh local career must win over stale remote');
  assert(merged.division === 'D', 'division preserved');
});

check('mergeCareerSaves prefers rich local when seeds differ', () => {
  const local = {
    seed: 222,
    clubName: 'New FC',
    division: 'D',
    createdAt: '2026-07-29T22:00:00.000Z',
    divisionTeams: { D: ['New FC'] },
    userRoster: Array.from({ length: 18 }, (_, i) => ({ name: `P${i}` })),
  };
  const remote = {
    seed: 111,
    clubName: 'Old FC',
    division: 'A',
    updatedAt: '2026-07-29T20:00:00.000Z',
    divisionTeams: { A: ['Old FC'] },
    userRoster: Array.from({ length: 18 }, (_, i) => ({ name: `O${i}` })),
  };
  const merged = mergeCareerSaves(local, remote, 0);
  assert(merged.seed === 222, 'new local seed must win');
});

check('isSlimCareerCheckpoint detects cloud checkpoint', () => {
  const slim = slimCareerForCloudUpload({ seed: 1, clubName: 'X', division: 'A' });
  assert(isSlimCareerCheckpoint(slim), 'upload checkpoint is slim');
  assert(!isSlimCareerCheckpoint({ seed: 1, divisionTeams: { D: ['X'] }, userRoster: Array.from({ length: 18 }, () => ({})) }), 'pyramid save is not slim');
});

check('isSeasonValidForCareer rejects local checkpoint blob', () => {
  const career = { seed: 42 };
  const checkpoint = { seed: 42, currentRound: 8, _localCheckpoint: true };
  assert(!isSeasonValidForCareer(career, checkpoint), 'checkpoint must hydrate before boot');
  assert(isSeasonValidForCareer(career, { seed: 42, standings: { A: [] } }), 'full season ok');
});

check('save revision grows monotonically for consecutive writes', () => {
  const first = stampSyncableSave(SAVE_KEYS.season, { saveRevision: Date.now() + 10_000 });
  const second = stampSyncableSave(SAVE_KEYS.season, first);
  assert(second.saveRevision > first.saveRevision, 'second revision must be greater');
});

check('explicit revision wins even when timestamp is older', () => {
  const local = {
    saveRevision: 20,
    updatedAt: '2026-01-01T00:00:00.000Z',
    careerCalendarDate: { day: 1, month: 1, year: 2026 },
  };
  const remote = {
    saveRevision: 19,
    updatedAt: '2026-12-01T00:00:00.000Z',
    careerCalendarDate: { day: 1, month: 12, year: 2026 },
  };
  assert(pickNewerSave(local, remote, SAVE_KEYS.season) === local, 'higher revision must win');
});

console.log(`\nSave sync tests: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
