/**
 * Pirâmide nacional oficial 2026 (CBF) + pool regional Brasfoot (lazy por UF).
 */

const PYRAMID_URL = './data/brazil-official-pyramid-2026.json';
const INDEX_URL = './data/brasfoot-regional-index.json';
const IMPORT_BY_UF_BASE = './data/brasfoot-by-uf';
/** Fallback legado (monolítico). */
const IMPORT_URL = './data/brasfoot-clubs-import.json';

/** @type {{
 *   pyramid: object,
 *   importClubs: object[],
 *   divisionTeams: object,
 *   nationalClubs: object[],
 *   regionalNames: string[],
 *   loadedUfs: Set<string>,
 *   indexClubs: object[],
 * } | null} */
let cache = null;

function clubNames(list) {
  return (list || []).map(entry => entry?.name).filter(Boolean);
}

function normalizeImportClub(club) {
  return {
    name: club?.name || '',
    uf: String(club?.uf || '').toUpperCase(),
    division: club?.division || 'REG',
    country: club?.country || 'BRA',
    ...(club?.crest ? { crest: club.crest } : {}),
    ...(club?.id ? { id: club.id } : {}),
  };
}

/**
 * @param {object} pyramidDoc
 * @param {object[]} indexClubs
 */
function buildFromDocs(pyramidDoc, indexClubs) {
  const divisions = pyramidDoc?.divisions || {};
  const divisionTeams = {
    A: clubNames(divisions.A),
    B: clubNames(divisions.B),
    C: clubNames(divisions.C),
    D: clubNames(divisions.D),
  };

  const nationalClubs = ['A', 'B', 'C', 'D'].flatMap(div =>
    (divisions[div] || []).map(entry => ({
      name: entry.name,
      uf: entry.uf,
      division: div,
      id: entry.id || '',
      placeholder: !!entry.placeholder,
    })),
  );

  const nationalNameKeys = new Set(nationalClubs.map(c => c.name.toLowerCase()));
  const regionalNames = (indexClubs || [])
    .filter(
      club =>
        club?.country === 'BRA'
        && club?.division === 'REG'
        && club?.name
        && !nationalNameKeys.has(String(club.name).toLowerCase()),
    )
    .map(club => club.name);

  return {
    pyramid: pyramidDoc,
    importClubs: [],
    indexClubs: indexClubs || [],
    loadedUfs: new Set(),
    divisionTeams,
    nationalClubs,
    regionalNames,
  };
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao carregar ${url}`);
  return res.json();
}

/** Carrega pirâmide + índice regional slim (sem detalhes por UF). */
export async function loadOfficialBrazilWorld() {
  if (cache) return cache;
  const pyramidDoc = await fetchJson(PYRAMID_URL);
  let indexClubs = [];
  try {
    const indexPayload = await fetchJson(INDEX_URL);
    indexClubs = (Array.isArray(indexPayload?.clubs) ? indexPayload.clubs : []).map(normalizeImportClub);
  } catch {
    const importPayload = await fetchJson(IMPORT_URL);
    indexClubs = (Array.isArray(importPayload?.clubs) ? importPayload.clubs : []).map(normalizeImportClub);
    cache = buildFromDocs(pyramidDoc, indexClubs);
    cache.importClubs = [...indexClubs];
    cache.loadedUfs = new Set(['__legacy__']);
    return cache;
  }
  cache = buildFromDocs(pyramidDoc, indexClubs);
  return cache;
}

/**
 * Carrega clubes completos de uma ou mais UFs (merge no cache).
 * @param {string[]} ufs
 */
export async function ensureImportClubsForUfs(ufs = []) {
  const world = await loadOfficialBrazilWorld();
  const pending = [...new Set(
    (ufs || [])
      .map(uf => String(uf || '').toUpperCase())
      .filter(uf => uf && !world.loadedUfs.has(uf)),
  )];
  if (!pending.length) return world.importClubs;

  const batches = await Promise.all(
    pending.map(async uf => {
      try {
        const payload = await fetchJson(`${IMPORT_BY_UF_BASE}/${uf.toLowerCase()}.json`);
        world.loadedUfs.add(uf);
        return (Array.isArray(payload?.clubs) ? payload.clubs : []).map(normalizeImportClub);
      } catch {
        return [];
      }
    }),
  );
  world.importClubs.push(...batches.flat());
  return world.importClubs;
}

/** Carrega as 27 UFs (estaduais / auditoria completa). */
export async function ensureAllImportClubs() {
  const { BRAZILIAN_UFS } = await import('./brazilian-clubs-by-uf.js');
  return ensureImportClubsForUfs(BRAZILIAN_UFS.map(item => item.code));
}

export function getOfficialBrazilWorldCache() {
  return cache;
}

export function clearOfficialBrazilWorldCache() {
  cache = null;
}

/** @param {number} seed */
export function createSeededRandom(seed) {
  let state = (Number(seed) || 1) >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Sorteia vítima do cascade — prefere UF, fallback nacional.
 * @param {{ division: string, uf: string, seed: number, excludeNames?: string[] }} options
 */
export function pickCascadeVictim({ division, uf, seed, excludeNames = [] }) {
  const world = cache;
  if (!world) return null;
  const div = String(division || 'A').toUpperCase();
  const stateUf = String(uf || '').toUpperCase();
  const exclude = new Set(excludeNames.map(name => String(name || '').toLowerCase()));
  const realOnly = world.nationalClubs.filter(
    club =>
      club.division === div
      && !club.placeholder
      && !exclude.has(club.name.toLowerCase()),
  );
  let pool = realOnly.filter(club => club.uf === stateUf);
  if (!pool.length) pool = realOnly;
  if (!pool.length) {
    pool = world.nationalClubs.filter(
      club => club.division === div && !exclude.has(club.name.toLowerCase()),
    );
  }
  if (!pool.length) return null;
  const rng = createSeededRandom((Number(seed) ^ 0x9e3779b1) >>> 0);
  return pool[Math.floor(rng() * pool.length)] || null;
}

/** Distribui N clubes em G grupos (ex.: 96÷16 = 6 iguais). */
export function serieDGroupSizes(clubCount, groupCount = 16) {
  const total = Math.max(0, Number(clubCount) || 0);
  const groups = Math.max(1, Number(groupCount) || 16);
  if (!total) return [];
  const base = Math.floor(total / groups);
  let remainder = total % groups;
  const sizes = [];
  for (let i = 0; i < groups; i += 1) {
    sizes.push(base + (remainder > 0 ? 1 : 0));
    if (remainder > 0) remainder -= 1;
  }
  return sizes;
}

function normClubKey(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

const DIVISION_ORDER = ['A', 'B', 'C', 'D'];

function findClubDivision(divisionTeams, clubName) {
  const key = normClubKey(clubName);
  if (!key) return null;
  for (const division of DIVISION_ORDER) {
    const names = divisionTeams?.[division];
    if (Array.isArray(names) && names.some(name => normClubKey(name) === key)) return division;
  }
  return null;
}

/**
 * Sincroniza saves antigos com a pirâmide CBF 2026 (96 clubes na Série D, grupos fixos).
 * Preserva o clube do usuário na divisão em que está no save.
 * @returns {{ divisionTeams: object, changed: boolean }}
 */
export function repairDivisionTeamsWithOfficial(divisionTeams, officialWorld, options = {}) {
  const official = officialWorld?.divisionTeams;
  if (!official) return { divisionTeams, changed: false };

  const userClub = options.userClub || null;
  const userDivision = options.userDivision || null;
  const allOfficialKeys = new Set(
    DIVISION_ORDER.flatMap(div => (official[div] || []).map(normClubKey)),
  );

  const next = {
    A: [...(official.A || [])],
    B: [...(official.B || [])],
    C: [...(official.C || [])],
    D: [...(official.D || [])],
  };

  if (userClub) {
    const userDiv = findClubDivision(divisionTeams, userClub) || userDivision;
    if (userDiv && next[userDiv]) {
      const userKey = normClubKey(userClub);
      const already = next[userDiv].some(name => normClubKey(name) === userKey);
      if (!already) {
        const saveList = divisionTeams?.[userDiv] || [];
        const missingOfficial = next[userDiv].filter(
          name => !saveList.some(saved => normClubKey(saved) === normClubKey(name)),
        );
        if (missingOfficial.length === 1) {
          const idx = next[userDiv].findIndex(
            name => normClubKey(name) === normClubKey(missingOfficial[0]),
          );
          if (idx >= 0) next[userDiv][idx] = userClub;
        } else {
          const idx = next[userDiv].findIndex(name => normClubKey(name) !== userKey);
          if (idx >= 0) next[userDiv][idx] = userClub;
        }
      }
    }
  }

  let changed = false;
  for (const div of DIVISION_ORDER) {
    const before = (divisionTeams?.[div] || []).map(normClubKey).sort().join('|');
    const after = (next[div] || []).map(normClubKey).sort().join('|');
    if (before !== after) changed = true;
    const missingOfficial = (next[div] || []).filter(name => !allOfficialKeys.has(normClubKey(name)));
    if (missingOfficial.length) changed = true;
  }

  return { divisionTeams: next, changed };
}

/**
 * Monta os 16 grupos oficiais CBF (A1–A16) a partir da pirâmide carregada.
 * Usa `serieDGroups` do JSON ou blocos sequenciais de `divisions.D`.
 * @param {string[]} divisionDNames — elenco atual da Série D no save
 * @param {{ replacements?: Record<string, string> }} [options] — evictedKey → incoming (cascade)
 * @returns {string[][]}
 */
export function buildOfficialSerieDGroups(divisionDNames, options = {}) {
  const replacements = options.replacements || {};
  const pool = [...new Set((divisionDNames || []).filter(Boolean))];
  const used = new Set();
  const pick = officialName => {
    const officialKey = normClubKey(officialName);
    const incoming = replacements[officialKey];
    if (incoming) {
      const replaced = pool.find(
        name => !used.has(name) && normClubKey(name) === normClubKey(incoming),
      );
      if (replaced) {
        used.add(replaced);
        return replaced;
      }
    }
    const key = normClubKey(officialName);
    const match = pool.find(name => !used.has(name) && normClubKey(name) === key);
    if (match) {
      used.add(match);
      return match;
    }
    if (officialName && pool.includes(officialName) && !used.has(officialName)) {
      used.add(officialName);
      return officialName;
    }
    return null;
  };

  const embedded = cache?.pyramid?.serieDGroups;
  if (Array.isArray(embedded) && embedded.length === 16) {
    return embedded.map(group =>
      (group || []).map(entry => {
        const officialName = typeof entry === 'string' ? entry : entry?.name;
        return pick(officialName) || officialName;
      }).filter(Boolean),
    );
  }

  const entries = cache?.pyramid?.divisions?.D;
  if (!Array.isArray(entries) || entries.length < 6) {
    const sizes = serieDGroupSizes(pool.length, 16);
    const groups = [];
    let offset = 0;
    for (const size of sizes) {
      groups.push(pool.slice(offset, offset + size));
      offset += size;
    }
    return groups;
  }

  const groups = [];
  for (let g = 0; g < 16; g += 1) {
    const group = [];
    for (let i = 0; i < 6; i += 1) {
      const slot = entries[g * 6 + i];
      const officialName = slot?.name;
      const name = pick(officialName) || officialName;
      if (name) group.push(name);
    }
    groups.push(group);
  }

  for (const name of pool) {
    if (used.has(name)) continue;
    const target =
      groups.find(group => group.length < 6 && group.length % 2 === 0)
      ?? groups.find(group => group.length < 6);
    if (target) target.push(name);
    else groups[groups.length - 1]?.push(name);
    used.add(name);
  }

  return groups;
}

/** Converte log do cascade ({ from, to }) em mapa para montagem de grupos oficiais. */
export function serieDCascadeReplacementsToMap(replacements = []) {
  const map = {};
  for (const row of replacements || []) {
    if (!row?.from || !row?.to) continue;
    map[normClubKey(row.from)] = row.to;
  }
  return map;
}

/** Atualiza nomes nos grupos após substituições cascade (vítima → usuário, etc.). */
export function applySerieDCascadeReplacementsToGroups(groups, replacements = []) {
  const map = serieDCascadeReplacementsToMap(replacements);
  if (!Object.keys(map).length || !Array.isArray(groups)) return groups;
  return groups.map(group =>
    (group || []).map(name => {
      const key = normClubKey(name);
      return map[key] || name;
    }),
  );
}
