/**
 * Persistência de carreira — bloqueio de race no Novo Jogo, debounce de temporada, sync de elencos.
 */

import { SAVE_KEYS, CAREER_INDEX_KEY, slotBundleKeys } from '../core/constants.js';
import {
  MEMORY_LIMITS,
  writeJsonResilient,
  markSkipPersistOnce,
  consumeSkipPersistOnce,
  markSkipSessionEndOnce,
  pruneInjuryHistory,
  clearSessionCareerData,
  hasLocalCareerSave,
  markCareerReloadPending,
  shouldPreserveAuthOnPageHide,
} from '../core/save.js';
import { endBrowserSession, flushCloudSync, flushCloudSyncAsync } from '../core/storage-api.js';
import {
  getActiveSlotId,
  syncActiveSlotFromCache,
} from '../core/career-slot-manager.js';
import { getAutosaveMode, mergePreferencesIntoCareer, AUTOSAVE_MODES } from '../core/save-preferences.js';
import { trimWorldRostersForQuota } from './world-rosters.js';

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
    if (!getSavedNewGame?.()) return false;
    if (immediate === true) {
      if (persistSeasonTimer) {
        clearTimeout(persistSeasonTimer);
        persistSeasonTimer = null;
      }
      const ok = writeSeasonSave();
      if (flush) flushCloudSync({ urgent: true });
      return ok;
    }
    if (persistSeasonTimer) clearTimeout(persistSeasonTimer);
    persistSeasonTimer = setTimeout(() => {
      persistSeasonTimer = null;
      writeSeasonSave();
    }, MEMORY_LIMITS.persistDebounceMs);
    return true;
  };

  /** Grava temporada + carreira imediatamente após avanço de rodada (sempre — evita loop de rodada). */
  const persistAfterRoundAdvance = () => {
    if (!getSavedNewGame?.()) return;
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
    if (!getSavedNewGame?.()) return { ok: false, cloud: false, localOk: false };
    const seasonLocalOk = persistSeason(true, { flush: false });
    syncCareerRosters();
    const careerLocalOk = persistCareer({ ...getSavedNewGame() });
    syncActiveSlotFromCache();
    const slotId = getActiveSlotId();
    const forceLocalKeys = [SAVE_KEYS.career, SAVE_KEYS.season, SAVE_KEYS.playerHistory, CAREER_INDEX_KEY];
    if (slotId) forceLocalKeys.push(...Object.values(slotBundleKeys(slotId)));
    const cloud = await flushCloudSyncAsync({ forceLocalKeys });
    const localOk = seasonLocalOk && careerLocalOk;
    return {
      ok: localOk,
      localOk,
      seasonLocalOk,
      careerLocalOk,
      cloud: cloud.ok,
      cloudMode: cloud.mode,
      cloudReason: cloud.reason,
      cloudErrors: cloud.errors || [],
      seasonOk: cloud.seasonOk,
      careerOk: cloud.careerOk,
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
        if (sessionStorage.getItem('brfut-skip-persist-once')) {
          sessionStorage.removeItem('brfut-skip-persist-once');
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
        syncActiveSlotFromCache();
        persistSeason(true, { flush: false });
        seasonOk = true;
      }
      flushCloudSync({ keepalive: true });
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
      const skipSession = hasCareer || shouldPreserveAuthOnPageHide();
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
      if (getSavedNewGame?.()) {
        syncActiveSlotFromCache();
        persistSeason(true, { flush: false });
      }
      flushCloudSync({ keepalive: true });
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
