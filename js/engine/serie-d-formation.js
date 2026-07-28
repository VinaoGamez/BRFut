/**
 * Formação da Série D — critérios CBF (96 vagas).
 *
 * 1. Rebaixados da Série C (4)
 * 2. Estaduais / copas via RNF (64 vagas por UF)
 * 3. Permanência — 2ª fase da edição anterior
 * 4. RNC — complemento (clubes sem divisão nacional)
 */

import { getAllRealClubs, getRealClub, normClubName } from './brazilian-clubs-by-uf.js';
import { serieDGroupSizes } from './brazil-official-pyramid.js';
import { SERIE_D_CLUBS, SERIE_C_RELEGATION_TO_D, SERIE_D_GROUPS } from './serie-c-calendar.js';
import { stateLeagueAffectsSerieD } from './state-league-format.js';

/** Vagas distribuídas às federações estaduais (RNF). */
export const SERIE_D_STATE_SLOTS = 64;

/**
 * Vagas por UF no critério RNF (soma = 64).
 * Aproximação CBF — atualizar quando a CBF publicar tabela oficial.
 */
export const RNF_SERIE_D_SLOTS_BY_UF = Object.freeze({
  SP: 6,
  RJ: 5,
  MG: 5,
  RS: 5,
  PR: 4,
  BA: 4,
  PE: 3,
  CE: 3,
  GO: 3,
  SC: 2,
  PA: 2,
  DF: 2,
  ES: 2,
  PB: 2,
  RN: 2,
  MT: 2,
  MS: 2,
  AL: 1,
  AM: 1,
  AP: 1,
  MA: 1,
  PI: 1,
  RO: 1,
  RR: 1,
  SE: 1,
  AC: 1,
  TO: 1,
});

const NATIONAL_DIVISIONS = new Set(['A', 'B', 'C', 'D']);

export function rnfSlotTotal(slots = RNF_SERIE_D_SLOTS_BY_UF) {
  return Object.values(slots).reduce((sum, count) => sum + Number(count || 0), 0);
}

export function resolveClubUf(clubName, clubs = {}) {
  const fromClub = clubs[clubName];
  if (fromClub?.uf) return String(fromClub.uf).toUpperCase();
  const fromRegistry = getRealClub(clubName);
  if (fromRegistry?.uf) return String(fromRegistry.uf).toUpperCase();
  const fromImport = getAllRealClubs().find(club => normClubName(club.name) === normClubName(clubName));
  if (fromImport?.uf) return String(fromImport.uf).toUpperCase();
  return null;
}

export function hasNationalDivision(clubName, clubs = {}) {
  const division = clubs[clubName]?.division || getRealClub(clubName)?.division;
  return NATIONAL_DIVISIONS.has(String(division || '').toUpperCase());
}

/** Pontuação RNC (ranking nacional do jogo). */
export function rncTotalScore(clubName, rankingEntries = {}, clubs = {}) {
  const entry = rankingEntries[clubName];
  if (entry) {
    const total =
      Number(entry.base || 0) +
      Number(entry.championshipPoints || 0) +
      Number(entry.titlePoints || 0);
    if (Number.isFinite(total) && total > 0) return total;
  }
  const club = clubs[clubName];
  if (!club) return 0;
  const overall =
    club.roster?.slice(0, 11).reduce((sum, player) => sum + Number(player?.overall || 0), 0) /
      Math.max(1, Math.min(11, club.roster?.length || 0)) || Number(club.power) || 0;
  return overall;
}

function stableSortByRnc(names, rankingEntries, clubs) {
  return [...names].sort((a, b) => {
    const scoreDiff = rncTotalScore(b, rankingEntries, clubs) - rncTotalScore(a, rankingEntries, clubs);
    if (scoreDiff !== 0) return scoreDiff;
    return String(a).localeCompare(String(b), 'pt-BR');
  });
}

function pushUnique(list, name, used) {
  if (!name || used.has(normClubName(name))) return false;
  list.push(name);
  used.add(normClubName(name));
  return true;
}

/**
 * Top 4 de cada grupo após a fase de grupos (= classificados à 2ª fase).
 * @param {string[][]} serieDGroups
 * @param {{ standings?: { club: string, points: number, wins: number, goalDiff: number }[] }} competitionD
 */
export function collectSerieDSecondPhaseClubs(serieDGroups, competitionD) {
  const standings = competitionD?.standings || [];
  const qualified = new Set();
  (serieDGroups || []).forEach(group => {
    (group || [])
      .map(name => standings.find(row => row.club === name))
      .filter(Boolean)
      .sort(
        (a, b) =>
          b.points - a.points || b.wins - a.wins || b.goalDiff - a.goalDiff || a.club.localeCompare(b.club, 'pt-BR'),
      )
      .slice(0, 4)
      .forEach(row => qualified.add(row.club));
  });
  return [...qualified];
}

