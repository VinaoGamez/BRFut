/**
 * Aposentadoria profissional — virada de temporada (pós idade +1).
 */
import { resolvePlayerId } from './player-identity.js';
import { playerKey } from './player-match-stats.js';
import { isContractExpired, refreshContractStatus } from './player-contracts.js';
import { ROSTER_CAREER_MIN } from './player-generation.js';

export const RETIRED_POOL_MAX = 400;
export const RETIRED_POOL_TTL_SEASONS = 12;

const OUTFIELD = { minAge: 36, hardAge: 42 };
const KEEPER = { minAge: 38, hardAge: 44 };

const BASE_CHANCE = {
  36: 0.12,
  37: 0.22,
  38: 0.35,
  39: 0.5,
  40: 0.7,
  41: 0.88,
  42: 1,
};

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

function posLimits(pos) {
  return pos === 'GOL' ? KEEPER : OUTFIELD;
}

/** Idade efetiva na tabela (GOL −2). */
function tableAge(age, pos) {
  return pos === 'GOL' ? Math.max(0, age - 2) : age;
}

function baseChanceForAge(age, pos) {
  const a = tableAge(age, pos);
  if (a >= 42) return 1;
  if (a < 36) return 0;
  return BASE_CHANCE[a] ?? 1;
}

export function retirementRoll(seed) {
  let h = 0;
  const key = String(seed ?? '');
  for (let i = 0; i < key.length; i += 1) {
    h = (Math.imul(31, h) + key.charCodeAt(i)) | 0;
  }
  return ((h >>> 0) % 10000) / 10000;
}

function seasonMinutes(player, season, getSeasonMinutes) {
  if (typeof getSeasonMinutes === 'function') {
    const m = getSeasonMinutes(player, season);
    if (Number.isFinite(m)) return Math.max(0, m);
  }
  return 0;
}

function yearOvrDelta(player, developmentState) {
  const id = resolvePlayerId(player);
  const raw = developmentState?.yearDeltaByPlayer?.[id];
  return Number(raw) || 0;
}

function severeInjury(player) {
  const inj = player?.injury;
  if (!inj || inj.legacy) return false;
  const grade = Number(inj.grade) || 0;
  const days = Number(inj.totalDays ?? inj.daysRemaining) || 0;
  return grade >= 3 && days > 60;
}

/**
 * Chance 0–1 de aposentar nesta virada (antes do clamp 5–95%).
 * @param {object} player — já com idade pós +1
 */
export function computeRetirementChance(player, ctx = {}) {
  const age = Number(player?.age) || 0;
  const pos = player?.pos || 'MC';
  const limits = posLimits(pos);
  if (age < limits.minAge) return 0;
  if (age >= limits.hardAge) return 1;

  let chance = baseChanceForAge(age, pos);
  const ovr = Number(player.overall) || 0;
  const minutes = seasonMinutes(player, ctx.season, ctx.getSeasonMinutes);

  if (ovr >= 76 && age <= 38) chance -= 0.25;
  else if (ovr >= 72 && age <= 36) chance -= 0.15;
  if (minutes >= 900) chance -= 0.2;
  else if (minutes < 180) chance += 0.2;

  if (ctx.careerDate) {
    refreshContractStatus(player, ctx.careerDate);
    if (isContractExpired(player, ctx.careerDate)) chance += 0.15;
  }
  if (yearOvrDelta(player, ctx.developmentState) < 0) chance += 0.1;
  if (severeInjury(player)) chance += 0.15;

  return clamp(chance, 0.05, 0.95);
}

export function shouldRetirePlayer(player, ctx = {}) {
  const age = Number(player?.age) || 0;
  const pos = player?.pos || 'MC';
  const limits = posLimits(pos);
  if (age < limits.minAge) return { retire: false, chance: 0 };
  if (age >= limits.hardAge) return { retire: true, chance: 1, forced: true };

  const chance = computeRetirementChance(player, ctx);
  const seed = `${ctx.season}|${ctx.clubName}|${resolvePlayerId(player)}|retire`;
  const roll = ctx.random ?? retirementRoll(seed);
  return { retire: roll < chance, chance, roll };
}

