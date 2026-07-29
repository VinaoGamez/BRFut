import { SAVE_KEYS, LEGACY_SAVE_KEYS, CAREER_INDEX_KEY, ACTIVE_SLOT_SESSION_KEY, isSlotBundleKey, slotBundleKeys } from './constants.js';
import { normalizeWorldCupHistory } from '../engine/world-cup-history.js';
import { stampSyncableSave, isLocalStorageCheckpoint } from './save-sync.js';
import { isCloudStorageActive, queueCloudDelete, queueCloudSave } from './storage-api.js';
import { migrateLegacyStorageKeysInPlace } from './save-key-normalizer.js';

/** Limites de cota do localStorage (~5–10 MB por origem). */
export const STORAGE_LIMITS = {
  warnBytes: 3_400_000,
  criticalBytes: 4_400_000,
  /** JSON serializado acima disso dispara slim proativo antes de gravar. */
  largePayloadChars: 260_000,
  /** Reclaim preventivo quando o payload passa deste tamanho. */
  proactiveReclaimChars: 200_000,
};

/** Limites para conter crescimento de save/RAM em carreiras longas. */
export const MEMORY_LIMITS = {
  injuryHistory: 5,
  rankingTitles: 12,
  liveTimeline: 40,
  persistDebounceMs: 400,
  /** Amostras do gráfico de volume ao vivo (~2 min cada). */
  liveVolumeSamples: 120,
  /** Rodadas mantidas no histórico da temporada. */
  seasonRoundHistory: 24,
  /** Mensagens gravadas no save da temporada (inbox já tem teto próprio). */
  seasonMessages: 80,
  /** Deals de mercado mantidos no save. */
  seasonTransferDeals: 40,
  /** Autosave periódico enquanto a carreira está ativa (ms). */
  autosaveIntervalMs: 45_000,
  /** HTML da timeline ao vivo — cap no snapshot. */
  liveTimelineHtml: 8000,
};

export function readJson(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

/** Copia chaves legadas Matchday → BR Fut (local + sessionStorage). */
export function migrateLegacyStorageKeys() {
  migrateLegacyStorageKeysInPlace(localStorage);
  migrateLegacyStorageKeysInPlace(sessionStorage);
}

const quotaWarnedKeys = new Set();

/** Estimativa de bytes usados no localStorage (UTF-16 ≈ 2× char length). */
export function estimateLocalStorageUsage() {
  let total = 0;
  const breakdown = {};
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      const value = localStorage.getItem(key) || '';
      const bytes = (key.length + value.length) * 2;
      breakdown[key] = bytes;
      total += bytes;
    }
  } catch {
    /* ignore */
  }
  return { total, breakdown };
}

/** Pressão estimada no localStorage — guia slim proativo. */
let storagePressureCache = null;
let storagePressureCacheAt = 0;
const STORAGE_PRESSURE_CACHE_MS = 1200;

export function getStoragePressure({ fresh = false } = {}) {
  const now = Date.now();
  if (!fresh && storagePressureCache && now - storagePressureCacheAt < STORAGE_PRESSURE_CACHE_MS) {
    return storagePressureCache;
  }
  const { total, breakdown } = estimateLocalStorageUsage();
  let level = 'ok';
  if (total >= STORAGE_LIMITS.criticalBytes) level = 'critical';
  else if (total >= STORAGE_LIMITS.warnBytes) level = 'warn';
  storagePressureCache = { total, breakdown, level };
  storagePressureCacheAt = now;
  return storagePressureCache;
}

export function invalidateStoragePressureCache() {
  storagePressureCache = null;
  storagePressureCacheAt = 0;
}

function estimatePayloadChars(key, value) {
  try {
    return JSON.stringify(stampSyncableSave(key, value)).length;
  } catch {
    return 0;
  }
}

/**
 * Libera chaves regeneráveis / secundárias antes de gravar saves críticos.
 * @returns {number} bytes estimados liberados
 */
