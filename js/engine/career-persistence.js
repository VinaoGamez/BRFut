/**
 * Persistência de carreira — bloqueio de race no Novo Jogo, debounce de temporada, sync de elencos.
 */

import { SAVE_KEYS } from '../core/constants.js';
import { appendDebugTrail } from '../core/debug-trail.js';
import {
  MEMORY_LIMITS,
  writeJsonResilient,
  markSkipPersistOnce,
  consumeSkipPersistOnce,
  consumeSkipSessionEndOnce,
  markSkipSessionEndOnce,
  pruneInjuryHistory,
  clearSessionCareerData,
  hasLocalCareerSave,
  markCareerReloadPending,
} from '../core/save.js';
import { endBrowserSession, flushCloudSync, flushCloudSyncAsync, isCloudStorageActive } from '../core/storage-api.js';
import { getAutosaveMode, mergePreferencesIntoCareer, AUTOSAVE_MODES } from '../core/save-preferences.js';
import { trimWorldRostersForQuota } from './world-rosters.js';

// #region agent log
const __dbgSave = (location, message, data, hypothesisId) => {
  fetch('http://127.0.0.1:7743/ingest/6125dd39-2579-4c29-a7c1-51d14474875e', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '25cc52' },
    body: JSON.stringify({
      sessionId: '25cc52',
      location,
      message,
      data,
      hypothesisId,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
};
// #endregion

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

  /** Evita TDZ quando persistCareer roda antes de `clubs` existir no boot. */
  const safeRuntime = () => {
    try {
      const clubs = getClubs?.();
      const userClub = getUserClub?.();
      if (!clubs || typeof clubs !== 'object') return null;
      return { clubs, userClub };
    } catch {
      return null;
    }
  };

  const persistCareer = payload => {
    if (careerReset.blockWrites) return true;
    const slimSteps = [
      data => data,
      data => {
        const runtime = safeRuntime();
        if (!runtime) return data;
        const { clubs, userClub } = runtime;
        const userDivision = clubs?.[userClub]?.division;
        if (!data?.worldRosters || !userDivision) return data;
        return {
          ...data,
          worldRosters: trimWorldRostersForQuota(data.worldRosters, clubs, {
            keepDivisions: [userDivision],
            userClub,
          }),
        };
      },
      data => {
        const runtime = safeRuntime();
        if (!runtime) return data;
        const { clubs, userClub } = runtime;
        const userDivision = clubs?.[userClub]?.division;
        if (!data?.worldRosters || !userDivision) return data;
        return {
          ...data,
          worldRosters: trimWorldRostersForQuota(data.worldRosters, clubs, {
            keepDivisions: [userDivision, 'A'],
            userClub,
          }),
        };
      },
      data => ({ ...data, worldRosters: {} }),
    ];
    const result = writeJsonResilient(SAVE_KEYS.career, payload, {
      preserveKeys: [SAVE_KEYS.career, SAVE_KEYS.season],
      slimSteps,
      proactiveSlim: false,
    });
    return result.ok;
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

  const persistSeason = (immediate = false, { flush = true } = {}) => {
    if (!getSavedNewGame?.()) return;
    if (immediate === true) {
      if (persistSeasonTimer) {
        clearTimeout(persistSeasonTimer);
        persistSeasonTimer = null;
      }
      writeSeasonSave();
      if (flush) flushCloudSync({ urgent: true });
      return;
    }
    if (persistSeasonTimer) clearTimeout(persistSeasonTimer);
    persistSeasonTimer = setTimeout(() => {
      persistSeasonTimer = null;
      writeSeasonSave();
    }, MEMORY_LIMITS.persistDebounceMs);
  };

  /** Grava temporada + carreira imediatamente após avanço de rodada (respeita preferência). */
  const persistAfterRoundAdvance = () => {
    if (!getSavedNewGame?.()) return;
    const mode = getAutosaveMode();
    // #region agent log
    __dbgSave('career-persistence.js:persistAfterRoundAdvance', 'round advance persist gate', {
      mode,
      willPersistSeason: mode === AUTOSAVE_MODES.round,
    }, 'B');
    // #endregion
    if (mode === AUTOSAVE_MODES.manual) return;
    if (mode === AUTOSAVE_MODES.every3) return;
    persistSeason(true);
    syncCareerRosters();
    flushCloudSync();
  };

  /** Conta jogos do usuário para autosave "a cada 3 jogos". */
  const notifyUserMatchPlayed = () => {
    if (!getSavedNewGame?.()) return;
    const mode = getAutosaveMode();
    if (mode !== AUTOSAVE_MODES.every3) return;
    const savedNewGame = getSavedNewGame();
    const prefs = mergePreferencesIntoCareer(savedNewGame);
    const nextCount = (prefs.gamesSinceAutosave || 0) + 1;
    // #region agent log
    __dbgSave('career-persistence.js:notifyUserMatchPlayed', 'every3 counter tick', {
      nextCount,
      willFullSave: nextCount >= 3,
    }, 'B');
    // #endregion
    if (nextCount >= 3) {
      mergePreferencesIntoCareer(savedNewGame, { gamesSinceAutosave: 0 });
      persistCareer({ ...savedNewGame });
      persistSeason(true);
      syncCareerRosters();
      flushCloudSync();
      return;
    }
    mergePreferencesIntoCareer(savedNewGame, { gamesSinceAutosave: nextCount });
    persistCareer({ ...savedNewGame });
    persistSeason(true);
  };

  /** Save manual acionado pelo jogador (Opções → SALVAR). Aguarda confirmação da nuvem quando logado. */
  const manualSaveAll = async () => {
    if (!getSavedNewGame?.()) return { ok: false, cloud: false };
    persistSeason(true, { flush: false });
    syncCareerRosters();
    const cloud = await flushCloudSyncAsync({
      forceLocalKeys: [SAVE_KEYS.career, SAVE_KEYS.season],
    });
    // #region agent log
    try {
      const seasonRaw = localStorage.getItem(SAVE_KEYS.season);
      const season = seasonRaw ? JSON.parse(seasonRaw) : null;
      sessionStorage.setItem(
        'matchday-debug-manual-save',
        JSON.stringify({
          ts: Date.now(),
          cloudOk: cloud.ok,
          cloudMode: cloud.mode,
          cloudReason: cloud.reason || null,
          cloudSynced: cloud.synced,
          cloudFailed: cloud.failed || [],
          cloudErrors: cloud.errors || [],
          careerCal: season?.careerCalendarDate || null,
          cloudActive: isCloudStorageActive(),
        }),
      );
    } catch {
      /* ignore */
    }
    __dbgSave('career-persistence.js:manualSaveAll', 'manual save finished', {
      cloudOk: cloud.ok,
      cloudMode: cloud.mode,
      cloudReason: cloud.reason,
      cloudSynced: cloud.synced,
      cloudFailed: cloud.failed || [],
      cloudErrors: cloud.errors || [],
    }, 'F');
    // #endregion
    return {
      ok: true,
      cloud: cloud.ok,
      cloudMode: cloud.mode,
      cloudReason: cloud.reason,
      cloudErrors: cloud.errors || [],
    };
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
    const flushOnExit = () => {
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
      const hadCareer = hasLocalCareerSave() || !!getSavedNewGame?.();
      let seasonOk = false;
      if (hadCareer) {
        persistSeason(true);
        seasonOk = true;
      }
      flushCloudSync({ urgent: true });
      // #region agent log
      __dbgSave('career-persistence.js:flushOnExit', 'pagehide/visibility flush', {
        hadCareer,
        seasonOk,
        autosaveMode: getAutosaveMode(),
        skipPersistOnUnload,
        skipForNewGame,
      }, 'C');
      // #endregion
    };
    window.addEventListener('beforeunload', () => {
      if (hasLocalCareerSave() || getSavedNewGame?.()) {
        markCareerReloadPending();
        markSkipSessionEndOnce();
      }
    });
    window.addEventListener('beforeunload', flushOnExit);
    // pagehide é mais confiável que beforeunload em F5 / hard refresh (desktop e mobile).
    window.addEventListener('pagehide', event => {
      if (event.persisted) return;
      const hasCareer = hasLocalCareerSave() || !!getSavedNewGame?.();
      if (hasCareer) {
        markCareerReloadPending();
        markSkipSessionEndOnce();
      }
      flushOnExit();
      const skipSession = hasCareer || consumeSkipSessionEndOnce();
      // #region agent log
      __dbgSave('career-persistence.js:pagehide', 'session end decision', {
        skipSession,
        hasCareer,
        willEndSession: !skipSession,
      }, 'A');
      appendDebugTrail('pagehide:career-persistence', { skipSession, hasCareer });
      // #endregion
      if (skipSession) return;
      endBrowserSession();
      clearSessionCareerData();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'hidden') return;
      if (skipPersistOnUnload) return;
      try {
        flushLiveMatchPersist();
      } catch {
        /* ignore */
      }
      if (getSavedNewGame?.()) persistSeason(true);
      flushCloudSync({ urgent: true });
    });
  };

  const bindPeriodicAutosave = () => {
    /* autosave periódico desativado — preferência do jogador (rodada / 3 jogos / manual). */
  };

  const setSkipPersistOnUnload = () => {
    skipPersistOnUnload = true;
  };

  return {
    consumeBootSkip: consumeSkipPersistOnce,
    persistCareer,
    prepareForNewCareer,
    persistSeason,
    persistAfterRoundAdvance,
    notifyUserMatchPlayed,
    manualSaveAll,
    syncCareerRosters,
    bindWriteSeasonSave,
    bindFlushLiveMatchPersist,
    bindBeforeUnloadPersist,
    bindPeriodicAutosave,
    setSkipPersistOnUnload,
    isWriteBlocked: () => careerReset.blockWrites,
  };
}
