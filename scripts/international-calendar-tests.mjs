/**
 * Calendário internacional — datas, ciclo e custo para os clubes.
 * node scripts/international-calendar-tests.mjs
 */
import {
  INTERNATIONAL_WINDOW_COST,
  INTERNATIONAL_WINDOWS,
  WORLD_CUP_CLUB_RELEASE_LEAD_DAYS,
  WORLD_CUP_EDITIONS,
  WORLD_CUP_YEARS,
  clubStoppages,
  cycleAnchorYear,
  describeInternationalCycle,
  effectiveLeagueWindow,
  internationalCyclePhase,
  internationalWindowsForYear,
  isWorldCupYear,
  qualifyingMatchdays,
  stoppageSummary,
  worldCupDateIsExact,
  worldCupWindow,
} from '../js/engine/international-calendar.js';

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

// --------------------------------------------------------------- Copas

check('2026 tem as datas oficiais', () => {
  const copa = worldCupWindow(2026);
  assert(copa.start[0] === 5 && copa.start[1] === 11, `início ${copa.start}`);
  assert(copa.end[0] === 6 && copa.end[1] === 19, `fim ${copa.end}`);
  assert(copa.exact === true, 'marcada como exata');
  assert(copa.teams === 48 && copa.matches === 104, '48 seleções, 104 jogos');
});

check('2030 tem as datas oficiais', () => {
  const copa = worldCupWindow(2030);
  assert(copa.start[0] === 5 && copa.start[1] === 8, `início ${copa.start}`);
  assert(copa.end[0] === 6 && copa.end[1] === 21, `fim ${copa.end}`);
  assert(copa.hosts.join() === 'Marrocos,Portugal,Espanha', `anfitriões ${copa.hosts}`);
});

check('2034 herda a última edição e avisa que é aproximação', () => {
  const copa = worldCupWindow(2034);
  assert(copa.exact === false, 'tem que marcar como aproximada');
  assert(worldCupDateIsExact(2034) === false, 'dateIsExact reflete');
  assert(copa.start[0] === 5 && copa.start[1] === 8, `herda o padrão de 2030`);
  assert(copa.year === 2034, 'ano é o doPedido');
});

check('2030 não usa as datas de 2026 — era o bug', () => {
  const a = worldCupWindow(2026);
  const b = worldCupWindow(2030);
  assert(a.start[1] !== b.start[1], '11/jun contra 8/jun');
  assert(a.end[1] !== b.end[1], '19/jul contra 21/jul');
});

// ----------------------------------------------------------------- ciclo

check('Copa só em 2026 e 2030', () => {
  assert(isWorldCupYear(2026) === true, '2026');
  assert(isWorldCupYear(2030) === true, '2030');
  [2027, 2028, 2029, 2031].forEach(y => assert(isWorldCupYear(y) === false, `${y} não é Copa`));
});

check('o ciclo não tem ano neutro', () => {
  assert(internationalCyclePhase(2026) === 'world-cup', '2026');
  assert(internationalCyclePhase(2027) === 'qualifying', '2027');
  assert(internationalCyclePhase(2028) === 'qualifying', '2028');
  assert(internationalCyclePhase(2029) === 'qualifying', '2029');
  assert(internationalCyclePhase(2030) === 'world-cup', '2030');
  [2026, 2027, 2028, 2029].forEach(y => {
    assert(cycleAnchorYear(y) !== null, `${y} tem âncora`);
  });
});

check('os anos de classificação apontam para 2030', () => {
  assert(cycleAnchorYear(2027) === 2030, '2027');
  assert(cycleAnchorYear(2028) === 2030, '2028');
  assert(cycleAnchorYear(2029) === 2030, '2029');
  assert(cycleAnchorYear(2026) === 2026, '2026 manda em si mesmo');
});

// -------------------------------------------------------------- janelas

check('2027 tem quatro janelas FIFA', () => {
  const janelas = INTERNATIONAL_WINDOWS[2027];
  assert(janelas.length === 4, `${janelas.length} janelas`);
  assert(janelas.map(j => j.id).join() === '2027-03,2027-06,2027-09,2027-11', janelas.map(j => j.id).join());
});

check('setembro e outubro são um bloco só', () => {
  const janela = INTERNATIONAL_WINDOWS[2028].find(j => j.id === '2028-09');
  assert(janela.start[0] === 8 && janela.start[1] === 18, `começa ${janela.start}`);
  assert(janela.end[0] === 9 && janela.end[1] === 3, `termina ${janela.end}`);
});

check('toda janela tem custo de liberação', () => {
  Object.values(INTERNATIONAL_WINDOWS).flat().forEach(janela => {
    assert(INTERNATIONAL_WINDOW_COST[janela.id] != null, `custo de ${janela.id}`);
  });
});

check('em ano de Copa a janela de junho some', () => {
  const comCopa = internationalWindowsForYear(2030).map(j => j.id);
  assert(!comCopa.includes('2030-06'), `não pode repetir a Copa: ${comCopa}`);
  assert(comCopa.length === 3, `${comCopa.length} janelas`);
  const semCopa = internationalWindowsForYear(2029).map(j => j.id);
  assert(semCopa.includes('2029-06'), 'ano de classificação mantém junho');
});

