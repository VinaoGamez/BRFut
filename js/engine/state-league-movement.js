/**
 * Acesso e rebaixamento entre divisões visíveis dos estaduais.
 *
 * Divisões de 10 clubes: 4 sobem (semifinalistas) e 4 descem (piores), exceto:
 * - Divisão 1: somente rebaixamento (4 descem; Paulista = 2 piores/grupo).
 * - Última divisão visível: 4 sobem; formação = 4 rebaixados da divisão acima + sorteio até 10.
 * - UF com uma só divisão: 3 últimos saem e são trocados por clubes de fora (sorteio).
 */

import { normClubName } from './brazilian-clubs-by-uf.js';
import {
  PAULISTA_UF,
  PAULISTA_DIVISION_SIZE,
  STATE_LEAGUE_MAX_PER_DIVISION,
  STATE_LEAGUE_MIN_CLUBS,
  groupQualifiers,
  isPaulistaFormat,
  leagueQualifiers,
  sortStandingsRows,
} from './state-league-format.js';

/** Clubes que sobem/descem entre divisões de 10 times. */
export const TIER_MOVEMENT_COUNT = 4;
/** UF com uma só divisão estadual: só os 3 últimos saem e são trocados. */
export const SOLE_DIVISION_RELEGATE_COUNT = 3;
export const DIV1_RELEGATE_PER_GROUP = 2;
export const LAST_TIER_RELEGATED_IN = TIER_MOVEMENT_COUNT;
export const LAST_TIER_LOTTERY_SLOTS = STATE_LEAGUE_MAX_PER_DIVISION - LAST_TIER_RELEGATED_IN;

/** @deprecated Use TIER_MOVEMENT_COUNT */
export const DIV2_3_PROMOTE_COUNT = TIER_MOVEMENT_COUNT;
/** @deprecated Use TIER_MOVEMENT_COUNT */
export const DIV2_3_RELEGATE_COUNT = TIER_MOVEMENT_COUNT;
/** @deprecated Use TIER_MOVEMENT_COUNT */
export const DIV4_PROMOTE_COUNT = TIER_MOVEMENT_COUNT;
/** @deprecated Use LAST_TIER_RELEGATED_IN */
export const DIV4_RELEGATED_FROM_3 = LAST_TIER_RELEGATED_IN;
/** @deprecated Use LAST_TIER_LOTTERY_SLOTS */
export const DIV4_LOTTERY_SLOTS = LAST_TIER_LOTTERY_SLOTS;

function uniqueNames(names) {
  const seen = new Set();
  const out = [];
  (names || []).forEach(name => {
    if (!name) return;
    const key = normClubName(name);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(name);
  });
  return out;
}

function divisionByTier(divisions, tier) {
  return (divisions || []).find(item => (item.tier || 1) === tier) || null;
}

function sortedTiers(divisions) {
  return [...new Set((divisions || []).map(item => item.tier || 1))].sort((a, b) => a - b);
}

function maxVisibleTier(divisions) {
  const tiers = sortedTiers(divisions);
  return tiers[tiers.length - 1] || 1;
}

/** 2 piores de cada grupo (Divisão 1 Paulista). */
export function collectPaulistaGroupRelegated(competition, perGroup = DIV1_RELEGATE_PER_GROUP) {
  if (!competition || !isPaulistaFormat(competition)) return [];
  return (competition.standings || []).flatMap(groupRows =>
    sortStandingsRows([...groupRows])
      .slice(-perGroup)
      .map(row => row.club),
  );
}

/** N piores da tabela única (10 clubes). */
export function collectLeagueBottom(competition, count = TIER_MOVEMENT_COUNT) {
  const table = sortStandingsRows([...(competition?.standings?.[0] || [])]);
  return table.slice(-count).map(row => row.club);
}

/** 4 semifinalistas / melhores classificados (acesso à divisão acima). */
export function collectSemifinalistsForPromotion(competition) {
  if (!competition) return [];
  if (Array.isArray(competition.semifinalists) && competition.semifinalists.length >= TIER_MOVEMENT_COUNT) {
    return uniqueNames(competition.semifinalists).slice(0, TIER_MOVEMENT_COUNT);
  }
  const semis = competition.knockout?.semis || [];
  if (semis.length >= 2) {
    return uniqueNames(semis.flatMap(game => [game.home, game.away])).slice(0, TIER_MOVEMENT_COUNT);
  }
  if (isPaulistaFormat(competition)) {
    return uniqueNames(groupQualifiers(competition).flatMap(rows => rows.map(row => row.club))).slice(
      0,
      TIER_MOVEMENT_COUNT,
    );
  }
  return uniqueNames(leagueQualifiers(competition).map(row => row.club)).slice(0, TIER_MOVEMENT_COUNT);
}

