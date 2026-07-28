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

function pickNewerSeasonSave(localValue, remoteValue) {
  const localRound = Number(localValue.currentRound) || 0;
  const remoteRound = Number(remoteValue.currentRound) || 0;
  if (localRound !== remoteRound) {
    const localCal = Date.parse(localValue.careerCalendarDate || '') || 0;
    const remoteCal = Date.parse(remoteValue.careerCalendarDate || '') || 0;
    if (localCal > 0 && remoteCal > 0 && localCal !== remoteCal) {
      return localCal > remoteCal ? localValue : remoteValue;
    }
    return localRound > remoteRound ? localValue : remoteValue;
  }
  return null;
}

export function pickNewerSave(localValue, remoteValue, key, remoteEnvelopeAt = 0) {
  if (!localValue) return remoteValue ?? null;
  if (!remoteValue) return localValue;

  if (key === SAVE_KEYS.season) {
    const seasonWinner = pickNewerSeasonSave(localValue, remoteValue);
    if (seasonWinner) return seasonWinner;
  }

  const localScore = saveFreshness(localValue, key);
  const remoteValueScore = saveFreshness(remoteValue, key);
  const remoteScore = Math.max(remoteValueScore, Number(remoteEnvelopeAt) || 0);
  // Envelope da API não pode vencer save local com updatedAt mais recente no payload.
  if (remoteScore > localScore && remoteValueScore < localScore) return localValue;
  if (remoteScore > localScore) return remoteValue;
  return localValue;
}

export function stampSyncableSave(key, value) {
  if (key !== SAVE_KEYS.career && key !== SAVE_KEYS.season) return value;
  if (!value || typeof value !== 'object') return value;
  return { ...value, updatedAt: new Date().toISOString() };
}
