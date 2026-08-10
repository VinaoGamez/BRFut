/**
 * Jogadores livres da carreira. O pool pertence ao universo da carreira e deve
 * ser persistido junto do save/API, nunca recriado a cada boot.
 */
import {
  buildSquadRoles,
  generatePlayer,
  rollProfessionalSquadSize,
} from './player-generation.js';
import { ensurePlayerId, resolvePlayerId } from './player-identity.js';
import { estimatePlayerValue, refreshMarketFields } from './player-value.js';
import { resolvePlayerRoundWage } from './economy.js';
import { signSemesterContract } from './player-contracts.js';

export const INITIAL_FREE_AGENT_SHARE = 0.1;
export const FREE_AGENT_CLUB_LABEL = 'LIVRE';

const DIVISIONS = ['A', 'B', 'C', 'D'];

const cleanDate = value => {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

export function ensureFreeAgentsPool(value) {
  return Array.isArray(value) ? value.filter(item => item?.player && resolvePlayerId(item.player)) : [];
}

export function releasePlayerToFreeAgents(poolInput, player, context = {}) {
  const pool = Array.isArray(poolInput) ? poolInput : [];
  if (!player || typeof player !== 'object') return { ok: false, reason: 'invalid_player', pool };
  const playerId = resolvePlayerId(player);
  if (!playerId) return { ok: false, reason: 'missing_player_id', pool };
  if (pool.some(item => item.playerId === playerId || resolvePlayerId(item.player) === playerId)) {
    return { ok: false, reason: 'already_free', pool };
  }

  const division = DIVISIONS.includes(context.division) ? context.division : 'D';
  const moved = { ...player };
  delete moved.isYouth;
  delete moved.youthCategory;
  delete moved.onLoan;
  delete moved.loanFrom;
  delete moved.loanListed;
  delete moved.loanBuyOption;
  delete moved.contractUntil;
  moved.contract = null;
  moved.listed = true;
  moved.askingPrice = 0;
  moved.freeAgent = true;
  moved.club = FREE_AGENT_CLUB_LABEL;
  moved.formerClub = context.formerClub || moved.formerClub || null;
  refreshMarketFields(moved, { division, season: context.season });
  const marketValue = Number(moved.marketValue) || estimatePlayerValue(moved, division);
  const wageDemand = Math.max(100, Math.round(resolvePlayerRoundWage(moved, division)));
  const age = Number(moved.age) || 24;
  const potential = Number(moved.potential) || Number(moved.overall) || 0;
  const signingBonusFactor = age <= 23 && potential > (Number(moved.overall) || 0) + 5 ? 8 : 5;
  const entry = {
    playerId,
    player: moved,
    status: 'free_agent',
    marketTier: division,
    formerClub: context.formerClub || null,
    formerDivision: division,
    releaseReason: context.reason || 'released',
    releasedAt: cleanDate(context.careerDate),
    freeSinceSeason: Number(context.season) || new Date().getFullYear(),
    marketValue,
    wageDemand,
    signingBonus: Math.max(0, Math.round(wageDemand * signingBonusFactor)),
  };
  pool.push(entry);
  return { ok: true, entry, pool };
}

export function removeFreeAgent(pool, playerId) {
  if (!Array.isArray(pool)) return null;
  const index = pool.findIndex(item => item?.playerId === playerId || resolvePlayerId(item?.player) === playerId);
  if (index < 0) return null;
  return pool.splice(index, 1)[0] || null;
}

/** Cria 10% adicionais por faixa, proporcional ao total contratado na divisão. */
export function createInitialFreeAgentsPool(clubs, context = {}) {
  const pool = [];
  const random = typeof context.random === 'function' ? context.random : Math.random;
  const season = Number(context.season) || 2026;
  DIVISIONS.forEach(division => {
    const divisionClubs = Object.entries(clubs || {}).filter(([, club]) => club?.division === division);
    const contracted = divisionClubs.reduce(
      (sum, [, club]) => sum + (Array.isArray(club?.roster) ? club.roster.length : 0),
      0,
    );
    const target = Math.ceil(contracted * INITIAL_FREE_AGENT_SHARE);
    if (!target) return;
    const averagePower = divisionClubs.length
      ? Math.round(divisionClubs.reduce((sum, [, club]) => sum + (Number(club.power) || 20), 0) / divisionClubs.length)
      : 20;
    const roles = [];
    while (roles.length < target) roles.push(...buildSquadRoles(rollProfessionalSquadSize(random)));
    roles.slice(0, target).forEach((role, index) => {
      const player = generatePlayer({
        role,
        index: 900000 + DIVISIONS.indexOf(division) * 100000 + index,
        clubPower: averagePower,
        division,
        random,
        firstNames: context.firstNames,
        lastNames: context.lastNames,
        starterBoost: index % 10 === 0,
      });
      ensurePlayerId(player, { seed: context.seed || 0, club: `free-${division}`, index });
      releasePlayerToFreeAgents(pool, player, {
        division,
        season,
        careerDate: context.careerDate,
        reason: 'initial_free_agent',
      });
    });
  });
  return pool;
}

export function serializeFreeAgentsPool(pool) {
  return ensureFreeAgentsPool(pool).map(item => ({
    ...item,
    player: { ...item.player, contract: null, club: FREE_AGENT_CLUB_LABEL, freeAgent: true },
  }));
}

/** IA contrata livres para cobrir elencos/posições curtos na virada. */
export function signFreeAgentsForAi(clubs, pool, context = {}) {
  const moves = [];
  const userClub = context.userClub || null;
  const rank = { A: 4, B: 3, C: 2, D: 1 };
  Object.entries(clubs || {}).forEach(([clubName, club]) => {
    if (clubName === userClub || !Array.isArray(club?.roster)) return;
    const target = Math.max(22, Math.min(26, Number(context.targetRoster) || 22));
    while (club.roster.length < target && pool.length) {
      const counts = club.roster.reduce((acc, player) => {
        acc[player.pos] = (acc[player.pos] || 0) + 1;
        return acc;
      }, {});
      const needed = ['GOL', 'ZAG', 'LAT', 'VOL', 'MC', 'MEI', 'ATA', 'PE', 'PD']
        .sort((a, b) => (counts[a] || 0) - (counts[b] || 0));
      const clubRank = rank[club.division] || 1;
      const candidates = pool
        .map((entry, index) => ({ entry, index }))
        .filter(({ entry }) => (rank[entry.marketTier] || 1) <= clubRank + 1)
        .sort((a, b) => {
          const posA = needed.indexOf(a.entry.player?.pos);
          const posB = needed.indexOf(b.entry.player?.pos);
          if (posA !== posB) return posA - posB;
          return Number(b.entry.player?.overall || 0) - Number(a.entry.player?.overall || 0);
        });
      const selected = candidates[0];
      if (!selected) break;
      const [entry] = pool.splice(selected.index, 1);
      const player = { ...entry.player };
      player.freeAgent = false;
      player.club = clubName;
      player.listed = false;
      player.askingPrice = null;
      player.wage = Number(entry.wageDemand) || player.wage;
      signSemesterContract(player, {
        wagePerRound: player.wage,
        signedDate: context.careerDate,
        division: club.division,
      });
      club.roster.push(player);
      moves.push({ player, playerId: entry.playerId, from: FREE_AGENT_CLUB_LABEL, to: clubName, fee: 0, type: 'free_agent' });
    }
  });
  return moves;
}
