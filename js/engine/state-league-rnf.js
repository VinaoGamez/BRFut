/**
 * Qualificados estaduais para vagas RNF da Série D (a partir de 2027).
 */

import { RNF_SERIE_D_SLOTS_BY_UF, rnfSlotTotal } from './serie-d-formation.js';
import {
  STATE_LEAGUE_FIRST_SERIE_D_SEASON,
  sortStandingsRows,
  stateLeagueAffectsSerieD,
} from './state-league-format.js';
import { normClubName } from './brazilian-clubs-by-uf.js';

export { STATE_LEAGUE_FIRST_SERIE_D_SEASON, stateLeagueAffectsSerieD };

/**
 * Ordem de prioridade RNF dentro da UF após o estadual.
 * Divisão 1 pesa sobre Divisão 2; campeão > vice > semifinalistas > melhor campanha.
 */
export function rankStateRnfCandidates(competition) {
  if (!competition || competition.complete !== true) return [];
  const ranked = [];
  const pushUnique = name => {
    if (!name) return;
    if (ranked.some(item => normClubName(item) === normClubName(name))) return;
    ranked.push(name);
  };

  pushUnique(competition.champion);
  pushUnique(competition.runnerUp);
  (competition.semifinalists || []).forEach(pushUnique);

  competition.standings.forEach(groupRows => {
    sortStandingsRows(groupRows).slice(0, 4).forEach(row => pushUnique(row.club));
  });

  return ranked;
}

/**
 * @param {Record<string, Array<object>>} stateCompetitionsByUf — mapa UF → divisões
 * @returns {Map<string, string[]>} UF → clubes qualificados (ordenados)
 */
export function buildStateRnfQualifiersByUf(stateCompetitionsByUf, season) {
  const map = new Map();
  if (!stateLeagueAffectsSerieD(season)) return map;

  Object.entries(stateCompetitionsByUf || {}).forEach(([uf, divisions]) => {
    const ordered = [];
    [...(divisions || [])]
      .sort((a, b) => (a.tier || 1) - (b.tier || 1))
      .forEach(division => {
        rankStateRnfCandidates(division).forEach(name => {
          if (!ordered.some(item => normClubName(item) === normClubName(name))) ordered.push(name);
        });
      });
    if (ordered.length) map.set(String(uf).toUpperCase(), ordered);
  });
  return map;
}

/**
 * Seleciona até `slotCount` clubes da UF para RNF, excluindo já usados.
 */
export function pickRnfFromStateQualifiers(uf, slotCount, qualifiers, used) {
  const list = qualifiers.get(String(uf).toUpperCase()) || [];
  const picked = [];
  for (const name of list) {
    if (picked.length >= slotCount) break;
    const key = normClubName(name);
    if (used.has(key)) continue;
    picked.push(name);
    used.add(key);
  }
  return picked;
}

export function summarizeStateRnfImpact(stateCompetitionsByUf, season) {
  if (!stateLeagueAffectsSerieD(season)) {
    return 'Estaduais de 2026 não alteram a formação da Série D (transição CBF).';
  }
  const qualifiers = buildStateRnfQualifiersByUf(stateCompetitionsByUf, season);
  let clubs = 0;
  qualifiers.forEach(list => {
    clubs += list.length;
  });
  return `${clubs} clubes mapeados nos estaduais · ${rnfSlotTotal()} vagas RNF distribuídas por UF.`;
}

export function defaultRnfSlots() {
  return { ...RNF_SERIE_D_SLOTS_BY_UF };
}
