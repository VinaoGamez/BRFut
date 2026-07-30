/**
 * Testes — Copa progressiva (grupos → mata-mata).
 * Uso: node scripts/world-cup-competition-tests.mjs
 */
import {
  createWorldCupCompetition,
  getWorldCupAllFixtures,
  advanceWorldCupThroughDate,
  worldCupGroupMatchdayEndDate,
  advanceWorldCupSpectatorThroughWindow,
  simulateNationalTeamMatch,
  resolveWorldCupKnockoutIfDrawn,
  resolveWorldCupChampionCode,
  earliestPendingWorldCupUserFixture,
} from '../js/engine/world-cup-competition.js';
import { WORLD_CUP_GROUP_FIXTURE_COUNT } from '../js/engine/world-cup-calendar.js';
import { isGroupStageComplete } from '../js/engine/world-cup-standings.js';
import { winnerFromGame } from '../js/engine/world-cup-bracket.js';

let passed = 0;
let failed = 0;

function check(label, fn) {
  try {
    fn();
    passed += 1;
    console.log(`OK  ${label}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${label}`, error.message);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

check('início só com 72 jogos de grupos', () => {
  const comp = createWorldCupCompetition({ year: 2026, random: () => 0.5 });
  assert(comp.groupFixtures.length === WORLD_CUP_GROUP_FIXTURE_COUNT);
  assert(comp.knockoutFixtures.length === 0);
  assert(getWorldCupAllFixtures(comp).length === 72);
});

check('grupo C = Brasil, Marrocos, Escócia, Haiti', () => {
  const comp = createWorldCupCompetition({ year: 2026, random: () => 0.5 });
  const groupC = comp.groupFixtures.filter(g => g.group === 'C');
  assert(groupC.length === 6);
  const teams = new Set(groupC.flatMap(g => [g.homeCode, g.awayCode]));
  assert(teams.has('BRA'));
  assert(teams.has('MAR'));
  assert(teams.has('SCO'));
  assert(teams.has('HAI'));
});

check('CPU simula grupos — mata-mata só depois', () => {
  const comp = createWorldCupCompetition({ year: 2026, random: () => 0.42 });
  const lastGroupDate = new Date(
    Math.max(...comp.groupFixtures.map(g => new Date(g.date).getTime())),
  );
  advanceWorldCupThroughDate(comp, lastGroupDate, {
    random: () => 0.42,
    isUserTeam: () => false,
    simulate: simulateNationalTeamMatch,
  });
  assert(isGroupStageComplete(comp.groupFixtures));
  assert(comp.knockoutGenerated === true);
  assert(comp.knockoutFixtures.length === 16);
  assert(getWorldCupAllFixtures(comp).length === 72 + 16);
});

check('espectador simula CMU progressivamente na janela', () => {
  const comp = createWorldCupCompetition({ year: 2026, random: () => 0.42 });
  const midJune = new Date(2026, 5, 15, 12);
  advanceWorldCupSpectatorThroughWindow(comp, midJune, 2026, {
    random: () => 0.42,
    simulate: simulateNationalTeamMatch,
  });
  assert(comp.phase !== 'complete' || comp.knockoutGenerated === true);
  const played = comp.groupFixtures.filter(g => g.completed || g.homeGoals != null).length;
  assert(played > 0 && played < comp.groupFixtures.length);
});

check('julho sem final placeholder antes dos grupos', () => {
  const comp = createWorldCupCompetition({ year: 2026, random: () => 0.5 });
  const july19 = new Date(2026, 6, 19, 12);
  const beforeGroups = getWorldCupAllFixtures(comp).filter(
    g => new Date(g.date).getMonth() === 6 && new Date(g.date).getDate() === 19,
  );
  assert(beforeGroups.length === 0);
  advanceWorldCupThroughDate(comp, july19, {
    random: () => 0.42,
    isUserTeam: () => false,
    simulate: simulateNationalTeamMatch,
  });
  const after = getWorldCupAllFixtures(comp).filter(
    g => g.phase === 'FINAL' && new Date(g.date).getDate() === 19,
  );
  assert(after.length <= 1);
});

check('mata-mata empatado resolve com prorrogação/pênaltis', () => {
  const game = {
    id: 'QF1',
    home: 'Brasil',
    away: 'Iraque',
    homeCode: 'BRA',
    awayCode: 'IRQ',
    homeGoals: 0,
    awayGoals: 0,
    completed: true,
    knockout: true,
    stage: 'QF',
    competition: 'COPA DO MUNDO',
  };
  const competition = { teamStrength: { BRA: { teamPower: 90 }, IRQ: { teamPower: 78 } } };
  let n = 0;
  const random = () => {
    n += 1;
    return (n * 0.19) % 1;
  };
  assert(resolveWorldCupKnockoutIfDrawn(game, competition, random) === true);
  assert(winnerFromGame(game) != null, 'deve ter vencedor após desempate');
  assert(game.extraTimePlayed === true);
  assert(game.shootoutWinner || game.homeGoals !== game.awayGoals);
});

check('fim da rodada da Copa alcança jogos de todos os 12 grupos', () => {
  const comp = createWorldCupCompetition({ year: 2026, random: () => 0.42 });
  const end = worldCupGroupMatchdayEndDate(comp, 1);
  assert(end instanceof Date && !Number.isNaN(end.getTime()), 'data final da rodada');
  advanceWorldCupThroughDate(comp, end, {
    random: () => 0.42,
    isUserTeam: game => game.homeCode === 'BRA' || game.awayCode === 'BRA',
    simulate: simulateNationalTeamMatch,
  });
  const cpuGames = comp.groupFixtures.filter(
    game => Number(game.matchday) === 1 && game.homeCode !== 'BRA' && game.awayCode !== 'BRA',
  );
  assert(cpuGames.length === 23, `esperado 23 jogos CPU, recebido ${cpuGames.length}`);
  assert(cpuGames.every(game => game.completed && game.homeGoals != null), 'todos os grupos simulados');
});

check('campeão da final ao vivo aparece antes do próximo avanço', () => {
  const competition = {
    champion: null,
    knockoutFixtures: [{
      id: 'F',
      home: 'Estados Unidos',
      away: 'Irã',
      homeCode: 'USA',
      awayCode: 'IRN',
      homeGoals: 0,
      awayGoals: 0,
      shootoutWinner: 'Estados Unidos',
      completed: true,
    }],
  };
  assert(resolveWorldCupChampionCode(competition) === 'USA');
});

check('CPU completa mata-mata sem empates órfãos', () => {
  const comp = createWorldCupCompetition({ year: 2026, random: () => 0.37 });
  const end = new Date(2026, 6, 20, 12);
  let n = 0;
  advanceWorldCupThroughDate(comp, end, {
    random: () => {
      n += 1;
      return (n * 0.41) % 1;
    },
    isUserTeam: () => false,
    simulate: simulateNationalTeamMatch,
  });
  assert(comp.phase === 'complete' || comp.knockoutGenerated);
  const orphanDraw = (comp.knockoutFixtures || []).find(
    g =>
      (g.completed || g.homeGoals != null) &&
      Number(g.homeGoals) === Number(g.awayGoals) &&
      !g.shootoutWinner &&
      !g.winnerCode,
  );
  assert(!orphanDraw, 'nenhum mata-mata deve ficar empatado sem vencedor');
});

check('calendário à frente completa a Copa numa chamada', () => {
  const comp = createWorldCupCompetition({ year: 2026, random: () => 0.33 });
  const pastWindow = new Date(2026, 7, 1, 12);
  let n = 0;
  advanceWorldCupThroughDate(comp, pastWindow, {
    random: () => {
      n += 1;
      return (n * 0.29) % 1;
    },
    isUserTeam: () => false,
  });
  assert(comp.phase === 'complete', 'deve fechar a Copa quando a data já passou da janela');
  assert(!!comp.champion, 'deve ter campeão');
});

check('earliestPendingWorldCupUserFixture pega o jogo mais antigo', () => {
  const pending = earliestPendingWorldCupUserFixture(
    {
      groupFixtures: [],
      knockoutFixtures: [
        {
          home: 'Brasil',
          away: 'França',
          homeCode: 'BRA',
          awayCode: 'FRA',
          date: new Date(2026, 6, 10),
          completed: false,
        },
        {
          home: 'Brasil',
          away: 'Alemanha',
          homeCode: 'BRA',
          awayCode: 'GER',
          date: new Date(2026, 6, 5),
          completed: false,
        },
      ],
    },
    game => game.homeCode === 'BRA' || game.awayCode === 'BRA',
  );
  assert(pending);
  assert(new Date(pending.date).getDate() === 5);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
