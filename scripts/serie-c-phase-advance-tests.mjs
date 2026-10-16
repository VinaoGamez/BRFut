/**
 * Série C — máquina de fases: grupos ao fim da primeira, final ao fim dos grupos.
 * node scripts/serie-c-phase-advance-tests.mjs
 */
import { createSerieCPhaseAdvance } from '../js/engine/serie-c-phase-advance.js';
import { buildCompetitionRoundRobinFixtures } from '../js/engine/competition-calendar.js';
import { serieCPhaseRounds } from '../js/engine/serie-c-format.js';

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

const CLUBES = 20;
const NOMES = Array.from({ length: CLUBES }, (_, i) => `C${i + 1}`);

/**
 * Monta um cenário com a primeira fase pronta e a tabela preenchida.
 * `standings` é a classificação final da fase 1, na ordem.
 */
function cenario(ranking = NOMES, clubes = CLUBES) {
  const fixtures = buildCompetitionRoundRobinFixtures(
    Array.from({ length: clubes }, (_, i) => `C${i + 1}`),
    'serie-c-phase1',
  );
  const { phase1 } = serieCPhaseRounds(clubes);
  let state = {};
  const deps = {
    getNationalCompetitions: () => ({
      C: {
        fixtures,
        standings: ranking.map((club, i) => ({
          club,
          points: 40 - i,
          wins: 10 - Math.floor(i / 2),
          goalDiff: 20 - i * 2,
        })),
      },
    }),
    getSerieCClubs: () => clubes,
    getSerieCState: () => state,
    setSerieCState: next => { state = { ...state, ...next }; },
    rebuildCalendarGames: () => {},
  };
  return { deps, advance: createSerieCPhaseAdvance(deps), fixtures, phase1, state: () => state };
}

check('a primeira fase tem só o turno', () => {
  const { fixtures, phase1 } = cenario();
  assert(fixtures.length === phase1, `rodadas ${fixtures.length} vs fase 1 ${phase1}`);
  assert(phase1 === 19, `fase 1 ${phase1}`);
  assert(fixtures.every(round => round.length === CLUBES / 2), '10 jogos por rodada');
});

check('a fase 1 termina em 19 rodadas e não instala nada sozinha', () => {
  const { advance } = cenario();
  const r = advance.updateSerieCPhases(18);
  assert(r.installed === null, `rodada 18 instalou ${r.installed}`);
});

check('ao fim da fase 1, os grupos entram', () => {
  const { advance, fixtures, phase1, state } = cenario();
  const r = advance.updateSerieCPhases(phase1);
  assert(r.installed === 'groups', `instalou ${r.installed}`);
  assert(fixtures.length === phase1 + 6, `rodadas ${fixtures.length}`);
  const st = state();
  assert(st.groupsInstalled === true, 'marcado');
  assert(st.groups.groupA.length === 4, `grupo A ${st.groups.groupA.length}`);
  assert(st.groups.groupB.length === 4, `grupo B ${st.groups.groupB.length}`);
});

check('os grupos usam a semeadura entrelaçada da CBF', () => {
  const ranking = Array.from({ length: 20 }, (_, i) => `C${i + 1}`);
  const { advance, state } = cenario(ranking);
  advance.updateSerieCPhases(19);
  const { groupA, groupB } = state().groups;
  assert(groupA.join() === 'C1,C4,C5,C8', `grupo A ${groupA.join()}`);
  assert(groupB.join() === 'C2,C3,C6,C7', `grupo B ${groupB.join()}`);
});

check('as rodadas de grupo jogam dentro do grupo, nunca fora', () => {
  const { advance, fixtures, phase1 } = cenario();
  advance.updateSerieCPhases(phase1);
  const rodadaGrupos = fixtures.slice(phase1);
  assert(rodadaGrupos.length === 6, `rodadas de grupo ${rodadaGrupos.length}`);
  rodadaGrupos.forEach((games, i) => {
    assert(games.length === 4, `rodada ${i + 1}: ${games.length} jogos`);
    assert(games.every(g => g.phase === 'GRUPOS'), 'marcadas como GRUPOS');
    games.forEach(g => assert(g.home !== g.away, 'jogo sem auto-confronto'));
  });
});