export function reclaimLocalStorageSpace({ aggressive = false, preserveKeys = [] } = {}) {
  const preserve = new Set(preserveKeys);
  let freed = 0;
  const removeKey = key => {
    if (!key || preserve.has(key)) return;
    try {
      const value = localStorage.getItem(key);
      if (value) freed += (key.length + value.length) * 2;
      localStorage.removeItem(key);
      invalidateStoragePressureCache();
    } catch {
      /* ignore */
    }
  };

  removeKey(SAVE_KEYS.liveMatch);

  try {
    const hist = localStorage.getItem(SAVE_KEYS.playerHistory);
    const histBytes = hist ? (SAVE_KEYS.playerHistory.length + hist.length) * 2 : 0;
    if (aggressive || histBytes > 250_000) removeKey(SAVE_KEYS.playerHistory);
  } catch {
    /* ignore */
  }

  if (aggressive) {
    removeKey(SAVE_KEYS.training);
    removeKey(SAVE_KEYS.pace);
  }

  const pressure = getStoragePressure({ fresh: true });
  if (pressure.level !== 'ok') {
    let activeSlotId = null;
    try {
      activeSlotId = readJson(CAREER_INDEX_KEY, null)?.activeSlotId || null;
    } catch {
      /* ignore */
    }
    try {
      const sessionSlot = sessionStorage.getItem(ACTIVE_SLOT_SESSION_KEY);
      if (sessionSlot) activeSlotId = sessionSlot;
    } catch {
      /* ignore */
    }

    const keepSlotKeys = new Set();
    if (pressure.level !== 'critical' && activeSlotId) {
      Object.values(slotBundleKeys(activeSlotId)).forEach(key => keepSlotKeys.add(key));
    }

    try {
      const slotKeysToDrop = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key || !isSlotBundleKey(key) || preserve.has(key)) continue;
        if (pressure.level === 'critical' || !keepSlotKeys.has(key)) slotKeysToDrop.push(key);
      }
      slotKeysToDrop.forEach(removeKey);
    } catch {
      /* ignore */
    }
  }

  try {
    const keysToDrop = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || preserve.has(key)) continue;
      if (
        key.startsWith('brfut-card-lab')
        || key.startsWith('brfut-card-lab')
        || key.startsWith('card-lab-layout-')
        || key.startsWith('brfut-team-lab')
        || key.startsWith('brfut-team-lab')
        || key === 'brfut-sponsor-offer-history'
        || key === 'brfut-sponsor-offer-history'
        || key.startsWith('transfers-col-width-')
      ) {
        keysToDrop.push(key);
      }
    }
    keysToDrop.forEach(removeKey);
  } catch {
    /* ignore */
  }

  return freed;
}

/** Alias explícito para preparar gravações críticas (carreira/temporada). */
export function prepareStorageForSave(options = {}) {
  return reclaimLocalStorageSpace(options);
}

function warnQuotaOnce(key, error) {
  if (quotaWarnedKeys.has(key)) return;
  quotaWarnedKeys.add(key);
  console.warn('[brfut] cota de localStorage esgotada', key, error);
  try {
    window.dispatchEvent(new CustomEvent('brfut:save-quota', { detail: { key } }));
  } catch {
    /* ignore */
  }
}

/**
 * Grava JSON com proteção de cota. Retorna false se falhar.
 * Em QuotaExceeded, remove chaves regeneráveis e tenta novamente.
 */
