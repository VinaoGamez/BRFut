import {
  materializeRecopaNational,
  restoreRecopaNational,
  serializeRecopaNational,
  recopaNationalFixtures,
  completeRecopaNationalFixture,
  recopaNationalEmptyMessage,
  isRecopaNationalEnabled,
  RECOPA_NATIONAL_COMPETITION,
} from '../js/engine/recopa-national.js';
import { resolveFixtureCompetitionCode } from '../js/engine/season-calendar-mold.js';
import { buildPageCompetitionOptions } from '../js/feature/championship-page/hub.js';
import { getCompetitionSlotKey, ACTIVE_WEEK_PROFILE } from '../js/engine/season-week-slots.js';

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

check('Recopa Nacional está habilitada no molde', () => {
  assert(isRecopaNationalEnabled() === true);
});

check('grade semanal BR ativa', () => {
  assert(ACTIVE_WEEK_PROFILE === 'br_weekly_grid');
  assert(getCompetitionSlotKey('recopa_national') === 'recopa_national');
});

check('materialize monta fixture entre campeões distintos', () => {
  const comp = materializeRecopaNational(restoreRecopaNational(null, 2027), {
    seasonYear: 2027,
    priorChampions: { season: 2026, A: 'Palmeiras', CUP: 'Flamengo' },
  });
  assert(comp.ready === true);
  assert(comp.skippedSameClub === false);
  assert(comp.fixture?.home === 'Palmeiras');
  assert(comp.fixture?.away === 'Flamengo');
  assert(comp.fixture?.competition === RECOPA_NATIONAL_COMPETITION);
  assert(recopaNationalFixtures(comp).length === 1);
});

check('mesmo clube campeão pula Recopa', () => {
  const comp = materializeRecopaNational(restoreRecopaNational(null, 2027), {
    seasonYear: 2027,
    priorChampions: { season: 2026, A: 'Palmeiras', CUP: 'Palmeiras' },
  });
  assert(comp.complete === true);
  assert(comp.skippedSameClub === true);
  assert(comp.fixture === null);
  assert(comp.champion === 'Palmeiras');
});

check('1ª temporada sem priorSeasonChampions', () => {
  const comp = restoreRecopaNational(null, 2026);
  materializeRecopaNational(comp, { seasonYear: 2026, priorChampions: null });
  assert(comp.ready === false);
  assert(recopaNationalEmptyMessage(comp).includes('2ª temporada'));
});

check('resolveFixtureCompetitionCode mapeia SCB', () => {
  assert(resolveFixtureCompetitionCode({ competition: RECOPA_NATIONAL_COMPETITION }) === 'SCB');
});

check('hub Campeonatos inclui Recopa Nacional', () => {
  const options = buildPageCompetitionOptions({ FEATURES: { stateLeague: true }, savedNewGame: {} });
  assert(options.some(opt => opt.id === 'RECOPA' && opt.label === 'Recopa Nacional'));
});

check('completeRecopaNationalFixture define campeão', () => {
  const comp = materializeRecopaNational(restoreRecopaNational(null, 2027), {
    seasonYear: 2027,
    priorChampions: { season: 2026, A: 'Palmeiras', CUP: 'Flamengo' },
  });
  const game = comp.fixture;
  game.homeGoals = 2;
  game.awayGoals = 1;
  completeRecopaNationalFixture(comp, game);
  assert(comp.complete === true);
  assert(comp.champion === 'Palmeiras');
  assert(serializeRecopaNational(comp).champion === 'Palmeiras');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
