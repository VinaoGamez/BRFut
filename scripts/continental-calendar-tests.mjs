/**
 * Calendário continental CONMEBOL — vagas, datas e reserva por clube.
 * node scripts/continental-calendar-tests.mjs
 */
import {
  CONMEBOL_BERTHS,
  CONMEBOL_ENABLED,
  CONMEBOL_EDITIONS,
  berthAudit,
  berthCountFor,
  allocateBrazilBerths,
  continentalDates,
  continentalSlots,
  describeContinental,
  divisionHasBerth,
  eligibleDivisionsFor,
  reserveContinentalDates,
} from '../js/engine/continental-calendar.js';

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

// ------------------------------------------------------------------ vagas

check('Brasil tem 7 na Libertadores e 6 na Sul-Americana', () => {
  assert(berthCountFor('libertadores') === 7, `Lib = ${berthCountFor('libertadores')}`);
  assert(berthCountFor('sudamericana') === 6, `Sul = ${berthCountFor('sudamericana')}`);
});

check('Só Série A tem vaga na Libertadores', () => {
  assert(eligibleDivisionsFor('libertadores').join() === 'A', eligibleDivisionsFor('libertadores').join());
  assert(divisionHasBerth('A', 'libertadores') === true, 'A tem');
  assert(divisionHasBerth('B', 'libertadores') === false, 'B não tem');
});

check('Série A e B têm vaga na Sul-Americana', () => {
  assert(eligibleDivisionsFor('sudamericana').join() === 'A,B', eligibleDivisionsFor('sudamericana').join());
  assert(divisionHasBerth('B', 'sudamericana') === true, 'B tem');
});

check('Série C e D nunca têm vaga continental', () => {
  ['libertadores', 'sudamericana'].forEach(comp => {
    ['C', 'D'].forEach(div => {
      assert(divisionHasBerth(div, comp) === false, `${div} não tem vaga na ${comp}`);
    });
  });
});

check('competição continental está desligada in-game', () => {
  assert(CONMEBOL_ENABLED === false, 'precisa estar desligada');
  assert(CONMEBOL_EDITIONS[2026] != null, 'mas as datas existem');
});

// ----------------------------------------------------------------- datas

check('Libertadores vai de 3/fev a 28/nov', () => {
  const slots = continentalSlots('libertadores', 2026);
  const datas = continentalDates('libertadores', 2026);
  assert(datas.length > 0, 'tem datas');
  assert(datas[0].month === 1 && datas[0].day === 3, `começa ${datas[0].month}/${datas[0].day}`);
  assert(datas[datas.length - 1].month === 10 && datas[datas.length - 1].day === 28,
    `termina ${datas[datas.length - 1].month}/${datas[datas.length - 1].day}`);
  assert(slots.length > 0, 'slots');
});

check('Sul-Americana vai de 3/mar a 21/nov', () => {
  const datas = continentalDates('sudamericana', 2026);
  assert(datas[0].month === 2 && datas[0].day === 3, `começa ${datas[0].month}/${datas[0].day}`);
  const ultima = datas[datas.length - 1];
  assert(ultima.month === 10 && ultima.day === 21, `termina ${ultima.month}/${ultima.day}`);
});

check('as duas competições têm as mesmas 6 rodadas de grupo', () => {
  const lib = continentalSlots('libertadores', 2026).filter(s => s.phase === 'FASE DE GRUPOS');
  const sul = continentalSlots('sudamericana', 2026).filter(s => s.phase === 'FASE DE GRUPOS');
  assert(lib.length === 6, `Lib tem ${lib.length} rodadas de grupo`);
  assert(sul.length === 6, `Sul tem ${sul.length} rodadas de grupo`);
  const chave = s => `${s.month}/${s.day}`;
  assert(lib.map(chave).join() === sul.map(chave).join(), 'mesmas datas');
  assert(chave(lib[0]) === '3/7', `primeira em ${chave(lib[0])}`);
  assert(chave(lib[5]) === '4/26', `última em ${chave(lib[5])} (26 a 28/mai)`);
});

check('a final continental é jogo único', () => {
  const finalLib = continentalSlots('libertadores', 2026).filter(s => s.phase === 'FINAL');
  assert(finalLib.length === 1, `${finalLib.length} jogo na final`);
  assert(finalLib[0].leg === 'JOGO ÚNICO', `leg = ${finalLib[0].leg}`);
  assert(finalLib[0].month === 10 && finalLib[0].day === 28, `${finalLib[0].month}/${finalLib[0].day}`);
});

check('fases em ida e volta trazem as duas pernas', () => {
  const quartas = continentalSlots('libertadores', 2026).filter(s => s.phase === 'QUARTAS');
  assert(quartas.length === 2, `${quartas.length} pernas`);
  assert(quartas[0].month === 8 && quartas[0].day === 15, `ida ${quartas[0].month}/${quartas[0].day}`);
  assert(quartas[1].month === 8 && quartas[1].day === 21, `volta ${quartas[1].month}/${quartas[1].day}`);
});

check('a repescagem é só da Sul-Americana', () => {
  assert(continentalSlots('sudamericana', 2026).some(s => s.phase === 'REPESCAGEM'), 'tem repescagem');
  assert(!continentalSlots('libertadores', 2026).some(s => s.phase === 'REPESCAGEM'), 'Lib não tem');
});

check('competição ou ano desconhecido devolve lista vazia', () => {
  assert(continentalSlots('recopa', 2026).length === 0, 'competição desconhecida');
  assert(continentalSlots('libertadores', 2031).length === 0, 'ano sem calendário');
});

