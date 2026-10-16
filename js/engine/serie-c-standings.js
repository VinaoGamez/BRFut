/**
 * Série C — classificação por fase e desfecho da temporada.
 *
 * A tabela única da divisão não conta a temporada inteira. No formato CBF cada
 * fase tem a sua:
 *
 *   Fase 1  — todos contra todos, turno único. Define quem rebaixa.
 *   Fase 2  — dois grupos de 4. Só o primeiro de cada grupo interessa.
 *   Fase 3  — final em dois jogos, decidida no saldo agregado.
 *
 * Somar os pontos dos grupos e da final na mesma tabela da fase 1 daria ao
 * jogador uma classificação que não existe no regulamento: o campeão da Série C
 * é o vencedor da final, não o líder dos 27 pontos. Por isso este módulo é
 * separado — ele lê as rodadas já disputadas e reconstrói cada tabela.
 *
 * Módulo puro: nenhum save, nenhum clube, nenhuma data.
 */

import {
  SERIE_C_QUALIFIED,
  SERIE_C_PHASE_1,
  SERIE_C_GROUP_ROUNDS,
  SERIE_C_FINAL_ROUNDS,
  serieCPhaseRounds,
} from './serie-c-format.js';

/** Mesmo formato de linha usado pelo resto do motor. */
export const emptySerieCRow = club => ({
  club,
  played: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  goalDiff: 0,
  points: 0,
});

/** Ordem de classificação: pontos, vitórias, saldo. Igual à usada no motor. */
export const compareSerieCRows = (a, b) =>
  b.points - a.points
  || b.wins - a.wins
  || b.goalDiff - a.goalDiff
  || String(a.club).localeCompare(String(b.club), 'pt-BR');

/**
 * Rodadas que pertencem a cada fase.
 *
 * @param {number} clubs tamanho da divisão
 * @returns {{phase1: number, groups: number, final: number, total: number}}
 */
export function serieCRoundSpan(clubs) {
  const { phase1, groups, final, total } = serieCPhaseRounds(clubs);
  return { phase1, groups, final, total };
}

/** Uma rodada 1-based está na fase 1? */
export function isSerieCPhaseOneRound(round, clubs) {
  const { phase1 } = serieCRoundSpan(clubs);
  const r = Number(round);
  return Number.isFinite(r) && r >= 1 && r <= phase1;
}

/** Uma rodada 1-based está na fase de grupos? */
export function isSerieCGroupRound(round, clubs) {
  const { phase1, groups } = serieCRoundSpan(clubs);
  const r = Number(round);
  return Number.isFinite(r) && r > phase1 && r <= phase1 + groups;
}

/** Uma rodada 1-based é a da final? */
export function isSerieCFinalRound(round, clubs) {
  const { phase1, groups, final } = serieCRoundSpan(clubs);
  const r = Number(round);
  return Number.isFinite(r) && r > phase1 + groups && r <= phase1 + groups + final;
}

/** Um jogo já tem resultado registrado? */
export function isFinishedSerieCGame(game) {
  if (!game || !game.home || !game.away) return false;
  if (game.completed === false) return false;
  return Number.isFinite(Number(game.homeGoals)) && Number.isFinite(Number(game.awayGoals));
}

/**
 * Acumula uma lista de jogos numa tabela.
 *
 * @param {string[]} clubs clubes que entram zerados na tabela
 * @param {Array<object>} games
 * @returns {Array<object>} linhas já ordenadas
 */
export function buildSerieCStandings(clubs, games) {
  const rows = new Map((clubs || []).filter(Boolean).map(club => [club, emptySerieCRow(club)]));
  (games || []).forEach(game => {
    if (!isFinishedSerieCGame(game)) return;
    const home = rows.get(game.home);
    const away = rows.get(game.away);
    if (!home || !away) return;
    const hg = Number(game.homeGoals);
    const ag = Number(game.awayGoals);
    home.played += 1;
    away.played += 1;
    home.goalDiff += hg - ag;
    away.goalDiff += ag - hg;
    if (hg > ag) {
      home.wins += 1;
      away.losses += 1;
      home.points += 3;
    } else if (hg < ag) {
      away.wins += 1;
      home.losses += 1;
      away.points += 3;
    } else {
      home.draws += 1;
      away.draws += 1;
      home.points += 1;
      away.points += 1;
    }
  });
  return [...rows.values()].sort(compareSerieCRows);
}

