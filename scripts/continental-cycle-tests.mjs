/**
 * Ciclo de várias temporadas com a CONMEBOL e as Datas FIFA ligadas, sem
 * navegador: campeões de um ano viram vagas, Recopa e histórico no seguinte;
 * Eliminatórias atravessam três temporadas e fecham antes da Copa de 2030.
 */
import assert from 'node:assert/strict';
import { createConmebolRuntime, clubsWithForeignFallback } from '../js/engine/conmebol-runtime.js';
import { createInternationalRuntime } from '../js/engine/international-runtime.js';

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed += 1; console.log(`  ok  ${name}`); }
  catch (error) { console.error(`  FAIL ${name}`); throw error; }
};

const BR = Array.from({ length: 20 }, (_, i) => `Clube BR ${String(i + 1).padStart(2, '0')}`);
const NATIONS = ['Brasil', 'Brasil', 'Argentina', 'Uruguai', 'Colombia', 'Paraguai'];
const makeBase = () => Object.fromEntries(BR.map((name, i) => [name, {
  name,
  division: 'A',
  power: 62 - i * 0.4,
  roster: Array.from({ length: 6 }, (_, k) => ({
    playerId: `${name}-${k}`,
    name: `${name} J${k}`,
    nationality: NATIONS[k],
    overall: 72 - i * 0.5 - k,
    pos: k === 0 ? 'GOL' : 'ATA',
    marketValue: 1_000_000,
  })),
}]));

