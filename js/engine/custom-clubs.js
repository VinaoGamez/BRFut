/**
 * Clubes customizados — Lab de Times (localStorage, só build local).
 * Alimenta o registry em runtime; não vai para GitHub Pages.
 */

import { readJson, writeJson } from '../core/save.js';
import { foreignClubUf, isBrazilianClubCountry, normalizeClubCountry } from './club-countries.js';

export const CUSTOM_CLUBS_KEY = 'brfut-custom-clubs';
export const CREST_STYLE_VERSION_KEY = 'brfut-crest-style-version';
/** Incremente ao mudar a lógica de randomização em massa. */
export const CREST_STYLE_VERSION = 1;

/** @typedef {'vertical'|'horizontal'|'diagonal'|'stripes-h'|'stripes-v'|'tricolor-v'|'solid'|'chevron'|'cross'|'quarters'|'ring'|'half-arch'} CrestPattern */
/** @typedef {'classic'|'round'|'modern'|'banner'|'circle'|'hex'} CrestShape */

/**
 * @typedef {Object} CustomClubCrest
 * @property {string} slug
 * @property {string} primary
 * @property {string} secondary
 * @property {string} [accent]
 * @property {CrestPattern} pattern
 * @property {CrestShape} [shape]
 * @property {string} [label] — texto dentro do escudo (vazio = iniciais)
 * @property {string} [labelColor] — cor do texto (vazio = automática)
 * @property {number} [labelSize] — tamanho da fonte 8–28 (0 = automático)
 * @property {string} [image] — data URL (upload manual) ou vazio (escudo gerado)
 */

/**
 * @typedef {Object} CustomClub
 * @property {string} id
 * @property {string} name
 * @property {string} country — código CONMEBOL (ex.: BRA, ARG)
 * @property {string} uf
 * @property {'A'|'B'|'C'|'D'|'REG'} division
 * @property {CustomClubCrest} crest
 * @property {string} createdAt
 * @property {string} updatedAt
 */

const CREST_SHAPES = Object.freeze([
  'classic',
  'round',
  'modern',
  'banner',
  'circle',
  'hex',
]);

const CREST_PATTERNS = Object.freeze([
  'vertical',
  'horizontal',
  'diagonal',
  'stripes-h',
  'stripes-v',
  'tricolor-v',
  'chevron',
  'cross',
  'quarters',
  'ring',
  'half-arch',
  'solid',
]);

/** Padrões sorteados em massa (evita lote todo «sólido» vindo do Brasfoot). */
const CREST_RANDOM_PATTERNS = Object.freeze(CREST_PATTERNS.filter(pattern => pattern !== 'solid'));

function seededRng(seed) {
  let state = 0;
  const label = String(seed || 'x');
  for (let i = 0; i < label.length; i += 1) {
    state = (state * 31 + label.charCodeAt(i)) >>> 0;
  }
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function pickSeeded(seed, items) {
  if (!items.length) return items[0];
  const rng = seededRng(seed);
  return items[Math.floor(rng() * items.length)];
}

function randomCrestStyleForClub(club) {
  const seedBase = club.id || club.crest?.slug || club.name || 'clube';
  return {
    shape: pickSeeded(`${seedBase}|shape`, CREST_SHAPES),
    pattern: pickSeeded(`${seedBase}|pattern`, CREST_RANDOM_PATTERNS),
  };
}

function normClubName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ');
}

/** @type {CustomClub[]|null} */
let clubsCache = null;
/** @type {Map<string, CustomClub>|null} */
let clubsByNameCache = null;
let clubsCacheVersion = 0;

export function getCustomClubsCacheVersion() {
  return clubsCacheVersion;
}

export function invalidateCustomClubsCache() {
  clubsCache = null;
  clubsByNameCache = null;
  clubsCacheVersion += 1;
}

function indexCustomClubs(clubs) {
  /** @type {Map<string, CustomClub>} */
  const byName = new Map();
  for (const club of clubs) {
    byName.set(normClubName(club.name), club);
  }
  clubsByNameCache = byName;
}
function slugFromName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'clube';
}

