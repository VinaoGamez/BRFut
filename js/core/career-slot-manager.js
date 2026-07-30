/**
 * Múltiplas carreiras por usuário — índice leve + bundles por slot.
 * Cache ativo: SAVE_KEYS (brfut-career, …). Persistência: brfut-slot-{id}-*.
 */
import {
  SAVE_KEYS,
  CAREER_INDEX_KEY,
  CAREER_SLOT_LIMIT,
  ACTIVE_SLOT_SESSION_KEY,
  slotBundleKeys,
} from './constants.js';
import { readJson, writeJson, getStoragePressure } from './save.js';
import {
  flushCloudDeletesAsync,
  isCloudStorageActive,
  queueCloudDelete,
  queueCloudSave,
} from './storage-api.js';
import { isLocalStorageCheckpoint } from './local-save-checkpoint.js';
import { pickNewerSave } from './save-sync.js';

const INDEX_VERSION = 1;

const emptyIndex = () => ({
  version: INDEX_VERSION,
  activeSlotId: null,
  updatedAt: null,
  slots: [],
});

export function readCareerIndex() {
  const raw = readJson(CAREER_INDEX_KEY, null);
  if (!raw || !Array.isArray(raw.slots)) return emptyIndex();
  return { ...emptyIndex(), ...raw, slots: [...raw.slots] };
}

export function writeCareerIndex(index) {
  const next = {
    ...index,
    version: INDEX_VERSION,
    updatedAt: new Date().toISOString(),
    slots: Array.isArray(index.slots) ? index.slots : [],
  };
  writeJson(CAREER_INDEX_KEY, next);
  return next;
}

