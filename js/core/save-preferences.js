/**
 * Preferências de save e ritmo — persistidas na carreira (sync na nuvem).
 */
import { SAVE_KEYS } from './constants.js';

export const AUTOSAVE_MODES = {
  round: 'round',
  every3: 'every3',
  manual: 'manual',
};

const AUTOSAVE_LABELS = {
  round: 'Salvar a cada rodada',
  every3: 'Salvar a cada 3 jogos',
  manual: 'Não salvar automaticamente',
};

const AUTOSAVE_STORAGE_KEY = 'brfut-autosave-mode';
const DEFAULT_AUTOSAVE = AUTOSAVE_MODES.round;
const DEFAULT_PACE = 'standard';

export function autosaveModeLabel(mode) {
  return AUTOSAVE_LABELS[mode] || AUTOSAVE_LABELS[DEFAULT_AUTOSAVE];
}

export function normalizeAutosaveMode(mode) {
  return AUTOSAVE_MODES[mode] ? mode : DEFAULT_AUTOSAVE;
}

export function getAutosaveMode() {
  try {
    const stored = localStorage.getItem(AUTOSAVE_STORAGE_KEY);
    return normalizeAutosaveMode(stored);
  } catch {
    return DEFAULT_AUTOSAVE;
  }
}

export function setAutosaveMode(mode) {
  const normalized = normalizeAutosaveMode(mode);
  try {
    localStorage.setItem(AUTOSAVE_STORAGE_KEY, normalized);
  } catch {
    /* ignore */
  }
  return normalized;
}

export function readCareerPreferences(career) {
  const prefs = career?.preferences && typeof career.preferences === 'object' ? career.preferences : {};
  return {
    autosave: normalizeAutosaveMode(prefs.autosave),
    pace: typeof prefs.pace === 'string' && prefs.pace ? prefs.pace : DEFAULT_PACE,
    gamesSinceAutosave: Number.isFinite(Number(prefs.gamesSinceAutosave))
      ? Math.max(0, Math.floor(Number(prefs.gamesSinceAutosave)))
      : 0,
  };
}

/** Hidrata localStorage a partir do save da carreira. */
export function applyCareerPreferences(career) {
  const prefs = readCareerPreferences(career);
  setAutosaveMode(prefs.autosave);
  try {
    localStorage.setItem(SAVE_KEYS.pace, prefs.pace);
  } catch {
    /* ignore */
  }
  return prefs;
}

/** Atualiza objeto de carreira in-memory com preferências atuais. */
export function mergePreferencesIntoCareer(career, patch = {}) {
  if (!career || typeof career !== 'object') return career;
  const current = readCareerPreferences(career);
  const next = {
    autosave: normalizeAutosaveMode(patch.autosave ?? current.autosave),
    pace: typeof patch.pace === 'string' && patch.pace ? patch.pace : current.pace,
    gamesSinceAutosave: Number.isFinite(Number(patch.gamesSinceAutosave))
      ? Math.max(0, Math.floor(Number(patch.gamesSinceAutosave)))
      : current.gamesSinceAutosave,
  };
  career.preferences = next;
  setAutosaveMode(next.autosave);
  try {
    localStorage.setItem(SAVE_KEYS.pace, next.pace);
  } catch {
    /* ignore */
  }
  return career;
}

export function listAutosaveOptions() {
  return Object.entries(AUTOSAVE_LABELS).map(([value, label]) => ({ value, label }));
}
