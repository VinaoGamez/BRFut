import {
  SERIE_C_QUALIFIED,
  SERIE_C_GROUP_ROUNDS,
  SERIE_C_FINAL_ROUNDS,
  SERIE_C_PHASE_GROUPS,
  SERIE_C_PHASE_FINAL,
  serieCGroupComposition,
  serieCPhaseRounds,
  serieCPhaseIndexForRound,
  serieCPhaseLabel,
  describeSerieCFormat,
} from '../js/engine/serie-c-format.js';
import {
  buildSerieCStandings,
  compareSerieCRows,
  detectSerieCGroups,
  isSerieCFinalRound,
  isSerieCGroupRound,
  isSerieCPhaseOneRound,
  resolveSerieCOutcome,
  serieCChampion,
  serieCFinalAggregate,
  serieCGroupStandings,
  serieCGroupWinners,
  serieCPhaseOneStandings,
  serieCRoundSpan,
} from '../js/engine/serie-c-standings.js';

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

// ---------------------------------------------------------------- formato

check('20 clubes somam 27 rodadas', () => {
  const r = serieCPhaseRounds(20);
  assert(r.phase1 === 19, `fase 1 = ${r.phase1}`);
  assert(r.groups === 6, `grupos = ${r.groups}`);
  assert(r.final === 2, `final = ${r.final}`);
  assert(r.total === 27, `total = ${r.total}`);
});

check('divisão maior alonga só a primeira fase', () => {
  assert(serieCPhaseRounds(24).total === 31, '24 clubes');
  assert(serieCPhaseRounds(28).total === 35, '28 clubes');
});

check('grupos são entrelaçados 1/4/5/8 e 2/3/6/7', () => {
  const ranked = ['1', '2', '3', '4', '5', '6', '7', '8'];
  const { groupA, groupB } = serieCGroupComposition(ranked);
  assert(groupA.join() === '1,4,5,8', `grupo A = ${groupA}`);
  assert(groupB.join() === '2,3,6,7', `grupo B = ${groupB}`);
});

check('nenhum clube aparece em dois grupos', () => {
  const ranked = Array.from({ length: SERIE_C_QUALIFIED }, (_v, i) => `C${i + 1}`);
  const { groupA, groupB } = serieCGroupComposition(ranked);
  const all = [...groupA, ...groupB];
  assert(new Set(all).size === all.length, 'sem repetição');
});

check('rodada identifica a fase', () => {
  assert(serieCPhaseIndexForRound(19, 20) === 1, '19 é fase 1');
  assert(serieCPhaseIndexForRound(20, 20) === SERIE_C_PHASE_GROUPS, '20 é grupos');
  assert(serieCPhaseIndexForRound(25, 20) === SERIE_C_PHASE_GROUPS, '25 é grupos');
  assert(serieCPhaseIndexForRound(26, 20) === SERIE_C_PHASE_FINAL, '26 é final');
  assert(serieCPhaseIndexForRound(27, 20) === SERIE_C_PHASE_FINAL, '27 é final');
  assert(serieCPhaseIndexForRound(28, 20) === 0, '28 está fora');
});

check('classificação de fase por rodada bate com o formato', () => {
  assert(isSerieCPhaseOneRound(1, 20) && isSerieCPhaseOneRound(19, 20), 'fase 1');
  assert(!isSerieCPhaseOneRound(20, 20), '20 não é fase 1');
  assert(isSerieCGroupRound(20, 20) && isSerieCGroupRound(25, 20), 'grupos');
  assert(!isSerieCGroupRound(26, 20), '26 não é grupo');
  assert(isSerieCFinalRound(26, 20) && isSerieCFinalRound(27, 20), 'final');
  assert(!isSerieCFinalRound(28, 20), '28 não é final');
  assert(serieCRoundSpan(20).total === 27, 'span');
});

check('rótulo e descrição da fase', () => {
  assert(serieCPhaseLabel(1) === 'FASE 1', 'fase 1');
  assert(serieCPhaseLabel(SERIE_C_PHASE_GROUPS) === 'GRUPOS', 'grupos');
  assert(serieCPhaseLabel(SERIE_C_PHASE_FINAL) === 'FINAL', 'final');
  assert(serieCPhaseLabel(9) === '', 'desconhecida');
  const texto = describeSerieCFormat(20, 4).join(' ');
  assert(texto.includes('19 rodadas'), 'menciona a fase 1');
  assert(texto.includes('27 rodadas'), 'menciona o total');
  assert(texto.includes('4 últimos'), 'menciona o rebaixamento');
});