/**
 * Jogos de um intervalo de rodadas (1-based, inclusive).
 *
 * @param {Array<Array>} fixtures rodadas da divisão
 * @param {number} from primeira rodada
 * @param {number} to última rodada
 * @returns {Array<object>}
 */
export function serieCGamesBetween(fixtures, from, to) {
  if (!Array.isArray(fixtures)) return [];
  const out = [];
  const start = Math.max(1, Number(from) || 1);
  const end = Number(to) || 0;
  for (let round = start; round <= end; round += 1) {
    const games = fixtures[round - 1];
    if (!Array.isArray(games)) continue;
    games.forEach(game => {
      if (game) out.push(game);
    });
  }
  return out;
}

/**
 * Tabela da primeira fase. É dela que sai o rebaixamento.
 *
 * @param {object} params
 * @param {Array<Array>} params.fixtures
 * @param {string[]} params.clubs todos os clubes da divisão
 * @param {number} params.clubsCount tamanho da divisão
 * @returns {Array<object>}
 */
export function serieCPhaseOneStandings({ fixtures, clubs, clubsCount }) {
  const { phase1 } = serieCRoundSpan(clubsCount);
  return buildSerieCStandings(clubs, serieCGamesBetween(fixtures, 1, phase1));
}

/**
 * Tabelas dos dois grupos da segunda fase.
 *
 * Só contam os jogos cujo `group` bate com o grupo — os dois grupos jogam nas
 * mesmas rodadas, então filtrar por rodada não separa nada.
 *
 * @param {object} params
 * @param {Array<Array>} params.fixtures
 * @param {{groupA: string[], groupB: string[]}} params.groups
 * @param {number} params.clubsCount
 * @returns {{A: Array<object>, B: Array<object>}}
 */
export function serieCGroupStandings({ fixtures, groups, clubsCount }) {
  const { phase1, groups: groupRounds } = serieCRoundSpan(clubsCount);
  const games = serieCGamesBetween(fixtures, phase1 + 1, phase1 + groupRounds);
  const tableFor = (list, key) =>
    buildSerieCStandings(
      list || [],
      games.filter(game => String(game?.group || '').toUpperCase() === key),
    );
  return {
    A: tableFor(groups?.groupA, 'A'),
    B: tableFor(groups?.groupB, 'B'),
  };
}

/** Nomes dos clubes das duas tabelas de grupo, na ordem de classificação. */
export function serieCGroupOrder(standings) {
  return {
    groupA: (standings?.A || []).map(row => row.club),
    groupB: (standings?.B || []).map(row => row.club),
  };
}

/** Vencedor de cada grupo — quem acessa a Série B. */
export function serieCGroupWinners(standings) {
  return {
    groupA: standings?.A?.[0]?.club || null,
    groupB: standings?.B?.[0]?.club || null,
  };
}

/**
 * Placar agregado da final.
 *
 * @param {Array<Array>} fixtures
 * @param {string} tieId identificador usado em `buildSerieCRFinalRounds`
 * @returns {{clubA: string|null, clubB: string|null, goalsA: number, goalsB: number, legs: number}|null}
 */
export function serieCFinalAggregate(fixtures, tieId = 'serie-c-final') {
  if (!Array.isArray(fixtures)) return null;
  let clubA = null;
  let clubB = null;
  let goalsA = 0;
  let goalsB = 0;
  let legs = 0;
  fixtures.forEach(round => {
    if (!Array.isArray(round)) return;
    round.forEach(game => {
      if (!game || game.tieId !== tieId || !isFinishedSerieCGame(game)) return;
      if (!clubA) {
        clubA = game.home;
        clubB = game.away;
      }
      legs += 1;
      const hg = Number(game.homeGoals);
      const ag = Number(game.awayGoals);
      if (game.home === clubA) {
        goalsA += hg;
        goalsB += ag;
      } else {
        goalsA += ag;
        goalsB += hg;
      }
    });
  });
  if (!clubA || !clubB || legs < 1) return null;
  return { clubA, clubB, goalsA, goalsB, legs };
}

/**
 * Campeão da Série C: agregado da final.
 *
 * A CBF resolve o empate do agregado na disputa de pênaltis, que o motor não
 * simula. O desempate adotado aqui é o gol marcado fora de casa ao longo da
 * final — determinístico, já usado como critério no futebol e coerente com a
 * lógica de mando de campo do motor. Fica registrado como substituto, não como
 * a regra oficial.
 *
 * @returns {{champion: string|null, runnerUp: string|null, method: string, aggregate: object|null}}
 */