function rngFrom(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

/** Roda uma carreira de `seasons` anos e devolve o que cada ano produziu. */
function runCareer({ from = 2026, seasons = 5, userClub = 'Clube BR 01' } = {}) {
  const base = makeBase();
  let rt = null;
  const clubs = clubsWithForeignFallback(base, name => rt?.getForeignClub(name));
  const career = { seed: 99, conmebolHistory: {}, priorSeasonChampions: null, conmebolQualifiers: null, internationalCaps: {} };
  const random = rngFrom(17);
  const out = [];
  for (let season = from; season < from + seasons; season += 1) {
    const messages = [];
    const prizes = [];
    rt = createConmebolRuntime({
      getCareerSeason: () => season,
      getCareerSeed: () => career.seed,
      getClubs: () => clubs,
      getUserClub: () => userClub,
      getDivisionTeams: () => ({ A: BR }),
      getPriorSeasonChampions: () => career.priorSeasonChampions,
      getHistory: () => career.conmebolHistory,
      simulateRoundMatch: () => ({ homeGoals: Math.floor(random() * 3), awayGoals: Math.floor(random() * 3) }),
      isUserFixture: () => false,
      pushMessage: message => messages.push(message),
      creditUserPrize: (amount, label) => prizes.push({ amount, label }),
    });
    rt.init();
    const intl = createInternationalRuntime({
      getCareerSeason: () => season,
      getCareerSeed: () => career.seed,
      getClubs: () => base,
      getUserClub: () => userClub,
      getQualifiersState: () => career.conmebolQualifiers,
      setQualifiersState: value => { career.conmebolQualifiers = value; },
      getCapsLedger: () => career.internationalCaps,
      setCapsLedger: value => { career.internationalCaps = value; },
      pushMessage: message => messages.push(message),
      injurePlayer: () => ({ name: 'Lesão muscular', daysRemaining: 10 }),
      random,
    });
    intl.init();
    for (let ts = new Date(season, 0, 10).getTime(); ts <= new Date(season, 11, 31).getTime(); ts += 86_400_000) {
      const date = new Date(ts);
      rt.advanceThroughDate(date);
      intl.advanceTo(date);
    }
    const edition = rt.edition;
    const summary = rt.seasonSummary();
    out.push({
      season,
      edition,
      summary,
      duty: intl.serialize(),
      messages,
      prizes,
      qualifiers: career.conmebolQualifiers ? JSON.parse(JSON.stringify(career.conmebolQualifiers)) : null,
    });
    // Virada de temporada: o mesmo que setPriorSeasonChampions grava na carreira.
    career.conmebolHistory = summary.history;
    career.priorSeasonChampions = {
      season,
      standingsA: [...BR],
      CUP: BR[8],
      CUP_RUNNER_UP: BR[3],
      LIBERTADORES: summary.LIBERTADORES,
      SUDAMERICANA: summary.SUDAMERICANA,
    };
  }
  return { out, career };
}

const { out, career } = runCareer();

console.log('Ciclo continental (2026–2030)');

test('toda temporada fecha Libertadores, Sul-Americana, Recopa e Intercontinental', () => {
  out.forEach(({ season, edition }) => {
    assert.ok(edition.libertadores.champion, `${season}: sem campeão da Libertadores`);
    assert.ok(edition.sudamericana.champion, `${season}: sem campeão da Sul-Americana`);
    assert.ok(edition.recopa.champion, `${season}: sem campeão da Recopa`);
    assert.ok(edition.intercontinental.champion, `${season}: sem campeão Intercontinental`);
    assert.ok(edition.fixtures.every(game => game.completed), `${season}: jogo pendente`);
  });
});

test('campeões de um ano disputam a Recopa e entram nos grupos no ano seguinte', () => {
  for (let i = 1; i < out.length; i += 1) {
    const prev = out[i - 1].edition;
    const cur = out[i].edition;
    const tie = cur.recopa.stages.F.ties[0];
    assert.deepEqual(new Set([tie.home, tie.away]), new Set([prev.libertadores.champion, prev.sudamericana.champion]), `${cur.season}: Recopa com clubes errados`);
    // Volta na casa do campeão da Libertadores.
    assert.equal(tie.away, prev.libertadores.champion);
    const groupClubs = cur.libertadores.entrants.group.map(entry => entry.club);
    assert.ok(groupClubs.includes(prev.libertadores.champion));
    assert.ok(groupClubs.includes(prev.sudamericana.champion));
  }
});

test('ranking continental acumula entre temporadas', () => {
  const clubsWithHistory = Object.keys(career.conmebolHistory || {});
  assert.ok(clubsWithHistory.length > 40, `histórico com só ${clubsWithHistory.length} clubes`);
});

test('Datas FIFA: toda janela do ano convoca e devolve', () => {
  out.forEach(({ season, duty }) => {
    const windows = Object.values(duty.windows);
    assert.ok(windows.length >= 1, `${season}: nenhuma janela`);
    windows.forEach(entry => assert.equal(entry.status, 'returned', `${season}: convocado não voltou`));
    assert.ok(windows.some(entry => entry.callups.some(call => call.team === 'Brasil')), `${season}: Seleção não chamou ninguém`);
  });
  assert.ok(Object.keys(career.internationalCaps).length > 0, 'histórico pela seleção vazio');
});

test('2026 é ano de Copa: uma paragem só, sem Eliminatórias', () => {
  const y2026 = out.find(item => item.season === 2026);
  assert.deepEqual(Object.keys(y2026.duty.windows), ['copa_2026']);
  assert.equal(y2026.qualifiers, null);
});

test('Eliminatórias de 2030 atravessam 2027–2029 e fecham com as sedes classificadas', () => {
  const played = out.map(item => item.qualifiers?.fixtures.filter(game => game.completed).length ?? 0);
  assert.deepEqual(played.slice(1, 4), [20, 60, 90], `rodadas por ano: ${played.join(', ')}`);
  const final = out.find(item => item.season === 2029).qualifiers;
  assert.equal(final.complete, true);
  ['ARG', 'URU', 'PAR'].forEach(code => assert.ok(final.qualified.includes(code), `${code} (sede) fora`));
  assert.ok(final.qualified.length >= 6 && final.qualified.length <= 7);
});

test('2030 volta a ser ano de Copa e guarda o resultado das Eliminatórias', () => {
  const y2030 = out.find(item => item.season === 2030);
  assert.deepEqual(Object.keys(y2030.duty.windows), ['copa_2030']);
  assert.equal(y2030.qualifiers.complete, true);
  assert.equal(y2030.qualifiers.cycleYear, 2030);
});

console.log(`\n${passed} testes ok`);