// ------------------------------------------------------------ classificação

const jogo = (home, away, homeGoals, awayGoals, extra = {}) => ({
  home,
  away,
  homeGoals,
  awayGoals,
  completed: true,
  ...extra,
});

const semResultado = (home, away, extra = {}) => ({
  home,
  away,
  completed: false,
  homeGoals: null,
  awayGoals: null,
  ...extra,
});

check('vitória vale 3, empate 1, derrota 0', () => {
  const rows = buildSerieCStandings(['A', 'B', 'C'], [
    jogo('A', 'B', 2, 0),
    jogo('A', 'C', 1, 1),
  ]);
  const porNome = Object.fromEntries(rows.map(r => [r.club, r]));
  assert(porNome.A.points === 4, `A = ${porNome.A.points}`);
  assert(porNome.B.points === 0, `B = ${porNome.B.points}`);
  assert(porNome.C.points === 1, `C = ${porNome.C.points}`);
  assert(porNome.A.wins === 1 && porNome.A.draws === 1, 'vitórias e empates');
  assert(porNome.A.goalDiff === 2, `saldo A = ${porNome.A.goalDiff}`);
  assert(porNome.C.goalDiff === 0, 'saldo C');
  assert(porNome.B.losses === 1, `derrotas de B = ${porNome.B.losses}`);
});

check('jogo sem resultado não entra na tabela', () => {
  const rows = buildSerieCStandings(['A', 'B'], [semResultado('A', 'B')]);
  assert(rows.every(r => r.played === 0 && r.points === 0), 'tabela zerada');
});

check('ordem é pontos, vitórias, saldo', () => {
  const rows = buildSerieCStandings(['A', 'B', 'C'], [
    jogo('A', 'B', 1, 0),
    jogo('C', 'B', 1, 0),
    jogo('A', 'C', 0, 5),
  ]);
  // C ganhou de A e de B (6), A ganhou de B (3), B não pontuou.
  assert(rows[0].club === 'C', `1º ${rows[0].club}`);
  assert(rows[1].club === 'A', `2º ${rows[1].club}`);
  assert(rows[2].club === 'B', `3º ${rows[2].club}`);
  // Empate em pontos: quem tem mais vitórias fica à frente, mesmo com saldo menor.
  assert(compareSerieCRows({ points: 3, wins: 1, goalDiff: 0, club: 'X' },
    { points: 3, wins: 2, goalDiff: 5, club: 'Y' }) > 0, 'X tem menos vitórias');
  assert(compareSerieCRows({ points: 6, wins: 2, goalDiff: 0, club: 'X' },
    { points: 3, wins: 1, goalDiff: 9, club: 'Y' }) < 0, 'pontos dominam');
});

// ------------------------------------------------------------- fases da C

const CLUBES = Array.from({ length: 20 }, (_v, i) => `C${i + 1}`);