/** Índice do grupo Série D (0–15) — comparação normalizada de nomes. */
export function findSerieDGroupIndex(clubName, serieDGroups = []) {
  if (!clubName || !Array.isArray(serieDGroups) || !serieDGroups.length) return -1;
  const key = normClubName(clubName);
  return serieDGroups.findIndex(
    group => Array.isArray(group) && group.some(name => normClubName(name) === key),
  );
}

/** Nome canônico do clube dentro do grupo (útil após substituições de nome). */
export function resolveSerieDGroupClubName(clubName, serieDGroups = []) {
  const groupIndex = findSerieDGroupIndex(clubName, serieDGroups);
  if (groupIndex < 0) return clubName;
  const key = normClubName(clubName);
  return serieDGroups[groupIndex]?.find(name => normClubName(name) === key) || clubName;
}

/** Grupo ímpar ou vazio não gera calendário round-robin — exige rebalanceamento. */
export function serieDGroupsNeedRebalance(serieDGroups = []) {
  if (!Array.isArray(serieDGroups) || !serieDGroups.length) return true;
  const seen = new Set();
  for (const group of serieDGroups) {
    if (!Array.isArray(group) || group.length < 2 || group.length % 2 !== 0) return true;
    for (const club of group) {
      const key = normClubName(club);
      if (!key) return true;
      if (seen.has(key)) return true;
      seen.add(key);
    }
  }
  return false;
}

/**
 * Redistribui clubes da Série D em grupos de tamanho par (CBF: 96÷16).
 * Preserva índice de grupo quando possível — corrige saves com clubes extras empilhados.
 */
export function rebalanceSerieDGroups(divisionTeams, serieDGroups = [], groupCount = SERIE_D_GROUPS) {
  const dTeams = [];
  const seen = new Set();
  for (const club of divisionTeams?.D || []) {
    const key = normClubName(club);
    if (!club || !key || seen.has(key)) continue;
    seen.add(key);
    dTeams.push(club);
  }
  if (!dTeams.length) return (serieDGroups || []).map(group => [...(group || [])]);

  const preferredIndex = new Map();
  (serieDGroups || []).forEach((group, groupIndex) => {
    (group || []).forEach(club => {
      const key = normClubName(club);
      if (key && dTeams.some(name => normClubName(name) === key) && !preferredIndex.has(key)) {
        preferredIndex.set(key, groupIndex);
      }
    });
  });

  const rawSizes = serieDGroupSizes(dTeams.length, groupCount);
  const sizes = rawSizes.map(size => (size % 2 === 0 ? size : Math.max(2, size - 1)));
  let sizeTotal = sizes.reduce((sum, size) => sum + size, 0);
  let carry = dTeams.length - sizeTotal;
  for (let index = 0; carry > 0; index = (index + 1) % sizes.length) {
    sizes[index] += 2;
    carry -= 2;
  }
  const groups = sizes.map(() => []);
  const unassigned = [...dTeams];

  const takeFromUnassigned = key => {
    const index = unassigned.findIndex(name => normClubName(name) === key);
    if (index < 0) return null;
    const [club] = unassigned.splice(index, 1);
    return club;
  };

  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const capacity = sizes[groupIndex] || 0;
    const preferred = unassigned.filter(club => preferredIndex.get(normClubName(club)) === groupIndex);
    for (const club of preferred) {
      if (groups[groupIndex].length >= capacity) break;
      const placed = takeFromUnassigned(normClubName(club));
      if (placed) groups[groupIndex].push(placed);
    }
  }

  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const capacity = sizes[groupIndex] || 0;
    while (groups[groupIndex].length < capacity && unassigned.length) {
      groups[groupIndex].push(unassigned.shift());
    }
  }

  while (unassigned.length) {
    const club = unassigned.shift();
    const target = groups.find(group => group.length % 2 === 1) ?? groups.find(group => group.length < 6);
    if (target) target.push(club);
    else groups[groups.length - 1]?.push(club);
  }

  return groups;
}

/**
 * Garante que cada clube da lista D apareça em algum grupo (corrige saves/desalinhamentos).
 */
