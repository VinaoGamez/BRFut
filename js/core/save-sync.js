import { SAVE_KEYS } from './constants.js';
import { parseSavedCalendarDate } from '../engine/career-calendar.js';

/** Timestamp comparável para resolver conflito local vs nuvem. */
export function saveFreshness(value, key = '') {
  if (!value || typeof value !== 'object') return 0;
  const ts = Date.parse(value.updatedAt || value.savedAt || '');
  if (Number.isFinite(ts) && ts > 0) return ts;
  if (key === SAVE_KEYS.season) {
    const calTs = seasonCalendarTs(value);
    if (calTs > 0) return calTs;
    const round = Number(value.currentRound);
    if (Number.isFinite(round) && round > 0) return round * 86_400_000;
  }
  return 0;
}

function seasonCalendarTs(value) {
  const date = parseSavedCalendarDate(value?.careerCalendarDate, null);
  return date ? date.getTime() : 0;
}

function pickNewerSeasonSave(localValue, remoteValue) {
  const localCal = seasonCalendarTs(localValue);
  const remoteCal = seasonCalendarTs(remoteValue);
  if (localCal !== remoteCal) {
    return localCal > remoteCal ? localValue : remoteValue;
  }
  const localRound = Number(localValue.currentRound) || 0;
  const remoteRound = Number(remoteValue.currentRound) || 0;
  if (localRound !== remoteRound) {
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
