/**
 * Checkpoints locais minimos apos confirmacao da VPS.
 * O estado completo permanece na API; o browser guarda apenas identidade e
 * progresso suficiente para localizar/hidratar a carreira na proxima abertura.
 */
import { SAVE_KEYS, SAVE_VERSION } from './constants.js';
import { invalidateStoragePressureCache } from './save.js';

export const LOCAL_CHECKPOINT_FLAG = '_localCheckpoint';
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
  return stampCheckpoint({
    version: Number.isInteger(career.version) ? career.version : SAVE_VERSION.career,
    seed: career.seed,
    clubName: career.clubName,
    managerName: career.managerName,
    division: career.division,
    season: career.season,
    userUf: career.userUf,
    nationalTeamCode: career.nationalTeamCode ?? null,
    preferences: career.preferences ?? null,
    saveRevision: Number(career.saveRevision) || 0,
    updatedAt: career.updatedAt || new Date().toISOString(),
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
    userNationalTeamCode: season.userNationalTeamCode ?? null,
    nationalTeamOfferState: season.nationalTeamOfferState ?? null,
    nationalTeamOffersSentYear: season.nationalTeamOffersSentYear ?? null,
    saveRevision: Number(season.saveRevision) || 0,
    updatedAt: season.updatedAt || new Date().toISOString(),
  });
}

export function buildPlayerHistoryLocalCheckpoint(history) {
  return stampCheckpoint({
    version: history?.version ?? 1,
    season: history?.season ?? null,
    players: {},
    matchLogs: [],
    seasonArchives: [],
    saveRevision: Number(history?.saveRevision) || 0,
    updatedAt: history?.updatedAt || new Date().toISOString(),
  });
}

function logicalKind(key) {
  const normalized = String(key || '');
  if (normalized === SAVE_KEYS.career || normalized.endsWith('-career')) return 'career';
  if (normalized === SAVE_KEYS.season || normalized.endsWith('-season')) return 'season';
  if (normalized === SAVE_KEYS.playerHistory || normalized.endsWith('-player-history')) return 'playerHistory';
  if (normalized === SAVE_KEYS.liveMatch || normalized.endsWith('-live-match')) return 'liveMatch';
  return null;
}

export function buildLocalCheckpointForKey(key, fullValue) {
  const kind = logicalKind(key);
  if (kind === 'career') return buildCareerLocalCheckpoint(fullValue);
  if (kind === 'season') return buildSeasonLocalCheckpoint(fullValue);
  if (kind === 'playerHistory') return buildPlayerHistoryLocalCheckpoint(fullValue);
  if (kind === 'liveMatch') return null;
  return undefined;
}

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

/** So deve ser chamado depois de a API confirmar o mesmo payload integral. */
export function applyLocalCheckpointTrim(key, fullValue) {
  if (!isCloudLocalTrimEnabled()) return false;
  // Bundles de slot são a cópia local jogável. Apenas as chaves canônicas
  // podem virar checkpoint depois que a API confirma o payload integral.
  if (!CLOUD_OFFLOAD_KEYS.has(key)) return false;
  const checkpoint = buildLocalCheckpointForKey(key, fullValue);
  if (checkpoint === undefined) return false;
  try {
    if (checkpoint === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(checkpoint));
    invalidateStoragePressureCache();
    return true;
  } catch {
    return false;
  }
}

export function cloudPayloadForKey(_key, value) {
  return value;
}