export function writeJson(key, value, { scheduleSlotSync = true } = {}) {
  const payload = stampSyncableSave(key, value);
  let raw;
  try {
    raw = JSON.stringify(payload);
  } catch (error) {
    console.warn('[brfut] falha ao serializar save', key, error);
    return false;
  }

  const tryWrite = () => {
    localStorage.setItem(key, raw);
    invalidateStoragePressureCache();
    if (isCloudStorageActive()) {
      try {
        queueCloudSave(key, payload);
      } catch {
        /* ignore cloud queue */
      }
    }
    if (
      scheduleSlotSync
      && getStoragePressure().level !== 'critical'
      && (
        key === SAVE_KEYS.career
        || key === SAVE_KEYS.season
        || key === SAVE_KEYS.playerHistory
        || key === SAVE_KEYS.liveMatch
      )
    ) {
      void import('./career-slot-manager.js')
        .then(mod => mod.scheduleActiveSlotSync())
        .catch(() => {});
    }
    return true;
  };

  try {
    if (raw.length > STORAGE_LIMITS.proactiveReclaimChars) {
      reclaimLocalStorageSpace({ preserveKeys: [key] });
    }
    return tryWrite();
  } catch (error) {
    const quota =
      error?.name === 'QuotaExceededError' ||
      error?.code === 22 ||
      error?.code === 1014;
    if (!quota) {
      console.warn('[brfut] falha ao gravar save', key, error);
      return false;
    }

    reclaimLocalStorageSpace({ preserveKeys: [key] });
    try {
      return tryWrite();
    } catch {
      /* fall through */
    }

    reclaimLocalStorageSpace({ aggressive: true, preserveKeys: [key] });
    try {
      return tryWrite();
    } catch (retryError) {
      warnQuotaOnce(key, retryError);
      return false;
    }
  }
}

/**
 * Grava JSON com slim progressivo quando a cota aperta.
 * @param {string} key
 * @param {object} value
 * @param {{ slimSteps?: Array<(payload: object, pressure: { level: string }) => object>, preserveKeys?: string[], proactiveSlim?: boolean }} [options]
 * @returns {{ ok: boolean, value: object, slimmed: boolean }}
 */
export function writeJsonResilient(key, value, { slimSteps = [], preserveKeys = null, proactiveSlim = true } = {}) {
  const preserve = [...(preserveKeys || [key])];
  let current = value;
  let pressure = getStoragePressure();

  prepareStorageForSave({
    preserveKeys: preserve,
    aggressive: pressure.level === 'critical',
  });

  let rawLen = estimatePayloadChars(key, current);
  const shouldSlimProactively =
    pressure.level !== 'ok' || rawLen > STORAGE_LIMITS.largePayloadChars;

  if (proactiveSlim && shouldSlimProactively && slimSteps.length) {
    for (const slim of slimSteps) {
      current = slim(current, pressure);
      rawLen = estimatePayloadChars(key, current);
      if (pressure.level === 'ok' && rawLen <= STORAGE_LIMITS.largePayloadChars) break;
    }
  }

  if (writeJson(key, current)) {
    return { ok: true, value: current, slimmed: current !== value };
  }

  for (const slim of slimSteps) {
    current = slim(current, { level: 'critical' });
    prepareStorageForSave({ aggressive: true, preserveKeys: preserve });
    if (writeJson(key, current)) {
      return { ok: true, value: current, slimmed: true };
    }
  }

  pressure = getStoragePressure();
  warnQuotaOnce(key, new DOMException('QuotaExceededError', 'QuotaExceededError'));
  return { ok: false, value: current, slimmed: current !== value };
}

function sanitizeWorldRostersOnLoad(worldRosters) {
  if (!worldRosters || typeof worldRosters !== 'object') return {};
  const out = {};
  Object.entries(worldRosters).forEach(([clubName, roster]) => {
    if (!Array.isArray(roster)) return;
    out[clubName] = roster
      .map(player => {
        if (!player || typeof player !== 'object') return null;
        const { workload, injuryHistory, ...rest } = player;
        return rest;
      })
      .filter(Boolean);
  });
  return out;
}

function readActiveSlotIdForLoad() {
  try {
    const session = sessionStorage.getItem(ACTIVE_SLOT_SESSION_KEY);
    if (session) return session;
  } catch {
    /* ignore */
  }
  const index = readJson(CAREER_INDEX_KEY, null);
  return index?.activeSlotId || null;
}

