/**
 * Regressão do seletor de temporada na página de Campeonatos.
 * node scripts/championship-history-tests.mjs
 */
import { resolveChampionshipPageRenderMode } from '../js/feature/championship-page/index.js';
import { buildSeasonArchive } from '../js/engine/season-archive.js';

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
  assertEqual(archive.version, 2);
  assertEqual(archive.recopaCompetition.champion, 'Clube A');
  assertEqual(archive.recopaCompetition.fixtures[0].homeGoals, 2);
  assertEqual(archive.worldCupCompetition.champion, 'Brasil');
  assertEqual(archive.worldCupCompetition.fixtures[0].phase, 'FINAL');
  assertEqual(archive.stateLeagueResults.MT[0].champion, 'Cuiabá');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