export function ensureSerieDGroupMembership(divisionTeams, serieDGroups = []) {
  const groups = (serieDGroups || []).map(group => [...(group || [])]);
  if (!groups.length) return groups;
  const dTeams = [...(divisionTeams?.D || [])];
  const isListed = name =>
    groups.some(group => group.some(entry => normClubName(entry) === normClubName(name)));
  let changed = false;
  for (const club of dTeams) {
    if (!club || isListed(club)) continue;
    changed = true;
    break;
  }
  if (serieDGroupsNeedRebalance(groups)) changed = true;
  if (!changed) return groups;
  return rebalanceSerieDGroups(divisionTeams, groups);
}

/**
 * Monta elenco da Série D (96) pelos quatro critérios CBF.
 * @returns {{ roster: string[], breakdown: object }}
 */
export function buildSerieDRosterCBF({
  relegatedFromC = [],
  promotedFromD = [],
  previousD = [],
  permanenceClubs = [],
  regionalPool = [],
  nationalRankingEntries = {},
  clubs = {},
  userClub = null,
  rnfSlots = RNF_SERIE_D_SLOTS_BY_UF,
  targetSize = SERIE_D_CLUBS,
  stateRnfQualifiersByUf = null,
  careerSeason = 2026,
}) {
  const roster = [];
  const used = new Set();
  const promotedKeys = new Set((promotedFromD || []).map(name => normClubName(name)));
  const breakdown = {
    relegatedC: [],
    stateRnf: [],
    permanence: [],
    rnc: [],
  };

  const relC = (relegatedFromC || []).slice(-SERIE_C_RELEGATION_TO_D);
  relC.forEach(name => {
    if (pushUnique(roster, name, used)) breakdown.relegatedC.push(name);
  });

  const regionalByUf = new Map();
  (regionalPool || []).forEach(name => {
    if (!name || hasNationalDivision(name, clubs)) return;
    if (promotedKeys.has(normClubName(name))) return;
    const uf = resolveClubUf(name, clubs);
    if (!uf) return;
    if (!regionalByUf.has(uf)) regionalByUf.set(uf, []);
    regionalByUf.get(uf).push(name);
  });

  Object.entries(rnfSlots).forEach(([uf, slotCount]) => {
    const useStateResults = stateLeagueAffectsSerieD(careerSeason) && stateRnfQualifiersByUf;
    const stateCandidates = useStateResults ? stateRnfQualifiersByUf.get?.(uf) || stateRnfQualifiersByUf[uf] || [] : [];
    const regionalCandidates = stableSortByRnc(regionalByUf.get(uf) || [], nationalRankingEntries, clubs);
    const candidates = useStateResults && stateCandidates.length ? stateCandidates : regionalCandidates;
    let added = 0;
    for (const name of candidates) {
      if (added >= slotCount || roster.length >= targetSize) break;
      if (pushUnique(roster, name, used)) {
        breakdown.stateRnf.push(name);
        added += 1;
      }
    }
  });

  const permanenceOrdered = stableSortByRnc(
    (permanenceClubs || []).filter(name => {
      const key = normClubName(name);
      return key && !promotedKeys.has(key) && (previousD || []).some(prev => normClubName(prev) === key);
    }),
    nationalRankingEntries,
    clubs,
  );
  permanenceOrdered.forEach(name => {
    if (roster.length >= targetSize) return;
    if (pushUnique(roster, name, used)) breakdown.permanence.push(name);
  });

  const rncCandidates = stableSortByRnc(
    [
      ...(regionalPool || []).filter(name => !hasNationalDivision(name, clubs)),
      ...(previousD || []).filter(name => !promotedKeys.has(normClubName(name))),
    ],
    nationalRankingEntries,
    clubs,
  );
  rncCandidates.forEach(name => {
    if (roster.length >= targetSize) return;
    if (pushUnique(roster, name, used)) breakdown.rnc.push(name);
  });

  if (roster.length < targetSize) {
    Object.keys(clubs).forEach(name => {
      if (roster.length >= targetSize) return;
      if (userClub && normClubName(name) === normClubName(userClub)) return;
      if (hasNationalDivision(name, clubs) && !previousD.includes(name)) return;
      if (pushUnique(roster, name, used)) breakdown.rnc.push(name);
    });
  }

  return { roster: roster.slice(0, targetSize), breakdown };
}

export function serieDFormationSummary(breakdown) {
  if (!breakdown) return '';
  return [
    `${breakdown.relegatedC?.length || 0} rebaixados da Série C`,
    `${breakdown.stateRnf?.length || 0} vagas estaduais (RNF)`,
    `${breakdown.permanence?.length || 0} permanência (2ª fase)`,
    `${breakdown.rnc?.length || 0} complemento RNC`,
  ].join(' · ');
}