function seasonHasCupFixtures(season) {
  return (season?.cupCompetition?.stages || []).some(
    stage => Array.isArray(stage?.fixtures) && stage.fixtures.length > 0,
  );
}

export function loadCareerSave() {
  let raw = readJson(SAVE_KEYS.career, null);
  const slotId = readActiveSlotIdForLoad();
  if (slotId) {
    const slotCareer = readJson(slotBundleKeys(slotId).career, null);
    // Checkpoint ativo sem pirâmide — preferir o bundle completo do slot.
    if (slotCareer && (!raw || isLocalStorageCheckpoint(raw))) {
      raw = slotCareer;
    } else if (!raw) {
      raw = slotCareer;
    }
  }
  if (!raw) return null;
  return {
    ...raw,
    worldRosters: sanitizeWorldRostersOnLoad(raw.worldRosters),
    worldCupHistory: normalizeWorldCupHistory(raw.worldCupHistory),
  };
}

export function loadSeasonSave() {
  let raw = readJson(SAVE_KEYS.season, null);
  const slotId = readActiveSlotIdForLoad();
  if (slotId) {
    const slotSeason = readJson(slotBundleKeys(slotId).season, null);
    if (slotSeason && !isLocalStorageCheckpoint(slotSeason)) {
      // Ativo checkpoint/slim sem Copa → slot completo (evita perder sorteio no hard refresh).
      if (
        !raw ||
        isLocalStorageCheckpoint(raw) ||
        (!seasonHasCupFixtures(raw) && seasonHasCupFixtures(slotSeason))
      ) {
        raw = slotSeason;
      }
    } else if (!raw) {
      raw = slotSeason;
    }
  }
  return raw;
}

export function isSeasonValidForCareer(career, season) {
  if (!career || season?.seed !== career.seed) return false;
  if (season?._localCheckpoint) return false;
  return true;
}

/** Remove temporada local incompatível com a carreira (seed divergente ou Novo Jogo). */
export function purgeOrphanSeasonForCareer(career) {
  const season = loadSeasonSave();
  if (!season) return false;
  if (!career || career.freshWorld || !isSeasonValidForCareer(career, season)) {
    clearSeasonSave();
    return true;
  }
  return false;
}

const FRESH_CAREER_BOOT_KEY = 'brfut-fresh-career-boot';

