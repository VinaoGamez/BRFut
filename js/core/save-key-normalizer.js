/**
 * Normalização única de chaves de save (local, remoto, DELETE).
 * Centraliza matchday-* → brfut-* e variantes de slot.
 */
import { SAVE_KEYS, LEGACY_SAVE_KEYS, CAREER_INDEX_KEY, isSlotBundleKey } from './constants.js';

const SESSION_KEY_ALIASES = [
  ['brfut-fresh-career-boot', 'matchday-fresh-career-boot'],
  ['brfut-skip-persist-once', 'matchday-skip-persist-once'],
  ['brfut-career-reload', 'matchday-career-reload'],
  ['brfut-skip-session-end', 'matchday-skip-session-end'],
  ['brfut-autosave-mode', 'matchday-autosave-mode'],
  ['brfut-active-slot-id', 'matchday-active-slot-id'],
  [CAREER_INDEX_KEY, 'matchday-career-index'],
];

/** Chave canônica BR Fut para leitura/gravação. */
export function canonicalSaveKey(key) {
  const raw = String(key || '');
  if (!raw) return raw;

  for (const [nextKey, legacyKey] of SESSION_KEY_ALIASES) {
    if (raw === legacyKey) return nextKey;
  }

  for (const [logical, legacyKey] of Object.entries(LEGACY_SAVE_KEYS)) {
    const newKey = SAVE_KEYS[logical];
    if (newKey && raw === legacyKey) return newKey;
  }

  if (/^matchday-slot-/.test(raw)) {
    return raw.replace(/^matchday-slot-/, 'brfut-slot-');
  }

  return raw;
}

/** Todas as variantes (nova + legado) para DELETE na nuvem. */
export function allSaveKeyVariants(key) {
  const canonical = canonicalSaveKey(key);
  const variants = new Set([canonical, key]);

  Object.entries(SAVE_KEYS).forEach(([logical, newKey]) => {
    const legacyKey = LEGACY_SAVE_KEYS[logical];
    if (newKey === canonical || legacyKey === canonical) {
      variants.add(newKey);
      if (legacyKey) variants.add(legacyKey);
    }
  });

  SESSION_KEY_ALIASES.forEach(([nextKey, legacyKey]) => {
    if (canonical === nextKey || canonical === legacyKey) {
      variants.add(nextKey);
      variants.add(legacyKey);
    }
  });

  if (/^brfut-slot-/.test(canonical)) {
    variants.add(canonical.replace(/^brfut-slot-/, 'matchday-slot-'));
  }

  return [...variants];
}

/** Payload remoto GET /api/saves — promove chaves legadas para brfut-*. */
export function normalizeRemoteSaveKeys(saves) {
  if (!saves || typeof saves !== 'object') return saves;
  const out = { ...saves };
  Object.entries(LEGACY_SAVE_KEYS).forEach(([, legacyKey]) => {
    const canonical = canonicalSaveKey(legacyKey);
    if (legacyKey !== canonical && out[legacyKey] != null && out[canonical] == null) {
      out[canonical] = out[legacyKey];
    }
  });
  if (out['matchday-career-index'] != null && out[CAREER_INDEX_KEY] == null) {
    out[CAREER_INDEX_KEY] = out['matchday-career-index'];
  }
  return out;
}

/** Migra chaves legadas em localStorage/sessionStorage (boot). */
export function migrateLegacyStorageKeysInPlace(storage) {
  if (!storage) return;
  Object.entries(LEGACY_SAVE_KEYS).forEach(([, legacyKey]) => {
    const canonical = canonicalSaveKey(legacyKey);
    if (legacyKey === canonical) return;
    try {
      const legacy = storage.getItem(legacyKey);
      const current = storage.getItem(canonical);
      if (legacy && !current) storage.setItem(canonical, legacy);
    } catch {
      /* ignore quota */
    }
  });
  SESSION_KEY_ALIASES.forEach(([nextKey, legacyKey]) => {
    try {
      const legacy = storage.getItem(legacyKey);
      if (legacy && !storage.getItem(nextKey)) storage.setItem(nextKey, legacy);
    } catch {
      /* ignore */
    }
  });
}

/** Lista todas as chaves syncáveis presentes (ativo + slots + índice). */
export function listLocalSyncableKeys() {
  const keys = new Set(Object.values(SAVE_KEYS));
  keys.add(CAREER_INDEX_KEY);
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (isSlotBundleKey(key) || keys.has(key)) keys.add(canonicalSaveKey(key));
    }
  } catch {
    /* ignore */
  }
  return [...keys];
}
