import {
  ensureLiveNationalRoundCommitted,
  nationalSeasonLastRound,
  resolveRoundAlreadyRecorded,
  resolveRoundForLiveCommit,
} from '../js/engine/round-advance.js';
import { reconcileLinkedFixtureWithLiveSnapshot } from '../js/feature/match-live-entry/index.js';
import { findLeagueFixtureByPair, gameMatchesRecordedCompat } from '../js/engine/competition-calendar.js';

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

check('partida ao vivo incompleta reabre fixture marcado incorretamente como concluído', () => {
  const linked = { completed: true, homeGoals: 0, awayGoals: 0 };
  reconcileLinkedFixtureWithLiveSnapshot(linked, {
    matchFinished: false,
    fixture: { completed: true, homeGoals: 2, awayGoals: 0 },
  });
  assert(linked.completed === false, 'fixture precisa permanecer pendente');
  assert(linked.homeGoals === 2 && linked.awayGoals === 0, 'placar ao vivo precisa ser preservado');
});

check('fim de jogo sincroniza fixture canônico mesmo quando snapshot já está concluído', () => {
  const canonical = { home: 'Usuário FC', away: 'Rival', round: 5 };
  const live = { home: 'Usuário FC', away: 'Rival', round: 5, completed: true };
  const history = [];
  let tableCommits = 0;
  const committed = ensureLiveNationalRoundCommitted(
    {
      getUserClub: () => 'Usuário FC',
      getChampionshipFixtures: () => [[], [], [], [], [canonical]],
      getLiveSideGoals: () => ({ home: [], away: [] }),
      getHomeGoals: () => 2,
      getAwayGoals: () => 1,
      getUserDivision: () => 'C',
      getNationalCompetitions: () => ({ C: { fixtures: [[], [], [], [], [canonical]] } }),
      leagueUserGameForRound: () => canonical,
      applyRoundToTable: () => { tableCommits += 1; },
      invalidateUserScheduleCache: () => {},
    },
    { liveMatchGame: live, roundForCommit: 5, seasonRoundHistory: history },
  );
  assert(committed, 'commit deve concluir');
  assert(canonical.completed === true, 'fixture do calendário precisa ser concluído');
  assert(canonical.homeGoals === 2 && canonical.awayGoals === 1, 'placar precisa chegar ao calendário');
  assert(history[0]?.games?.length === 1, 'resultado precisa entrar no histórico');
  assert(tableCommits === 1, 'tabela precisa receber o resultado uma vez');
});

check('fim da temporada usa o total real de rodadas da divisão', () => {
  assert(nationalSeasonLastRound({ getChampionshipFixtures: () => Array.from({ length: 54 }) }, 'C') === 54);
  assert(nationalSeasonLastRound({ getChampionshipFixtures: () => Array.from({ length: 38 }) }, 'A') === 38);
  assert(nationalSeasonLastRound({ getChampionshipFixtures: () => [] }, 'D') === 22);
});

check('history without standings update is discarded', () => {
  const history = [{ round: 5, games: [{ home: 'A', away: 'B', homeGoals: 2, awayGoals: 1 }] }];
  const userGame = { home: 'A', away: 'B', round: 5 };
  const ok = resolveRoundAlreadyRecorded(history, 5, {
    userGame,
    userLeaguePlayed: () => 4,
  });
  assert(!ok, 'should not treat as recorded');
  assert(!history.some(item => item.round === 5), 'stale history removed');
});

check('history with matching standings counts as recorded', () => {
  const history = [{ round: 5, games: [{ home: 'A', away: 'B', round: 5, homeGoals: 2, awayGoals: 1 }] }];
  const userGame = { home: 'A', away: 'B', round: 5 };
  const ok = resolveRoundAlreadyRecorded(history, 5, {
    userGame,
    userLeaguePlayed: () => 5,
  });
  assert(ok, 'should treat as recorded');
  assert(history.length === 1, 'history kept');
});

check('history with wrong fixture is discarded', () => {
  const history = [{ round: 5, games: [{ home: 'A', away: 'C', homeGoals: 1, awayGoals: 0 }] }];
  const userGame = { home: 'A', away: 'B', round: 5 };
  const ok = resolveRoundAlreadyRecorded(history, 5, {
    userGame,
    userLeaguePlayed: () => 5,
  });
  assert(!ok, 'mismatched fixture should not count');
  assert(!history.some(item => item.round === 5), 'mismatched history removed');
});

check('history discarded when user fixture still pending', () => {
  const history = [{ round: 5, games: [{ home: 'A', away: 'B', round: 5, homeGoals: 2, awayGoals: 1 }] }];
  const userGame = { home: 'A', away: 'B', round: 5 };
  const ok = resolveRoundAlreadyRecorded(history, 5, {
    userGame,
    userLeaguePlayed: () => 5,
    isFixtureCompleted: () => false,
  });
  assert(!ok, 'pending user fixture must re-commit round');
  assert(!history.some(item => item.round === 5), 'stale history removed');
});

check('live commit round follows finished fixture round', () => {
  const fixtures = [[{ home: 'Usuário FC', away: 'Rival', round: 5 }]];
  const game = { home: 'Usuário FC', away: 'Rival' };
  assert(resolveRoundForLiveCommit(game, 16, 'Usuário FC', fixtures) === 5, 'must infer fixture round');
  assert(resolveRoundForLiveCommit(game, 16, 'Outro', fixtures) === 16, 'non-user fixture keeps currentRound');
});

check('findLeagueFixtureByPair resolves round without game.round', () => {
  const fixtures = [
    [],
    [],
    [],
    [],
    [{ home: 'Usuário FC', away: 'Rival', round: 5 }],
  ];
  const hit = findLeagueFixtureByPair({ home: 'Usuário FC', away: 'Rival' }, fixtures);
  assert(hit?.round === 5, 'must locate pair in calendar');
});

check('turno e returno não são confundidos pelo mesmo par de clubes', () => {
  const fixtures = [
    [{ home: 'Usuário FC', away: 'Rival', round: 1, fixtureId: 'ida' }],
    [{ home: 'Rival', away: 'Usuário FC', round: 2, fixtureId: 'volta' }],
  ];
  const returnLeg = findLeagueFixtureByPair(
    { home: 'Rival', away: 'Usuário FC', round: 2 },
    fixtures,
  );
  assert(returnLeg?.game?.fixtureId === 'volta', 'deve selecionar o jogo da rodada e mando corretos');
  assert(
    !gameMatchesRecordedCompat(
      { home: 'Rival', away: 'Usuário FC', round: 2 },
      { home: 'Usuário FC', away: 'Rival', round: 1 },
    ),
    'resultado da ida não pode concluir a volta',
  );
});

check('save legado sem rodada ainda usa correspondência pelo par', () => {
  assert(
    gameMatchesRecordedCompat(
      { home: 'Usuário FC', away: 'Rival', round: 5 },
      { home: 'Rival', away: 'Usuário FC' },
    ),
    'registro antigo sem rodada deve continuar recuperável',
  );
});

console.log(`\nround-advance-tests: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
