/**
 * Regressão do seletor de temporada na página de Campeonatos.
 * node scripts/championship-history-tests.mjs
 */
import {
  resolveChampionshipPageRenderMode,
  serieDViewModelFromArchive,
  stateLeagueViewModelFromArchive,
  worldCupViewModelFromArchive,
} from '../js/feature/championship-page/index.js';
import { buildSeasonArchive } from '../js/engine/season-archive.js';
import { computeGroupStandings } from '../js/engine/world-cup-standings.js';

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

const assertEqual = (actual, expected) => {
  if (actual !== expected) throw new Error(`esperado ${expected}, recebido ${actual}`);
};

check('Copa atual continua usando o renderizador de mata-mata', () => {
  assertEqual(
    resolveChampionshipPageRenderMode({ archiveView: false, knockoutView: true }),
    'knockout',
  );
});

check('Copa arquivada tem precedência sobre o mata-mata atual', () => {
  assertEqual(
    resolveChampionshipPageRenderMode({ archiveView: true, knockoutView: true }),
    'archive',
  );
});

check('Série arquivada usa os dados históricos', () => {
  assertEqual(
    resolveChampionshipPageRenderMode({ archiveView: true, knockoutView: false }),
    'archive',
  );
});

check('arquivo preserva Recopa Nacional, Copa do Mundo e Estaduais', () => {
  const archive = buildSeasonArchive({
    careerSeason: 2030,
    nationalCompetitions: {
      A: { standings: [{ club: 'Clube A', played: 1, wins: 1, points: 3 }] },
      B: { standings: [] },
      C: { standings: [] },
      D: { standings: [] },
    },
    recopaCompetition: { champion: 'Clube A', complete: true },
    recopaFixtures: [
      { home: 'Clube A', away: 'Clube B', homeGoals: 2, awayGoals: 1, completed: true },
    ],
    worldCupCompetition: { champion: 'BRA', complete: true },
    worldCupChampion: 'Brasil',
    worldCupFixtures: [
      { home: 'Brasil', away: 'França', homeGoals: 1, awayGoals: 0, phase: 'FINAL', completed: true },
    ],
    stateLeagueResults: {
      MT: [{ tier: 1, champion: 'Cuiabá', runnerUp: 'Operário', complete: true }],
    },
  });
  assertEqual(archive.version, 4);
  assertEqual(archive.recopaCompetition.champion, 'Clube A');
  assertEqual(archive.recopaCompetition.fixtures[0].homeGoals, 2);
  assertEqual(archive.worldCupCompetition.champion, 'Brasil');
  assertEqual(archive.worldCupCompetition.fixtures[0].phase, 'FINAL');
  assertEqual(archive.stateLeagueResults.MT[0].champion, 'Cuiabá');
});

check('arquivo preserva tabela, rodadas e mata-mata dos Estaduais', () => {
  const archive = buildSeasonArchive({
    careerSeason: 2030,
    nationalCompetitions: { A: {}, B: {}, C: {}, D: {} },
    stateLeagueSnapshot: {
      competitions: {
        MT: [{
          tier: 1,
          leagueRoundCount: 1,
          teams: ['Cuiabá', 'Operário'],
          standings: [[
            { club: 'Cuiabá', played: 1, wins: 1, draws: 0, losses: 0, goalDiff: 1, points: 3 },
            { club: 'Operário', played: 1, wins: 0, draws: 0, losses: 1, goalDiff: -1, points: 0 },
          ]],
          fixtures: [
            [{ home: 'Cuiabá', away: 'Operário', homeGoals: 1, awayGoals: 0, completed: true }],
            [{ home: 'Cuiabá', away: 'Mixto', homeGoals: 2, awayGoals: 1, phase: 'final', completed: true }],
          ],
        }],
      },
    },
  });
  const view = stateLeagueViewModelFromArchive(archive, 'EST:MT:1');
  assertEqual(view.standings[0][0].points, 3);
  assertEqual(view.fixtures[1][0].phase, 'final');
});

check('arquivo preserva grupos e todas as fases da Série D', () => {
  const rounds = Array.from({ length: 22 }, () => []);
  rounds[0] = [{ home: 'Clube A', away: 'Clube B', groupIndex: 0, homeGoals: 1, awayGoals: 0, completed: true }];
  rounds[10] = [{ home: 'Clube A', away: 'Clube C', tieId: 'd-1', homeGoals: 2, awayGoals: 0, completed: true }];
  rounds[11] = [{ home: 'Clube C', away: 'Clube A', tieId: 'd-1', homeGoals: 1, awayGoals: 0, completed: true }];
  const archive = buildSeasonArchive({
    careerSeason: 2030,
    nationalCompetitions: {
      A: {}, B: {}, C: {},
      D: {
        groups: [['Clube A', 'Clube B']],
        standings: [
          { club: 'Clube A', played: 1, wins: 1, draws: 0, losses: 0, goalDiff: 1, points: 3 },
          { club: 'Clube B', played: 1, wins: 0, draws: 0, losses: 1, goalDiff: -1, points: 0 },
        ],
        fixtures: rounds,
        knockout: { promoted: ['Clube A'] },
      },
    },
  });
  const view = serieDViewModelFromArchive(archive);
  assertEqual(view.groups[0].standings[0].club, 'Clube A');
  assertEqual(view.groups[0].fixtures.length, 1);
  assertEqual(view.phases[0].fixtures.length, 2);
  assertEqual(view.phases[0].fixtures[0].tieId, 'd-1');
});

check('arquivo da Copa do Mundo recupera grupos e mata-mata para o visual ao vivo', () => {
  const view = worldCupViewModelFromArchive({
    worldCupCompetition: {
      complete: true,
      fixtures: [
        { home: 'Brasil', away: 'Haiti', group: 'C', round: 1, homeGoals: 2, awayGoals: 0 },
        { home: 'Brasil', away: 'França', phase: 'FINAL', round: 9, homeGoals: 1, awayGoals: 0 },
      ],
    },
  });
  assertEqual(view.phase, 'complete');
  assertEqual(view.groupFixtures.length, 1);
  assertEqual(view.knockoutFixtures.length, 1);
  assertEqual(computeGroupStandings('C', view.groupFixtures).length, 2);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
