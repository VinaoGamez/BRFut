import { SAVE_KEYS } from './constants.js';

/** Timestamp comparável para resolver conflito local vs nuvem. */
export function saveFreshness(value, key = '') {
  if (!value || typeof value !== 'object') return 0;
  const ts = Date.parse(value.updatedAt || value.savedAt || '');
  if (Number.isFinite(ts) && ts > 0) return ts;
  if (key === SAVE_KEYS.season) {
    const round = Number(value.currentRound);
    if (Number.isFinite(round) && round > 0) return round * 86_400_000;
  }
  return 0;
}

export function pickNewerSave(localValue, remoteValue, key, remoteEnvelopeAt = 0) {
  if (!localValue) return remoteValue ?? null;
  if (!remoteValue) return localValue;
  const localScore = saveFreshness(localValue, key);
  const remoteScore = Math.max(saveFreshness(remoteValue, key), Number(remoteEnvelopeAt) || 0);
  if (remoteScore > localScore) return remoteValue;
  return localValue;
}

export function stampSyncableSave(key, value) {
  if (key !== SAVE_KEYS.career && key !== SAVE_KEYS.season) return value;
  if (!value || typeof value !== 'object') return value;
  if (value.updatedAt) return value;
  return { ...value, updatedAt: new Date().toISOString() };
}
