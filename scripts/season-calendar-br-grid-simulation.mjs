/**
 * Simulação da grade semanal BR (2026) — doméstico ativo; internacional só molde.
 */
import { writeFileSync } from 'node:fs';
import {
  runBrGridSeasonSimulation,
  CONTINENTAL_CALENDAR_SLOTS,
} from '../js/engine/season-calendar-br-grid.js';
import { FUTURE_COMPETITION_MOLD as MOLD } from '../js/engine/season-calendar-mold.js';

const YEAR = 2026;
const report = runBrGridSeasonSimulation(YEAR);

console.log('=== Simulação calendário BR 2026 ===\n');
console.log(`Internacionais in-game: ${report.internationalInGame ? 'SIM' : 'NÃO'}`);
console.log(`CMU trava clubes: ${report.worldCupClubLocked ? 'SIM' : 'NÃO'} (${report.worldCupLockedDateCount} datas seleções)`);
console.log(`Ciclo: âncora ${report.cycle.anchorYear} · offset ${report.cycle.cycleOffset}`);
console.log(`LIB enabled: ${MOLD.libertadores.enabled} · CSU enabled: ${MOLD.sudamericana.enabled}`);
console.log(`Slots CONMEBOL salvos: ${CONTINENTAL_CALENDAR_SLOTS.length}\n`);

console.log('--- Contagem de datas nominais ---');
Object.entries(report.calendarCounts).forEach(([key, val]) => {
  console.log(`  ${key}: ${val}`);
});

console.log('\n--- Fases (amostra) ---');
report.phaseSamples.forEach(row => {
  console.log(`  ${row.label} (${row.date}) → ${row.phase}`);
  console.log(`    EST=${row.weekdays.EST} BSA=${row.weekdays.BSA} BSB=${row.weekdays.BSB} CBR=${row.weekdays.CBR}`);
});

console.log('\n--- 13 slots CONMEBOL (registro; não entra no jogo) ---');
report.continentalSlots.forEach(s => {
  console.log(`  #${s.slot} ${s.date} (${s.weekday})${s.paused ? ' [pausa CMU]' : ''}`);
});

console.log('\n--- Matriz divisões (2026) ---');
report.validationMatrix.scenarios
  .filter(s => s.seasonYear === 2026 && s.packageId === 'elite_full')
  .forEach(s => {
    const tag = s.pass ? '✓' : '✗';
    console.log(`  ${tag} Série ${s.division}: ${s.matchCount} jogos (${s.packageLabel})`);
  });
console.log('\n--- Recopas (SCB in-game · REC molde) ---');
report.recopaNational.forEach(s => console.log(`  SCB ${s.leg}: ${s.date}`));
report.recopaSudamericana.forEach(s => console.log(`  REC ${s.leg}: ${s.date}`));

console.log('\n--- Ciclo quadrienal (molde 2026 → 2030 → 2034) ---');
report.quadrennialChecks.forEach(c => {
  console.log(`  ${c.label}: janela [${c.month + 1}/${c.day}] · âncora ${c.anchorYear} → ${c.nextAnchorYear}`);
});

console.log('\n--- Cenários de clube ---');
let failed = 0;
report.scenarios.forEach(s => {
  const ok = s.pass;
  if (!ok) failed += 1;
  const tag = ok ? '✓' : '✗';
  const note = s.includeContinental ? ' [molde CON]' : '';
  console.log(
    `  ${tag} ${s.id}${note}: ${s.matchCount} jogos, falhas=${s.expectedFailures}, rest=${s.restConflicts}`,
  );
});

console.log(`\n--- Resultado ---`);
if (report.allScenariosPass) {
  console.log('✓ Todos os cenários domésticos (+ CON futuro) passaram sem violar descanso mínimo.');
} else {
  console.log('✗ Há cenários com conflito de descanso — ver detalhes acima.');
}

const outPath = new URL('../tmp-br-grid-simulation.json', import.meta.url);
writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(`\nRelatório JSON: ${outPath.pathname}`);

process.exit(failed ? 1 : 0);
