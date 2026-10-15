/**
 * Série C temporada em três fases — montagem e instalação progressiva.
 *
 * A primeira fase é gerada inteira no início da temporada. Os grupos e a final
 * **não** são: eles dependem de quem termina a fase 1 em cada posição, então só
 * podem ser instalados depois que ela acaba. É o mesmo desenho que a Série D já
 * usa no mata-mata (`serie-d-knockout-advance.js`).
 *
 * Consequência prática: um save antigo da Série C, com 38 rodadas de turno e
 * returno, não pode ser reaproveitado — as posições não batem.
 */

import {
  SERIE_C_QUALIFIED,
  SERIE_C_GROUP_ROUNDS,
  SERIE_C_FINAL_ROUNDS,
  SERIE_C_PHASE_GROUPS,
  SERIE_C_PHASE_FINAL,
  serieCGroupComposition,
  serieCPhaseRounds,
} from './serie-c-format.js';

export const SERIE_C_COMPETITION = 'BRASILEIRÃO SÉRIE C';

/**
 * Instala um bloco de rodadas a partir de `startRound`, preservando o que já
 * existe antes e preenchendo buracos no meio.
 *
 * @param {Array<Array>} fixtures array de rodadas da divisão
 * @param {Array<Array>} rounds rodadas novas, na ordem
 * @param {number} startRound rodada 1-based onde o bloco começa
 * @returns {number} total de rodadas depois da instalação
 */
export function installSerieCRounds(fixtures, rounds, startRound) {
  if (!Array.isArray(fixtures)) return 0;
  if (!Array.isArray(rounds) || !rounds.length) return fixtures.length;
  const start = Math.max(1, Number(startRound) || 1);
  rounds.forEach((games, index) => {
    const slot = start + index - 1;
    const list = Array.isArray(games) ? games : [];
    // Não sobrescreve rodada que já tem jogo marcado: seria trocar resultado
    // por agenda no meio da temporada.
    const existente = fixtures[slot];
    const temJogo = Array.isArray(existente) && existente.some(game => game && game.completed);
    if (temJogo) return;
    fixtures[slot] = list.map(game => ({
      ...game,
      competition: game?.competition || SERIE_C_COMPETITION,
      phase: game?.phase,
    }));
  });
  // Apara rodadas vazias no fim: o comprimento do array tem que ser a última
  // rodada com jogo, senão a temporada ganha rodadas fantasma.
  while (fixtures.length && isRoundEmpty(fixtures[fixtures.length - 1])) {
    fixtures.pop();
  }
  return fixtures.length;
}

const isRoundEmpty = round => !Array.isArray(round) || !round.length || round.every(game => !game);

/**
 * Monta a segunda fase: dois grupos de 4 em turno e returno, com as rodadas
 * achatadas (todos os grupos jogam na mesma rodada, como na Série D).
 *
 * @param {{groupA: string[], groupB: string[]}} groups
 * @param {(clubs: string[], roundRobin: boolean) => Array<Array>} roundRobin
 * @returns {Array<Array>} 6 rodadas
 */
export function buildSerieCGroupRounds(groups, roundRobin) {
  const lists = [groups?.groupA || [], groups?.groupB || []].filter(list => list.length >= 2);
  if (!lists.length) return [];
  const perGroup = lists.map(list => roundRobin(list, true));
  const rounds = [];
  for (let r = 0; r < SERIE_C_GROUP_ROUNDS; r += 1) {
    const games = [];
    lists.forEach((_list, index) => {
      const groupGames = perGroup[index]?.[r] || [];
      groupGames.forEach(game => {
        games.push({ ...game, phase: 'GRUPOS', group: index === 0 ? 'A' : 'B' });
      });
    });
    if (games.length) rounds.push(games);
  }
  return rounds;
}

/**
 * Monta a final: dois jogos, o segundo com os mando invertidos.
 *
 * @param {string} winnerA vencedor do grupo A
 * @param {string} winnerB vencedor do grupo B
 * @returns {Array<Array>} 2 rodadas de 1 jogo
 */
export function buildSerieCRFinalRounds(winnerA, winnerB) {
  if (!winnerA || !winnerB) return [];
  const jogo = (home, away, leg) => ({
    home,
    away,
    phase: 'FINAL',
    leg,
    tieId: `serie-c-final`,
    completed: false,
    date: null,
  });
  return [[jogo(winnerA, winnerB, 'IDA')], [jogo(winnerB, winnerA, 'VOLTA')]];
}

/**
 * Instala grupos e final a partir da classificação da primeira fase.
 *
 * @param {object} params
 * @param {Array<Array>} params.fixtures rodadas da divisão
 * @param {string[]} params.ranked clubes na ordem da fase 1
 * @param {number} params.clubs tamanho da divisão
 * @param {Function} params.roundRobin gerador de pontos corridos
 * @returns {{groupA: string[], groupB: string[], roundsInstalled: number}}
 */
export function installSerieCSecondPhase({ fixtures, ranked, clubs, roundRobin }) {
  const { phase1 } = serieCPhaseRounds(clubs);
  const { groupA, groupB } = serieCGroupComposition((ranked || []).slice(0, SERIE_C_QUALIFIED));
  const rounds = buildSerieCGroupRounds({ groupA, groupB }, roundRobin);
  if (!rounds.length) return { groupA, groupB, roundsInstalled: 0 };
  installSerieCRounds(fixtures, rounds, phase1 + 1);
  return { groupA, groupB, roundsInstalled: rounds.length };
}

/**
 * Instala a final entre os vencedores de grupo.
 *
 * @returns {{winner: string|null, roundsInstalled: number}}
 */
export function installSerieCFinal({ fixtures, clubs, winnerA, winnerB }) {
  const { phase1, groups } = serieCPhaseRounds(clubs);
  const rounds = buildSerieCRinalRoundsSafe(winnerA, winnerB);
  if (!rounds.length) return { winner: null, roundsInstalled: 0 };
  installSerieCRounds(fixtures, rounds, phase1 + groups + 1);
  return { winner: winnerA, roundsInstalled: rounds.length };
}

const buildSerieCRinalRoundsSafe = (winnerA, winnerB) =>
  winnerA && winnerB ? buildSerieCRFinalRounds(winnerA, winnerB) : [];

/** Número de rodadas que a segunda fase ocupa (grupos). */
export const SERIE_C_GROUPS_ROUNDS = SERIE_C_GROUP_ROUNDS;

/** Fases exportadas para a UI e para o regulamento. */
export const SERIE_C_PHASES = Object.freeze({
  first: 1,
  groups: SERIE_C_PHASE_GROUPS,
  final: SERIE_C_PHASE_FINAL,
});

/** Total de rodadas reservadas para final — usado no cálculo de temporada. */
export const SERIE_C_FINAL_TOTAL = SERIE_C_FINAL_ROUNDS;
