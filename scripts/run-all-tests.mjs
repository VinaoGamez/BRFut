/**
 * Roda a bateria completa de testes headless do projeto.
 * Uso: npm run test:all
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function resolvePythonCommand() {
  const configured = String(process.env.BRFUT_PYTHON || '').trim();
  const codexBundled = process.env.USERPROFILE
    ? path.join(
        process.env.USERPROFILE,
        '.cache',
        'codex-runtimes',
        'codex-primary-runtime',
        'dependencies',
        'python',
        'python.exe',
      )
    : '';
  const candidates = [
    configured,
    process.platform === 'win32' ? 'py' : 'python3',
    'python',
    'python3',
    codexBundled,
  ].filter(Boolean);
  for (const command of [...new Set(candidates)]) {
    if (path.isAbsolute(command) && !fs.existsSync(command)) continue;
    const probe = spawnSync(command, ['--version'], { cwd: root, stdio: 'ignore' });
    if (!probe.error && probe.status === 0) return command;
  }
  return null;
}

const pythonCommand = resolvePythonCommand();

/** @type {{ label: string, steps: string[][] }[]} */
const SUITES = [
  { label: 'division-information-flow', steps: [['scripts/division-information-flow-tests.mjs']] },
  { label: 'player-card-stats-source', steps: [['scripts/player-card-stats-source-tests.mjs']] },
  { label: 'league-fixtures', steps: [['scripts/league-fixtures-tests.mjs']] },
  { label: 'season-scheduler', steps: [['scripts/season-scheduler-tests.mjs']] },
  { label: 'season-calendar-plan', steps: [['scripts/season-calendar-plan-tests.mjs']] },
  { label: 'season-calendar-mold', steps: [['scripts/season-calendar-mold-tests.mjs']] },
  { label: 'recopa-national', steps: [['scripts/recopa-national-tests.mjs']] },
  { label: 'knockout-shootout', steps: [['scripts/knockout-shootout-tests.mjs']] },
  { label: 'shootout-live', steps: [['scripts/shootout-live-tests.mjs']] },
  { label: 'competition-rules', steps: [['scripts/competition-rules-tests.mjs']] },
  { label: 'championship-history', steps: [['scripts/championship-history-tests.mjs']] },
  { label: 'serie-c-calendar', steps: [['scripts/serie-c-calendar-tests.mjs']] },
  { label: 'serie-d-knockout-legs', steps: [['scripts/serie-d-knockout-legs-tests.mjs']] },
  { label: 'messages-stale', steps: [['scripts/messages-stale-tests.mjs']] },
  { label: 'save-sync-controller', steps: [['scripts/save-sync-controller-tests.mjs']] },
  { label: 'club-solvency', steps: [['scripts/club-solvency-tests.mjs']] },
  { label: 'bank-loan', steps: [['scripts/bank-loan-tests.mjs']] },
  { label: 'season-objectives', steps: [['scripts/season-objectives-tests.mjs']] },
  { label: 'player-history', steps: [['scripts/player-history-tests.mjs']] },
  { label: 'match-ratings', steps: [['scripts/match-ratings-tests.mjs']] },
  { label: 'match-conversion', steps: [['scripts/match-conversion-tests.mjs']] },
  { label: 'finance-mood', steps: [['scripts/finance-mood-tests.mjs']] },
  { label: 'finances-impact', steps: [['scripts/finances-impact-tests.mjs']] },
  { label: 'transfer-division-fit', steps: [['scripts/transfer-division-fit-tests.mjs']] },
  { label: 'transfer-division-phase', steps: [['scripts/transfer-division-phase-tests.mjs']] },
  { label: 'loan-fit', steps: [['scripts/loan-fit-tests.mjs']] },
  { label: 'loan-buy-option', steps: [['scripts/loan-buy-option-tests.mjs']] },
  { label: 'loan-salary-split', steps: [['scripts/loan-salary-split-tests.mjs']] },
  { label: 'overdraft', steps: [['scripts/overdraft-tests.mjs']] },
  { label: 'sell-down-buyout', steps: [['scripts/sell-down-buyout-tests.mjs']] },
  { label: 'stadium-sectors', steps: [['scripts/stadium-sectors-tests.mjs']] },
  { label: 'stadium-naming', steps: [['scripts/stadium-naming-tests.mjs']] },
  { label: 'stadium-visual-tier', steps: [['scripts/stadium-visual-tier-tests.mjs']] },
  { label: 'soft-envelope', steps: [['scripts/soft-envelope-tests.mjs']] },
  { label: 'tv-advance', steps: [['scripts/tv-advance-tests.mjs']] },
  { label: 'season-goal-live', steps: [['scripts/season-goal-live-tests.mjs']] },
  { label: 'own-goal-report', steps: [['scripts/own-goal-report-tests.mjs']] },
  { label: 'youth-academy', steps: [['scripts/youth-academy-tests.mjs']] },
  { label: 'brfut-api', steps: [['scripts/brfut_api_tests.py']] },
  { label: 'transfers', steps: [['scripts/transfers-tests.mjs']] },
  { label: 'transfer-history-data', steps: [['scripts/transfer-history-data-tests.mjs']] },
  { label: 'manager-ranking-history', steps: [['scripts/manager-ranking-history-tests.mjs']] },
  {
    label: 'match-view-all',
    steps: [['scripts/match-view-world-tests.mjs'], ['scripts/match-view-play-tests.mjs']],
  },
  {
    label: 'ao-vivo-2d',
    steps: [['modules/ao-vivo-2d/scripts/run-tests.mjs', 'lab']],
  },
];

const runStep = scriptArgs => {
  const [script, ...args] = scriptArgs;
  const isPython = script.endsWith('.py');
  const command = isPython ? pythonCommand : process.execPath;
  if (!command) {
    console.error('Python não encontrado. Defina BRFUT_PYTHON com o caminho do executável.');
    return { status: 1 };
  }
  const stepArgs = isPython ? [script, ...args] : [script, ...args];
  return spawnSync(command, stepArgs, {
    cwd: root,
    stdio: 'inherit',
  });
};

const runSuite = ({ label, steps }) => {
  console.log(`\n=== ${label} ===\n`);
  for (const step of steps) {
    const result = runStep(step);
    const code = result.status ?? 1;
    if (code !== 0) return { label, ok: false, code };
  }
  return { label, ok: true, code: 0 };
};

const results = SUITES.map(runSuite);
const failed = results.filter(r => !r.ok);

console.log('\n--- resumo ---');
console.log(`${results.length - failed.length}/${results.length} suítes OK`);
if (failed.length) {
  console.error('Falharam:', failed.map(r => r.label).join(', '));
  process.exit(1);
}
console.log('test:all OK');