// ------------------------------------------------------------- paragens

check('ano de Copa tem uma paragem só, e longa', () => {
  const paragens = clubStoppages(2026);
  assert(paragens.length === 1, `${paragens.length} paragens`);
  const copa = paragens[0];
  assert(copa.kind === 'world-cup', `tipo ${copa.kind}`);
  // 17 dias antes de 11/jun é 25/mai, a data de liberação publicada pela FIFA.
  assert(copa.start[0] === 4 && copa.start[1] === 25, `liberação em ${copa.start}`);
  assert(copa.end[0] === 6 && copa.end[1] === 19, `fim em ${copa.end}`);
  assert(copa.days === 56, `${copa.days} dias`);
  assert(WORLD_CUP_CLUB_RELEASE_LEAD_DAYS === 17, 'antecedência de liberação');
});

check('a paragem de 2026 bate com os 56 dias da FIFA', () => {
  const { totalDays } = stoppageSummary(2026);
  assert(totalDays === 56, `${totalDays} dias — a FIFA publica 56`);
});

check('ano de classificação tem janelas curtas', () => {
  const paragens = clubStoppages(2029);
  assert(paragens.length === 4, `${paragens.length} janelas`);
  paragens.forEach(p => {
    assert(p.days <= 18, `${p.id} tem ${p.days} dias`);
    assert(p.kind === 'international-window', `${p.id} tipo ${p.kind}`);
  });
  paragens.forEach(p => assert(p.cost <= p.days, `${p.id}: custo ${p.cost} passa dos ${p.days} dias da janela`));
});

check('a Copa custa muito mais que uma janela de classificação', () => {
  const copa = stoppageSummary(2026);
  const classificatoria = stoppageSummary(2029);
  assert(copa.clubCostDays > classificatoria.clubCostDays, `${copa.clubCostDays} vs ${classificatoria.clubCostDays}`);
  const janela = classificatoria.stoppages[0];
  assert(copa.clubCostDays > janela.days * 4, `Copa ${copa.clubCostDays} contra ${janela.days} de uma janela`);
});

check('classificatórias só existem fora da Copa', () => {
  assert(qualifyingMatchdays(2029).length === 4, '2029 tem 4');
  assert(qualifyingMatchdays(2026).length === 0, '2026 é Copa');
});

// ------------------------------------------------------- janela efetiva

// Meses em base 0: [9, 28] é 28 de outubro, não de setembro.
const ateDezembro = { start: [0, 28], end: [11, 6] };
const ateOutubro = { start: [1, 14], end: [9, 28] };
const serieC = { start: [3, 5], end: [9, 25] };

check('divisão que já chega em dezembro absorve a Copa', () => {
  const r = effectiveLeagueWindow(ateDezembro, 2026);
  assert(r.extended === false, 'não precisa esticar');
  assert(r.extraDays === 0, `${r.extraDays} dias`);
});

check('divisão que termina antes da Copa estica pelo tamanho da paragem', () => {
  const r = effectiveLeagueWindow(ateOutubro, 2026);
  assert(r.extended === true, 'estica');
  assert(r.extraDays === 56, `${r.extraDays} dias`);
  assert(r.end[0] === 11 && r.end[1] === 23, `28/out + 56 dias dá ${r.end}`);
});

check('ano de classificação estica menos', () => {
  const r = effectiveLeagueWindow(ateOutubro, 2029);
  assert(r.extended === true, 'estica');
  assert(r.extraDays < 56, `${r.extraDays} dias, bem menos que a Copa`);
});

check('a Série C de 2026 termina em 20 de dezembro', () => {
  const r = effectiveLeagueWindow(serieC, 2026);
  assert(r.extended === true, 'estica');
  assert(r.end[0] === 11 && r.end[1] === 20, `25/out + 56 dias dá ${r.end}`);
});

check('janela sem paragem volta idêntica', () => {
  const r = effectiveLeagueWindow(serieC, 2031);
  assert(r.extended === false, 'sem Copa e sem janela que atropele');
  assert(r.end.join() === serieC.end.join(), `end ${r.end}`);
});

// ------------------------------------------------------------- descrições

check('descrição do ciclo é legível', () => {
  assert(describeInternationalCycle(2026).includes('Copa do Mundo 2026'), describeInternationalCycle(2026));
  assert(describeInternationalCycle(2029).includes('classificação'), describeInternationalCycle(2029));
  assert(describeInternationalCycle(2034).includes('aproximadas'), describeInternationalCycle(2034));
});

check('nenhum lançamento com ano sem calendário', () => {
  const anos = [2026, 2027, 2028, 2029, 2030, 2031, 2034, 2050];
  anos.forEach(y => {
    assert(Array.isArray(clubStoppages(y)), `paragens de ${y}`);
    assert(Number.isFinite(stoppageSummary(y).totalDays), `resumo de ${y}`);
    assert(effectiveLeagueWindow(serieC, y), `janela efetiva de ${y}`);
  });
});

console.log(`\ninternational-calendar: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);