check('cada par do grupo se enfrenta duas vezes, uma em cada mando', () => {
  const { advance, fixtures, phase1 } = cenario();
  advance.updateSerieCPhases(phase1);
  const jogos = fixtures.slice(phase1).flat();
  const pares = new Map();
  jogos.forEach(g => {
    const k = [g.home, g.away].sort().join('|');
    const par = pares.get(k) || [];
    par.push(`${g.home}>${g.away}`);
    pares.set(k, par);
  });
  // 2 grupos × 6 pares = 12 confrontos distintos, dois jogos cada.
  assert(pares.size === 12, `confrontos distintos ${pares.size}`);
  pares.forEach((lista, k) => {
    assert(lista.length === 2, `${k}: ${lista.length} jogos`);
    assert(lista[0].startsWith(lista[1].split('>')[1]), `${k}: mandos não se inverteram`);
  });
});

check('a final só entra quando os grupos terminam', () => {
  const { advance, fixtures, phase1 } = cenario();
  advance.updateSerieCPhases(phase1);
  const antes = fixtures.length;
  advance.updateSerieCPhases(phase1 + 5);
  assert(fixtures.length === antes, 'antes do fim dos grupos nada muda');
  const r = advance.updateSerieCPhases(phase1 + 6);
  assert(r.installed === 'final', `instalou ${r.installed}`);
  assert(fixtures.length === 27, `rodadas ${fixtures.length}`);
});

check('a final são dois jogos com os mandos invertidos', () => {
  const { advance, fixtures, phase1 } = cenario();
  advance.updateSerieCPhases(phase1);
  advance.updateSerieCPhases(phase1 + 6);
  const final = fixtures.slice(phase1 + 6);
  assert(final.length === 2, `rodadas de final ${final.length}`);
  const ida = final[0][0];
  const volta = final[1][0];
  assert(ida.phase === 'FINAL' && volta.phase === 'FINAL', 'marcadas como FINAL');
  assert(ida.home === volta.away && ida.away === volta.home, 'mandos invertidos');
});

check('não há fase duplicada se a rodada for reprocessada', () => {
  const { advance, fixtures, phase1 } = cenario();
  advance.updateSerieCPhases(phase1);
  const depoisGrupos = fixtures.length;
  advance.updateSerieCPhases(phase1);
  assert(fixtures.length === depoisGrupos, 'grupos não duplicam');
  advance.updateSerieCPhases(phase1 + 6);
  const depoisFinal = fixtures.length;
  advance.updateSerieCPhases(phase1 + 6);
  assert(fixtures.length === depoisFinal, 'final não duplica');
});

check('a temporada da Série C fecha em 27 rodadas', () => {
  const { advance, fixtures, phase1 } = cenario();
  advance.updateSerieCPhases(phase1);
  advance.updateSerieCPhases(phase1 + 6);
  assert(fixtures.length === 27, `total ${fixtures.length}`);
  assert(advance.isSerieCSeasonComplete(27) === true, '27 completa');
  assert(advance.isSerieCSeasonComplete(26) === false, '26 não completa');
});

check('24 clubes dão 31 rodadas', () => {
  const { advance, fixtures, phase1 } = cenario(undefined, 24);
  assert(phase1 === 23, `fase 1 ${phase1}`);
  advance.updateSerieCPhases(phase1);
  assert(fixtures.length === phase1 + 6, `${fixtures.length}`);
  advance.updateSerieCPhases(phase1 + 6);
  assert(fixtures.length === 31, `total ${fixtures.length}`);
});

check('fase 1 incompleta não instala grupo pela metade', () => {
  // Só 7 clubes classificados entre os 8 necessários: nada é instalado.
  const fixtures = buildCompetitionRoundRobinFixtures(NOMES, 'serie-c-phase1');
  const standings = Array.from({ length: 7 }, (_, i) => ({
    club: `C${i + 1}`,
    points: 40 - i,
    wins: 1,
    goalDiff: 1,
  }));
  const advance = createSerieCPhaseAdvance({
    getNationalCompetitions: () => ({ C: { fixtures, standings } }),
    getSerieCClubs: () => CLUBES,
    getSerieCState: () => ({}),
    setSerieCState: () => {},
    rebuildCalendarGames: () => {},
  });
  const r = advance.updateSerieCPhases(19);
  assert(r.installed === null, `instalou ${r.installed}`);
  assert(fixtures.length === 19, `rodadas ${fixtures.length}`);
});

console.log(`\nserie-c-phase-advance: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