/** Divisão 1 — somente rebaixamento (4 clubes). */
export function collectDivision1Relegated(competition, uf) {
  if (!competition) return [];
  if (String(uf || competition.uf || '').toUpperCase() === PAULISTA_UF && isPaulistaFormat(competition)) {
    return uniqueNames(collectPaulistaGroupRelegated(competition));
  }
  return uniqueNames(collectLeagueBottom(competition, TIER_MOVEMENT_COUNT));
}

/** @deprecated Use collectSemifinalistsForPromotion */
export const collectDivision4Promoted = collectSemifinalistsForPromotion;

/**
 * Movimentações por divisão.
 * promotedTo[tier] = clubes que sobem PARA `tier` (vindos de tier+1).
 * relegatedFrom[tier] = clubes que descem DE `tier` (vão para tier+1).
 */
export function computeMovementsForUf(divisions, uf) {
  const code = String(uf || '').toUpperCase();
  const tierList = sortedTiers(divisions);
  const maxTier = maxVisibleTier(divisions);
  const promotedTo = {};
  const relegatedFrom = {};

  tierList.forEach(tier => {
    const comp = divisionByTier(divisions, tier);
    if (!comp) return;

    if (tier < maxTier) {
      relegatedFrom[tier] =
        tier === 1 ? collectDivision1Relegated(comp, code) : collectLeagueBottom(comp, TIER_MOVEMENT_COUNT);
    } else if (maxTier === 1 && tier === 1) {
      // UF com uma só divisão: apenas os 3 últimos saem; o restante permanece.
      relegatedFrom[tier] = collectLeagueBottom(comp, SOLE_DIVISION_RELEGATE_COUNT);
    }

    if (tier > 1) {
      promotedTo[tier - 1] = collectSemifinalistsForPromotion(comp);
    }
  });

  return {
    uf: code,
    maxTier,
    tierList,
    promotedTo,
    relegatedFrom,
    /** Compat legado */
    promotedTo1: promotedTo[1] || [],
    relegatedFrom1: relegatedFrom[1] || [],
    promotedTo2: promotedTo[2] || [],
    relegatedFrom2: relegatedFrom[2] || [],
    promotedTo3: promotedTo[3] || [],
    relegatedFrom3: relegatedFrom[3] || [],
  };
}

export function computeAllMovements(competitionsByUf) {
  const out = {};
  Object.entries(competitionsByUf || {}).forEach(([uf, divisions]) => {
    if (!divisions?.length) return;
    out[String(uf).toUpperCase()] = computeMovementsForUf(divisions, uf);
  });
  return out;
}

function normalizeRoster(names, targetSize, fillFrom, exclude = new Set()) {
  const roster = uniqueNames(names).filter(name => !exclude.has(normClubName(name)));
  if (roster.length >= targetSize) return roster.slice(0, targetSize);
  for (const name of fillFrom) {
    if (roster.length >= targetSize) break;
    const key = normClubName(name);
    if (exclude.has(key) || roster.some(item => normClubName(item) === key)) continue;
    roster.push(name);
  }
  return roster;
}

function tierCapacity(tier, ufCode) {
  if (tier === 1 && String(ufCode).toUpperCase() === PAULISTA_UF) return PAULISTA_DIVISION_SIZE;
  return STATE_LEAGUE_MAX_PER_DIVISION;
}

/**
 * Monta elencos da próxima temporada aplicando acesso/rebaixamento.
 * Última divisão visível: rebaixados da divisão acima + sorteio até 10.
 * UF com uma só divisão: mantém quem não caiu; sorteio só preenche as vagas.
 */
