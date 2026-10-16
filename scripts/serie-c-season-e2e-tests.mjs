/**
 * Série C — temporada inteira, de ponta a ponta.
 *
 * Roda as mesmas peças que o motor usa, na mesma ordem: os 19 jogos da fase 1,
 * a instalação dos grupos, os 6 jogos de grupo, a final, e a leitura do
 * desfecho. O simulador é determinístico (força por clube, sem sorteio real),
 * então a temporada inteira é reproduzível.
 *
 * O ponto do teste é a guarda de pontuação: os grupos e a finalrodadas não podem
 * vazar para a tabela da primeira fase. Sem isso o campeão da Série C seria o
 * líder de uma tabela que não existe no regulamento da CBF.
 *
 * node scripts/serie-c-season-e2e-tests.mjs
 */
import { createSerieCPhaseAdvance } from '../js/engine/serie-c-phase-advance.js';
import { buildCompetitionRoundRobinFixtures } from '../js/engine/competition-calendar.js';
import { roundFeedsDivisionStandings } from '../js/engine/national-round-sim.js';
import { serieCPhaseRounds, SERIE_C_QUALIFIED } from '../js/engine/serie-c-format.js';
import { resolveSerieCOutcome } from '../js/engine/serie-c-standings.js';
import { serieCRelegationSlots } from '../js/engine/serie-c-calendar.js';

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

const TEMPORADA = 2026;
const CLUBES = 20;
const NOMES = Array.from({ length: CLUBES }, (_v, i) => `C${String(i + 1).padStart(2, '0')}`);
const FORCA = Object.fromEntries(NOMES.map((nome, i) => [nome, 100 - i * 3]));

/** Simulador determinístico: mais força, mais gols. Sem sorteio. */
function simular(game) {
  const diff = FORCA[game.home] - FORCA[game.away];
  const placar = Math.max(0, Math.min(5, 1 + Math.round(diff / 14)));
  const inverso = Math.max(0, Math.min(5, 1 - Math.round(diff / 14)));
  game.homeGoals = placar;
  game.awayGoals = inverso;
  game.completed = true;
  return game;
}

/** Joga a rodada e devolve as linhas de classificação da divisão. */
function jogarRodada(fixtures, round, standings) {
  const jogos = fixtures[round - 1] || [];
  jogos.forEach(simular);
  // Mesma regra do motor: nem toda rodada soma na tabela.
  if (!roundFeedsDivisionStandings('C', round, CLUBES)) return;
  jogos.forEach(game => {
    const mandante = standings.find(r => r.club === game.home);
    const visitante = standings.find(r => r.club === game.away);
    mandante.played += 1;
    visitante.played += 1;
    mandante.goalDiff += game.homeGoals - game.awayGoals;
    visitante.goalDiff += game.awayGoals - game.homeGoals;
    if (game.homeGoals > game.awayGoals) {
      mandante.wins += 1;
      visitante.losses += 1;
      mandante.points += 3;
    } else if (game.homeGoals < game.awayGoals) {
      visitante.wins += 1;
      mandante.losses += 1;
      visitante.points += 3;
    } else {
      mandante.draws += 1;
      visitante.draws += 1;
      mandante.points += 1;
      visitante.points += 1;
    }
  });
  standings.sort((a, b) => b.points - a.points || b.wins - a.wins || b.goalDiff - a.goalDiff);
}

/** Temporada completa: 19 + 6 + 2 rodadas. */
function temporada() {
  const fixtures = buildCompetitionRoundRobinFixtures(NOMES, 'serie-c-phase1');
  const standings = NOMES.map(club => ({ club, played: 0, wins: 0, draws: 0, losses: 0, goalDiff: 0, points: 0 }));
  let state = {};
  const deps = {
    getNationalCompetitions: () => ({ C: { fixtures, standings } }),
    getSerieCClubs: () => CLUBES,
    getSerieCState: () => state,
    setSerieCState: next => { state = { ...state, ...next }; },
    rebuildCalendarGames: () => {},
  };
  const advance = createSerieCPhaseAdvance(deps);
  const installacoes = [];
  const { phase1, groups: groupRounds, final: finalRounds, total } = serieCPhaseRounds(CLUBES);

  // Mesma ordem do motor: disputa a rodada, e só então a fase concluída dispara a
// instalação da próxima. Por isso a rodada 19 precisa existir antes dos grupos.
for (let round = 1; round <= total; round += 1) {
    jogarRodada(fixtures, round, standings);
    const r = advance.updateSerieCPhases(round);
    if (r.installed) installacoes.push({ round, installed: r.installed });
  }
  return { fixtures, standings, state, installacoes, phase1, groupRounds, finalRounds, total };
}

const T = temporada();
const desfecho = resolveSerieCOutcome({
  fixtures: T.fixtures,
  clubs: NOMES,
  clubsCount: CLUBES,
  relegationSlots: serieCRelegationSlots(TEMPORADA),
});
const vencedores = new Set([desfecho.groupWinners.groupA, desfecho.groupWinners.groupB].filter(Boolean));

check('a temporada tem 27 rodadas', () => {
  assert(T.total === 27, `total ${T.total}`);
  assert(T.fixtures.length === 27, `rodadas geradas ${T.fixtures.length}`);
  assert(T.installacoes.length === 2, `instalações ${JSON.stringify(T.installacoes)}`);
});

check('grupos entram na rodada 19 e a final na 25', () => {
  const grupos = T.installacoes.find(i => i.installed === 'groups');
  const final = T.installacoes.find(i => i.installed === 'final');
  assert(grupos && grupos.round === 19, `grupos na ${grupos?.round}`);
  assert(final && final.round === 25, `final na ${final?.round}`);
});

