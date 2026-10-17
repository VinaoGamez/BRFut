/**
 * Regras de estrangeiros: o que é medido, o que é extrapolado, e o que nunca
 * pode acontecer.
 *
 * node scripts/estrangeiros-regras-tests.mjs
 */
import assert from 'node:assert/strict';
import {
  FOREIGNER_LIMITS,
  foreignerAverageFor,
  extrapolateFromBudget,
  realisticForeignerLimit,
  foreignerLimitFor,
  assignRosterNationalities,
} from '../js/engine/player-nationality.js';

let passed = 0;
let failed = 0;
function check(nome, fn) {
  try {
    fn();
    passed += 1;
    console.log(`\u2713 ${nome}`);
  } catch (erro) {
    failed += 1;
    console.log(`\u2717 ${nome}`);
    console.log(`    ${erro.message}`);
  }
}

function rng(semente = 1) {
  let s = semente >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const elenco = (n = 26) =>
  Array.from({ length: n }, (_, i) => ({
    name: `Jogador ${i}`,
    pos: 'MC',
    nationality: 'Brasil',
    nameCustomized: false,
  }));

check('teto legal vem do regulamento da CBF e vale 9 em toda parte', () => {
  for (const d of ['A', 'B', 'C', 'D', 'REG']) {
    assert.equal(foreignerLimitFor(d), 9, `divisão ${d}`);
  }
  assert.match(FOREIGNER_LIMITS.Brasil.fonte, /s[úu]mula/i);
  assert.match(FOREIGNER_LIMITS.Brasil.fonte, /nove/i);
});

check('a extrapolação usa B como âncora, e a conta bate', () => {
  // B = 1,30 medido. C = 4,2/6,2 do orçamento de B.
  assert.equal(extrapolateFromBudget('C'), 0.881);
  assert.equal(extrapolateFromBudget('D'), 0.566);
  assert.equal(extrapolateFromBudget('REG'), 0.377);
  // A e B são medidos, não extrapolados.
  assert.equal(extrapolateFromBudget('B'), 1.3);
});

check('A e B são marcados como medidos; o resto como extrapolado', () => {
  assert.equal(FOREIGNER_LIMITS.Brasil.A.fonte, 'medido');
  assert.equal(FOREIGNER_LIMITS.Brasil.B.fonte, 'medido');
  for (const d of ['C', 'D', 'REG']) {
    assert.equal(FOREIGNER_LIMITS.Brasil[d].fonte, 'extrapolado', `divisão ${d}`);
    assert.equal(typeof FOREIGNER_LIMITS.Brasil[d].mediaAlvo, 'number', `divisão ${d} sem média alvo`);
  }
});

check('B U M: clube regional NUNCA chega perto do teto legal', () => {
  // A queixa original: "time de nível regional com 9 estrangeiros é quase
  // impossível". Isto é o teste que garante que não volta.
  const r = rng(99);
  let maximo = 0;
  for (let clube = 0; clube < 600; clube += 1) {
    const roster = elenco();
    assignRosterNationalities(roster, 'REG', r);
    const n = roster.filter(p => p.nationality !== 'Brasil').length;
    if (n > maximo) maximo = n;
    assert.ok(n <= realisticForeignerLimit('REG'), `REG gerou ${n}, teto é ${realisticForeignerLimit('REG')}`);
  }
  assert.ok(maximo <= 2, `regional chegou a ${maximo} estrangeiros`);
});

check('as divisões baixas ficam abaixo da média extrapolada', () => {
  const esperadas = { C: 0.88, D: 0.57, REG: 0.38 };
  for (const [divisao, alvo] of Object.entries(esperadas)) {
    const r = rng(7);
    const clubes = 500;
    let total = 0;
    for (let i = 0; i < clubes; i += 1) {
      const roster = elenco();
      assignRosterNationalities(roster, divisao, r);
      total += roster.filter(p => p.nationality !== 'Brasil').length;
    }
    const media = total / clubes;
    assert.ok(
      media <= alvo + 0.05,
      `${divisao}: média ${media.toFixed(2)} passou do alvo extrapolado ${alvo}`,
    );
  }
});

check('a ordem entre divisões é sempre decrescente', () => {
  const medias = ['A', 'B', 'C', 'D', 'REG'].map(divisao => {
    const r = rng(31);
    let total = 0;
    for (let i = 0; i < 200; i += 1) {
      const roster = elenco();
      assignRosterNationalities(roster, divisao, r);
      total += roster.filter(p => p.nationality !== 'Brasil').length;
    }
    return total / 200;
  });
  for (let i = 1; i < medias.length; i += 1) {
    assert.ok(
      medias[i] <= medias[i - 1],
      `${['A','B','C','D','REG'][i]} (${medias[i].toFixed(2)}) ficou acima de ${['A','B','C','D','REG'][i-1]} (${medias[i-1].toFixed(2)})`,
    );
  }
  console.log(`    médias: ${medias.map((m, i) => `${['A','B','C','D','REG'][i]}=${m.toFixed(2)}`).join('  ')}`);
});

check('a distribuição por país segue o dado real da Série A', () => {
  const r = rng(4242);
  const contagem = {};
  for (let i = 0; i < 400; i += 1) {
    const roster = elenco();
    assignRosterNationalities(roster, 'A', r);
    for (const p of roster) {
      if (p.nationality === 'Brasil') continue;
      contagem[p.nationality] = (contagem[p.nationality] || 0) + 1;
    }
  }
  const total = Object.values(contagem).reduce((s, n) => s + n, 0);
  const share = pais => (contagem[pais] || 0) / total;
  // Real medido na Série A 2026 (footystats).
  assert.ok(share('Argentina') > 0.34 && share('Argentina') < 0.45, `Argentina ${(share('Argentina')*100).toFixed(1)}%, real 39,6%`);
  assert.ok(share('Colombia') > 0.17 && share('Colombia') < 0.27, `Colômbia ${(share('Colombia')*100).toFixed(1)}%, real 21,9%`);
  assert.ok(share('Uruguai') > 0.11 && share('Uruguai') < 0.20, `Uruguai ${(share('Uruguai')*100).toFixed(1)}%, real 15,0%`);
  // O eixo CONMEBOL tem de responder por mais de 3/4.
  const conmebol = share('Argentina') + share('Colombia') + share('Uruguai') + share('Equador') + share('Paraguai') + share('Chile') + share('Venezuela');
  assert.ok(conmebol > 0.78, `CONMEBOL só ${(conmebol*100).toFixed(1)}%, real 84%`);
  console.log(`    CONMEBOL ${(conmebol*100).toFixed(1)}% (real 84%)`);
});

console.log(`\nestrangeiros-regras: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