/** Marca reload pós-Novo Jogo — impede nuvem de reidratar save antigo antes do DELETE. */
export function markFreshCareerBoot() {
  try {
    sessionStorage.setItem(FRESH_CAREER_BOOT_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function consumeFreshCareerBoot() {
  try {
    if (!sessionStorage.getItem(FRESH_CAREER_BOOT_KEY)) return false;
    sessionStorage.removeItem(FRESH_CAREER_BOOT_KEY);
    return true;
  } catch {
    return false;
  }
}

export function clearSeasonSave({ cloudDeletes = true } = {}) {
  localStorage.removeItem(SAVE_KEYS.season);
  localStorage.removeItem(SAVE_KEYS.liveMatch);
  if (cloudDeletes && isCloudStorageActive()) {
    queueCloudDelete(SAVE_KEYS.season);
    queueCloudDelete(SAVE_KEYS.liveMatch);
  }
  // playerHistory (brfut-player-history) NÃO é limpo aqui — sobrevive entre temporadas.
}

/** Flag one-shot: impede persistSeason no beforeunload (Novo Jogo / troca de carreira). */
const SKIP_PERSIST_ONCE_KEY = 'brfut-skip-persist-once';

export function markSkipPersistOnce() {
  try {
    sessionStorage.setItem(SKIP_PERSIST_ONCE_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function consumeSkipPersistOnce() {
  try {
    if (!sessionStorage.getItem(SKIP_PERSIST_ONCE_KEY)) return false;
    sessionStorage.removeItem(SKIP_PERSIST_ONCE_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Indica reload com carreira ativa — evita wipe local se token sumir no refresh. */
const CAREER_RELOAD_KEY = 'brfut-career-reload';

export function hasLocalCareerSave() {
  try {
    if (localStorage.getItem(SAVE_KEYS.career)) return true;
    if (localStorage.getItem(LEGACY_SAVE_KEYS.career)) return true;
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && isSlotBundleKey(key) && key.endsWith('-career') && localStorage.getItem(key)) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

export function markCareerReloadPending() {
  try {
    sessionStorage.setItem(CAREER_RELOAD_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function consumeCareerReloadPending() {
  try {
    if (!sessionStorage.getItem(CAREER_RELOAD_KEY)) return false;
    sessionStorage.removeItem(CAREER_RELOAD_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Flag one-shot: não encerra sessão/token no pagehide (reload interno, nova carreira, etc.). */
const SKIP_SESSION_END_KEY = 'brfut-skip-session-end';

export function markSkipSessionEndOnce() {
  try {
    sessionStorage.setItem(SKIP_SESSION_END_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function consumeSkipSessionEndOnce() {
  try {
    if (!sessionStorage.getItem(SKIP_SESSION_END_KEY)) return false;
    sessionStorage.removeItem(SKIP_SESSION_END_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Hard refresh / F5 — pagehide dispara mas não é fechamento de aba. */
export function isReloadNavigation() {
  try {
    const nav = performance.getEntriesByType('navigation')[0];
    return nav?.type === 'reload';
  } catch {
    return false;
  }
}

export function shouldPreserveAuthOnPageHide() {
  return isReloadNavigation() || consumeSkipSessionEndOnce();
}

/**
 * Limpa carreira + temporada + live (+ treino opcional) para liberar cota
 * e evitar conflito ao iniciar Novo Jogo.
 */
export function clearCareerStorage({
  clearTraining = true,
  clearPlayerHistory = true,
  cloudDeletes = true,
} = {}) {
  try {
    localStorage.removeItem(SAVE_KEYS.career);
    if (cloudDeletes && isCloudStorageActive()) queueCloudDelete(SAVE_KEYS.career);
  } catch {
    /* ignore */
  }
  clearSeasonSave({ cloudDeletes });
  if (clearTraining) {
    try {
      localStorage.removeItem(SAVE_KEYS.training);
      if (cloudDeletes && isCloudStorageActive()) queueCloudDelete(SAVE_KEYS.training);
    } catch {
      /* ignore */
    }
  }
  if (clearPlayerHistory && SAVE_KEYS.playerHistory) {
    try {
      localStorage.removeItem(SAVE_KEYS.playerHistory);
      if (cloudDeletes && isCloudStorageActive()) queueCloudDelete(SAVE_KEYS.playerHistory);
    } catch {
      /* ignore */
    }
  }
}

/** Limpa dados locais da sessão (carreira ativa) sem apagar histórico de jogadores. */
export function clearSessionCareerData() {
  try {
    localStorage.removeItem(SAVE_KEYS.career);
    localStorage.removeItem(SAVE_KEYS.season);
    localStorage.removeItem(SAVE_KEYS.liveMatch);
    localStorage.removeItem(SAVE_KEYS.training);
    localStorage.removeItem(SAVE_KEYS.pace);
    localStorage.removeItem('brfut-autosave-mode');
    localStorage.removeItem('matchday-autosave-mode');
    Object.values(LEGACY_SAVE_KEYS).forEach(key => localStorage.removeItem(key));
  } catch {
    /* ignore */
  }
}

/**
 * Apaga todos os saves de carreira no navegador (ativo, slots, legado, índice).
 * Usado em manutenção / reset operacional.
 */
export function purgeAllCareerStorage() {
  const keysToDrop = new Set([
    ...Object.values(SAVE_KEYS),
    ...Object.values(LEGACY_SAVE_KEYS),
    CAREER_INDEX_KEY,
    'brfut-autosave-mode',
    'matchday-autosave-mode',
    'brfut-fresh-career-boot',
    'matchday-fresh-career-boot',
    'brfut-skip-persist-once',
    'matchday-skip-persist-once',
    'brfut-career-reload',
    'matchday-career-reload',
    'brfut-skip-session-end',
    'matchday-skip-session-end',
    'brfut-active-slot-id',
    'matchday-active-slot-id',
  ]);

  try {
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (keysToDrop.has(key) || isSlotBundleKey(key) || /^matchday-slot-/.test(key)) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    /* ignore */
  }

  try {
    for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
      const key = sessionStorage.key(i);
      if (!key) continue;
      if (
        keysToDrop.has(key)
        || key.startsWith('brfut-')
        || key.startsWith('matchday-')
      ) {
        sessionStorage.removeItem(key);
      }
    }
  } catch {
    /* ignore */
  }

  invalidateStoragePressureCache();
}

export function hydrateMessages(season, valid) {
  if (!valid || !Array.isArray(season?.careerMessages)) return [];
  return season.careerMessages.map(message => ({ ...message, read: !!message.read }));
}

export function pruneInjuryHistory(history, limit = MEMORY_LIMITS.injuryHistory) {
  if (!Array.isArray(history) || !history.length) return [];
  const trimmed = history.length > limit ? history.slice(-limit) : history;
  return trimmed.map(entry => ({ ...entry }));
}

export function pruneRankingTitles(titles, limit = MEMORY_LIMITS.rankingTitles) {
  if (!Array.isArray(titles) || !titles.length) return [];
  const trimmed = titles.length > limit ? titles.slice(-limit) : titles;
  return trimmed.map(entry => ({ ...entry }));
}

export function involvesClub(game, clubName) {
  return !!(clubName && game && (game.home === clubName || game.away === clubName));
}

/** Compacta um resultado de partida para RAM/disco (sem events/fatigue/etc.). */
export function compactMatchResult(game, { keepData = false } = {}) {
  if (!game) return null;
  const compact = {
    home: game.home,
    away: game.away,
    homeGoals: game.homeGoals,
    awayGoals: game.awayGoals,
  };
  if (keepData && game.data) compact.data = { ...game.data };
  const homeGoalsList = game.goals?.home || [];
  const awayGoalsList = game.goals?.away || [];
  if (homeGoalsList.length || awayGoalsList.length) {
    compact.goals = { home: [...homeGoalsList], away: [...awayGoalsList] };
  }
  // Metadados de mata-mata — necessários para reabrir confrontos.
  if (game.competition) compact.competition = game.competition;
  if (game.round != null) compact.round = game.round;
  if (game.phase) compact.phase = game.phase;
  if (game.leg) compact.leg = game.leg;
  if (game.tieId) compact.tieId = game.tieId;
  if (game.penalties) compact.penalties = game.penalties;
  if (game.shootoutWinner) compact.shootoutWinner = game.shootoutWinner;
  if (game.shootoutPenalties) compact.shootoutPenalties = game.shootoutPenalties;
  if (game.winner) compact.winner = game.winner;
  if (game.completed) compact.completed = true;
  // Público/bilheteria: necessário para resumo de temporada (ledger/mensagens são podados).
  if (Number.isFinite(Number(game.attendance))) {
    compact.attendance = Math.round(Number(game.attendance));
    if (Number.isFinite(Number(game.fillRate))) compact.fillRate = Number(game.fillRate);
  }
  if (Number.isFinite(Number(game.gateRevenue))) compact.gateRevenue = Number(game.gateRevenue);
  if (game.gateCredited) compact.gateCredited = true;
  return compact;
}

function compactUserStats(userStats) {
  if (!userStats) return null;
  return {
    home: { ...userStats.home },
    away: { ...userStats.away },
    goals: {
      home: [...(userStats.goals?.home || [])],
      away: [...(userStats.goals?.away || [])],
    },
  };
}

/** Compacta histórico de rodadas (extraído/estendido do motor legado). */
export function trimRoundHistory(history = [], maxRounds = MEMORY_LIMITS.seasonRoundHistory) {
  if (!Array.isArray(history) || history.length <= maxRounds) return history;
  return history.slice(-maxRounds);
}

/** Compacta histórico de rodadas (extraído/estendido do motor legado). */
export function compactRoundHistory(history = [], userClub = null) {
  return trimRoundHistory(history).map(item => ({
    round: item.round,
    games: (item.games || []).map(game =>
      compactMatchResult(game, { keepData: involvesClub(game, userClub) })
    ),
    userStats: compactUserStats(item.userStats),
  }));
}

export function compactCompetitionHistories(histories = {}, userClub = null) {
  return Object.fromEntries(
    Object.entries(histories).map(([division, history]) => [
      division,
      compactRoundHistory(history || [], userClub),
    ])
  );
}

/** Só persiste artilheiros/assistentes com produção (>0). */
export function slimLeaderboard(rows, metric) {
  return (rows || [])
    .filter(row => (Number(row?.[metric]) || 0) > 0)
    .map(row => ({
      name: row.name,
      club: row.club,
      division: row.division,
      games: row.games || 0,
      [metric]: row[metric],
      tieValue: row.tieValue || 0,
    }));
}

const workloadIsActive = workload => {
  if (!workload || typeof workload !== 'object') return false;
  return (
    Number(workload.minutesLast7Days) > 0 ||
    Number(workload.minutesLast14Days) > 0 ||
    Number(workload.matchesLast14Days) > 0 ||
    Number(workload.consecutiveStarts) > 0 ||
    Number(workload.highIntensityLoad) > 0 ||
    Number(workload.lastMatchRound) > 0
  );
};

const disciplineIsActive = discipline => {
  if (!discipline || typeof discipline !== 'object') return false;
  if (Number(discipline.suspendedGames) > 0) return true;
  if (discipline.competitionCards && Object.keys(discipline.competitionCards).length) return true;
  return Number(discipline.yellow) > 0 || Number(discipline.red) > 0;
};

/** Fadiga esparsa: só jogadores abaixo de 100 (fresh = omitido). */
export function slimFatigueSnapshot(clubs) {
  const out = {};
  Object.entries(clubs || {}).forEach(([clubName, club]) => {
    const tired = {};
    (club.roster || []).forEach(player => {
      const value = Math.round((Number(player.fatigue) || 100) * 10) / 10;
      if (value < 99.5) tired[player.name] = value;
    });
    if (Object.keys(tired).length) out[clubName] = tired;
  });
  return out;
}

/**
 * Disponibilidade esparsa.
 * - Clube do usuário: só campos ativos (sem nulls).
 * - IA: só jogadores com lesão/disciplina/carga relevante.
 */
export function slimAvailabilitySnapshot(clubs, userClub) {
  const out = {};
  Object.entries(clubs || {}).forEach(([clubName, club]) => {
    const isUser = clubName === userClub;
    const players = {};
    (club.roster || []).forEach(player => {
      const injury = player.injury ? { ...player.injury } : null;
      const history =
        isUser || (Array.isArray(player.injuryHistory) && player.injuryHistory.length)
          ? pruneInjuryHistory(player.injuryHistory)
          : [];
      const workload = workloadIsActive(player.workload) ? { ...player.workload } : null;
      const discipline = disciplineIsActive(player.discipline) ? { ...player.discipline } : null;
      if (!isUser && !injury && !history.length && !workload && !discipline) return;
      const entry = {};
      if (injury) entry.injury = injury;
      if (history.length) entry.injuryHistory = history;
      if (workload) entry.workload = workload;
      if (discipline) entry.discipline = discipline;
      if (Object.keys(entry).length) players[player.name] = entry;
    });
    if (Object.keys(players).length) out[clubName] = players;
  });
  return out;
}

/** Remove blobs pesados das fixtures da Série D (data/events de sim). */
export function slimSerieDFixturesForSave(fixtures) {
  if (!Array.isArray(fixtures)) return [];
  return fixtures.map(round => {
    if (!Array.isArray(round)) return round;
    return round.map(game => {
      if (!game || typeof game !== 'object') return game;
      const slim = {
        home: game.home,
        away: game.away,
        round: game.round,
        competition: game.competition,
        tieId: game.tieId,
        leg: game.leg,
        knockoutRound: game.knockoutRound,
        twoLegged: game.twoLegged,
        completed: !!game.completed,
      };
      if (game.homeGoals != null) slim.homeGoals = game.homeGoals;
      if (game.awayGoals != null) slim.awayGoals = game.awayGoals;
      if (game.penalties) slim.penalties = game.penalties;
      if (game.shootoutWinner) slim.shootoutWinner = game.shootoutWinner;
      if (game.shootoutPenalties) slim.shootoutPenalties = game.shootoutPenalties;
      if (game.winner) slim.winner = game.winner;
      if (game.date) {
        slim.date = game.date instanceof Date ? game.date.toISOString() : game.date;
      }
      if (game.time) slim.time = game.time;
      return slim;
    });
  });
}

/** Compacta fixture de copa no save (stats só do clube do usuário). */
export function compactCupFixture(game, userClub) {
  if (!game) return null;
  const keepData = involvesClub(game, userClub);
  const compact = {
    home: game.home,
    away: game.away,
    competition: game.competition,
    phase: game.phase,
    phaseIndex: game.phaseIndex,
    leg: game.leg,
    date: game.date,
    time: game.time,
    gameNumber: game.gameNumber,
    tieId: game.tieId,
    completed: !!game.completed,
  };
  if (game.homeGoals != null) compact.homeGoals = game.homeGoals;
  if (game.awayGoals != null) compact.awayGoals = game.awayGoals;
  if (game.penalties) compact.penalties = game.penalties;
  if (game.winner) compact.winner = game.winner;
  if (game.shootoutWinner) compact.shootoutWinner = game.shootoutWinner;
  if (game.shootoutPenalties) compact.shootoutPenalties = game.shootoutPenalties;
  if (keepData && game.data) compact.data = { ...game.data };
  const homeGoalsList = game.goals?.home || [];
  const awayGoalsList = game.goals?.away || [];
  if (keepData && (homeGoalsList.length || awayGoalsList.length)) {
    compact.goals = { home: [...homeGoalsList], away: [...awayGoalsList] };
  }
  if (keepData && Number.isFinite(Number(game.attendance))) {
    compact.attendance = Math.round(Number(game.attendance));
    if (Number.isFinite(Number(game.fillRate))) compact.fillRate = Number(game.fillRate);
  }
  if (keepData && Number.isFinite(Number(game.gateRevenue))) compact.gateRevenue = Number(game.gateRevenue);
  if (keepData && game.gateCredited) compact.gateCredited = true;
  return compact;
}

/** Aplica tetos de histórico in-place nos clubes (RAM). */
export function pruneClubMemory(clubs, rankingEntries) {
  Object.values(clubs || {}).forEach(club => {
    (club.roster || []).forEach(player => {
      if (Array.isArray(player.injuryHistory) && player.injuryHistory.length > MEMORY_LIMITS.injuryHistory) {
        player.injuryHistory = player.injuryHistory.slice(-MEMORY_LIMITS.injuryHistory);
      }
    });
  });
  Object.values(rankingEntries || {}).forEach(entry => {
    if (Array.isArray(entry?.titles) && entry.titles.length > MEMORY_LIMITS.rankingTitles) {
      entry.titles = entry.titles.slice(-MEMORY_LIMITS.rankingTitles);
    }
  });
}
