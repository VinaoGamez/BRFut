/**
 * Regras CBF da Série D (1ª fase) — referência para comparar temporadas futuras.
 *
 * Fontes oficiais (2026):
 * - https://www.cbf.com.br/futebol-brasileiro/noticias/campeonato-brasileiro/a/cbf-divulga-grupos-da-serie-d-de-2026
 * - https://ge.globo.com/futebol/brasileirao-serie-d/
 *
 * A CBF publica os grupos A1–A16 no conselho técnico; o jogo espelha a lista
 * oficial do JSON `brazil-official-pyramid-{season}.json` (campo `serieDGroups`
 * ou ordem sequencial de `divisions.D`).
 */

import { SERIE_D_CLUBS, SERIE_D_GROUPS } from './serie-c-calendar.js';
import { SERIE_D_GROUP_ROUNDS } from '../core/constants.js';

/** @typedef {'geographic' | 'logistics' | 'max_3_per_federation'} SerieDFormationCriterion */

/**
 * Parâmetros de formação dos grupos — atualizar quando a CBF mudar o regulamento.
 * @type {Readonly<{
 *   season: number,
 *   clubs: number,
 *   groups: number,
 *   clubsPerGroup: number,
 *   maxClubsPerFederationPerGroup: number,
 *   formationCriteria: SerieDFormationCriterion[],
 *   groupLabels: string,
 *   knockoutPairing: string,
 *   knockoutSeeding: string,
 *   groupStageRounds: number,
 *   qualifyPerGroup: number,
 *   sources: string[],
 * }>}
 */
export const SERIE_D_CBF_GROUP_FORMATION = Object.freeze({
  season: 2026,
  clubs: SERIE_D_CLUBS,
  groups: SERIE_D_GROUPS,
  clubsPerGroup: SERIE_D_CLUBS / SERIE_D_GROUPS,
  /** Máximo de clubes da mesma federação estadual (UF) por grupo. */
  maxClubsPerFederationPerGroup: 3,
  /** Critérios declarados pela CBF na formação das chaves. */
  formationCriteria: Object.freeze(['geographic', 'logistics', 'max_3_per_federation']),
  /** Chaves nomeadas A1…A16 (16 grupos). */
  groupLabels: 'A1–A16',
  /** Mata-mata: A1×A2, A3×A4, … (grupos adjacentes). */
  knockoutPairing: 'adjacent_pairs',
  /** Entre grupos pareados: 1º×4º, 2º×3º. */
  knockoutSeeding: '1v4_2v3',
  groupStageRounds: SERIE_D_GROUP_ROUNDS,
  qualifyPerGroup: 4,
  sources: Object.freeze([
    'https://www.cbf.com.br/futebol-brasileiro/noticias/campeonato-brasileiro/a/cbf-divulga-grupos-da-serie-d-de-2026',
    'https://ge.globo.com/futebol/brasileirao-serie-d/',
  ]),
});

/** Índice da fase eliminatória da Série D (1–6) a partir da rodada do calendário. */
export function serieDPhaseIndexForRound(round) {
  const r = Number(round) || 0;
  if (r <= 12) return 1;
  if (r <= 14) return 2;
  if (r <= 16) return 3;
  if (r <= 18) return 4;
  if (r <= 20) return 5;
  return 6;
}

/** Texto curto para UI / REGRAS. */
export function serieDGroupFormationSummary() {
  const f = SERIE_D_CBF_GROUP_FORMATION;
  return [
    `${f.clubs} clubes em ${f.groups} grupos de ${f.clubsPerGroup}.`,
    'Elenco: 4 rebaixados da C + 64 vagas estaduais (RNF) + permanência (2ª fase) + complemento RNC.',
    'Chaves formadas pela CBF com critérios geográficos e logísticos.',
    `Máximo de ${f.maxClubsPerFederationPerGroup} clubes da mesma federação por grupo.`,
    `Grupos ${f.groupLabels}; mata-mata em pares adjacentes (${f.knockoutSeeding}).`,
  ];
}
