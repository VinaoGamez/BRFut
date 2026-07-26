/**
 * Persistência de carreira — bloqueio de race no Novo Jogo, debounce de temporada, sync de elencos.
 */

import { SAVE_KEYS } from '../core/constants.js';
import {
  MEMORY_LIMITS,
  writeJson,
  markSkipPersistOnce,
  consumeSkipPersistOnce,
  pruneInjuryHistory,
} from '../core/save.js';
import { flushCloudSync } from '../core/storage-api.js';

export function createCareerPersistence({
  getSavedNewGame,
  getClubs,
  getUserClub,
  collectWorldRosters,
} = {}) {
  const careerReset = { blockWrites: false };
  let persistSeasonTimer = null;
  let skipPersistOnUnload = false;
  /** @type {() => boolean} */
  let writeSeasonSave = () => false;
  /** @type {() => void} */
  let flushLiveMatchPersist = () => {};

  const persistCareer = payload => {
    if (careerReset.blockWrites) return true;
    return writeJson(SAVE_KEYS.career, payload);
  };

  const prepareForNewCareer = () => {
    careerReset.blockWrites = true;
    skipPersistOnUnload = true;
    markSkipPersistOnce();
    if (persistSeasonTimer) {
      clearTimeout(persistSeasonTimer);
      persistSeasonTimer = null;
    }
  };

  const persistSeason = (immediate = false) => {
    if (!getSavedNewGame?.()) return;
    if (immediate === true) {
      if (persistSeasonTimer) {
        clearTimeout(persistSeasonTimer);
        persistSeasonTimer = null;
      }
      writeSeasonSave();
      return;
    }
    if (persistSeasonTimer) clearTimeout(persistSeasonTimer);
    persistSeasonTimer = setTimeout(() => {
      persistSeasonTimer = null;
      writeSeasonSave();
    }, MEMORY_LIMITS.persistDebounceMs);
  };

  /** Grava temporada + carreira imediatamente após avanço de rodada. */
  const persistAfterRoundAdvance = () => {
    if (!getSavedNewGame?.()) return;
    persistSeason(true);
    syncCareerRosters();
    flushCloudSync();
  };

  const syncCareerRosters = () => {
    const savedNewGame = getSavedNewGame?.();
    const clubs = getClubs?.();
    const userClub = getUserClub?.();
    if (!savedNewGame || !clubs?.[userClub]) return;
    savedNewGame.userRoster = clubs[userClub].roster.map(player => ({
      ...player,
      injuryHistory: pruneInjuryHistory(player.injuryHistory),
    }));
    savedNewGame.worldRosters = collectWorldRosters?.(clubs, {
      skipClub: userClub,
      merge: savedNewGame.worldRosters || {},
    }) || {};
    persistCareer({ ...savedNewGame });
  };

  const bindWriteSeasonSave = fn => {
    writeSeasonSave = typeof fn === 'function' ? fn : () => false;
  };

  const bindFlushLiveMatchPersist = fn => {
    flushLiveMatchPersist = typeof fn === 'function' ? fn : () => {};
  };

  const bindBeforeUnloadPersist = () => {
    if (typeof window === 'undefined') return;
    window.addEventListener('beforeunload', () => {
      let skipForNewGame = false;
      try {
        if (sessionStorage.getItem('matchday-skip-persist-once')) {
          sessionStorage.removeItem('matchday-skip-persist-once');
          skipForNewGame = true;
        }
      } catch {
        /* ignore */
      }
      if (skipPersistOnUnload || skipForNewGame) return;
      try {
        flushLiveMatchPersist();
      } catch {
        /* ignore */
      }
      if (getSavedNewGame?.()) persistSeason(true);
      flushCloudSync({ urgent: true });
    });
  };

  return {
    consumeBootSkip: consumeSkipPersistOnce,
    persistCareer,
    prepareForNewCareer,
    persistSeason,
    persistAfterRoundAdvance,
    syncCareerRosters,
    bindWriteSeasonSave,
    bindFlushLiveMatchPersist,
    bindBeforeUnloadPersist,
    isWriteBlocked: () => careerReset.blockWrites,
  };
}
