/** Reduz payloads antes do PUT na nuvem (limite nginx ~2 MB). */
import { SAVE_KEYS } from './constants.js';

const CLOUD_PAYLOAD_TARGET = 900_000;

function payloadChars(value) {
  try {
    return JSON.stringify(value).length;
  } catch {
    return Infinity;
  }
}

export function slimCareerForCloudUpload(career) {
  if (!career || typeof career !== 'object') return career;
  let next = { ...career };
  if (payloadChars(next) <= CLOUD_PAYLOAD_TARGET) return next;

  next = { ...next, worldRosters: {} };
  if (payloadChars(next) <= CLOUD_PAYLOAD_TARGET) return next;

  if (Array.isArray(next.userRoster) && next.userRoster.length > 28) {
    next = { ...next, userRoster: next.userRoster.slice(0, 28) };
  }
  return next;
}

export function slimSeasonForCloudUpload(season) {
  if (!season || typeof season !== 'object') return season;
  let next = { ...season };
  if (payloadChars(next) <= CLOUD_PAYLOAD_TARGET) return next;

  next = {
    ...next,
    careerMessages: (next.careerMessages || []).slice(0, 40),
    seasonTransferDeals: [],
    userSeasonCrowds: [],
    pendingTransferOffers: Array.isArray(next.pendingTransferOffers)
      ? next.pendingTransferOffers.slice(0, 12)
      : [],
  };
  if (payloadChars(next) <= CLOUD_PAYLOAD_TARGET) return next;

  next = {
    ...next,
    competitionRoundHistory: {},
    seasonRoundHistory: Array.isArray(next.seasonRoundHistory)
      ? next.seasonRoundHistory.slice(-8)
      : [],
    nationalFixtures: { A: [], B: [], C: [], D: [] },
    playerDevelopment: next.playerDevelopment
      ? { season: next.playerDevelopment.season, entries: (next.playerDevelopment.entries || []).slice(-40) }
      : null,
  };
  if (payloadChars(next) <= CLOUD_PAYLOAD_TARGET) return next;

  return {
    ...next,
    stateLeagues: next.stateLeagues
      ? { ...next.stateLeagues, historyByUf: {}, results: {} }
      : null,
    managerRanking: null,
    userBudgetLedger: Array.isArray(next.userBudgetLedger) ? next.userBudgetLedger.slice(-30) : [],
  };
}

export function prepareCloudSavePayload(key, value) {
  if (key === SAVE_KEYS.career) return slimCareerForCloudUpload(value);
  if (key === SAVE_KEYS.season) return slimSeasonForCloudUpload(value);
  return value;
}

export function estimateCloudBodyChars(key, value) {
  return payloadChars({ value: prepareCloudSavePayload(key, value) });
}

export function rawPayloadChars(value) {
  return payloadChars(value);
}
