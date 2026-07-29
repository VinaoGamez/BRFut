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

/** Maior rodada estadual concluída ou currentRound da divisão — progresso real da carreira. */
export function maxStateLeagueRound(season) {
  if (!season?.stateLeagues?.competitions) return 0;
  let max = 0;
  Object.values(season.stateLeagues.competitions).forEach(divisions => {
    (divisions || []).forEach(division => {
      const cr = Number(division.currentRound) || 0;
      if (cr > max) max = cr;
      (division.fixtures || []).forEach((round, roundIndex) => {
        const roundNo = Number(round?.[0]?.round) || roundIndex + 1;
        (round || []).forEach(game => {
          const played = !!(game?.completed || game?.played || game?.homeGoals != null);
          if (played) max = Math.max(max, Number(game.round) || roundNo);
        });
        const hasOpen = (round || []).some(
          game => game && !game.completed && game.homeGoals == null && game.awayGoals == null,
        );
        if (hasOpen) max = Math.max(max, roundNo - 1);
      });
    });
  });
  return max;
}

function seasonPayloadWeight(value) {
  try {
    return JSON.stringify(value).length;
  } catch {
    return 0;
  }
}

function pickNewerSeasonSave(localValue, remoteValue) {
  const localCal = seasonCalendarTs(localValue);
  const remoteCal = seasonCalendarTs(remoteValue);
  if (localCal !== remoteCal) {
    return localCal > remoteCal ? localValue : remoteValue;
  }
  const localState = maxStateLeagueRound(localValue);
  const remoteState = maxStateLeagueRound(remoteValue);
  if (localState !== remoteState) {
    return localState > remoteState ? localValue : remoteValue;
  }
  const localRound = Number(localValue.currentRound) || 0;
  const remoteRound = Number(remoteValue.currentRound) || 0;
  if (localRound !== remoteRound) {
    return localRound > remoteRound ? localValue : remoteValue;
  }
  // Mesmo progresso: nunca substituir save completo local por checkpoint enxuto da nuvem.
  const localWeight = seasonPayloadWeight(localValue);
  const remoteWeight = seasonPayloadWeight(remoteValue);
  if (localWeight > remoteWeight + 4096) return localValue;
  if (remoteWeight > localWeight + 4096) return remoteValue;
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
