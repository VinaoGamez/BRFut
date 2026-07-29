/**
 * Diagnóstico e reparo de saves locais (ativo, bundle, legado).
 */
import {
  SAVE_KEYS,
  LEGACY_SAVE_KEYS,
  slotBundleKeys,
  isSlotBundleKey,
} from './constants.js';
import { readJson } from './save.js';
import { readCareerIndex, getSlotById, copyActiveKeysToBundle, copyBundleToActiveKeys } from './career-slot-manager.js';

function readRaw(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function payloadChars(key) {
  const raw = readRaw(key);
  return raw ? raw.length : 0;
}

/** Há objeto de carreira jogável (ativo, bundle ou legado). */
export function hasPlayableCareerSave(slotId = null) {
  if (readJson(SAVE_KEYS.career, null)) return true;
  if (readJson(LEGACY_SAVE_KEYS.career, null)) return true;

  const ids = slotId
    ? [slotId]
    : readCareerIndex().slots.map(entry => entry.id).filter(Boolean);

  return ids.some(id => !!readJson(slotBundleKeys(id).career, null));
}

/** Lista chaves BRFut relevantes no localStorage (diagnóstico). */
export function scanLocalCareerStorage() {
  const keys = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (
        key.startsWith('brfut-')
        || key.startsWith('matchday-')
        || key === 'futmanager-pace'
      ) {
        keys.push({
          key,
          chars: payloadChars(key),
          hasCareerClub: key.includes('-career') ? !!readJson(key, null)?.clubName : undefined,
        });
      }
    }
  } catch {
    /* ignore */
  }
  keys.sort((a, b) => b.chars - a.chars);
  const index = readCareerIndex();
  return {
    keys,
    index,
    playable: hasPlayableCareerSave(),
    activeCareer: !!readJson(SAVE_KEYS.career, null),
    legacyCareer: !!readJson(LEGACY_SAVE_KEYS.career, null),
  };
}

/**
 * Tenta restaurar o slot a partir de chaves ativas, legado ou outro bundle.
 * @returns {boolean} true se encontrou carreira
 */
export function repairSlotFromLocalStorage(slotId, { forceBundleCopy = true } = {}) {
  if (!slotId) return false;

  const bundle = slotBundleKeys(slotId);
  if (readJson(bundle.career, null)) {
    copyBundleToActiveKeys(slotId);
    return true;
  }

  const activeCareer = readJson(SAVE_KEYS.career, null);
  if (activeCareer) {
    copyActiveKeysToBundle(slotId, { force: forceBundleCopy });
    copyBundleToActiveKeys(slotId);
    return true;
  }

  const legacyCareer = readJson(LEGACY_SAVE_KEYS.career, null);
  if (legacyCareer) {
    try {
      localStorage.setItem(SAVE_KEYS.career, JSON.stringify(legacyCareer));
    } catch {
      return false;
    }
    copyActiveKeysToBundle(slotId, { force: forceBundleCopy });
    copyBundleToActiveKeys(slotId);
    return true;
  }

  const manifest = getSlotById(slotId);
  const clubHint = manifest?.clubName && manifest.clubName !== '—' ? manifest.clubName : null;

  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !isSlotBundleKey(key) || !key.endsWith('-career')) continue;
      const career = readJson(key, null);
      if (!career?.clubName) continue;
      if (clubHint && career.clubName !== clubHint && career.foundingClubName !== clubHint) continue;
      const match = key.match(/^brfut-slot-(.+)-career$/);
      if (!match) continue;
      const sourceId = match[1];
      if (sourceId === slotId) continue;
      const source = slotBundleKeys(sourceId);
      copyStoragePair(source.career, bundle.career);
      copyStoragePair(source.season, bundle.season);
      copyStoragePair(source.playerHistory, bundle.playerHistory);
      copyStoragePair(source.liveMatch, bundle.liveMatch);
      copyBundleToActiveKeys(slotId);
      return true;
    }
  } catch {
    /* ignore */
  }

  return false;
}

function copyStoragePair(src, dest) {
  const raw = readRaw(src);
  if (!raw) return;
  try {
    localStorage.setItem(dest, raw);
  } catch {
    /* ignore quota */
  }
}

/** @returns {{ ok: boolean, reason?: string, scan: ReturnType<typeof scanLocalCareerStorage> }} */
export function ensureSlotPlayable(slotId) {
  const scan = scanLocalCareerStorage();
  if (!slotId) return { ok: false, reason: 'missing_slot', scan };
  if (repairSlotFromLocalStorage(slotId)) return { ok: true, scan: scanLocalCareerStorage() };
  return { ok: false, reason: 'no_career_payload', scan };
}
