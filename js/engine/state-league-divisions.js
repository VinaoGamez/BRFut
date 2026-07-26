/**
 * Divisões visíveis dos estaduais — máx. 4 por UF; 4ª divisão sorteada quando há excedente.
 */

import {
  PAULISTA_UF,
  PAULISTA_DIVISION_SIZE,
  STATE_LEAGUE_MAX_PER_DIVISION,
  groupQualifiers,
  isPaulistaFormat,
  leagueQualifiers,
  sortClubsByPrestige,
} from './state-league-format.js';

export const STATE_LEAGUE_VISIBLE_TIERS = 4;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(str) {
  let h = 2166136261;
  const text = String(str ?? '');
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededShuffle(items, seedStr) {
  const rng = mulberry32(hashSeed(seedStr));
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Tamanho exigido por divisão (18 só na Div. 1 Paulista; demais = 10). */
export function divisionTargetSize(tier, ufCode) {
  const code = String(ufCode || '').toUpperCase();
  if (Number(tier) === 1 && code === PAULISTA_UF) return PAULISTA_DIVISION_SIZE;
  return STATE_LEAGUE_MAX_PER_DIVISION;
}

export function isValidDivisionSize(tier, ufCode, size) {
  return Number(size) === divisionTargetSize(tier, ufCode);
}

/** Detecta competições persistidas com elenco fora do tamanho fixo. */
export function competitionsNeedRepair(byUf) {
  return Object.entries(byUf || {}).some(([uf, divs]) =>
    (divs || []).some((div, index) =>
      !isValidDivisionSize(div.tier || index + 1, uf, (div.teams || []).length),
    ),
  );
}

function emptyStandingRow(club) {
  return { club, played: 0, wins: 0, draws: 0, losses: 0, goalDiff: 0, points: 0 };
}

function alignStandingsToTeams(competition, teams) {
  if (isPaulistaFormat(competition)) {
    const teamSet = new Set(teams);
    return (competition.standings || [])
      .map(group => (group || []).filter(row => teamSet.has(row.club)))
      .filter(group => group.length > 0);
  }
  const flat = (competition.standings || []).flat();
  return [
    teams.map(club => {
      const row = flat.find(item => item.club === club);
      return row ? { ...row, club } : emptyStandingRow(club);
    }),
  ];
}

/**
 * Corrige saves antigos: corta elencos acima do limite e remove divisões incompletas.
 * Preserva standings/progresso dos clubes que permanecem.
 */
export function sanitizeCompetitionsByUf(byUf, clubs = {}) {
  const out = {};
  Object.entries(byUf || {}).forEach(([uf, divs]) => {
    const fixed = (divs || [])
      .map((div, index) => {
        const tier = div.tier || index + 1;
        const target = divisionTargetSize(tier, uf);
        let teams = [...(div.teams || [])];
        if (teams.length > target) {
          teams = sortClubsByPrestige(teams, clubs).slice(0, target);
        }
        if (teams.length !== target) return null;
        return {
          ...div,
          teams,
          standings: alignStandingsToTeams(div, teams),
        };
      })
      .filter(Boolean);
    if (fixed.length) out[uf] = fixed;
  });
  return out;
}

/** Membership só é usada quando todos os elencos têm tamanho exato. */
export function filterValidMembershipByUf(membershipByUf) {
  const out = {};
  Object.entries(membershipByUf || {}).forEach(([uf, membership]) => {
    const rosters = membership?.rosters;
    if (!rosters || !Object.keys(rosters).length) return;
    const valid = Object.entries(rosters).every(([tier, teams]) =>
      isValidDivisionSize(Number(tier), uf, (teams || []).length),
    );
    if (valid) out[uf] = membership;
  });
  return out;
}

/** Clubes que avançaram da fase de grupos/pontos corridos ao mata-mata. */
export function collectPhaseAdvancers(competition) {
  if (!competition) return [];
  if (isPaulistaFormat(competition)) {
    return groupQualifiers(competition).flatMap(rows => rows.map(row => row.club));
  }
  return leagueQualifiers(competition).map(row => row.club);
}

/** Snapshot para vagas garantidas na 4ª divisão da temporada seguinte. */
export function extractGuaranteedTier4ByUf(competitionsByUf) {
  const out = {};
  Object.entries(competitionsByUf || {}).forEach(([uf, divisions]) => {
    const tier4 = (divisions || []).find(item => (item.tier || 1) === STATE_LEAGUE_VISIBLE_TIERS);
    if (!tier4) return;
    const advancers = collectPhaseAdvancers(tier4);
    if (advancers.length) out[String(uf).toUpperCase()] = advancers;
  });
  return out;
}

/** Sorteio determinístico para completar a Divisão 4. */
export function pickLotteryTeams(pool, slots, { seed, userClub } = {}) {
  if (!pool.length || slots <= 0) return [];
  if (pool.length <= slots) return [...pool];
  const roster = [];
  const add = name => {
    if (!name || roster.includes(name)) return;
    roster.push(name);
  };
  if (userClub && pool.includes(userClub)) add(userClub);
  const remaining = pool.filter(name => !roster.includes(name));
  seededShuffle(remaining, seed || 'lottery').slice(0, slots - roster.length).forEach(add);
  return roster;
}

export function createLotteryPicker({ lotterySeed, userUf, userClub } = {}) {
  return (pool, slots, { uf, userClub: uc }) =>
    pickLotteryTeams(pool, slots, {
      seed: `${lotterySeed}-${uf}-${slots}`,
      userClub: String(userUf || '').toUpperCase() === String(uf || '').toUpperCase() ? userClub || uc : null,
    });
}

/**
 * Até 4 divisões visíveis por UF.
 * Cada divisão tem tamanho fixo (10 clubes; Div. 1 Paulista = 18).
 * Se não houver clubes suficientes para preencher exatamente o tamanho, a divisão não é criada.
 */
export function splitStateDivisions(participants, clubs = {}, ufCode = 'SP', options = {}) {
  const sorted = sortClubsByPrestige(participants, clubs);
  const code = String(ufCode || '').toUpperCase();
  const block = STATE_LEAGUE_MAX_PER_DIVISION;
  const total = sorted.length;
  const tier1Size = divisionTargetSize(1, code);
  if (total < tier1Size) return [];

  const seasonYear = Number(options.seasonYear) || 2026;
  const lotterySeed = options.lotterySeed ?? `${code}-${seasonYear}`;
  const userUf = String(options.userUf || '').toUpperCase();
  const userClub = userUf === code ? options.userClub || null : null;

  const divisions = [];
  let idx = 0;

  divisions.push({ tier: 1, teams: sorted.slice(0, tier1Size) });
  idx = tier1Size;

  for (let tier = 2; tier <= 3; tier += 1) {
    const left = total - idx;
    if (left < block) break;
    divisions.push({ tier, teams: sorted.slice(idx, idx + block) });
    idx += block;
  }

  const pool = sorted.slice(idx);
  if (pool.length >= block) {
    const needsLottery = pool.length > block;
    const tier4Teams = needsLottery
      ? pickLotteryTeams(pool, block, {
          seed: lotterySeed,
          userClub,
        })
      : [...pool];
    if (tier4Teams.length === block) {
      divisions.push({ tier: 4, teams: tier4Teams, lottery: needsLottery, lotteryPoolSize: pool.length });
    }
  }

  return divisions.slice(0, STATE_LEAGUE_VISIBLE_TIERS);
}

export function rostersToDivisions(rosters, uf) {
  const code = String(uf || '').toUpperCase();
  const entries = Object.entries(rosters || {})
    .map(([tier, teams]) => ({
      tier: Number(tier),
      teams: [...teams],
    }))
    .filter(item => isValidDivisionSize(item.tier, code, item.teams.length))
    .sort((a, b) => a.tier - b.tier);
  const maxTier = entries[entries.length - 1]?.tier;
  return entries.map(item => ({
    ...item,
    lottery: item.tier === maxTier,
  }));
}
