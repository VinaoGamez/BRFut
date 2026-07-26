/**
 * Elencos procedurais para clubes regionais / estaduais (fora da pirâmide A–D).
 * Seed determinística por carreira + clube + temporada — mesmo elenco entre sessões
 * até haver delta persistido (transferência, etc.).
 */

import { createSeededRandom } from './brazil-official-pyramid.js';
import { hashSeedString, rosterSeedKey } from './club-roster-seed.js';
import {
  generatePlayer as generatePlayerCore,
  GENERIC_SQUAD_ROLES,
  pickStarterFlags,
} from './player-generation.js';
import { dedupeRosterNames } from './player-names.js';
import { getRealClub } from './brazilian-clubs-by-uf.js';
import { initialBudget } from './economy.js';

export { hashSeedString, rosterSeedKey } from './club-roster-seed.js';

export const STATE_TIER_CLUB_POWER = {
  1: [14, 20],
  2: [12, 18],
  3: [10, 16],
  4: [8, 14],
};

const NATIONAL_DIVISIONS = new Set(['A', 'B', 'C', 'D']);
const FORMATIONS = ['4-3-3', '4-4-2', '3-5-2', '4-2-3-1', '4-1-4-1', '5-3-2', '4-3-1-2', '3-4-3'];
const STYLES = ['Posse de bola', 'Contra-ataque', 'Pressão alta'];
const MENTALITIES = ['Defensiva', 'Equilibrada', 'Ofensiva'];

function intFromRng(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/** Localiza tier estadual do clube nas competições montadas. */
export function findStateTierForClub(competitionsByUf, clubName) {
  const key = String(clubName || '').trim().toLowerCase();
  if (!key) return null;
  for (const divisions of Object.values(competitionsByUf || {})) {
    for (const competition of divisions || []) {
      const teams = competition.teams || [];
      if (teams.some(name => String(name || '').trim().toLowerCase() === key)) {
        return {
          tier: competition.tier || 1,
          uf: competition.uf || null,
          index: teams.findIndex(name => String(name || '').trim().toLowerCase() === key),
        };
      }
    }
  }
  return null;
}

/**
 * Gera ou restaura elenco completo de um clube regional/estadual.
 * Não sobrescreve clubes nacionais (A–D) já materializados.
 */
export function ensureClubRoster(clubName, clubs, options = {}) {
  if (!clubName || !clubs) return null;

  const existing = clubs[clubName];
  if (existing?.roster?.length >= 18 && NATIONAL_DIVISIONS.has(existing.division)) {
    return existing;
  }
  if (existing?.roster?.length >= 18 && !options.force) {
    return existing;
  }

  const {
    careerSeed = 0,
    seasonYear = 2026,
    stateTier = null,
    uf = null,
    clubIndex = 0,
    firstNames = [],
    lastNames = [],
    onCreated = null,
  } = options;

  const tier = Number(stateTier) || existing?.stateTier || 2;
  const seedKey = rosterSeedKey(careerSeed, clubName, seasonYear);
  const rng = createSeededRandom(hashSeedString(seedKey));
  const powerRange = STATE_TIER_CLUB_POWER[tier] || STATE_TIER_CLUB_POWER[2];
  const basePower = intFromRng(rng, powerRange[0], powerRange[1]);
  const genDivision = 'D';

  const roles = [...GENERIC_SQUAD_ROLES];
  const starterFlags = pickStarterFlags(roles.length, rng);
  const roster = roles.map((role, playerIndex) =>
    generatePlayerCore({
      role,
      index: playerIndex + clubIndex * 29,
      clubPower: basePower,
      division: genDivision,
      random: rng,
      firstNames,
      lastNames,
      starterBoost: starterFlags[playerIndex],
    }),
  );
  dedupeRosterNames(roster);
  roster.forEach((player, index) => {
    if (player) player.number = index + 1;
  });

  const top11 = [...roster].sort((a, b) => b.overall - a.overall).slice(0, 11);
  const power = Math.round(top11.reduce((sum, p) => sum + p.overall, 0) / 11);
  const clubUf = uf || existing?.uf || getRealClub(clubName)?.uf || null;
  const isNational = existing && NATIONAL_DIVISIONS.has(existing.division);

  const patch = {
    name: clubName,
    division: isNational ? existing.division : 'REG',
    stateTier: tier,
    uf: clubUf,
    power: isNational ? existing.power || power : power,
    roster: isNational ? existing.roster : roster,
    formation:
      existing?.formation || FORMATIONS[intFromRng(rng, 0, FORMATIONS.length - 1)],
    style: existing?.style || STYLES[intFromRng(rng, 0, STYLES.length - 1)],
    mentality: existing?.mentality || MENTALITIES[intFromRng(rng, 0, MENTALITIES.length - 1)],
    position: existing?.position || clubIndex + 1,
    environment: existing?.environment ?? intFromRng(rng, 48, 78),
    support: existing?.support ?? intFromRng(rng, 38, 82),
    board: existing?.board ?? intFromRng(rng, 38, 82),
    finances: existing?.finances ?? intFromRng(rng, 35, 80),
    regionalBase: !isNational,
  };

  if (!existing?.budget && !isNational) {
    patch.budget = initialBudget('REG');
  }

  if (existing) {
    Object.assign(existing, patch);
  } else {
    clubs[clubName] = patch;
  }

  if (typeof onCreated === 'function') {
    onCreated(clubs[clubName]);
  }

  return clubs[clubName];
}

/** Todos os clubes listados em divisões estaduais válidas. */
export function collectStateLeagueClubNames(competitionsByUf) {
  const names = new Set();
  Object.values(competitionsByUf || {}).forEach(divisions => {
    (divisions || []).forEach(competition => {
      (competition.teams || []).forEach(name => {
        if (name) names.add(name);
      });
    });
  });
  return [...names];
}

/**
 * Materializa elencos de todos os participantes estaduais.
 * @returns {number} clubes criados/atualizados nesta passagem
 */
export function ensureStateLeagueRosters(competitionsByUf, clubs, options = {}) {
  let touched = 0;
  Object.entries(competitionsByUf || {}).forEach(([ufCode, divisions]) => {
    (divisions || []).forEach(competition => {
      const tier = competition.tier || 1;
      (competition.teams || []).forEach((clubName, index) => {
        const before = clubs[clubName]?.roster?.length || 0;
        ensureClubRoster(clubName, clubs, {
          ...options,
          uf: ufCode,
          stateTier: tier,
          clubIndex: index,
        });
        const after = clubs[clubName]?.roster?.length || 0;
        if (after >= 18 && before < 18) touched += 1;
      });
    });
  });
  return touched;
}

export function ensureMatchClubRosters(home, away, clubs, competitionsByUf, options = {}) {
  [home, away].forEach(clubName => {
    if (!clubName || clubs[clubName]?.roster?.length >= 18) return;
    const meta = findStateTierForClub(competitionsByUf, clubName);
    ensureClubRoster(clubName, clubs, {
      ...options,
      uf: meta?.uf || options.uf || getRealClub(clubName)?.uf || null,
      stateTier: meta?.tier || options.stateTier || 2,
      clubIndex: meta?.index || 0,
    });
  });
}

export function isNationalDivision(division) {
  return NATIONAL_DIVISIONS.has(division);
}
