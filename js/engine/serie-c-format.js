/**
 * Formato da Série C no vigente da CBF.
 *
 * A Série C não é mais um turno e returno: é um torneio em três fases dentro da
 * mesma temporada.
 *
 *   Fase 1  — turno único entre todos. Os 8 primeiros avançam.
 *   Fase 2  — dois grupos de 4, em turno e returno. Vencedor de cada grupo
 *             acessa a Série B.
 *   Fase 3  — final em dois jogos entre os victorious de grupo. Define o
 *             campeão.
 *
 * A distribuição dos 8 qualificados nos grupos é entrelaçada de propósito:
 * 1/4/5/8 num grupo e 2/3/6/7 no outro. É o sorteio da CBF — semeadura
 * alternada evita que os dois primeiros da fase 1 caiam no mesmo grupo e se
 * eliminem antes da final.
 *
 * Módulo puro: nenhuma data, nenhum clube, nenhum save. Só a regra.
 */

/** Quantos clubes avançam da primeira fase para os grupos. */
export const SERIE_C_QUALIFIED = 8;

/** Rodadas por grupo na segunda fase (4 clubes em turno e returno). */
export const SERIE_C_GROUP_ROUNDS = 6;

/** A final é em casa e fora. */
export const SERIE_C_FINAL_ROUNDS = 2;

/** Vencedores de grupo que acessam a Série B. */
export const SERIE_C_PROMOTION_SLOTS = 2;

/** Semana da fase 1 (vale a mesma para qualquer tamanho). */
export const SERIE_C_PHASE_1 = 1;
export const SERIE_C_PHASE_GROUPS = 2;
export const SERIE_C_PHASE_FINAL = 3;

/**
 * Composição dos grupos a partir da classificação da primeira fase.
 *
 * @param {string[]} ranked clubes na ordem da fase 1 (1º primeiro)
 * @returns {{groupA: string[], groupB: string[]}}
 */
export function serieCGroupComposition(ranked = []) {
  const at = index => ranked[index] ?? null;
  return {
    groupA: [at(0), at(3), at(4), at(7)].filter(Boolean),
    groupB: [at(1), at(2), at(5), at(6)].filter(Boolean),
  };
}

/** As duas fases dependem só do número de clubes. */
export function serieCPhaseRounds(clubs) {
  const size = Math.max(2, Number(clubs) || 20);
  const phase1 = size - 1;
  return {
    phase1,
    groups: SERIE_C_GROUP_ROUNDS,
    final: SERIE_C_FINAL_ROUNDS,
    total: phase1 + SERIE_C_GROUP_ROUNDS + SERIE_C_FINAL_ROUNDS,
  };
}

/** Rodadas totais da Série C numa temporada, a partir do tamanho da divisão. */
export function serieCTotalRounds(clubs) {
  return serieCPhaseRounds(clubs).total;
}

/**
 * Em qual fase uma rodada cai.
 *
 * @param {number} round rodada de 1 a `total`
 * @param {number} clubs tamanho da divisão
 * @returns {1|2|3} `0` quando a rodada está fora da temporada
 */
export function serieCPhaseIndexForRound(round, clubs) {
  const { phase1, groups } = serieCPhaseRounds(clubs);
  const r = Number(round);
  if (!Number.isFinite(r) || r < 1) return 0;
  if (r <= phase1) return SERIE_C_PHASE_1;
  if (r <= phase1 + groups) return SERIE_C_PHASE_GROUPS;
  if (r <= phase1 + groups + SERIE_C_FINAL_ROUNDS) return SERIE_C_PHASE_FINAL;
  return 0;
}

/** Rótulo curto da fase, para UI e para o regulamento. */
export function serieCPhaseLabel(phase) {
  return (
    {
      [SERIE_C_PHASE_1]: 'FASE 1',
      [SERIE_C_PHASE_GROUPS]: 'GRUPOS',
      [SERIE_C_PHASE_FINAL]: 'FINAL',
    }[Number(phase)] || ''
  );
}

/** Descreve o formato em texto, usado no regulamento e na tela deIMER-campeonatos. */
export function describeSerieCFormat(clubs, relegationSlots) {
  const { phase1, groups, total } = serieCPhaseRounds(clubs);
  return [
    `Fase 1: ${clubs} clubes em turno único, ${phase1} rodadas. Os ${SERIE_C_QUALIFIED} primeiros avançam.`,
    `Fase 2: dois grupos de 4 (1º/4º/5º/8º e 2º/3º/6º/7º), turno e returno, ${groups} rodadas.`,
    `Fase 3: final em dois jogos entre os vencedores de grupo.`,
    `${total} rodadas no total. Os ${relegationSlots} últimos da fase 1 são rebaixados à Série D.`,
  ];
}
