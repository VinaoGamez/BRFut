/**
 * Formato CBF da Série C — três fases, tamanho por temporada.
 * node scripts/serie-c-format-tests.mjs
 */
import {
  SERIE_C_QUALIFIED,
  SERIE_C_GROUP_ROUNDS,
  SERIE_C_FINAL_ROUNDS,
  SERIE_C_PROMOTION_SLOTS,
  serieCGroupComposition,
  serieCPhaseRounds,
  serieCTotalRounds,
  serieCPhaseIndexForRound,
  serieCPhaseLabel,
  describeSerieCFormat,
} from '../js/engine/serie-c-format.js';
import {
  installSerieCRounds,
  buildSerieCGroupRounds,
  buildSerieCRFinalRounds,
} from '../js/engine/serie-c-season.js';
import { serieCClubsForSeason, serieCRelegationSlots } from '../js/engine/serie-c-calendar.js';

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

const clubs20 = Array.from({ length: 20 }, (_, i) => `C${i + 1}`);
const ranked20 = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10', 'P11', 'P12', 'P13', 'P14', 'P15', 'P16', 'P17', 'P18', 'P19', 'P20'];

// Round robin de 4 clubes (círculo): 3 rodadas de 2 jogos no turno, 3 no
// returno. Cada clube joga 2 vezes em casa e 2 fora por turno.
const miniRoundRobin = (list, double) => {
  const n = list.length;
  const firstLeg = [];
  for (let r = 0; r < n - 1; r += 1) {
    const games = [];
    for (let i = 0; i < n / 2; i += 1) {
      const a = list[(i + r) % n];
      const b = list[(n - 1 - i + r + n) % n];
      games.push(i % 2 === 0 ? { home: a, away: b } : { home: b, away: a });
    }
    firstLeg.push(games);
  }
  if (!double) return firstLeg;
  const secondLeg = firstLeg.map(games =>
    games.map(game => ({ home: game.away, away: game.home })),
  );
  return [...firstLeg, ...secondLeg];
};

check('tamanhos da CBF: 20/24/28 clubes', () => {
  assert(serieCClubsForSeason(2026) === 20, '2026 = 20');
  assert(serieCClubsForSeason(2027) === 24, '2027 = 24');
  assert(serieCClubsForSeason(2028) === 28, '2028 = 28');
});

check('rodadas totais: 27, 31 e 35', () => {
  assert(serieCTotalRounds(20) === 27, `20 clubes -> ${serieCTotalRounds(20)}`);
  assert(serieCTotalRounds(24) === 31, `24 clubes -> ${serieCTotalRounds(24)}`);
  assert(serieCTotalRounds(28) === 35, `28 clubes -> ${serieCTotalRounds(28)}`);
});

check('a fase 1 é turno único', () => {
  const { phase1, groups, final, total } = serieCPhaseRounds(20);
  assert(phase1 === 19, `fase 1 ${phase1}`);
  assert(groups === 6, `grupos ${groups}`);
  assert(final === 2, `final ${final}`);
  assert(total === phase1 + groups + final, 'soma fecha');
  // 19 + 6 + 2 é a conta da CBF para 20 clubes.
  assert(total === 27, `total ${total}`);
});

check('os grupos são entrelaçados: 1/4/5/8 e 2/3/6/7', () => {
  const { groupA, groupB } = serieCGroupComposition(ranked20);
  assert(groupA.join() === 'P1,P4,P5,P8', `grupo A ${groupA.join()}`);
  assert(groupB.join() === 'P2,P3,P6,P7', `grupo B ${groupB.join()}`);
  assert(groupA.length === 4 && groupB.length === 4, 'quatro em cada');
  // Nenhum clube repetido entre os grupos.
  assert(new Set([...groupA, ...groupB]).size === 8, 'sem repetição');
});

check('a fase de cada rodada bate com a tabela da CBF', () => {
  for (const clubs of [20, 24, 28]) {
    const { phase1, groups } = serieCPhaseRounds(clubs);
    assert(serieCPhaseIndexForRound(1, clubs) === 1, `${clubs}: rodada 1 é fase 1`);
    assert(serieCPhaseIndexForRound(phase1, clubs) === 1, `${clubs}: última da fase 1`);
    assert(serieCPhaseIndexForRound(phase1 + 1, clubs) === 2, `${clubs}: primeira dos grupos`);
    assert(serieCPhaseIndexForRound(phase1 + groups, clubs) === 2, `${clubs}: última dos grupos`);
    assert(serieCPhaseIndexForRound(phase1 + groups + 1, clubs) === 3, `${clubs}: primeira da final`);
    assert(serieCPhaseIndexForRound(phase1 + groups + 2, clubs) === 3, `${clubs}: segunda da final`);
    assert(serieCPhaseIndexForRound(phase1 + groups + 3, clubs) === 0, `${clubs}: depois da final`);
  }
});