export function serieCChampion({ fixtures, tieId = 'serie-c-final' } = {}) {
  const aggregate = serieCFinalAggregate(fixtures, tieId);
  if (!aggregate) return { champion: null, runnerUp: null, method: 'sem-final', aggregate: null };
  const { clubA, clubB, goalsA, goalsB } = aggregate;
  let champion = null;
  let method = 'agregado';
  if (goalsA > goalsB) champion = clubA;
  else if (goalsB > goalsA) champion = clubB;
  else {
    method = 'gol-de-campo';
    const away = countAwayGoals(fixtures, tieId, clubA) - countAwayGoals(fixtures, tieId, clubB);
    champion = away > 0 ? clubA : away < 0 ? clubB : clubA;
  }
  return {
    champion,
    runnerUp: champion === clubA ? clubB : clubA,
    method,
    aggregate,
  };
}

/** Gols do clube marcados como visitante na final. */
function countAwayGoals(fixtures, tieId, clubName) {
  if (!Array.isArray(fixtures) || !clubName) return 0;
  let total = 0;
  fixtures.forEach(round => {
    if (!Array.isArray(round)) return;
    round.forEach(game => {
      if (!game || game.tieId !== tieId || !isFinishedSerieCGame(game)) return;
      if (game.away === clubName) total += Number(game.awayGoals);
    });
  });
  return total;
}

/**
 * Desfecho completo da temporada da Série C.
 *
 * Nunca lança: quando uma fase não chegou a ser disputada (save antigo, carreira
 * abandonada antes do fim) cai no desfecho compatível com o que existe.
 *
 * @param {object} params
 * @param {Array<Array>} params.fixtures rodadas da divisão
 * @param {string[]} params.clubs clubes da divisão
 * @param {number} params.clubsCount tamanho da divisão
 * @param {number} params.relegationSlots quantos caem da fase 1
 * @returns {{
 *   phase1: Array<object>,
 *   groups: {A: Array<object>, B: Array<object>},
 *   groupWinners: {groupA: string|null, groupB: string|null},
 *   promoted: string[],
 *   champion: string|null,
 *   runnerUp: string|null,
 *   relegated: string[],
 *   finalMethod: string,
 * }}
 */
export function resolveSerieCOutcome({ fixtures, clubs, clubsCount, relegationSlots = 2 } = {}) {
  const size = Number(clubsCount) || 20;
  const phase1 = serieCPhaseOneStandings({ fixtures, clubs, clubsCount: size });
  const phase1Order = phase1.map(row => row.club);

  // Grupos: só existem se `fixtures` trouxer jogos com `group`. Sem eles — save
  // antigo ou temporada interrompida — a promoteção sai da fase 1.
  const declaredGroups = detectSerieCGroups(fixtures);
  const groups = declaredGroups
    ? serieCGroupStandings({ fixtures, groups: declaredGroups, clubsCount: size })
    : { A: [], B: [] };
  const groupWinners = serieCGroupWinners(groups);

  const promoted = declaredGroups
    ? [groupWinners.groupA, groupWinners.groupB].filter(Boolean)
    : phase1Order.slice(0, 2);

  const final = serieCChampion({ fixtures });
  const champion = final.champion || phase1Order[0] || null;

  const relegated = phase1Order.slice(-Math.max(0, Number(relegationSlots) || 0));

  return {
    phase1,
    groups,
    groupWinners,
    promoted: [...new Set(promoted)],
    champion,
    runnerUp: final.runnerUp || null,
    relegated,
    finalMethod: final.method,
  };
}

/** Descobre a composição dos grupos a partir dos jogos já instalados. */
export function detectSerieCGroups(fixtures) {
  if (!Array.isArray(fixtures)) return null;
  const groupA = [];
  const groupB = [];
  let found = false;
  fixtures.forEach(round => {
    if (!Array.isArray(round)) return;
    round.forEach(game => {
      if (!game || !game.home || !game.away) return;
      const key = String(game.group || '').toUpperCase();
      if (key !== 'A' && key !== 'B') return;
      found = true;
      const list = key === 'A' ? groupA : groupB;
      if (!list.includes(game.home)) list.push(game.home);
      if (!list.includes(game.away)) list.push(game.away);
    });
  });
  if (!found) return null;
  return { groupA, groupB };
}

/** Quantos clubes avançam da fase 1 — reexportado para a UI usar a mesma fonte. */
export const SERIE_C_GROUP_WINNERS = 2;

export { SERIE_C_QUALIFIED, SERIE_C_GROUP_ROUNDS, SERIE_C_FINAL_ROUNDS, SERIE_C_PHASE_1 };