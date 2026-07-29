/**
 * Persistência local (+ nuvem) de arquivos de temporada por ano.
 */
import {
  ACTIVE_SLOT_SESSION_KEY,
} from './constants.js';
import { readJson, writeJson } from './save.js';
import { isCloudStorageActive, queueCloudSave } from './storage-api.js';
import {
  buildSeasonArchive,
  isValidSeasonArchive,
  seasonIndexEntryFromArchive,
  upsertSeasonIndex,
} from '../engine/season-archive.js';

export const LOCAL_ARCHIVE_KEEP = 8;

export function seasonArchiveStorageKey(year, slotId = null) {
  const y = Number(year);
  if (!Number.isFinite(y)) return null;
  const slot = String(slotId || '').trim();
  if (slot) return `brfut-slot-${slot}-season-archive-${y}`;
  return `brfut-season-archive-${y}`;
}

export function isSeasonArchiveKey(key) {
  return /^brfut-(?:slot-[a-zA-Z0-9-]+-)?season-archive-\d{4}$/.test(String(key || ''));
}

function readActiveSlotId() {
  try {
    return sessionStorage.getItem(ACTIVE_SLOT_SESSION_KEY) || localStorage.getItem(ACTIVE_SLOT_SESSION_KEY) || null;
  } catch {
    return null;
  }
}

function listLocalArchiveKeys(slotId = null) {
  const keys = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!isSeasonArchiveKey(key)) continue;
      if (slotId) {
        if (!key.includes(`brfut-slot-${slotId}-season-archive-`)) continue;
      } else if (key.includes('-slot-')) {
        continue;
      }
      keys.push(key);
    }
  } catch {
    /* ignore */
  }
  return keys;
}

function yearFromArchiveKey(key) {
  const match = String(key || '').match(/season-archive-(\d{4})$/);
  return match ? Number(match[1]) : null;
}

function pruneLocalArchives(slotId, keepYears) {
  const keep = new Set((keepYears || []).map(Number));
  listLocalArchiveKeys(slotId).forEach(key => {
    const year = yearFromArchiveKey(key);
    if (year != null && !keep.has(year)) {
      try {
        localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    }
  });
  // Also prune active (non-slot) mirrors for the same years when using slots
  if (slotId) {
    listLocalArchiveKeys(null).forEach(key => {
      const year = yearFromArchiveKey(key);
      if (year != null && !keep.has(year)) {
        try {
          localStorage.removeItem(key);
        } catch {
          /* ignore */
        }
      }
    });
  }
}

/**
 * Grava archive local (+ fila nuvem) e devolve entrada de índice.
 */
export function writeSeasonArchive(archive, { slotId = null, career = null } = {}) {
  if (!isValidSeasonArchive(archive)) return null;
  const year = Number(archive.careerSeason);
  const activeSlot = slotId || readActiveSlotId();
  const key = seasonArchiveStorageKey(year, activeSlot);
  const activeKey = seasonArchiveStorageKey(year, null);
  if (!key) return null;

  const okSlot = writeJson(key, archive);
  // Espelho ativo facilita load sem slot em sessões antigas.
  if (activeKey && activeKey !== key) writeJson(activeKey, archive);

  if (okSlot && isCloudStorageActive()) {
    queueCloudSave(key, archive);
    if (activeKey && activeKey !== key) queueCloudSave(activeKey, archive);
  }

  let bytes = 0;
  try {
    bytes = JSON.stringify(archive).length;
  } catch {
    bytes = 0;
  }

  const entry = seasonIndexEntryFromArchive(archive, { archiveKey: key, bytes });
  const nextIndex = upsertSeasonIndex(career?.seasonIndex, entry, { maxEntries: 20 });
  const keepYears = nextIndex.map(item => Number(item.year)).slice(-LOCAL_ARCHIVE_KEEP);
  pruneLocalArchives(activeSlot, keepYears);

  return { archive, entry, key, seasonIndex: nextIndex };
}

export function loadSeasonArchive(year, { slotId = null, seed = null } = {}) {
  const y = Number(year);
  if (!Number.isFinite(y)) return null;
  const activeSlot = slotId || readActiveSlotId();
  const keys = [
    seasonArchiveStorageKey(y, activeSlot),
    seasonArchiveStorageKey(y, null),
  ].filter(Boolean);

  for (const key of keys) {
    const raw = readJson(key, null);
    if (isValidSeasonArchive(raw, { seed, year: y })) return raw;
  }
  return null;
}

export function listSeasonArchiveYears({ slotId = null, seasonIndex = null } = {}) {
  const years = new Set();
  (Array.isArray(seasonIndex) ? seasonIndex : []).forEach(item => {
    const y = Number(item?.year);
    if (Number.isFinite(y)) years.add(y);
  });
  const activeSlot = slotId || readActiveSlotId();
  listLocalArchiveKeys(activeSlot).forEach(key => {
    const y = yearFromArchiveKey(key);
    if (y != null) years.add(y);
  });
  listLocalArchiveKeys(null).forEach(key => {
    const y = yearFromArchiveKey(key);
    if (y != null) years.add(y);
  });
  return [...years].sort((a, b) => a - b);
}

/**
 * Commit a partir do estado vivo (virada de temporada).
 */
export function commitSeasonArchiveFromLive(deps, meta = {}) {
  const archive = buildSeasonArchive({
    careerSeason: meta.careerSeason ?? deps.getCareerSeason?.(),
    seed: meta.seed ?? deps.getSavedNewGame?.()?.seed,
    userClub: meta.userClub ?? deps.getUserClub?.(),
    userDivision: meta.userDivision ?? deps.getUserDivision?.(),
    champions: meta.champions || null,
    nationalCompetitions: deps.getNationalCompetitions?.(),
    competitionRoundHistory: deps.getCompetitionRoundHistory?.(),
    cupCompetition: deps.getCupCompetition?.(),
    scorers: deps.getAllScorers?.() || meta.scorers,
    assistants: deps.getAllAssistants?.() || meta.assistants,
    movements: meta.movements || [],
    closedAt: meta.closedAt,
  });
  if (!archive) return null;

  const career = deps.getSavedNewGame?.() || null;
  const result = writeSeasonArchive(archive, { career });
  if (result?.seasonIndex && career) {
    career.seasonIndex = result.seasonIndex;
  }
  return result;
}
