/**
 * API unificada de limpeza de saves — escopo + comportamento na nuvem.
 */
import {
  SAVE_KEYS,
  CAREER_INDEX_KEY,
  slotBundleKeys,
  isSlotBundleKey,
} from './constants.js';
import { allSaveKeyVariants, listLocalSyncableKeys } from './save-key-normalizer.js';
import {
  clearSessionCareerData,
  clearCareerStorage,
  clearSeasonSave,
  purgeAllCareerStorage,
  invalidateStoragePressureCache,
} from './save.js';
import {
  flushCloudDeletesAsync,
  isCloudStorageActive,
  queueCloudDelete,
} from './storage-api.js';
import { readCareerIndex, getActiveSlotId } from './career-slot-manager.js';

/** @typedef {'session'|'career'|'all'} ClearScope */
/** @typedef {'skip'|'queue'|'await'} ClearCloudMode */

/**
 * @param {ClearScope} scope
 * @param {{ cloud?: ClearCloudMode, clearTraining?: boolean, clearPlayerHistory?: boolean, includeSlots?: boolean }} [options]
 */
export async function clearCareerData(scope, options = {}) {
  const cloud = options.cloud ?? (scope === 'session' ? 'skip' : 'queue');
  const clearTraining = options.clearTraining !== false;
  const clearPlayerHistory = options.clearPlayerHistory !== false;
  const includeSlots = options.includeSlots === true;

  if (scope === 'session') {
    clearSessionCareerData();
    return { ok: true, scope, cloud: 'skip' };
  }

  if (scope === 'career') {
    const keysBefore = collectClearKeys({ includeSlots, careerOnly: true });
    clearCareerStorage({ clearTraining, clearPlayerHistory, cloudDeletes: cloud === 'queue' });
    if (includeSlots) clearSlotBundlesLocal();
    if (cloud === 'await' && isCloudStorageActive()) {
      const result = await flushCloudDeletesAsync(keysBefore);
      return { ok: result.ok, scope, cloud, deleted: result.deleted };
    }
    return { ok: true, scope, cloud };
  }

  if (scope === 'all') {
    const keysBefore = listLocalSyncableKeys().flatMap(k => allSaveKeyVariants(k));
    purgeAllCareerStorage();
    if (cloud === 'await' && isCloudStorageActive()) {
      const unique = [...new Set(keysBefore)];
      const result = await flushCloudDeletesAsync(unique);
      return { ok: result.ok, scope, cloud, deleted: result.deleted };
    }
    if (cloud === 'queue' && isCloudStorageActive()) {
      keysBefore.forEach(key => queueCloudDelete(key));
    }
    invalidateStoragePressureCache();
    return { ok: true, scope, cloud };
  }

  return { ok: false, scope, reason: 'unknown_scope' };
}

function collectClearKeys({ includeSlots = false, careerOnly = false } = {}) {
  const keys = [
    SAVE_KEYS.career,
    SAVE_KEYS.season,
    SAVE_KEYS.liveMatch,
    SAVE_KEYS.training,
    SAVE_KEYS.playerHistory,
  ];
  if (!careerOnly) keys.push(CAREER_INDEX_KEY);
  if (includeSlots) {
    readCareerIndex().slots.forEach(slot => {
      keys.push(...Object.values(slotBundleKeys(slot.id)));
    });
    const activeId = getActiveSlotId();
    if (activeId) keys.push(...Object.values(slotBundleKeys(activeId)));
  }
  return [...new Set(keys.flatMap(k => allSaveKeyVariants(k)))];
}

function clearSlotBundlesLocal() {
  try {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && (isSlotBundleKey(key) || /^matchday-slot-/.test(key))) toRemove.push(key);
    }
    toRemove.forEach(key => localStorage.removeItem(key));
    localStorage.removeItem(CAREER_INDEX_KEY);
    localStorage.removeItem('matchday-career-index');
  } catch {
    /* ignore */
  }
}
