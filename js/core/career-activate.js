/**
 * Pipeline único: boot de storage + ativação de slot (merge local/remoto/bundle).
 */
import { SAVE_KEYS, CAREER_INDEX_KEY } from './constants.js';
import { readJson, migrateLegacyStorageKeys } from './save.js';
import {
  hydrateSlot,
  flushPendingSlotSync,
  syncActiveSlotFromCache,
  getActiveSlotId,
  migrateLegacySingleSaveToSlots,
} from './career-slot-manager.js';
import {
  ensureStorageHydrated,
  mergeSlotBundleFromCloud,
} from './storage-api.js';
import { repairSlotFromLocalStorage } from './career-storage-health.js';

let bootMigrationDone = false;

/** Somente testes — permite reexecutar migração de boot. */
export function resetCareerBootMigrationState() {
  bootMigrationDone = false;
}

/** Migração local legada + slots — uma vez por sessão de página. */
export function runCareerBootMigration() {
  if (bootMigrationDone) return;
  bootMigrationDone = true;
  migrateLegacyStorageKeys();
  migrateLegacySingleSaveToSlots();
}

/**
 * Reexecuta a descoberta de carreira depois que os saves da nuvem chegam.
 * A migração inicial roda antes do login; por isso um save existente apenas
 * na nuvem podia ser hidratado tarde demais para reconstruir o índice/slot.
 */
export function recoverCareerSlotsAfterHydration() {
  migrateLegacyStorageKeys();
  const index = migrateLegacySingleSaveToSlots();
  const active = index.activeSlotId
    ? index.slots.find(slot => slot.id === index.activeSlotId)
    : null;
  const slot = active || [...index.slots].sort(
    (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime(),
  )[0];
  if (!slot?.id || !repairSlotFromLocalStorage(slot.id)) {
    return { recovered: false, slotId: slot?.id || null };
  }
  syncActiveSlotFromCache({ slotId: slot.id });
  return { recovered: true, slotId: slot.id };
}

/**
 * Ativa um slot: hidrata storage, merge remoto do bundle, flush slot anterior, copia bundle → ativo.
 * @param {string} slotId
 * @param {{ skipProbe?: boolean, reason?: string }} [options]
 */
export async function activateSlot(slotId, { skipProbe = false, reason = 'activate', allowSeedFromActive = true } = {}) {
  runCareerBootMigration();
  await ensureStorageHydrated({ skipProbe, reason: `${reason}-storage` });

  if (!slotId) return { slotId: null, activeSlotId: getActiveSlotId() };

  await mergeSlotBundleFromCloud(slotId);

  const currentId = getActiveSlotId();
  if (currentId && currentId !== slotId) {
    flushPendingSlotSync();
    syncActiveSlotFromCache({ slotId: currentId });
  }

  hydrateSlot(slotId, { allowSeedFromActive });
  repairSlotFromLocalStorage(slotId);
  return { slotId, activeSlotId: getActiveSlotId() };
}

/** Boot completo antes de index.html (auth + slot opcional). */
export async function prepareGameSession({
  skipProbe = false,
  slotId = null,
  allowSeedFromActive = true,
} = {}) {
  runCareerBootMigration();
  const storage = await ensureStorageHydrated({ skipProbe, reason: 'game-session' });
  if (slotId) {
    await activateSlot(slotId, {
      skipProbe: true,
      reason: 'game-session-slot',
      allowSeedFromActive,
    });
  }
  return storage;
}

/** Indica se há carreira persistida (ativo ou índice de slots). */
export function hasPersistedCareer() {
  try {
    if (readJson(SAVE_KEYS.career, null)) return true;
    const index = readJson(CAREER_INDEX_KEY, null);
    return Array.isArray(index?.slots) && index.slots.length > 0;
  } catch {
    return false;
  }
}
