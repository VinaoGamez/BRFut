/**
 * Checkpoints locais mínimos após sync na VPS — libera cota do localStorage.
 * Save completo permanece na nuvem; local só guarda identidade da carreira.
 */
import { SAVE_KEYS } from './constants.js';
import { slimCareerForCloudUpload, slimPlayerHistoryForCloudUpload } from './cloud-save-payload.js';
import { invalidateStoragePressureCache } from './save.js';

export const LOCAL_CHECKPOINT_FLAG = '_localCheckpoint';

/** Chaves cujo blob completo pode sair do localStorage após sync na nuvem. */
export const CLOUD_OFFLOAD_KEYS = new Set([
  SAVE_KEYS.career,
  SAVE_KEYS.season,
  SAVE_KEYS.playerHistory,
  SAVE_KEYS.liveMatch,
]);

let cloudLocalTrimEnabled = false;

export function setCloudLocalTrimEnabled(enabled) {
  cloudLocalTrimEnabled = !!enabled;
}

export function isCloudLocalTrimEnabled() {
  return cloudLocalTrimEnabled;
}

export function isLocalStorageCheckpoint(value) {
  return !!(value && typeof value === 'object' && value[LOCAL_CHECKPOINT_FLAG]);
}

function stampCheckpoint(value) {
  return {
    ...value,
    [LOCAL_CHECKPOINT_FLAG]: true,
    _checkpointAt: new Date().toISOString(),
  };
}

export function buildCareerLocalCheckpoint(career) {
  if (!career || typeof career !== 'object') return career;
  const slim = slimCareerForCloudUpload(career);
  const userClub = career.clubName || slim.clubName;
  let userRoster = Array.isArray(career.userRoster) ? career.userRoster.slice(0, 22) : [];
  if (!userRoster.length && userClub && career.worldRosters?.[userClub]) {
    userRoster = career.worldRosters[userClub].slice(0, 22);
  }
  return stampCheckpoint({
    ...slim,
    clubName: userClub || slim.clubName,
    userRoster,
    nationalTeamCode: career.nationalTeamCode ?? slim.nationalTeamCode ?? null,
    preferences: career.preferences ?? slim.preferences ?? null,
    updatedAt: career.updatedAt || slim.updatedAt || new Date().toISOString(),
  });
}

export function buildSeasonLocalCheckpoint(season) {
  if (!season || typeof season !== 'object') return season;
  return stampCheckpoint({
    seed: season.seed,
    userClubName: season.userClubName,
    currentRound: season.currentRound,
    careerCalendarDate: season.careerCalendarDate,
    stateLeagueProgressRound: season.stateLeagueProgressRound,
    nationalTeamOfferState: season.nationalTeamOfferState ?? null,
    nationalTeamOffersSentYear: season.nationalTeamOffersSentYear ?? null,
    userNationalTeamCode: season.userNationalTeamCode ?? null,
    updatedAt: season.updatedAt || new Date().toISOString(),
  });
}

export function buildPlayerHistoryLocalCheckpoint(history) {
  if (!history || typeof history !== 'object') {
    return stampCheckpoint({
      version: 1,
      season: null,
      players: {},
      matchLogs: [],
      seasonArchives: [],
      updatedAt: new Date().toISOString(),
    });
  }
  return stampCheckpoint({
    version: history.version ?? 1,
    season: history.season ?? null,
    players: {},
    matchLogs: [],
    seasonArchives: [],
    updatedAt: history.updatedAt || new Date().toISOString(),
  });
}

export function buildLocalCheckpointForKey(key, fullValue) {
  if (key === SAVE_KEYS.career) return buildCareerLocalCheckpoint(fullValue);
  if (key === SAVE_KEYS.season) return buildSeasonLocalCheckpoint(fullValue);
  if (key === SAVE_KEYS.playerHistory) return buildPlayerHistoryLocalCheckpoint(fullValue);
  if (key === SAVE_KEYS.liveMatch) return null;
  return null;
}

/** Grava checkpoint no localStorage sem reenfileirar sync na nuvem. */
export function writeLocalCheckpoint(key, checkpoint) {
  if (!key || checkpoint == null) return false;
  try {
    localStorage.setItem(key, JSON.stringify(checkpoint));
    invalidateStoragePressureCache();
    return true;
  } catch {
    return false;
  }
}

/**
 * Após PUT bem-sucedido na VPS, substitui o save local completo por checkpoint.
 * @returns {boolean} true se checkpoint gravado
 */
export function applyLocalCheckpointTrim(key, fullValue) {
  if (!isCloudLocalTrimEnabled() || !CLOUD_OFFLOAD_KEYS.has(key)) return false;
  if (key === SAVE_KEYS.liveMatch) {
    try {
      localStorage.removeItem(SAVE_KEYS.liveMatch);
      invalidateStoragePressureCache();
      return true;
    } catch {
      return false;
    }
  }
  const checkpoint = buildLocalCheckpointForKey(key, fullValue);
  if (!checkpoint) return false;
  return writeLocalCheckpoint(key, checkpoint);
}

/** Payload enviado à nuvem (referência para testes). */
export function cloudPayloadForKey(key, value) {
  if (key === SAVE_KEYS.playerHistory) return slimPlayerHistoryForCloudUpload(value);
  return value;
}