export function newSlotId() {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${Date.now().toString(36)}-${rand}`;
}

export function defaultSlotName(career, season) {
  const club = career?.clubName || career?.foundingClubName || 'Carreira';
  const year = season?.year ?? career?.season ?? new Date().getFullYear();
  return `${club} ${year}`;
}

export function getActiveSlotId() {
  try {
    const session = sessionStorage.getItem(ACTIVE_SLOT_SESSION_KEY);
    if (session) return session;
  } catch {
    /* ignore */
  }
  return readCareerIndex().activeSlotId || null;
}

export function setActiveSlotId(slotId) {
  const index = readCareerIndex();
  index.activeSlotId = slotId || null;
  writeCareerIndex(index);
  try {
    if (slotId) sessionStorage.setItem(ACTIVE_SLOT_SESSION_KEY, slotId);
    else sessionStorage.removeItem(ACTIVE_SLOT_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function getSlotById(slotId) {
  return readCareerIndex().slots.find(entry => entry.id === slotId) || null;
}

export function getLastPlayedSlot() {
  const index = readCareerIndex();
  if (!index.slots.length) return null;
  const active = index.activeSlotId
    ? index.slots.find(entry => entry.id === index.activeSlotId)
    : null;
  if (active) return active;
  return [...index.slots].sort(
    (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime(),
  )[0];
}

export function canCreateSlot() {
  return readCareerIndex().slots.length < CAREER_SLOT_LIMIT;
}

export function buildSlotManifest(slotId, { name, career, season } = {}) {
  const c = career ?? readJson(SAVE_KEYS.career);
  const s = season ?? readJson(SAVE_KEYS.season);
  const existing = getSlotById(slotId);
  return {
    id: slotId,
    name: name || existing?.name || defaultSlotName(c, s),
    clubName: c?.clubName || c?.foundingClubName || existing?.clubName || '—',
    division: c?.division || existing?.division || '—',
    seasonYear: s?.year ?? c?.season ?? existing?.seasonYear ?? null,
    managerName: c?.managerName || existing?.managerName || '',
    currentRound: s?.currentRound ?? s?.round ?? existing?.currentRound ?? null,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function upsertSlotManifest(manifest) {
  const index = readCareerIndex();
  const idx = index.slots.findIndex(entry => entry.id === manifest.id);
  const prev = idx >= 0 ? index.slots[idx] : null;
  const entry = {
    ...prev,
    ...manifest,
    createdAt: prev?.createdAt || manifest.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (idx >= 0) index.slots[idx] = entry;
  else index.slots.push(entry);
  index.activeSlotId = manifest.id;
  writeCareerIndex(index);
  return entry;
}

function copyStorageKey(src, dest, { scheduleSlotSync = false, clearDestIfMissing = true } = {}) {
  const value = readJson(src, null);
  if (value == null) {
    if (clearDestIfMissing) {
      try {
        localStorage.removeItem(dest);
      } catch {
        /* ignore */
      }
    }
    return;
  }
  // Checkpoint local não pode sobrescrever o bundle completo (fonte da nuvem).
  if (isLocalStorageCheckpoint(value)) {
    const existing = readJson(dest, null);
    if (existing && !isLocalStorageCheckpoint(existing)) return;
    return;
  }
  writeJson(dest, value, { scheduleSlotSync });
}

export function copyActiveKeysToBundle(slotId, { force = false } = {}) {
  if (!slotId || (!force && getStoragePressure().level === 'critical')) return;
  const bundle = slotBundleKeys(slotId);
  copyStorageKey(SAVE_KEYS.career, bundle.career, { scheduleSlotSync: false });
  copyStorageKey(SAVE_KEYS.season, bundle.season, { scheduleSlotSync: false });
  copyStorageKey(SAVE_KEYS.playerHistory, bundle.playerHistory, { scheduleSlotSync: false });
  copyStorageKey(SAVE_KEYS.liveMatch, bundle.liveMatch, { scheduleSlotSync: false });
}

export function copyBundleToActiveKeys(slotId) {
  if (!slotId) return;
  const bundle = slotBundleKeys(slotId);
  const copyOpts = { scheduleSlotSync: false, clearDestIfMissing: false };
  copyStorageKey(bundle.career, SAVE_KEYS.career, copyOpts);
  copyStorageKey(bundle.season, SAVE_KEYS.season, copyOpts);
  copyStorageKey(bundle.playerHistory, SAVE_KEYS.playerHistory, copyOpts);
  copyStorageKey(bundle.liveMatch, SAVE_KEYS.liveMatch, copyOpts);
}

/** Se o ativo está mais fresco que o bundle, espelha ativo→bundle antes de hidratar. */
export function preferActiveOverStaleBundle(slotId) {
  const bundle = slotBundleKeys(slotId);
  const activeSeason = readJson(SAVE_KEYS.season, null);
  const bundleSeason = readJson(bundle.season, null);
  if (!activeSeason || isLocalStorageCheckpoint(activeSeason)) return false;
  if (!bundleSeason || isLocalStorageCheckpoint(bundleSeason)) {
    copyActiveKeysToBundle(slotId, { force: true });
    return true;
  }
  const winner = pickNewerSave(activeSeason, bundleSeason, SAVE_KEYS.season);
  if (winner === activeSeason) {
    copyActiveKeysToBundle(slotId, { force: true });
    return true;
  }
  return false;
}

function queueBundleCloudSync(slotId) {
  if (!isCloudStorageActive() || !slotId) return;
  const bundle = slotBundleKeys(slotId);
  Object.values(bundle).forEach(key => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) queueCloudSave(key, JSON.parse(raw));
    } catch {
      /* ignore corrupt */
    }
  });
}

let slotSyncTimer = 0;
let pendingSlotSyncId = null;

export function cancelPendingSlotSync() {
  if (slotSyncTimer) window.clearTimeout(slotSyncTimer);
  slotSyncTimer = 0;
  pendingSlotSyncId = null;
}

/** Flush debounced slot sync immediately (e.g. before slot switch or tab close). */
export function flushPendingSlotSync() {
  if (!slotSyncTimer && !pendingSlotSyncId) return false;
  if (slotSyncTimer) {
    window.clearTimeout(slotSyncTimer);
    slotSyncTimer = 0;
  }
  const slotId = pendingSlotSyncId;
  pendingSlotSyncId = null;
  if (slotId) return syncActiveSlotFromCache({ slotId });
  return syncActiveSlotFromCache();
}

/** Debounce — espelha cache ativo → bundle + índice. */
export function scheduleActiveSlotSync({ name } = {}) {
  if (getStoragePressure().level === 'critical') return;
  const slotId = getActiveSlotId();
  if (!slotId) return;
  pendingSlotSyncId = slotId;
  if (slotSyncTimer) window.clearTimeout(slotSyncTimer);
  slotSyncTimer = window.setTimeout(() => {
    slotSyncTimer = 0;
    const capturedId = pendingSlotSyncId;
    pendingSlotSyncId = null;
    if (capturedId) syncActiveSlotFromCache({ slotId: capturedId });
  }, 400);
}

export function syncActiveSlotFromCache({ name, slotId: forcedSlotId } = {}) {
  const slotId = forcedSlotId || getActiveSlotId();
  if (!slotId) return false;
  copyActiveKeysToBundle(slotId, { force: true });
  const manifest = buildSlotManifest(slotId, { name });
  upsertSlotManifest(manifest);
  queueBundleCloudSync(slotId);
  return true;
}

export function hydrateSlot(slotId, { allowSeedFromActive = true } = {}) {
  if (!slotId) return false;
  const currentId = getActiveSlotId();
  if (currentId && currentId !== slotId) {
    flushPendingSlotSync();
    syncActiveSlotFromCache({ slotId: currentId });
  } else {
    cancelPendingSlotSync();
  }
  setActiveSlotId(slotId);
  const bundle = slotBundleKeys(slotId);
  const hasBundleCareer = !!readJson(bundle.career, null);
  // Slot novo/vazio: não copiar carreira ativa (pode ser save antigo da nuvem).
  if (!hasBundleCareer && allowSeedFromActive) {
    const activeCareer = readJson(SAVE_KEYS.career, null);
    if (activeCareer && !isLocalStorageCheckpoint(activeCareer) && !activeCareer.freshWorld) {
      copyActiveKeysToBundle(slotId, { force: true });
    }
  } else if (!hasBundleCareer) {
    /* leave empty — nova carreira */
  }
  preferActiveOverStaleBundle(slotId);
  copyBundleToActiveKeys(slotId);
  return true;
}

export function createNewSlot({ name } = {}) {
  if (!canCreateSlot()) return null;
  const slotId = newSlotId();
  const manifest = {
    id: slotId,
    name: name || 'Nova carreira',
    clubName: '—',
    division: '—',
    seasonYear: null,
    managerName: '',
    currentRound: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const index = readCareerIndex();
  index.slots.push(manifest);
  index.activeSlotId = slotId;
  writeCareerIndex(index);
  setActiveSlotId(slotId);
  return slotId;
}

function localKeysForSlot(slotId) {
  const prefix = `brfut-slot-${String(slotId || '').trim()}-`;
  const keys = new Set(Object.values(slotBundleKeys(slotId)));
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(prefix)) keys.add(key);
    }
  } catch {
    /* best effort */
  }
  return [...keys];
}

/** Exclui uma carreira do índice, armazenamento local e nuvem. */
export async function deleteCareerSlot(slotId) {
  const id = String(slotId || '').trim();
  if (!id) return { ok: false, reason: 'invalid_slot' };
  const index = readCareerIndex();
  const slot = index.slots.find(entry => entry.id === id);
  if (!slot) return { ok: false, reason: 'slot_not_found' };

  const wasActive = getActiveSlotId() === id || index.activeSlotId === id;
  if (wasActive) cancelPendingSlotSync();
  const slotKeys = localKeysForSlot(id);
  const activeKeys = wasActive
    ? [SAVE_KEYS.career, SAVE_KEYS.season, SAVE_KEYS.playerHistory, SAVE_KEYS.liveMatch]
    : [];
  const deleteKeys = [...new Set([...slotKeys, ...activeKeys])];

  deleteKeys.forEach(key => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* best effort */
    }
  });

  index.slots = index.slots.filter(entry => entry.id !== id);
  if (wasActive) {
    const next = [...index.slots].sort(
      (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime(),
    )[0];
    index.activeSlotId = next?.id || null;
    try {
      sessionStorage.removeItem(ACTIVE_SLOT_SESSION_KEY);
    } catch {
      /* ignore */
    }
  }
  writeCareerIndex(index);

  if (isCloudStorageActive()) {
    const cloudResult = await flushCloudDeletesAsync(deleteKeys);
    return { ok: cloudResult.ok, slot, cloud: cloudResult.ok };
  }
  deleteKeys.forEach(key => queueCloudDelete(key));
  return { ok: true, slot, cloud: false };
}

/** Save único legado → primeiro slot (boot). */
export function migrateLegacySingleSaveToSlots() {
  const index = readCareerIndex();
  if (index.slots.length > 0) return index;

  const career = readJson(SAVE_KEYS.career);
  if (!career) return index;

  const season = readJson(SAVE_KEYS.season);
  const slotId = newSlotId();
  const manifest = buildSlotManifest(slotId, { career, season });
  copyActiveKeysToBundle(slotId);

  index.slots.push(manifest);
  index.activeSlotId = slotId;
  writeCareerIndex(index);
  setActiveSlotId(slotId);
  return index;
}

export function slotLimitLabel() {
  const count = readCareerIndex().slots.length;
  return `${count}/${CAREER_SLOT_LIMIT} saves`;
}

export function formatSlotDivision(division) {
  if (!division || division === '—') return '—';
  return `Série ${division}`;
}

export function formatSlotUpdatedAt(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}