// --------------------------------------------------------------- alocação

const SERIE_A = Array.from({ length: 20 }, (_v, i) => `A${i + 1}`);
const SERIE_B = Array.from({ length: 20 }, (_v, i) => `B${i + 1}`);

check('13 vagas, todas de A e B', () => {
  const berths = allocateBrazilBerths({ standingsA: SERIE_A, standingsB: SERIE_B, cupChampion: 'A20' });
  assert(berths.length === 13, `${berths.length} vagas`);
  const auditoria = berthAudit(berths);
  assert(auditoria.ok === true, `Série C/D com vaga: ${auditoria.porDivisao}`);
  assert(auditoria.total === 13, `${auditoria.total} no total`);
});

check('o campeão da Copa do Brasil abre a Libertadores', () => {
  const berths = allocateBrazilBerths({ standingsA: SERIE_A, standingsB: SERIE_B, cupChampion: 'A20' });
  const primeira = berths.find(b => b.competitionId === 'libertadores');
  assert(primeira.club === 'A20', `primeira vaga = ${primeira.club}`);
  assert(/Copa do Brasil/.test(primeira.via), `via ${primeira.via}`);
});

check('7 vagas na Libertadores', () => {
  const berths = allocateBrazilBerths({ standingsA: SERIE_A, standingsB: SERIE_B, cupChampion: 'A20' });
  assert(berths.filter(b => b.competitionId === 'libertadores').length === 7, 'Lib');
  assert(berths.filter(b => b.competitionId === 'sudamericana').length === 6, 'Sul');
});

check('nenhum clube ocupa duas vagas', () => {
  const berths = allocateBrazilBerths({ standingsA: SERIE_A, standingsB: SERIE_B, cupChampion: 'A20' });
  const clubes = berths.map(b => b.club);
  assert(new Set(clubes).size === clubes.length, `duplicados: ${clubes.length - new Set(clubes).size}`);
});

check('campeão da copa repetido na Série A não duplica vaga', () => {
  // 'A3' é o campeão da Copa do Brasil e também o 3º da Série A.
  const berths = allocateBrazilBerths({ standingsA: SERIE_A, standingsB: SERIE_B, cupChampion: 'A3' });
  const clubes = berths.map(b => b.club);
  assert(new Set(clubes).size === clubes.length, `duplicados: ${clubes.length - new Set(clubes).size}`);
  assert(berths.length === 13, `${berths.length} vagas`);
});

check('com a Série A cheia a Série B não entra — como em 2026', () => {
  // 2026: as 13 vagas brasileiras vieram todas da Série A.
  const berths = allocateBrazilBerths({ standingsA: SERIE_A, standingsB: SERIE_B, cupChampion: 'A20' });
  const daB = berths.filter(b => b.division === 'B');
  assert(daB.length === 0, `${daB.length} vagas para a B`);
  assert(berths.length === 13, `${berths.length} vagas`);
});

check('a Série B só entra quando a Série A não cobre a Sul-Americana', () => {
  const berths = allocateBrazilBerths({ standingsA: ['A1', 'A2'], standingsB: SERIE_B, cupChampion: 'X9' });
  const daB = berths.filter(b => b.division === 'B');
  assert(daB.length === 6, `${daB.length} vagas para a B`);
  assert(berths.length === 9, `${berths.length} vagas no total`);
  assert(berthAudit(berths).ok === true, 'sem Série C/D');
});

check('sem campeão de copa a Libra abre pelo 1º da Série A', () => {
  const berths = allocateBrazilBerths({ standingsA: SERIE_A, standingsB: SERIE_B, cupChampion: null });
  const lib = berths.filter(b => b.competitionId === 'libertadores');
  // São sempre 7 vagas; sem o campeão da copa, a Série A abre todas elas.
  assert(lib.length === 7, `${lib.length} vagas na Lib sem campeão de copa`);
  assert(lib[0].club === 'A1', `abre com ${lib[0].club}`);
  assert(berths.length === 13, `${berths.length} vagas no total`);
});

check('entrada vazia não lança', () => {
  const berths = allocateBrazilBerths();
  assert(Array.isArray(berths), 'lista');
  const auditoria = berthAudit(berths);
  assert(auditoria.ok === true, 'sem C/D');
});

// ---------------------------------------------------------------- reserva

check('reserva de datas é por clube e não bloqueia a temporada', () => {
  const r = reserveContinentalDates({ club: 'Palmeiras', competitionId: 'libertadores', seasonYear: 2026 });
  assert(r.enabled === false, 'competição desligada');
  assert(r.reservations.length > 0, 'tem reservas');
  assert(r.reservations.every(x => x.club === 'Palmeiras'), 'todas do mesmo clube');
  // A reserva não tem nada que bloqueie: é lista, não blackout.
  assert(!('blocksClubs' in r.reservations[0]), 'não é blackout');
});

check('cada clube continentado tem a sua reserva', () => {
  const berths = allocateBrazilBerths({ standingsA: SERIE_A, standingsB: SERIE_B, cupChampion: 'A20' });
  const reservas = berths.map(b =>
    reserveContinentalDates({ club: b.club, competitionId: b.competitionId, seasonYear: 2026 }).reservations.length);
  assert(reservas.every(n => n > 0), 'todo clube continentado tem reserva');
});

check('descrição legível', () => {
  const texto = describeContinental(2026);
  assert(texto.includes('Libertadores'), texto);
  assert(texto.includes('7 vagas'), texto);
  assert(describeContinental(2031).includes('não publicado'), 'ano sem calendário');
});

console.log(`\ncontinental-calendar: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);