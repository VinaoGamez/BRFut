/**
 * Validação cruzada: clube em cada divisão (A–D) × pacotes × ciclo 2026–2030.
 * Continental e Recopa Sul-Americana são molde (enabled: false in-game).
 */
import { writeFileSync } from 'node:fs';
import {
  runBrGridValidationMatrix,
  BR_GRID_VALIDATION_PACKAGES,
  BR_GRID_DIVISION_LEAGUE_KEYS,
  quadrennialSeasonYearsThrough,
} from '../js/engine/season-calendar-br-grid.js';
import { FUTURE_COMPETITION_MOLD } from '../js/engine/season-calendar-mold.js';
import { describeCalendarCycle } from '../js/engine/season-calendar-cycle.js';

const END_YEAR = Number(process.env.CYCLE_END_YEAR) || 2030;
const YEARS = quadrennialSeasonYearsThrough(END_YEAR);
const ANCHOR_YEARS = YEARS.filter(y => describeCalendarCycle(y).isAnchorYear);

const report = runBrGridValidationMatrix(YEARS);

console.log('=== Validação calendário BR — ciclo quadrienal ===\n');
console.log(`Anos: ${YEARS.join(' → ')}`);
console.log(`Anos-âncora CMU: ${ANCHOR_YEARS.join(', ')}`);
console.log(`Divisões: ${Object.keys(BR_GRID_DIVISION_LEAGUE_KEYS).join(', ')}`);
console.log(`Pacotes: ${Object.keys(BR_GRID_VALIDATION_PACKAGES).length}`);
console.log(`Cenários totais: ${report.scenarioCount}`);
console.log(`Internacionais in-game: LIB=${FUTURE_COMPETITION_MOLD.libertadores.enabled} CSU=${FUTURE_COMPETITION_MOLD.sudamericana.enabled}`);
console.log(`Recopa Nacional in-game: ${FUTURE_COMPETITION_MOLD.recopa_national.enabled}\n`);

console.log('--- Paridade quadrienal (molde civil) ---');
report.quadrennialParity.pairs.forEach(pair => {
  const tag = pair.valid ? '✓' : '✗';
  console.log(`  ${tag} ${pair.baseYear} → ${pair.nextYear}`);
  pair.checks.forEach(c => {
    const info = c.note ? ` (${c.note})` : '';
    console.log(`      ${c.match ? '✓' : '○'} ${c.label}: [${c.base.join(', ')}] ≡ [${c.next.join(', ')}]${info}`);
  });
});
if (report.quadrennialParity.valid) {
  console.log('  ✓ Definições do molde repetem entre anos-âncora (2026 ≡ 2030).\n');
} else {
  console.log('  ✗ Divergência estrutural entre anos-âncora.\n');
}

ANCHOR_YEARS.forEach(year => {
  const meta = report.calendarByYear[year];
  console.log(`--- Molde ${year} (âncora · offset ${meta.cycle.cycleOffset}) ---`);
  console.log(`  CMU trava clubes: ${meta.worldCupClubLocked ? 'SIM' : 'NÃO'}`);
  console.log(`  Recopa Nacional (SCB): ${meta.recopaNational.join(', ')}`);
  console.log(`  Recopa Sul-Americana (REC): ${meta.recopaSudamericana.join(', ')}`);
  console.log(`  Série A: ${meta.leagueAStart} → ${meta.leagueAEnd}`);
  console.log(`  Slots CONMEBOL ativos/pausados: ${meta.continentalActive}/${meta.continentalPaused}`);
  console.log('');
});

const printElite = year => {
  console.log(`--- Elite full · ${year} ---`);
  report.scenarios
    .filter(s => s.seasonYear === year && s.packageId === 'elite_full')
    .forEach(s => {
      const tag = s.pass ? '✓' : '✗';
      const breakdown = Object.entries(s.byCompetition || {})
        .map(([k, v]) => `${k}=${v}`)
        .join(' ');
      console.log(`  ${tag} Série ${s.division}: ${s.matchCount} jogos · remarcações=${s.shiftCount ?? 0} · ${breakdown}`);
    });
  console.log('');
};

ANCHOR_YEARS.forEach(printElite);

console.log('--- Tabela resumo (ano × divisão · elite_full) ---');
YEARS.forEach(year => {
  const rows = report.scenarios.filter(s => s.seasonYear === year && s.packageId === 'elite_full');
  const ok = rows.every(s => s.pass);
  const cycle = describeCalendarCycle(year);
  const games = rows.map(s => `${s.division}:${s.matchCount}`).join(' ');
  console.log(`  ${year} (âncora=${cycle.isAnchorYear ? 'sim' : 'não'} CMU=${cycle.worldCupClubLocked ? 'sim' : 'não'}): ${ok ? 'OK' : 'FAIL'} · ${games}`);
});

console.log('\n--- Tabela completa (todos pacotes · Série A) ---');
const byYear = {};
report.scenarios.filter(s => s.division === 'A').forEach(s => {
  if (!byYear[s.seasonYear]) byYear[s.seasonYear] = {};
  byYear[s.seasonYear][s.packageId] = s.pass ? 'OK' : 'FAIL';
});
YEARS.forEach(year => {
  const row = byYear[year] || {};
  const cells = Object.keys(BR_GRID_VALIDATION_PACKAGES).map(pkg => `${pkg.slice(0, 4)}:${row[pkg] || '?'}`);
  console.log(`  ${year}: ${cells.join(' | ')}`);
});

const failed = report.scenarios.filter(s => !s.pass);
console.log(`\n--- Resultado final ---`);
console.log(`${report.passCount}/${report.scenarioCount} cenários OK (${YEARS.length} anos × 4 div × 5 pacotes)`);

if (failed.length) {
  console.log('\nCenários com problema:');
  failed.slice(0, 15).forEach(s => {
    console.log(`  ✗ ${s.id}: jogos=${s.matchCount} falhas=${s.expectedFailures} rest=${s.restConflicts}`);
  });
  if (failed.length > 15) console.log(`  … +${failed.length - 15} outros`);
} else {
  console.log('✓ Ciclo 2026–2030 completo — descanso mínimo e molde OK em todos os cenários.');
}

const outPath = new URL('../tmp-br-grid-validation-2030.json', import.meta.url);
writeFileSync(
  outPath,
  JSON.stringify(
    {
      cycleEndYear: END_YEAR,
      seasonYears: YEARS,
      quadrennialParity: report.quadrennialParity,
      passCount: report.passCount,
      scenarioCount: report.scenarioCount,
      calendarByYear: report.calendarByYear,
      scenarios: report.scenarios.map(s => ({
        id: s.id,
        seasonYear: s.seasonYear,
        division: s.division,
        packageId: s.packageId,
        matchCount: s.matchCount,
        shiftCount: s.shiftCount ?? 0,
        byCompetition: s.byCompetition,
        pass: s.pass,
        expectedFailures: s.expectedFailures,
        restConflicts: s.restConflicts,
      })),
    },
    null,
    2,
  ),
);
console.log(`\nRelatório JSON: ${outPath.pathname}`);

process.exit(report.allPass && report.quadrennialParity.valid ? 0 : 1);
