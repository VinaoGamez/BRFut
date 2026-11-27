/**
 * Convocações e Eliminatórias.
 * node scripts/international-duty-tests.mjs
 */
import assert from 'node:assert/strict';
import { selectCallUps, resolveDutyReturn, applyDutyReturn, callupRuleFor } from '../js/engine/international-duty.js';
import {
  advanceQualifiersThroughDate,
  createConmebolQualifiers,
  qualifierTable,
  qualifierWindows,
  qualifiersCycleForYear,
} from '../js/engine/conmebol-qualifiers.js';

let passed = 0;
const test = (name, fn) => { try { fn(); passed += 1; console.log(`  ok  ${name}`); } catch (e) { console.error(`  FAIL ${name}`); throw e; } };
const rng = seed => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };

console.log('Seleções');

test('régua: Brasil exigente, Bolívia mais baixa, europeu só craque', () => {
  assert.ok(callupRuleFor('Brasil').min > callupRuleFor('Bolívia').min);
  assert.equal(callupRuleFor('Colômbia').team, 'Colômbia');
  assert.equal(callupRuleFor('Portugal').min, 70);
});

test('convoca os melhores por seleção, respeitando o limite', () => {
  const roster = [
    ...Array.from({ length: 6 }, (_, i) => ({ playerId: `b${i}`, name: `Br ${i}`, nationality: 'Brasil', overall: 70 - i, pos: 'MC' })),
    { playerId: 'u1', name: 'Uru', nationality: 'Uruguai', overall: 64, pos: 'ZAG' },
    { playerId: 'x1', name: 'Fraco', nationality: 'Uruguai', overall: 50, pos: 'ZAG' },
    { playerId: 'v1', name: 'Vene', nationality: 'Venezuela', overall: 57, pos: 'ATA' },
  ];
  const calls = selectCallUps({ clubs: { Clube: { roster, division: 'A' }, Fora: { roster: [{ playerId: 'z', nationality: 'Brasil', overall: 90 }], division: 'INT' } } });
  const brazil = calls.filter(c => c.team === 'Brasil');
  assert.equal(brazil.length, 3);
  assert.deepEqual(brazil.map(c => c.playerId), ['b0', 'b1', 'b2']);
  assert.ok(calls.some(c => c.playerId === 'u1'));
  assert.ok(!calls.some(c => c.playerId === 'x1'));
  assert.ok(calls.some(c => c.playerId === 'v1'));
  assert.ok(!calls.some(c => c.playerId === 'z'), 'clube estrangeiro não entra');
});

test('volta da seleção: cansaço, jogos e valorização', () => {
  const player = { name: 'A', pos: 'ATA', fatigue: 100, marketValue: 1_000_000 };
  const result = resolveDutyReturn(player, { random: rng(3), kind: 'world-cup' });
  applyDutyReturn(player, result, { team: 'Brasil', windowId: 'copa' });
  assert.ok(player.fatigue < 100);
  assert.ok(player.internationalCareer.caps >= 1);
  assert.ok(player.marketValue > 1_000_000);
});

test('Eliminatórias 2030: 18 rodadas em 9 janelas, de set/2027 a set-out/2029', () => {
  const windows = qualifierWindows(2030);
  assert.equal(windows.length, 9);
  assert.equal(windows[0].year, 2027);
  assert.equal(windows[0].start[0], 8);
  assert.equal(windows.at(-1).year, 2029);
  const q = createConmebolQualifiers({ cycleYear: 2030, seed: 5 });
  assert.equal(q.fixtures.length, 90);
  assert.equal(new Set(q.fixtures.map(g => g.matchday)).size, 18);
  // Cada seleção joga 18, 9 em casa.
  const homes = {};
  q.fixtures.forEach(g => { homes[g.home] = (homes[g.home] || 0) + 1; });
  Object.values(homes).forEach(n => assert.equal(n, 9));
});

test('ciclo: 2027–2029 jogam para 2030; ano de Copa não tem Eliminatórias', () => {
  assert.equal(qualifiersCycleForYear(2027), 2030);
  assert.equal(qualifiersCycleForYear(2029), 2030);
  assert.equal(qualifiersCycleForYear(2030), null);
  assert.equal(qualifiersCycleForYear(2031), 2034);
});

test('fim das Eliminatórias: sedes + 3 diretas (+ repescagem)', () => {
  const q = createConmebolQualifiers({ cycleYear: 2030, seed: 9 });
  const mid = advanceQualifiersThroughDate(q, new Date(2028, 6, 1));
  assert.ok(mid.changed && !q.complete);
  const end = advanceQualifiersThroughDate(q, new Date(2029, 11, 31));
  assert.ok(end.finished && q.complete);
  ['ARG', 'URU', 'PAR'].forEach(code => assert.ok(q.qualified.includes(code)));
  assert.ok(q.qualified.length === 6 || q.qualified.length === 7);
  const table = qualifierTable(q);
  assert.equal(table.reduce((s, r) => s + r.played, 0), 180);
});

test('favoritos se classificam na maioria das simulações', () => {
  let brazil = 0;
  for (let seed = 1; seed <= 60; seed += 1) {
    const q = createConmebolQualifiers({ cycleYear: 2030, seed });
    advanceQualifiersThroughDate(q, new Date(2029, 11, 31));
    if (q.qualified.includes('BRA')) brazil += 1;
  }
  assert.ok(brazil >= 50, `Brasil classificou ${brazil}/60`);
});

console.log(`\n${passed} testes ok`);
