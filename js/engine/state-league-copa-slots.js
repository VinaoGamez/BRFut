/**
 * Vaga(s) da Copa do Brasil via estadual — repasse quando o titular já tem vaga segura.
 */

import { getRealClub, normClubName } from './brazilian-clubs-by-uf.js';
import { rankStateRnfCandidates } from './state-league-rnf.js';

/**
 * Clube já possui caminho garantido na Copa (não precisa da vaga estadual).
 * Hoje: Série A entra na 5ª fase; demais divisões dependem do estadual ou sorteio inicial.
 * @param {Record<string, { division?: string }>} [clubs]
 */
export function hasSecuredCopaSlot(clubName, clubs = {}) {
  const division = clubs[clubName]?.division || getRealClub(clubName)?.division;
  return division === 'A';
}

/** Mesma ordem de prioridade do RNF: campeão → vice → semi → campanha nos grupos. */
export function rankStateCopaCandidates(competition) {
  return rankStateRnfCandidates(competition);
}

/**
 * Resolve titular(es) da vaga estadual na Copa, repassando se já houver vaga segura.
 * @returns {{ holders: string[], passedFrom: Array<{ skipped: string, reason: string }>, allCandidates: string[] }}
 */
export function resolveStateCopaSlot(competition, clubs = {}, slots = 1) {
  const ranked = rankStateCopaCandidates(competition);
  const holders = [];
  const passedFrom = [];
  for (const name of ranked) {
    if (holders.length >= slots) break;
    if (hasSecuredCopaSlot(name, clubs)) {
      passedFrom.push({ skipped: name, reason: 'vaga_segura_divisao' });
      continue;
    }
    holders.push(name);
  }
  return { holders, passedFrom, allCandidates: ranked };
}

/** Evita duplicar titular se o repasse já foi calculado. */
export function ensureStateCopaSlot(competition, clubs = {}, slots = 1) {
  if (!competition?.complete) return null;
  if (competition.copaSlot?.holders?.length) return competition.copaSlot;
  const resolved = resolveStateCopaSlot(competition, clubs, slots);
  competition.copaSlot = resolved;
  return resolved;
}
