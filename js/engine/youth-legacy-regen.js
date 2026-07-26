/**
 * Regens U-20 — só aposentados do clube do usuário (legacyOf).
 */
import { generateYouthPlayer } from './youth-academy.js';

export const LEGACY_REGEN_BASE = 0.03;
export const LEGACY_REGEN_MAX_CHANCE = 0.25;
export const LEGACY_REGEN_MAX_PER_SEASON = 1;

const ADJACENT_POS = {
  GOL: ['GOL'],
  ZAG: ['ZAG', 'VOL', 'LAT'],
  LAT: ['LAT', 'ZAG', 'VOL'],
  VOL: ['VOL', 'MC', 'ZAG', 'LAT'],
  MC: ['MC', 'VOL', 'MEI'],
  MEI: ['MEI', 'MC', 'PE', 'PD'],
  PE: ['PE', 'MEI', 'PD', 'ATA'],
  PD: ['PD', 'MEI', 'PE', 'ATA'],
  ATA: ['ATA', 'PE', 'PD', 'MEI'],
};

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

function splitName(full) {
  const parts = String(full || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return { first: 'Jogador', last: 'Silva' };
  if (parts.length === 1) return { first: parts[0], last: parts[0] };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

function recencyMod(season, retiredSeason) {
  const gap = Math.max(0, Number(season) - Number(retiredSeason));
  if (gap <= 2) return 1;
  if (gap <= 6) return 0.7;
  return 0.4;
}

export function eligibleLegacyPool(pool, userClub, season) {
  if (!userClub) return [];
  return (pool || []).filter(
    entry =>
      entry &&
      !entry.regenUsed &&
      entry.lastClub === userClub &&
      Number(season) - Number(entry.retiredSeason) <= 12,
  );
}

export function computeLegacyRegenChance(entry, ctx = {}) {
  const season = Number(ctx.season) || 0;
  let chance = LEGACY_REGEN_BASE;
  chance *= 4; // mesmo clube (único caso para o user)
  if (entry.star) chance *= 1.5;
  chance *= recencyMod(season, entry.retiredSeason);
  return clamp(chance, 0, LEGACY_REGEN_MAX_CHANCE);
}

export function pickLegacyCandidate(pool, userClub, season, random = Math.random) {
  const eligible = eligibleLegacyPool(pool, userClub, season);
  if (!eligible.length) return null;
  const weights = eligible.map(e => {
    const w = (e.star ? 1.5 : 1) * recencyMod(season, e.retiredSeason);
    return { entry: e, w: Math.max(0.01, w) };
  });
  const total = weights.reduce((s, r) => s + r.w, 0);
  let roll = (typeof random === 'function' ? random() : Math.random()) * total;
  for (const row of weights) {
    roll -= row.w;
    if (roll <= 0) return row.entry;
  }
  return weights[weights.length - 1].entry;
}

function pickLegacyPosition(retiredPos, random) {
  const list = ADJACENT_POS[retiredPos] || [retiredPos || 'MC'];
  if (random() > 0.15 || list.length === 1) return list[0];
  return list[1 + Math.floor(random() * (list.length - 1))];
}

function buildLegacyName(retired, random) {
  const { first, last } = splitName(retired.name);
  const roll = random();
  const jrOk = retired.star || true; // pool só do clube user
  if (roll < 0.1 && jrOk) {
    return `${last} Jr`;
  }
  if (roll < 0.45) {
    const firstNames = ['Pedro', 'Lucas', 'Gabriel', 'Enzo', 'Miguel', 'Rafael', 'Bruno', 'Caio'];
    const fn = firstNames[Math.floor(random() * firstNames.length)];
    return `${fn} ${last}`;
  }
  if (roll < 0.8) {
    const lastNames = ['Souza', 'Costa', 'Alves', 'Ribeiro', 'Martins', 'Lopes'];
    const ln = lastNames[Math.floor(random() * lastNames.length)];
    return `${first.charAt(0)}. ${ln}`;
  }
  const firstNames = ['Pedro', 'Lucas', 'Gabriel', 'Enzo', 'Miguel'];
  const fn = firstNames[Math.floor(random() * firstNames.length)];
  return `${fn} ${last}`;
}

/**
 * @param {object} ctx — club, clubName, division, random, firstNames, lastNames, careerDate, userClub, season, retiredPool, legacyMeta
 */
export function maybeRollLegacyYouthPlayer(ctx = {}) {
  const { userClub, clubName, season, retiredPool, legacyMeta } = ctx;
  if (!userClub || clubName !== userClub) return null;
  if ((legacyMeta?.season === season ? legacyMeta.count : 0) >= LEGACY_REGEN_MAX_PER_SEASON) {
    return null;
  }

  const eligible = eligibleLegacyPool(retiredPool, userClub, season);
  if (!eligible.length) return null;

  const random = typeof ctx.random === 'function' ? ctx.random : Math.random;
  const candidate = pickLegacyCandidate(retiredPool, userClub, season, random);
  if (!candidate) return null;

  const chance = computeLegacyRegenChance(candidate, ctx);
  const seed = `${season}|${clubName}|legacy-youth|${legacyMeta?.count ?? 0}|${candidate.id}`;
  const roll = random();
  if (roll >= chance) return null;

  return spawnLegacyYouthPlayer(candidate, { ...ctx, random });
}

export function spawnLegacyYouthPlayer(retired, ctx = {}) {
  const random = typeof ctx.random === 'function' ? ctx.random : Math.random;
  const role = pickLegacyPosition(retired.pos, random);
  const player = generateYouthPlayer({
    club: ctx.club,
    clubName: ctx.clubName,
    division: ctx.division || 'A',
    uf: retired.originUf || ctx.uf,
    random,
    firstNames: ctx.firstNames,
    lastNames: ctx.lastNames,
  });
  player.name = buildLegacyName(retired, random);
  player.pos = role;
  player.nationality = retired.nationality || player.nationality;
  player.originUf = retired.originUf || player.originUf;
  if (retired.star && random() < 0.08) player.destaque = true;
  if (retired.star && random() < 0.03) {
    player.destaque = true;
    player.craque = true;
  }
  player.legacyOf = {
    retiredPlayerId: retired.playerId,
    retiredName: retired.name,
    retiredSeason: retired.retiredSeason,
    retiredClub: retired.lastClub,
  };
  player.legacyTag = 'regen';
  return { player, legacyEntryId: retired.id };
}

export function markLegacyRegenUsed(pool, legacyEntryId) {
  if (!legacyEntryId || !Array.isArray(pool)) return pool;
  return pool.map(entry => (entry.id === legacyEntryId ? { ...entry, regenUsed: true } : entry));
}

export function bumpLegacyMeta(meta, season) {
  const s = Number(season);
  if (!meta || meta.season !== s) return { season: s, count: 1 };
  return { season: s, count: (Number(meta.count) || 0) + 1 };
}