/** Temporada completa: fase 1 + grupos + final, já disputados. */
function temporadaCompleta({ campeao = 'C1', vice = 'C2' } = {}) {
  const fixtures = [];
  const { phase1 } = serieCPhaseRounds(20);

  // Fase 1: C1 vence tudo, C20 e C19 perdem tudo.
  for (let r = 1; r <= phase1; r += 1) {
    const games = [];
    for (let i = 0; i < CLUBES.length / 2; i += 1) {
      const a = CLUBES[i];
      const b = CLUBES[CLUBES.length - 1 - i];
      const forte = a === 'C1' || b === 'C1' || a === 'C19' || a === 'C20' || b === 'C19' || b === 'C20';
      games.push(forte
        ? jogo(a, b, 3, 0)
        : jogo(a, b, 1, 1));
    }
    fixtures.push(games);
  }

  const grupos = { groupA: ['C1', 'C4', 'C5', 'C8'], groupB: ['C2', 'C3', 'C6', 'C7'] };
  // Grupos: C1 e C2 vencem os dois turnos.
  for (let r = 0; r < SERIE_C_GROUP_ROUNDS; r += 1) {
    const games = [];
    for (const [key, lista] of [['A', grupos.groupA], ['B', grupos.groupB]]) {
      const favorito = key === 'A' ? 'C1' : 'C2';
      for (let i = 0; i < lista.length / 2; i += 1) {
        const a = lista[i];
        const b = lista[lista.length - 1 - i];
        games.push(a === favorito || b === favorito
          ? jogo(a, b, 2, 0, { group: key, phase: 'GRUPOS' })
          : jogo(a, b, 1, 1, { group: key, phase: 'GRUPOS' }));
      }
    }
    fixtures.push(games);
  }

  const final = campeao === vice
    ? [jogo(campeao, vice, 1, 0, { tieId: 'serie-c-final', leg: 'IDA' }),
      jogo(vice, campeao, 1, 0, { tieId: 'serie-c-final', leg: 'VOLTA' })]
    : [jogo(campeao, vice, 2, 1, { tieId: 'serie-c-final', leg: 'IDA' }),
      jogo(vice, campeao, 0, 1, { tieId: 'serie-c-final', leg: 'VOLTA' })];
  fixtures.push([final[0]], [final[1]]);

  return { fixtures, grupos, fase1: phase1 };
}

check('tabela da fase 1 só soma as 19 primeiras rodadas', () => {
  const { fixtures } = temporadaCompleta();
  const rows = serieCPhaseOneStandings({ fixtures, clubs: CLUBES, clubsCount: 20 });
  assert(rows.length === 20, `${rows.length} clubes`);
  assert(rows.every(r => r.played === 19), `jogos disputados = ${rows[0].played}`);
  assert(rows[0].club === 'C1', `líder = ${rows[0].club}`);
  assert(rows[19].club === 'C20', `lanterna = ${rows[19].club}`);
  assert(rows[19].points === 0, `pontos do último = ${rows[19].points}`);
});

check('pontos dos grupos não contaminam a tabela da fase 1', () => {
  const { fixtures } = temporadaCompleta();
  const rows = serieCPhaseOneStandings({ fixtures, clubs: CLUBES, clubsCount: 20 });
  const lider = rows.find(r => r.club === 'C1');
  // 19 vitórias na fase 1 = 57 pontos. Se os grupos entrassem, seria 69.
  assert(lider.points === 57, `C1 na fase 1 = ${lider.points} pontos`);
  assert(lider.played === 19, `C1 jogou ${lider.played}`);
});

check('grupos são detectados a partir dos jogos', () => {
  const { fixtures, grupos } = temporadaCompleta();
  const detectados = detectSerieCGroups(fixtures);
  assert(detectados, 'detectou grupos');
  // A ordem de descoberta segue a rodada; o que importa é a composição.
  assert(
    [...detectados.groupA].sort().join() === [...grupos.groupA].sort().join(),
    `A = ${detectados.groupA}`,
  );
  assert(
    [...detectados.groupB].sort().join() === [...grupos.groupB].sort().join(),
    `B = ${detectados.groupB}`,
  );
  assert(detectados.groupA.length === 4 && detectados.groupB.length === 4, '4 por grupo');
});

check('sem jogos de grupo, detect returns null', () => {
  const fixtures = [[jogo('C1', 'C2', 1, 0)]];
  assert(detectSerieCGroups(fixtures) === null, 'não há grupos');
  assert(detectSerieCGroups(null) === null, 'sem fixtures');
});

check('tabela de grupo só soma os jogos do próprio grupo', () => {
  const { fixtures, grupos } = temporadaCompleta();
  const tabelas = serieCGroupStandings({ fixtures, groups: grupos, clubsCount: 20 });
  assert(tabelas.A.length === 4 && tabelas.B.length === 4, '4 por grupo');
  assert(tabelas.A.every(r => grupos.groupA.includes(r.club)), 'só clubes do grupo A');
  assert(tabelas.A.every(r => r.played === 6), `6 jogos = ${tabelas.A[0].played}`);
  assert(tabelas.A[0].points === 18, `C1 no grupo = ${tabelas.A[0].points}`);
  const vencedores = serieCGroupWinners(tabelas);
  assert(vencedores.groupA === 'C1', `vencedor A = ${vencedores.groupA}`);
  assert(vencedores.groupB === 'C2', `vencedor B = ${vencedores.groupB}`);
});