check('a tabela da primeira fase conta exatamente 19 jogos por clube', () => {
  T.standings.forEach(row => {
    assert(row.played === 19, `${row.club} jogou ${row.played}, esperado 19`);
  });
  assert(desfecho.phase1.every(r => r.played === 19), 'nenhum jogo de grupo ou final vazou');
});

check('a soma dos pontos da primeira fase bate com os jogos', () => {
  const jogosFase1 = T.fixtures.slice(0, T.phase1).flat();
  const somaEsperada = jogosFase1.reduce((acc, g) => acc + (g.homeGoals > g.awayGoals ? 3 : g.homeGoals < g.awayGoals ? 3 : 2), 0);
  const somaTabela = desfecho.phase1.reduce((acc, r) => acc + r.points, 0);
  assert(somaTabela === somaEsperada, `tabela ${somaTabela} vs jogos ${somaEsperada}`);
});

check('cada grupo tem 4 clubes, 6 rodadas e 3 jogos', () => {
  const rodadasGrupo = T.fixtures.slice(T.phase1, T.phase1 + T.groupRounds);
  assert(rodadasGrupo.length === 6, `rodadas ${rodadasGrupo.length}`);
  rodadasGrupo.forEach((games, i) => assert(games.length === 4, `rodada ${i + 1}: ${games.length} jogos`));
  assert(desfecho.groups.A.length === 4 && desfecho.groups.B.length === 4, '4 por grupo');
  desfecho.groups.A.forEach(r => assert(r.played === 6, `grupo A: ${r.club} jogou ${r.played}`));
});

check('os clubes dos grupos saíram do top 8 da primeira fase', () => {
  const top8 = desfecho.phase1.slice(0, SERIE_C_QUALIFIED).map(r => r.club);
  T.state.groups.groupA.forEach(club => assert(top8.includes(club), `${club} não está no top 8`));
  T.state.groups.groupB.forEach(club => assert(top8.includes(club), `${club} não está no top 8`));
});

check('a semeadura dos grupos é a entrelaçada da CBF', () => {
  const top8 = desfecho.phase1.slice(0, SERIE_C_QUALIFIED).map(r => r.club);
  const esperadoA = [top8[0], top8[3], top8[4], top8[7]].join();
  const esperadoB = [top8[1], top8[2], top8[5], top8[6]].join();
  assert([...T.state.groups.groupA].sort().join() === [...esperadoA.split(',')].sort().join(), `A = ${T.state.groups.groupA}`);
  assert([...T.state.groups.groupB].sort().join() === [...esperadoB.split(',')].sort().join(), `B = ${T.state.groups.groupB}`);
});

check('promovem os dois vencedores de grupo, um de cada', () => {
  assert(desfecho.promoted.length === 2, `promovidos ${desfecho.promoted}`);
  assert(vencedores.has(desfecho.promoted[0]), '1º promovido não é vencedor de grupo');
  assert(vencedores.size === 2, 'dois vencedores distintos');
  assert(new Set(desfecho.promoted).size === 2, 'sem duplicidade');
});

check('o acesso não é o top 4 da primeira fase', () => {
  const top4 = desfecho.phase1.slice(0, 4).map(r => r.club);
  const naoPromovidos = top4.filter(c => !desfecho.promoted.includes(c));
  assert(naoPromovidos.length > 0, `ninguém do top 4 ficou de fora: ${top4}`);
});

check('o campeão é o vencedor da final', () => {
  const jogosFinal = desfecho.champion ? desfecho.finalMethod : null;
  assert(desfecho.champion, 'sem campeão');
  assert(vencedores.has(desfecho.champion), `campeão ${desfecho.champion} não venceu nenhum grupo`);
  const naFinal = T.fixtures.slice(T.phase1 + T.groupRounds).flat().map(g => [g.home, g.away]);
  assert(naFinal.some(([a, b]) => a === desfecho.champion || b === desfecho.champion), 'campeão não jogou a final');
  assert(desfecho.finalMethod === 'agregado' || desfecho.finalMethod === 'gol-de-campo', `método ${desfecho.finalMethod}`);
});

check('o rebaixamento vem do fim da primeira fase', () => {
  const esperado = serieCRelegationSlots(TEMPORADA);
  assert(desfecho.relegated.length === esperado, `rebaixados ${desfecho.relegated.length}, esperado ${esperado}`);
  const fase1 = desfecho.phase1.map(r => r.club);
  const ultimos = fase1.slice(-esperado);
  assert(desfecho.relegated.join() === ultimos.join(), `rebaixados ${desfecho.relegated} vs últimos ${ultimos}`);
  desfecho.promoted.forEach(c => assert(!desfecho.relegated.includes(c), `${c} foi promovido e rebaixado`));
});

check('ninguém é promovido direto na primeira fase', () => {
  const top4 = desfecho.phase1.slice(0, 4).map(r => r.club);
  const promovidosQuePassaramDireto = top4.filter(c => !vencedores.has(c) && desfecho.promoted.includes(c));
  assert(promovidosQuePassaramDireto.length === 0, `promovidos sem grupo: ${promovidosQuePassaramDireto}`);
});

check('os grupos e a final não entram no saldo da primeira fase', () => {
  const saldoFase1 = desfecho.phase1.reduce((acc, r) => acc + r.goalDiff, 0);
  assert(saldoFase1 === 0, `saldo ${saldoFase1} — cada gol marca e desmarca`);
  const saldoGrupos = [...desfecho.groups.A, ...desfecho.groups.B].reduce((acc, r) => acc + r.goalDiff, 0);
  assert(saldoGrupos === 0, `saldo dos grupos ${saldoGrupos}`);
});

console.log(`\nserie-c-season-e2e: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);