export function buildNextSeasonRosters(
  uf,
  participants,
  previousDivisions,
  movements,
  { lotteryPick = null, userClub = null } = {},
) {
  const code = String(uf || '').toUpperCase();
  const sorted = [...participants];
  const block = STATE_LEAGUE_MAX_PER_DIVISION;
  const prev = tier => divisionByTier(previousDivisions, tier)?.teams || [];

  const m = movements || computeMovementsForUf(previousDivisions, code);
  const maxTier = m.maxTier || maxVisibleTier(previousDivisions);
  const tierList = m.tierList?.length ? m.tierList : sortedTiers(previousDivisions);

  const assigned = new Set();
  const mark = names => {
    names.forEach(name => assigned.add(normClubName(name)));
  };

  const rosters = {};

  tierList.forEach(tier => {
    if (tier >= maxTier) return;
    const incoming = m.promotedTo[tier] || [];
    const outgoing = m.relegatedFrom[tier] || [];
    const roster = normalizeRoster(
      [...prev(tier).filter(c => !outgoing.includes(c)), ...incoming],
      tierCapacity(tier, code),
      sorted.filter(c => !assigned.has(normClubName(c))),
      assigned,
    );
    if (roster.length === tierCapacity(tier, code)) {
      rosters[tier] = roster;
      mark(rosters[tier]);
    }
  });

  if (maxTier === 1 && tierList.includes(1)) {
    // Campeonato estadual único: não re-sortear o grupo inteiro.
    const outgoing = uniqueNames(m.relegatedFrom[1] || []);
    const outgoingKeys = new Set(outgoing.map(normClubName));
    const stayers = prev(1).filter(name => !outgoingKeys.has(normClubName(name)));
    mark(stayers);
    // Quem saiu não volta no mesmo ciclo — vagas vão para clubes de fora do grupo.
    mark(outgoing);
    const capacity = tierCapacity(1, code);
    const lotteryPool = sorted.filter(name => !assigned.has(normClubName(name)));
    const lotterySlots = Math.max(0, capacity - stayers.length);
    let lotteryTeams = [];
    if (lotterySlots > 0) {
      if (lotteryPool.length <= lotterySlots) {
        lotteryTeams = [...lotteryPool];
      } else if (typeof lotteryPick === 'function') {
        lotteryTeams = lotteryPick(lotteryPool, lotterySlots, { uf: code, userClub });
      } else {
        lotteryTeams = lotteryPool.slice(0, lotterySlots);
      }
    }
    const roster = normalizeRoster([...stayers, ...lotteryTeams], capacity, lotteryPool);
    if (roster.length === capacity) {
      rosters[1] = roster;
      mark(rosters[1]);
    }
  } else if (tierList.includes(maxTier)) {
    const relegatedIn = uniqueNames(m.relegatedFrom[maxTier - 1] || []);
    const lotteryPool = sorted.filter(c => !assigned.has(normClubName(c)));
    const lotterySlots = Math.max(0, block - relegatedIn.length);
    let lotteryTeams = [];
    if (lotteryPool.length <= lotterySlots) {
      lotteryTeams = [...lotteryPool];
    } else if (typeof lotteryPick === 'function') {
      lotteryTeams = lotteryPick(lotteryPool, lotterySlots, { uf: code, userClub });
    } else {
      lotteryTeams = lotteryPool.slice(0, lotterySlots);
    }
    const lastRoster = normalizeRoster([...relegatedIn, ...lotteryTeams], block, lotteryPool);
    if (lastRoster.length === block) {
      rosters[maxTier] = lastRoster;
      mark(rosters[maxTier]);
    }
  }

  Object.keys(rosters).forEach(key => {
    const tier = Number(key);
    if ((rosters[key] || []).length !== tierCapacity(tier, code)) delete rosters[key];
  });

  return { rosters, movements: m };
}

/** Persistência na carreira — elencos por divisão para a próxima temporada. */
export function buildMembershipSnapshot(competitionsByUf, participantsByUf = {}, options = {}) {
  const movementsByUf = computeAllMovements(competitionsByUf);
  const snapshot = {};
  Object.entries(competitionsByUf || {}).forEach(([uf, divisions]) => {
    const code = String(uf).toUpperCase();
    const participants = participantsByUf[code] || uniqueNames(divisions.flatMap(d => d.teams || []));
    if (!participants.length) return;
    const { rosters, movements } = buildNextSeasonRosters(
      code,
      participants,
      divisions,
      movementsByUf[code],
      {
        lotteryPick: options.lotteryPick,
        userClub: options.userClub,
      },
    );
    snapshot[code] = { rosters, movements };
  });
  return snapshot;
}