check('agregado da final soma os dois jogos', () => {
  const { fixtures } = temporadaCompleta();
  const agg = serieCFinalAggregate(fixtures);
  assert(agg.clubA === 'C1' && agg.clubB === 'C2', 'par da final');
  // Ida C1 2x1 C2, volta C2 0x1 C1 → agregado C1 3 x 1 C2.
  assert(agg.goalsA === 3 && agg.goalsB === 1, `${agg.goalsA}x${agg.goalsB}`);
  assert(agg.legs === 2, `pernas = ${agg.legs}`);
});

check('campeão vem da final, não da líder da fase 1', () => {
  const { fixtures } = temporadaCompleta();
  const { champion, method } = serieCChampion({ fixtures });
  assert(champion === 'C1', `campeão = ${champion}`);
  assert(method === 'agregado', `método = ${method}`);
});

check('campeão é o segundo da final quando a fase 1 é mais fraca', () => {
  const { fixtures } = temporadaCompleta({ campeao: 'C2', vice: 'C1' });
  const { champion } = serieCChampion({ fixtures });
  assert(champion === 'C2', `campeão = ${champion}`);
});

check('final inexistente não promove ninguém a campeão', () => {
  const r = serieCChampion({ fixtures: [] });
  assert(r.champion === null && r.method === 'sem-final', 'sem final');
});

check('desfecho completo: campeão, promovidos e rebaixados', () => {
  const { fixtures } = temporadaCompleta();
  const out = resolveSerieCOutcome({
    fixtures,
    clubs: CLUBES,
    clubsCount: 20,
    relegationSlots: 4,
  });
  assert(out.champion === 'C1', `campeão = ${out.champion}`);
  assert(out.promoted.join() === 'C1,C2', `promovidos = ${out.promoted}`);
  assert(out.relegated.length === 4, `rebaixados = ${out.relegated.length}`);
  assert(out.relegated.includes('C20') && out.relegated.includes('C19'), 'os últimos');
  assert(!out.relegated.includes('C1'), 'o líder não rebaixa');
  // O rebaixamento vem da fase 1: C2 é o 2º e está nos grupos, mas não rebaixa.
  assert(!out.relegated.includes('C2'), 'C2 passou da fase 1');
  assert(out.promoted.every(c => ['C1', 'C2'].includes(c)), 'só os vencedores de grupo');
});

check('promoção não é mais o top 4 da tabela única', () => {
  const { fixtures } = temporadaCompleta();
  const out = resolveSerieCOutcome({ fixtures, clubs: CLUBES, clubsCount: 20, relegationSlots: 4 });
  assert(out.promoted.length === 2, `promovidos = ${out.promoted.length}, esperado 2`);
  assert(!out.promoted.includes('C3'), 'o 3º da fase 1 não é promovido');
});

check('save sem grupos cai no desfecho compatível', () => {
  const fixtures = [];
  for (let r = 1; r <= 19; r += 1) {
    const games = [];
    for (let i = 0; i < CLUBES.length / 2; i += 1) {
      games.push(jogo(CLUBES[i], CLUBES[CLUBES.length - 1 - i], 2, 0));
    }
    fixtures.push(games);
  }
  const out = resolveSerieCOutcome({ fixtures, clubs: CLUBES, clubsCount: 20, relegationSlots: 4 });
  // Contrato: sem grupos, a promoção volta a ser os dois primeiros da fase 1.
  const top2 = out.phase1.slice(0, 2).map(r => r.club);
  assert(out.promoted.join() === top2.join(), `promovidos = ${out.promoted} (esperado ${top2})`);
  assert(out.champion === out.phase1[0].club, `campeão = ${out.champion}`);
  assert(out.finalMethod === 'sem-final', `método = ${out.finalMethod}`);
  assert(out.relegated.length === 4, 'rebaixamento preservado');
});

check('desfecho nunca lança com entrada vazia', () => {
  const out = resolveSerieCOutcome({});
  assert(Array.isArray(out.phase1), 'fase 1 é lista');
  assert(out.champion === null, 'sem campeão');
  assert(Array.isArray(out.promoted) && Array.isArray(out.relegated), 'listas');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);