export function buildRetiredPoolEntry(player, meta = {}) {
  const ovr = Number(player.overall) || 0;
  return {
    id: `ret-${resolvePlayerId(player)}`,
    playerId: resolvePlayerId(player),
    name: player.name,
    pos: player.pos,
    nationality: player.nationality || null,
    originUf: player.originUf || null,
    lastClub: meta.clubName,
    lastDivision: meta.division || 'A',
    lastOverall: ovr,
    retiredSeason: meta.season,
    retiredAge: Number(player.age) || 0,
    star: ovr >= 78,
    regenUsed: false,
  };
}

export function pruneRetiredPool(pool, currentSeason) {
  const season = Number(currentSeason) || 0;
  let list = Array.isArray(pool) ? [...pool] : [];
  list = list.filter(entry => {
    const retired = Number(entry.retiredSeason) || 0;
    return season - retired <= RETIRED_POOL_TTL_SEASONS;
  });
  if (list.length > RETIRED_POOL_MAX) {
    list = list.slice(list.length - RETIRED_POOL_MAX);
  }
  return list;
}

function removePlayerFromClub(club, playerId) {
  if (!club?.roster?.length) return false;
  const before = club.roster.length;
  club.roster = club.roster.filter(p => resolvePlayerId(p) !== playerId);
  return club.roster.length < before;
}

/**
 * Processa aposentadorias em todos os clubes.
 * @returns {{ retired, userDepartures, deferred, pool }}
 */
export function processSeasonRetirements(clubs, ctx = {}) {
  const season = Number(ctx.season) || new Date().getFullYear();
  const userClub = ctx.userClub || null;
  let pool = pruneRetiredPool(ctx.retiredPool, season);
  const retired = [];
  const userDepartures = [];
  const deferred = [];

  const clubEntries = Object.entries(clubs || {});

  clubEntries.forEach(([clubName, club]) => {
    if (!Array.isArray(club?.roster) || !club.roster.length) return;
    const division = club.division || 'A';
    const toProcess = [...club.roster];

    toProcess.forEach(player => {
      if (!player || player.isYouth) return;
      const check = shouldRetirePlayer(player, {
        ...ctx,
        season,
        clubName,
        division,
      });
      if (!check.retire) return;

      const playerId = resolvePlayerId(player);
      const wouldLeave = club.roster.length - 1;
      if (wouldLeave < ROSTER_CAREER_MIN) {
        deferred.push({ playerId, name: player.name, club: clubName, reason: 'min_roster' });
        return;
      }

      if (player.onLoan) {
        delete player.onLoan;
        delete player.loanFrom;
        delete player.loanListed;
        clearLoanFields(player);
      }

      if (!removePlayerFromClub(club, playerId)) return;

      const entry = buildRetiredPoolEntry(player, { clubName, division, season });
      pool.push(entry);
      const row = {
        ...entry,
        club: clubName,
        chance: check.chance,
        forced: !!check.forced,
      };
      retired.push(row);
      if (clubName === userClub) userDepartures.push(row);

      ctx.markRetiredInHistory?.(player, {
        season,
        clubName,
        division,
        historyKey: playerKey(player),
      });
    });
  });

  pool = pruneRetiredPool(pool, season);
  return { retired, userDepartures, deferred, pool };
}

function clearLoanFields(player) {
  delete player.loanBuyOption;
  delete player.loanSalaryShare;
  delete player.loanHostWage;
  delete player.loanUntil;
}

export function markRetiredInHistoryStore(store, historyKey, meta = {}) {
  if (!store?.players || !historyKey) return;
  const bucket = store.players[historyKey] || {
    name: meta.name,
    club: meta.clubName,
    seasons: {},
  };
  bucket.retired = true;
  bucket.retiredSeason = meta.season;
  bucket.retiredAge = meta.retiredAge;
  bucket.lastClub = meta.clubName;
  bucket.lastDivision = meta.division;
  store.players[historyKey] = bucket;
}
