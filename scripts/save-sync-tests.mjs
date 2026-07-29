import {
  mergeSeasonSaves,
  pickNewerSave,
  maxStateLeagueRound,
  hasUsableStateLeagueSave,
  pickRicherStateLeagues,
} from '../js/core/save-sync.js';
import { slimSeasonForCloudUpload } from '../js/core/cloud-save-payload.js';
import { slimSeasonPayloadLevel4 } from '../js/engine/season-save-quota.js';
import { SAVE_KEYS } from '../js/core/constants.js';

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

console.log(`\nSave sync tests: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
