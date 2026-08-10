import { SAVE_KEYS, LEGACY_SAVE_KEYS, SAVE_VERSION, isSlotBundleKey } from './constants.js';

export function isCareerSaveKey(key = '') {
  const value = String(key || '');
  return value === SAVE_KEYS.career
    || value === LEGACY_SAVE_KEYS.career
    || (isSlotBundleKey(value) && value.endsWith('-career'));
}

export function isCompatibleCareerPayload(value, minVersion = SAVE_VERSION.career) {
  return !!value
    && typeof value === 'object'
    && Number.isInteger(value.version)
    && value.version >= minVersion;
}

export function containsObsoleteCareerEntries(entries = {}) {
  return Object.entries(entries || {}).some(([key, entry]) => {
    if (!isCareerSaveKey(key)) return false;
    const value = entry && typeof entry === 'object' && 'value' in entry ? entry.value : entry;
    return !isCompatibleCareerPayload(value);
  });
}