check('acessos e rebaixamento', () => {
  assert(SERIE_C_QUALIFIED === 8, 'oito avançam');
  assert(SERIE_C_PROMOTION_SLOTS === 2, 'dois vencem grupo e sobem');
  assert(serieCRelegationSlots(2026) === 2, '2026 rebaixa 2');
  assert(serieCRelegationSlots(2028) === 6, '2028 rebaixa 6');
});

check('a final é em casa e fora, com os mandos invertidos', () => {
  const rounds = buildSerieCRFinalRounds('VENC-A', 'VENC-B');
  assert(rounds.length === SERIE_C_FINAL_ROUNDS, `rodadas ${rounds.length}`);
  const ida = rounds[0][0];
  const volta = rounds[1][0];
  assert(ida.home === 'VENC-A' && ida.away === 'VENC-B', 'ida');
  assert(volta.home === 'VENC-B' && volta.away === 'VENC-A', 'volta invertida');
  assert(ida.tieId === volta.tieId, 'mesmo confronto');
});

check('a final não é montada sem os dois vencedores', () => {
  assert(buildSerieCRFinalRounds('A', null).length === 0, 'sem vencedor B');
  assert(buildSerieCRFinalRounds(null, 'B').length === 0, 'sem vencedor A');
});

check('as rodadas de grupo achatam os dois grupos na mesma rodada', () => {
  const { groupA, groupB } = serieCGroupComposition(ranked20);
  const rounds = buildSerieCGroupRounds({ groupA, groupB }, miniRoundRobin);
  assert(rounds.length === SERIE_C_GROUP_ROUNDS, `rodadas ${rounds.length}`);
  rounds.forEach((games, index) => {
    // Dois grupos × dois jogos por grupo = quatro jogos na mesma rodada.
    assert(games.length === 4, `rodada ${index + 1}: ${games.length} jogos`);
    assert(games.every(game => game.phase === 'GRUPOS'), 'fase marcada');
    const grupos = new Set(games.map(game => game.group));
    assert(grupos.size === 2, 'um jogo de cada par em cada grupo');
    assert(games.filter(game => game.group === 'A').length === 2, '2 jogos no grupo A');
    assert(games.filter(game => game.group === 'B').length === 2, '2 jogos no grupo B');
  });
});

check('cada grupo joga 6 vezes: 3 em casa e 3 fora', () => {
  const { groupA, groupB } = serieCGroupComposition(ranked20);
  const rounds = buildSerieCGroupRounds({ groupA, groupB }, miniRoundRobin);
  const casa = {};
  groupA.forEach(club => { casa[club] = { home: 0, away: 0 }; });
  rounds.forEach(games => {
    games.filter(game => game.group === 'A').forEach(game => {
      casa[game.home].home += 1;
      casa[game.away].away += 1;
    });
  });
  groupA.forEach(club => {
    assert(casa[club].home === 3 && casa[club].away === 3, `${club}: ${casa[club].home}c/${casa[club].away}f`);
  });
});

check('installSerieCRounds escreve a partir da rodada pedida', () => {
  const fixtures = Array.from({ length: 19 }, (_, i) => [{ home: `H${i}`, away: `V${i}`, completed: true }]);
  const novos = [[{ home: 'GA1', away: 'GA2' }], [{ home: 'GA2', away: 'GA1' }]];
  installSerieCRounds(fixtures, novos, 20);
  assert(fixtures.length === 21, `tamanho ${fixtures.length}`);
  assert(fixtures[19][0].home === 'GA1', 'rodada 20 preenchida');
  assert(fixtures[18].length === 1 && fixtures[18][0].completed, 'rodada 19 intacta');
});

check('installSerieCRounds não sobrescreve rodada já disputada', () => {
  const fixtures = Array.from({ length: 19 }, (_, i) => [{ home: `H${i}`, away: `V${i}`, completed: true }]);
  fixtures[19] = [{ home: 'JOGADO', away: 'X', completed: true }];
  installSerieCRounds(fixtures, [[{ home: 'NOVO', away: 'Y' }]], 20);
  assert(fixtures[19][0].home === 'JOGADO', 'resultado preservado');
});

check('o texto do regulamento descreve as três fases', () => {
  const texto = describeSerieCFormat(20, 2).join(' ');
  assert(texto.includes('Fase 1'), 'fase 1');
  assert(texto.includes('turno único'), 'turno único');
  assert(texto.includes('dois grupos de 4'), 'grupos');
  assert(texto.includes('final em dois jogos'), 'final');
  assert(texto.includes('27 rodadas'), 'total');
  assert(texto.includes('2 últimos'), 'rebaixamento');
});

check('rótulos de fase', () => {
  assert(serieCPhaseLabel(1) === 'FASE 1', serieCPhaseLabel(1));
  assert(serieCPhaseLabel(2) === 'GRUPOS', serieCPhaseLabel(2));
  assert(serieCPhaseLabel(3) === 'FINAL', serieCPhaseLabel(3));
  assert(serieCPhaseLabel(9) === '', 'fora da temporada');
});

console.log(`\nserie-c-format: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
