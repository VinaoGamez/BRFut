/**
 * Metas complementares — avaliação de fim de temporada.
 * node scripts/season-objectives-tests.mjs
 */
import {
  evaluateSeasonObjective,
  evaluateSeasonObjectives,
  seasonObjectiveLiveProgress,
} from '../js/engine/season-objectives.js';

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

const objective = (id, evaluate, label = 'Meta teste') => ({
  id,
  category: 'tournament',
  label,
  evaluate,
});

check('evaluateSeasonObjective — posição cumprida', () => {
  const obj = objective('t_top_half', { type: 'position_max', max: 10, minPlayed: 10 });
  const result = evaluateSeasonObjective(obj, { position: 8, played: 20 });
  assert(result.status === 'met', `expected met, got ${result.status}`);
  assert(result.boardDelta === 1, `expected +1, got ${result.boardDelta}`);
});

check('evaluateSeasonObjective — posição falha', () => {
  const obj = objective('t_top_half', { type: 'position_max', max: 10, minPlayed: 10 });
  const result = evaluateSeasonObjective(obj, { position: 16, played: 20 });
  assert(result.status === 'missed', `expected missed, got ${result.status}`);
  assert(result.boardDelta === -1, `expected -1, got ${result.boardDelta}`);
});

check('evaluateSeasonObjectives — pacote teto +3', () => {
  const objectives = [
    objective('a', { type: 'goal_diff_min', min: 1 }, 'SG positivo'),
    objective('b', { type: 'goal_diff_min', min: 1 }, 'SG positivo 2'),
    objective('c', { type: 'goal_diff_min', min: 1 }, 'SG positivo 3'),
    objective('d', { type: 'goal_diff_min', min: 1 }, 'SG positivo 4'),
  ];
  const pack = evaluateSeasonObjectives(objectives, { goalDiff: 5, played: 20 });
  assert(pack.boardDelta === 3, `expected cap +3, got ${pack.boardDelta}`);
  assert(pack.rawBoardDelta === 4, `expected raw +4, got ${pack.rawBoardDelta}`);
  assert(pack.metCount === 4, `expected 4 met, got ${pack.metCount}`);
  assert(pack.body.includes('✓'), 'body should list checkmarks');
});

check('evaluateSeasonObjectives — pacote teto -3', () => {
  const objectives = [
    objective('a', { type: 'goal_diff_min', min: 50 }, 'SG impossível'),
    objective('b', { type: 'goal_diff_min', min: 50 }, 'SG impossível 2'),
    objective('c', { type: 'goal_diff_min', min: 50 }, 'SG impossível 3'),
    objective('d', { type: 'goal_diff_min', min: 50 }, 'SG impossível 4'),
  ];
  const pack = evaluateSeasonObjectives(objectives, { goalDiff: -10, played: 20 });
  assert(pack.boardDelta === -3, `expected cap -3, got ${pack.boardDelta}`);
  assert(pack.missedCount === 4, `expected 4 missed, got ${pack.missedCount}`);
});

check('evaluateSeasonObjectives — near não altera diretoria', () => {
  const objectives = [
    objective('a', { type: 'position_max', max: 10, minPlayed: 10 }, 'Top 10'),
  ];
  const pack = evaluateSeasonObjectives(objectives, { position: 11, played: 20 });
  assert(pack.items[0].status === 'near', `expected near, got ${pack.items[0].status}`);
  assert(pack.boardDelta === 0, `expected 0 delta, got ${pack.boardDelta}`);
});

check('seasonObjectiveLiveProgress — caixa positivo', () => {
  const obj = objective('e_positive', { type: 'balance_min', min: 0 });
  const live = seasonObjectiveLiveProgress(obj, { balance: 120_000 });
  assert(live.status === 'met', `expected met, got ${live.status}`);
});

check('sequência invicta considera o recorde alcançado, não apenas o fim da temporada', () => {
  const obj = objective('t_unbeaten_four', { type: 'unbeaten_streak', min: 4 });
  const live = seasonObjectiveLiveProgress(obj, { form: ['W', 'D', 'W', 'W', 'L'] });
  assert(live.status === 'met', `expected met, got ${live.status}`);
  assert(live.hint === '4 invicto', `expected streak 4, got ${live.hint}`);
});

check('sequência de vitórias considera o recorde alcançado antes de uma derrota', () => {
  const obj = objective('t_win_streak', { type: 'win_streak', min: 3 });
  const live = seasonObjectiveLiveProgress(obj, { form: ['W', 'W', 'W', 'L', 'W'] });
  assert(live.status === 'met', `expected met, got ${live.status}`);
  assert(live.hint.includes('3 vit'), `expected streak 3, got ${live.hint}`);
});

check('derrota não conta como partida invicta', () => {
  const obj = objective('t_unbeaten_four', { type: 'unbeaten_streak', min: 4 });
  const live = seasonObjectiveLiveProgress(obj, { form: ['L', 'L', 'L', 'L'] });
  assert(live.status === 'missed', `expected missed, got ${live.status}`);
  assert(live.hint === '0 invicto', `expected streak 0, got ${live.hint}`);
});

check('pacote de metas registra a versão atual das regras', () => {
  const pack = evaluateSeasonObjectives(
    [objective('t_win_streak', { type: 'win_streak', min: 3 })],
    { form: ['W', 'W', 'W'] },
  );
  assert(pack.rulesVersion === 2, `expected rulesVersion 2, got ${pack.rulesVersion}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