function newId() {
  return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Upload manual gravado como data URL no localStorage. */
export function isUploadedCrestImage(image) {
  return typeof image === 'string' && image.startsWith('data:image/');
}

/** Remove paths de pacotes (brasfoot/, clubs/) — só mantém upload data URL. */
export function stripBundledCrestImage(image) {
  if (!image || isUploadedCrestImage(image)) return image || '';
  return '';
}

/** Slugs dos 20 clubes argentinos recentes em Libertadores / Sudamericana. */
export const ARGENTINA_CONTINENTAL_SLUGS = Object.freeze(
  new Set([
    'racing_arg',
    'velezsarsfield_arg',
    'estudiantes_ar',
    'centralcordoba_arg',
    'talleres_arg',
    'riverplate_arg',
    'bocajuniors_arg',
    'godoycruz_ar',
    'independiente_arg',
    'huracan_arg',
    'union_arg',
    'lanus_arg',
    'defensayjusticia_ar',
    'rosariocentral_arg',
    'sanlorenzo_ar',
    'belgrano_arg',
    'argentinojnrs_arg',
    'tigre_arg',
    'newoldboys_ar',
    'gimnasialp_arg',
  ]),
);

export function isAllowedArgentinaClub(club) {
  if (normalizeClubCountry(club?.country) !== 'ARG') return true;
  const slug = String(club?.crest?.slug || '').toLowerCase();
  return ARGENTINA_CONTINENTAL_SLUGS.has(slug);
}

/** Remove clubes argentinos fora da lista continental (Libertadores / Sudamericana recentes). */
export function pruneArgentinaClubsToContinental() {
  const existing = loadCustomClubs();
  const next = existing.filter(club => isAllowedArgentinaClub(club));
  const removed = existing.length - next.length;
  const keptArg = next.filter(club => normalizeClubCountry(club.country) === 'ARG').length;
  if (!removed) return { ok: true, removed: 0, keptArg };
  if (!saveCustomClubs(next)) {
    return { ok: false, error: 'Falha ao gravar após limpar clubes argentinos.', removed: 0, keptArg: 0 };
  }
  return { ok: true, removed, keptArg };
}

/** @returns {CustomClub[]} */
export function loadCustomClubs() {
  if (clubsCache) return clubsCache;
  const raw = readJson(CUSTOM_CLUBS_KEY, []);
  if (!Array.isArray(raw)) {
    clubsCache = [];
    indexCustomClubs(clubsCache);
    return clubsCache;
  }
  clubsCache = raw
    .filter(entry => entry?.name && entry?.uf)
    .map(entry => ({
      ...entry,
      country: normalizeClubCountry(entry.country),
    }));
  indexCustomClubs(clubsCache);
  return clubsCache;
}

/** @param {CustomClub[]} clubs */
export function saveCustomClubs(clubs) {
  const ok = writeJson(CUSTOM_CLUBS_KEY, clubs);
  if (ok) {
    clubsCache = clubs;
    indexCustomClubs(clubs);
    clubsCacheVersion += 1;
  }
  return ok;
}

export function crestPatterns() {
  return [...CREST_PATTERNS];
}

export function crestShapes() {
  return [...CREST_SHAPES];
}

/** @param {Partial<CustomClubCrest>} crest @param {string} name */
export function normalizeCrest(crest = {}, name = '') {
  const slug = crest.slug || slugFromName(name);
  const pattern = CREST_PATTERNS.includes(crest.pattern) ? crest.pattern : 'vertical';
  const shape = CREST_SHAPES.includes(crest.shape) ? crest.shape : 'classic';
  return {
    slug,
    primary: crest.primary || '#1a3fa8',
    secondary: crest.secondary || '#ffffff',
    accent: crest.accent || '#ffffff',
    pattern,
    shape,
    label: String(crest.label || '').trim().slice(0, 16),
    labelColor: normalizeLabelColor(crest.labelColor),
    labelSize: normalizeLabelSize(crest.labelSize),
    image: stripBundledCrestImage(crest.image),
  };
}

function normalizeLabelColor(value) {
  const color = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : '';
}

function normalizeLabelSize(value) {
  const size = Number(value);
  if (!Number.isFinite(size) || size <= 0) return 0;
  return Math.min(28, Math.max(8, Math.round(size)));
}

/**
 * Sorteia modelo + padrão para escudos gerados; mantém cor primária e secundária do time.
 * Uploads manuais não são alterados.
 * @param {{ force?: boolean }} [options]
 */
export function randomizeGeneratedCrestStyles({ force = false } = {}) {
  const existing = loadCustomClubs();
  if (!existing.length) return { ok: true, updated: 0, skipped: false };

  if (!force) {
    const version = Number(readJson(CREST_STYLE_VERSION_KEY, 0)) || 0;
    if (version >= CREST_STYLE_VERSION) {
      return { ok: true, updated: 0, skipped: true };
    }
  }

  let updated = 0;
  const next = existing.map(club => {
    if (isUploadedCrestImage(club.crest?.image)) return club;

    const { shape, pattern } = randomCrestStyleForClub(club);
    const primary = club.crest?.primary || '#1a3fa8';
    const secondary = club.crest?.secondary || '#ffffff';
    updated += 1;

    return {
      ...club,
      crest: normalizeCrest(
        {
          slug: club.crest?.slug,
          primary,
          secondary,
          accent: '#ffffff',
          shape,
          pattern,
          label: '',
          image: '',
        },
        club.name,
      ),
      updatedAt: new Date().toISOString(),
    };
  });

  if (!updated) {
    writeJson(CREST_STYLE_VERSION_KEY, CREST_STYLE_VERSION);
    return { ok: true, updated: 0, skipped: false };
  }

  if (!saveCustomClubs(next)) {
    return { ok: false, error: 'Falha ao gravar escudos randomizados (localStorage cheio?).', updated: 0 };
  }
  writeJson(CREST_STYLE_VERSION_KEY, CREST_STYLE_VERSION);
  return { ok: true, updated, skipped: false };
}

/** @param {Partial<CustomClub>} input */
export function createCustomClub(input = {}) {
  const name = String(input.name || '').trim();
  const country = normalizeClubCountry(input.country);
  const uf = isBrazilianClubCountry(country)
    ? String(input.uf || '').trim().toUpperCase()
    : foreignClubUf(country);
  const division = ['A', 'B', 'C', 'D', 'REG'].includes(input.division) ? input.division : 'C';
  const now = new Date().toISOString();
  const crest = normalizeCrest(input.crest || {}, name);
  return {
    id: input.id || newId(),
    name,
    country,
    uf,
    division,
    crest,
    createdAt: input.createdAt || now,
    updatedAt: now,
  };
}

/** @param {string} id */
export function getCustomClubById(id) {
  return loadCustomClubs().find(club => club.id === id) || null;
}

/** @param {string} name */
export function getCustomClubByName(name) {
  loadCustomClubs();
  return clubsByNameCache?.get(normClubName(name)) || null;
}

/** Escudo para resolveClubCrestArtwork. */
export function getCustomClubCrestArtwork(clubName) {
  const club = getCustomClubByName(clubName);
  if (!club?.crest) return null;
  return {
    slug: club.crest.slug,
    name: club.name,
    primary: club.crest.primary,
    secondary: club.crest.secondary,
    accent: club.crest.accent,
    pattern: club.crest.pattern,
    shape: club.crest.shape || 'classic',
    label: club.crest.label || '',
    labelColor: club.crest.labelColor || '',
    labelSize: club.crest.labelSize || 0,
    image: club.crest.image || '',
    custom: true,
  };
}

/** Entradas no formato do registry (REAL_CLUBS_BY_UF) — só clubes brasileiros. */
export function getCustomClubsForRegistry() {
  return loadCustomClubs()
    .filter(club => isBrazilianClubCountry(club.country))
    .map(club => ({
    name: club.name,
    country: club.country,
    uf: club.uf,
    division: club.division,
    custom: true,
    id: club.id,
  }));
}

/** @param {CustomClub} club @param {CustomClub[]} [existing] */
export function upsertCustomClub(club, existing = loadCustomClubs()) {
  const entry = createCustomClub(club);
  if (!entry.name) return { ok: false, error: 'Informe o nome do clube.' };
  if (isBrazilianClubCountry(entry.country) && (!entry.uf || entry.uf.length !== 2)) {
    return { ok: false, error: 'Selecione o estado (UF).' };
  }

  const nameKey = normClubName(entry.name);
  const duplicate = existing.find(item => {
    if (item.id === entry.id) return false;
    if (normClubName(item.name) !== nameKey) return false;
    if (normalizeClubCountry(item.country) !== entry.country) return false;
    return item.uf === entry.uf;
  });
  if (duplicate) {
    return {
      ok: false,
      error: `Já existe "${entry.name}" em ${entry.uf} (${entry.country}). Renomeie ou exclua o duplicado.`,
    };
  }

  const index = existing.findIndex(item => item.id === entry.id);
  const next = [...existing];
  if (index >= 0) {
    next[index] = { ...entry, createdAt: existing[index].createdAt, updatedAt: new Date().toISOString() };
  } else {
    next.push(entry);
  }

  if (!saveCustomClubs(next)) return { ok: false, error: 'Falha ao gravar (localStorage cheio?).' };
  return { ok: true, club: index >= 0 ? next[index] : next[next.length - 1] };
}

/** @param {string} id */
export function deleteCustomClub(id) {
  return deleteCustomClubs([id]);
}

/** @param {string[]} ids */
export function deleteCustomClubs(ids) {
  const drop = new Set((ids || []).filter(Boolean));
  if (!drop.size) return { ok: false, error: 'Nenhum clube selecionado.' };

  const existing = loadCustomClubs();
  const next = existing.filter(club => !drop.has(club.id));
  const removed = existing.length - next.length;
  if (!removed) return { ok: false, error: 'Nenhum clube encontrado para excluir.' };
  if (!saveCustomClubs(next)) return { ok: false, error: 'Falha ao gravar.' };
  return { ok: true, removed };
}

/**
 * Nova carreira: remove clubes custom de saves anteriores do registry local.
 * Mantém só o clube da carreira atual (match por nome normalizado).
 */
export function retainCustomClubsForCareer(clubName) {
  const keepKey = normClubName(clubName);
  if (!keepKey) return { ok: true, removed: 0 };
  const existing = loadCustomClubs();
  const next = existing.filter(club => normClubName(club.name) === keepKey);
  const removed = existing.length - next.length;
  if (!removed) return { ok: true, removed: 0 };
  if (!saveCustomClubs(next)) return { ok: false, error: 'Falha ao gravar.', removed: 0 };
  return { ok: true, removed };
}

function clubDedupeKey(club) {
  const slug = club?.crest?.slug || '';
  const uf = String(club?.uf || '').toUpperCase();
  const nameKey = normClubName(club?.name);
  return slug ? `slug:${slug}` : `name:${uf}|${nameKey}`;
}

function pickPreferredClub(a, b) {
  const score = club => {
    const hasUpload = isUploadedCrestImage(club?.crest?.image) ? 1 : 0;
    const cleanName = !/\([^)]*\)\s*$/.test(String(club?.name || '')) ? 1 : 0;
    return hasUpload * 10 + cleanName;
  };
  return score(a) >= score(b) ? a : b;
}

/** Remove duplicatas (mesmo slug, ou mesmo nome + UF). */
export function dedupeCustomClubs() {
  const existing = loadCustomClubs();
  /** @type {Map<string, CustomClub>} */
  const best = new Map();
  let removed = 0;

  for (const club of existing) {
    const key = clubDedupeKey(club);
    if (!best.has(key)) {
      best.set(key, club);
      continue;
    }
    best.set(key, pickPreferredClub(best.get(key), club));
    removed += 1;
  }

  const next = [...best.values()].sort((a, b) =>
    `${a.uf}|${a.name}`.localeCompare(`${b.uf}|${b.name}`, 'pt-BR'),
  );
  if (next.length === existing.length) {
    return { ok: true, removed: 0, count: next.length };
  }
  if (!saveCustomClubs(next)) {
    return { ok: false, error: 'Falha ao gravar após remover duplicados.' };
  }
  return { ok: true, removed, count: next.length };
}

/** @param {CustomClub[]} clubs */
export function importCustomClubs(clubs, { replace = false } = {}) {
  if (!Array.isArray(clubs)) return { ok: false, error: 'JSON inválido.' };
  const parsed = clubs
    .map(entry => createCustomClub(entry))
    .filter(entry => entry.name && entry.uf)
    .filter(entry => isAllowedArgentinaClub(entry));
  if (!parsed.length) return { ok: false, error: 'Nenhum clube válido no arquivo.' };

  const base = replace ? [] : loadCustomClubs();
  /** @type {Map<string, CustomClub>} */
  const byId = new Map(base.map(item => [item.id, item]));
  /** @type {Map<string, CustomClub>} */
  const bySlug = new Map();
  /** @type {Map<string, CustomClub>} */
  const byNameUf = new Map();
  for (const item of byId.values()) {
    const slug = String(item.crest?.slug || '').toLowerCase();
    if (slug) bySlug.set(slug, item);
    byNameUf.set(`${item.uf}|${normClubName(item.name)}`, item);
  }

  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const club of parsed) {
    const nameKey = normClubName(club.name);
    const slug = String(club.crest?.slug || '').toLowerCase();
    const nameUfKey = `${club.uf}|${nameKey}`;

    let duplicate = false;
    if (slug) {
      const hit = bySlug.get(slug);
      if (hit && hit.id !== club.id) duplicate = true;
    }
    if (!duplicate) {
      const hit = byNameUf.get(nameUfKey);
      if (hit && hit.id !== club.id) duplicate = true;
    }
    if (duplicate) {
      skipped += 1;
      continue;
    }

    if (byId.has(club.id)) {
      const prev = byId.get(club.id);
      const merged = {
        ...club,
        createdAt: prev.createdAt,
        updatedAt: new Date().toISOString(),
      };
      byId.set(club.id, merged);
      if (slug) bySlug.set(slug, merged);
      byNameUf.set(nameUfKey, merged);
      updated += 1;
    } else {
      byId.set(club.id, club);
      if (slug) bySlug.set(slug, club);
      byNameUf.set(nameUfKey, club);
      added += 1;
    }
  }

  /** @type {Map<string, CustomClub>} */
  const best = new Map();
  let removedDuplicates = 0;
  for (const club of byId.values()) {
    const key = clubDedupeKey(club);
    if (!best.has(key)) {
      best.set(key, club);
      continue;
    }
    best.set(key, pickPreferredClub(best.get(key), club));
    removedDuplicates += 1;
  }

  const next = [...best.values()].sort((a, b) =>
    `${a.uf}|${a.name}`.localeCompare(`${b.uf}|${b.name}`, 'pt-BR'),
  );
  if (!saveCustomClubs(next)) {
    return {
      ok: false,
      error: 'Falha ao gravar (localStorage cheio?). Libere espaço ou importe filtrando por UF.',
    };
  }
  return {
    ok: true,
    count: next.length,
    added,
    updated,
    skipped,
    removedDuplicates,
  };
}

export function exportCustomClubsJson() {
  return JSON.stringify(loadCustomClubs(), null, 2);
}

/** Limpa todos os clubes customizados do Lab (localStorage). */
export function clearCustomClubs() {
  if (!saveCustomClubs([])) {
    return { ok: false, error: 'Falha ao limpar clubes.' };
  }
  return { ok: true };
}

/** Remove referências a PNGs de pacote; mantém só uploads data URL. */
export function clearAllBundledCrestImages() {
  const existing = loadCustomClubs();
  let cleared = 0;
  const next = existing.map(club => {
    const image = club.crest?.image;
    if (!image || isUploadedCrestImage(image)) return club;
    cleared += 1;
    return {
      ...club,
      crest: { ...club.crest, image: '' },
      updatedAt: new Date().toISOString(),
    };
  });

  if (!cleared) return { ok: true, cleared: 0 };
  if (!saveCustomClubs(next)) {
    return { ok: false, error: 'Falha ao gravar após remover escudos de pacote.', cleared: 0 };
  }
  return { ok: true, cleared };
}
