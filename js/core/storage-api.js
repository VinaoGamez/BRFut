/**
 * Cliente da API BR Fut (porta 5081 / api.brfut.com.br).
 * Espelha saves do localStorage em Documentos/BR Fut quando o usuário está logado.
 */
import {
  SAVE_KEYS,
  LEGACY_SAVE_KEYS,
  ALL_SYNCABLE_SAVE_KEYS,
  BRFUT_API_ORIGIN,
  saveKeyVariants,
  CAREER_INDEX_KEY,
  ACTIVE_SLOT_SESSION_KEY,
  isSyncableSaveKey,
  isSlotBundleKey,
  slotBundleKeys,
} from './constants.js';
import { pickNewerSave, saveFreshness, maxStateLeagueRound, mergeSeasonSaves, mergeCareerSaves } from './save-sync.js';
import { prepareCloudSavePayload, estimateCloudBodyChars, rawPayloadChars } from './cloud-save-payload.js';
import {
  applyLocalCheckpointTrim,
  setCloudLocalTrimEnabled,
} from './local-save-checkpoint.js';
import { isLocalStorageCheckpoint } from './save-sync.js';
import { consumeFreshCareerBoot, readJson } from './save.js';
import { normalizeRemoteSaveKeys } from './save-key-normalizer.js';

const AUTH_TOKEN_KEY = 'brfut-auth-token';
const AUTH_REMEMBER_KEY = 'brfut-auth-remember';
const SYNCABLE_KEYS = ALL_SYNCABLE_SAVE_KEYS;
const SYNC_DEBOUNCE_MS = 400;
const SYNC_AUTH_BACKOFF_MS = 30_000;
const PRESENCE_INTERVAL_MS = 120_000;

let backendAvailable = null;
let backendProbeAt = 0;
let cloudActive = false;
let currentUser = null;
/** Snapshot de GET /api/saves — evita GET por chave quando o save remoto não existe. */
let remoteSavesCache = null;
const syncQueue = new Map();
let syncTimer = 0;
let syncAuthBlockedUntil = 0;
let presenceTimer = 0;
const syncWarned = new Set();

/** Testers locais (5081) usam API embutida — evita CORS com api.brfut.com.br em build de produção. */
function resolveApiOrigin() {
  try {
    const host = window.location.hostname;
    if (host === '127.0.0.1' || host === 'localhost') {
      return window.location.origin;
    }
  } catch {
    /* ignore */
  }
  if (BRFUT_API_ORIGIN) return BRFUT_API_ORIGIN;
  // Builds públicos sem BRFUT_API_ORIGIN (ex.: Cloudflare Pages) — API fica na VPS.
  try {
    const host = String(window.location.hostname || '');
    if (
      host === 'brfut.com.br' ||
      host === 'www.brfut.com.br' ||
      host.endsWith('.pages.dev') ||
      host.endsWith('github.io')
    ) {
      return 'https://api.brfut.com.br';
    }
  } catch {
    /* ignore */
  }
  return window.location.origin;
}

const apiUrl = path => new URL(path, resolveApiOrigin()).toString();

function warnSyncOnce(id, message, ...args) {
  if (syncWarned.has(id)) return;
  syncWarned.add(id);
  console.warn(message, ...args);
}

function deactivateCloudSync({ reason = 'auth_failed' } = {}) {
  setAuthToken('');
  cloudActive = false;
  currentUser = null;
  remoteSavesCache = null;
  syncCloudLocalTrimFlag();
  syncQueue.clear();
  syncAuthBlockedUntil = Date.now() + SYNC_AUTH_BACKOFF_MS;
  if (syncTimer) {
    window.clearTimeout(syncTimer);
    syncTimer = 0;
  }
  stopPresenceHeartbeat();
  return reason;
}

function isSyncAuthBlocked() {
  return syncAuthBlockedUntil > Date.now();
}

function handleSyncAuthFailure(error) {
  if (error?.status !== 401) return false;
  deactivateCloudSync();
  warnSyncOnce('sync-auth', '[brfut] sessão expirada — sync na nuvem pausado. Entre novamente em Conta.', error);
  return true;
}

function handleSyncInvalidKeyFailure(error, key) {
  if (error?.status !== 400 || error?.code !== 'invalid_key') return false;
  syncQueue.delete(key);
  warnSyncOnce(
    `sync-invalid-key-${key}`,
    '[brfut] API rejeitou chave de save — reinicie o servidor 5081 ou atualize a API',
    key,
    error.message,
  );
  return true;
}

async function parseJsonResponse(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

export function getAuthToken() {
  try {
    // Aceita token em localStorage (lembrar) ou sessionStorage (aba).
    // Antes: se remember=0, ignorava localStorage mesmo com token válido residual.
    return (
      localStorage.getItem(AUTH_TOKEN_KEY) ||
      sessionStorage.getItem(AUTH_TOKEN_KEY) ||
      ''
    );
  } catch {
    return '';
  }
}

export function isAuthRememberEnabled() {
  try {
    return localStorage.getItem(AUTH_REMEMBER_KEY) === '1';
  } catch {
    return false;
  }
}

function setAuthToken(token, { remember = false } = {}) {
  try {
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    if (token) {
      if (remember) {
        localStorage.setItem(AUTH_TOKEN_KEY, token);
        localStorage.setItem(AUTH_REMEMBER_KEY, '1');
      } else {
        sessionStorage.setItem(AUTH_TOKEN_KEY, token);
        localStorage.removeItem(AUTH_REMEMBER_KEY);
      }
      return;
    }
    localStorage.removeItem(AUTH_REMEMBER_KEY);
  } catch {
    /* ignore */
  }
}

export function isCloudStorageActive() {
  return cloudActive && !!getAuthToken();
}

function syncCloudLocalTrimFlag() {
  setCloudLocalTrimEnabled(isCloudStorageActive());
}

/** Revalida token + sessão antes de upload manual (cloudActive pode ter caído). */
export async function ensureCloudReady() {
  const token = getAuthToken();
  if (!token) {
    cloudActive = false;
    syncCloudLocalTrimFlag();
    return false;
  }
  if (cloudActive && currentUser) return true;
  try {
    backendAvailable = null;
    backendProbeAt = 0;
    if (!(await probeBackend({ force: true }))) return false;
    const me = await authedFetch('/api/auth/me', { retry: true });
    currentUser = me.user;
    cloudActive = true;
    syncAuthBlockedUntil = 0;
    syncCloudLocalTrimFlag();
    startPresenceHeartbeat();
    return true;
  } catch (error) {
    // Token inválido: limpa para o jogador poder logar de novo.
    if (error?.status === 401) {
      setAuthToken('');
      currentUser = null;
    }
    cloudActive = false;
    syncCloudLocalTrimFlag();
    return false;
  }
}

export function getCloudUser() {
  return currentUser;
}

const BACKEND_OK_TTL_MS = 60_000;
const BACKEND_FAIL_TTL_MS = 4_000;

export async function probeBackend({ force = false } = {}) {
  const now = Date.now();
  if (
    !force &&
    backendAvailable != null &&
    now - backendProbeAt < (backendAvailable ? BACKEND_OK_TTL_MS : BACKEND_FAIL_TTL_MS)
  ) {
    return backendAvailable;
  }
  try {
    const response = await fetch(apiUrl('/api/health'), { cache: 'no-store' });
    if (!response.ok) {
      backendAvailable = false;
      backendProbeAt = now;
      return false;
    }
    const body = await parseJsonResponse(response);
    backendAvailable = body?.ok === true && body?.service === 'brfut-api';
  } catch {
    backendAvailable = false;
  }
  backendProbeAt = now;
  return backendAvailable;
}

function sleep(ms) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

async function authedFetch(path, options = {}) {
  const { retry, ...fetchOptions } = options;
  const headers = { ...(fetchOptions.headers || {}) };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (fetchOptions.body != null && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const maxAttempts = retry === false ? 1 : 3;
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(apiUrl(path), { ...fetchOptions, headers, cache: 'no-store' });
      const body = await parseJsonResponse(response);
      if (!response.ok) {
        const message = body?.error || `HTTP ${response.status}`;
        const error = new Error(message);
        error.code = body?.code || 'request_failed';
        error.status = response.status;
        // Rate limit / indisponível: tenta de novo antes de desistir do SALVAR.
        if ((response.status === 429 || response.status === 503) && attempt < maxAttempts) {
          await sleep(400 * attempt * attempt);
          lastError = error;
          continue;
        }
        throw error;
      }
      return body;
    } catch (error) {
      lastError = error;
      const status = error?.status || 0;
      const retriable = status === 429 || status === 503 || status === 0;
      if (retriable && attempt < maxAttempts) {
        await sleep(450 * attempt * attempt);
        continue;
      }
      if (!error?.status && error?.name === 'TypeError') {
        error.status = 0;
        error.code = error.code || 'network_failed';
      }
      throw error;
    }
  }
  throw lastError || new Error('request_failed');
}

/** Login/register sem Bearer antigo — evita 401 de sessão stale derrubar o fluxo. */
async function postAuthJson(path, payload) {
  const response = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  const body = await parseJsonResponse(response);
  if (!response.ok) {
    const message = body?.error || `HTTP ${response.status}`;
    const error = new Error(message);
    error.code = body?.code || 'request_failed';
    error.status = response.status;
    throw error;
  }
  return body;
}

function remoteHasCareer(remoteSaves) {
  const { value } = normalizeRemoteSaveEntry(remoteSaves?.[SAVE_KEYS.career]);
  return !!value;
}

function localHasAnyCareerPayload() {
  if (readLocalSave(SAVE_KEYS.career)) return true;
  if (readLocalSave(LEGACY_SAVE_KEYS?.career || 'matchday-new-game')) return true;
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && isSlotBundleKey(key) && key.endsWith('-career') && readLocalSave(key)) return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

function normalizeRemoteSaveEntry(entry) {
  if (entry == null) return { value: null, updatedAt: 0 };
  if (typeof entry === 'object' && entry !== null && 'value' in entry) {
    const envelopeAt = Date.parse(entry.updatedAt || '');
    return {
      value: entry.value,
      updatedAt: Number.isFinite(envelopeAt) && envelopeAt > 0 ? envelopeAt : 0,
    };
  }
  return { value: entry, updatedAt: 0 };
}

function setRemoteSavesCache(saves) {
  remoteSavesCache = saves && typeof saves === 'object' ? saves : {};
}

function rememberRemoteSave(key, value, updatedAt = Date.now()) {
  if (!remoteSavesCache) remoteSavesCache = {};
  remoteSavesCache[key] = { value, updatedAt };
}

function readCachedRemoteSave(key) {
  if (!remoteSavesCache || !Object.prototype.hasOwnProperty.call(remoteSavesCache, key)) {
    return undefined;
  }
  return normalizeRemoteSaveEntry(remoteSavesCache[key]).value;
}

function readLocalSave(key) {
  return readJson(key, null);
}

function resolveActiveSlotId() {
  try {
    const session = sessionStorage.getItem(ACTIVE_SLOT_SESSION_KEY);
    if (session) return session;
  } catch {
    /* ignore */
  }
  return readLocalSave(CAREER_INDEX_KEY)?.activeSlotId || null;
}

/**
 * Espelha o save completo no bundle do slot ativo antes do trim local.
 * Sem isso o checkpoint sobrescreve o slot e a nuvem perde o save jogável.
 */
function mirrorFullSaveToActiveSlot(key, fullValue) {
  if (!fullValue || isLocalStorageCheckpoint(fullValue)) return null;
  if (
    key !== SAVE_KEYS.career &&
    key !== SAVE_KEYS.season &&
    key !== SAVE_KEYS.playerHistory &&
    key !== SAVE_KEYS.liveMatch
  ) {
    return null;
  }
  const slotId = resolveActiveSlotId();
  if (!slotId) return null;
  const bundle = slotBundleKeys(slotId);
  const dest =
    key === SAVE_KEYS.career
      ? bundle.career
      : key === SAVE_KEYS.season
        ? bundle.season
        : key === SAVE_KEYS.playerHistory
          ? bundle.playerHistory
          : bundle.liveMatch;
  try {
    localStorage.setItem(dest, JSON.stringify(fullValue));
    return { key: dest, value: fullValue };
  } catch {
    return null;
  }
}

async function putCloudSaveValue(key, value) {
  const prepared = prepareCloudSavePayload(key, value);
  await authedFetch(`/api/saves/${encodeURIComponent(key)}`, {
    method: 'PUT',
    body: JSON.stringify({ value: prepared }),
  });
  rememberRemoteSave(key, prepared);
  return prepared;
}

/**
 * Para upload: se a chave ativa for checkpoint, prefere o bundle completo do slot.
 * Evita gravar na nuvem um stub local depois do trim.
 */
function resolveLocalValueForCloudUpload(key) {
  let value = null;
  try {
    const raw = localStorage.getItem(key);
    if (raw) value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value) return null;
  if (!isLocalStorageCheckpoint(value)) return value;

  if (
    key !== SAVE_KEYS.career &&
    key !== SAVE_KEYS.season &&
    key !== SAVE_KEYS.playerHistory &&
    key !== SAVE_KEYS.liveMatch
  ) {
    return value;
  }

  const slotId = resolveActiveSlotId();
  if (!slotId) return value;
  const bundle = slotBundleKeys(slotId);
  const altKey =
    key === SAVE_KEYS.career
      ? bundle.career
      : key === SAVE_KEYS.season
        ? bundle.season
        : key === SAVE_KEYS.playerHistory
          ? bundle.playerHistory
          : bundle.liveMatch;
  try {
    const altRaw = localStorage.getItem(altKey);
    if (!altRaw) return value;
    const alt = JSON.parse(altRaw);
    if (alt && !isLocalStorageCheckpoint(alt)) return alt;
  } catch {
    /* ignore */
  }
  return value;
}

function mergeRemoteSaves(saves, { skipCareerSeasonHydrate = false } = {}) {
  if (!saves || typeof saves !== 'object') return;
  const normalized = normalizeRemoteSaveKeys(saves);
  Object.entries(normalized).forEach(([key, rawEntry]) => {
    const { value: remoteValue, updatedAt: remoteEnvelopeAt } = normalizeRemoteSaveEntry(rawEntry);
    if (remoteValue == null) return;

    if (key === CAREER_INDEX_KEY || isSlotBundleKey(key)) {
      const localValue = readLocalSave(key);
      const winner = pickNewerSave(localValue, remoteValue, key, remoteEnvelopeAt);
      try {
        localStorage.setItem(key, JSON.stringify(winner));
      } catch {
        /* ignore quota during hydrate */
      }
      if (
        isCloudStorageActive() &&
        localValue &&
        winner === localValue &&
        saveFreshness(localValue, key) > Math.max(saveFreshness(remoteValue, key), remoteEnvelopeAt || 0)
      ) {
        queueCloudSave(key, localValue);
      }
      return;
    }

    if (!Object.values(SAVE_KEYS).includes(key)) return;

    const localValue = readLocalSave(key);
    if (skipCareerSeasonHydrate && (key === SAVE_KEYS.career || key === SAVE_KEYS.season)) {
      if (localValue && isCloudStorageActive() && !isLocalStorageCheckpoint(localValue)) {
        queueCloudSave(key, localValue);
      }
      return;
    }

    if (isLocalStorageCheckpoint(localValue) && remoteValue != null) {
      const winner =
        key === SAVE_KEYS.season
          ? mergeSeasonSaves(localValue, remoteValue, remoteEnvelopeAt)
          : key === SAVE_KEYS.career
            ? mergeCareerSaves(localValue, remoteValue, remoteEnvelopeAt)
            : remoteValue;
      try {
        localStorage.setItem(key, JSON.stringify(winner));
      } catch {
        /* ignore quota during hydrate */
      }
      return;
    }

    if (!localValue) {
      if (key === SAVE_KEYS.season) {
        const career = readLocalSave(SAVE_KEYS.career);
        if (career?.freshWorld) return;
        if (career && remoteValue?.seed != null && remoteValue.seed !== career.seed) return;
      }
      try {
        localStorage.setItem(key, JSON.stringify(remoteValue));
      } catch {
        /* ignore quota during hydrate */
      }
      return;
    }

    const winner =
      key === SAVE_KEYS.season
        ? mergeSeasonSaves(localValue, remoteValue, remoteEnvelopeAt)
        : key === SAVE_KEYS.career
          ? mergeCareerSaves(localValue, remoteValue, remoteEnvelopeAt)
          : pickNewerSave(localValue, remoteValue, key, remoteEnvelopeAt);
    try {
      localStorage.setItem(key, JSON.stringify(winner));
    } catch {
      /* ignore quota during hydrate */
    }

    const localScore = saveFreshness(localValue, key);
    const remoteScore = Math.max(saveFreshness(remoteValue, key), remoteEnvelopeAt || 0);
    if (isCloudStorageActive()) {
      if (key === SAVE_KEYS.season) {
        const mergedState = maxStateLeagueRound(winner);
        const remoteState = maxStateLeagueRound(remoteValue);
        const mergedBytes = JSON.stringify(winner).length;
        const remoteBytes = JSON.stringify(remoteValue).length;
        if (mergedState > remoteState || mergedBytes > remoteBytes + 4096) {
          queueCloudSave(key, winner);
        }
      } else if (winner === localValue && localScore > remoteScore) {
        queueCloudSave(key, localValue);
      }
    }
  });
}

/** Chrome limita corpo e quantidade de fetch keepalive — só usar ao fechar a aba. */
const KEEPALIVE_BODY_LIMIT = 60_000;

function flushSyncQueueKeepalive() {
  if (!isCloudStorageActive() || !syncQueue.size) return;
  const batch = new Map(syncQueue);
  syncQueue.clear();
  const token = getAuthToken();
  let deferred = false;

  batch.forEach((value, key) => {
    const prepared = prepareCloudSavePayload(key, value);
    const body = JSON.stringify({ value: prepared });
    if (body.length > KEEPALIVE_BODY_LIMIT) {
      syncQueue.set(key, value);
      deferred = true;
      warnSyncOnce(
        `keepalive-skip-${key}`,
        '[brfut] save grande demais para keepalive — usando sync completo',
        key,
        `${Math.round(body.length / 1024)}KB`,
      );
      return;
    }
    fetch(apiUrl(`/api/saves/${encodeURIComponent(key)}`), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body,
      keepalive: true,
      cache: 'no-store',
    })
      .then(async response => {
        if (!response.ok) {
          if (response.status === 401) {
            handleSyncAuthFailure({ status: 401 });
            return;
          }
          if (response.status === 400) {
            const body = await parseJsonResponse(response);
            if (handleSyncInvalidKeyFailure({ status: 400, code: body?.code, message: body?.error }, key)) {
              return;
            }
          }
          syncQueue.set(key, value);
          scheduleCloudSync();
          return;
        }
        rememberRemoteSave(key, prepareCloudSavePayload(key, value));
        const mirror = mirrorFullSaveToActiveSlot(key, value);
        if (mirror) queueCloudSave(mirror.key, mirror.value);
        applyLocalCheckpointTrim(key, value);
      })
      .catch(error => {
        if (handleSyncAuthFailure(error)) return;
        warnSyncOnce(`keepalive-${key}`, '[brfut] falha ao sincronizar save (keepalive)', key, error);
        syncQueue.set(key, value);
        scheduleCloudSync();
      });
  });

  if (deferred) flushSyncQueue();
}

export function flushCloudSync({ urgent = false, keepalive = false } = {}) {
  if (!isCloudStorageActive()) return;
  if (syncTimer) {
    window.clearTimeout(syncTimer);
    syncTimer = 0;
  }
  if (keepalive) flushSyncQueueKeepalive();
  else if (urgent) flushSyncQueue();
  else flushSyncQueue();
}

/** Aguarda upload na nuvem (sem keepalive — suporta saves grandes). Usado no save manual. */
export async function flushCloudSyncAsync({ forceLocalKeys = null } = {}) {
  const ready = await ensureCloudReady();
  if (!ready) {
    return {
      ok: false,
      synced: 0,
      mode: BRFUT_API_ORIGIN ? 'cloud' : 'local',
      reason: 'cloud_inactive',
      errors: [],
      seasonOk: false,
      careerOk: false,
    };
  }
  if (syncTimer) {
    window.clearTimeout(syncTimer);
    syncTimer = 0;
  }

  const batch = new Map(syncQueue);
  syncQueue.clear();

  const keysToSync =
    forceLocalKeys ||
    (batch.size ? [...batch.keys()] : [SAVE_KEYS.season, SAVE_KEYS.career]);

  keysToSync.forEach(key => {
    if (!isSyncableSaveKey(key)) return;
    if (batch.has(key)) return;
    const value = resolveLocalValueForCloudUpload(key);
    if (value) batch.set(key, value);
  });

  // Troca checkpoints já enfileirados por payload completo do slot, se existir.
  for (const [key, value] of [...batch.entries()]) {
    if (!isLocalStorageCheckpoint(value)) continue;
    const resolved = resolveLocalValueForCloudUpload(key);
    if (resolved && resolved !== value) batch.set(key, resolved);
  }
  if (!batch.size) {
    return {
      ok: false,
      synced: 0,
      mode: 'cloud',
      reason: 'empty_batch',
      errors: [],
      seasonOk: false,
      careerOk: false,
    };
  }

  const orderedKeys = [
    ...keysToSync.filter(key => batch.has(key)),
    ...[...batch.keys()].filter(key => !keysToSync.includes(key)),
  ];

  const results = [];
  const mirroredSlotKeys = new Set();
  for (const key of orderedKeys) {
    const value = batch.get(key);
    if (value == null) continue;
    const bodyChars = estimateCloudBodyChars(key, value);
    try {
      await putCloudSaveValue(key, value);
      const mirror = mirrorFullSaveToActiveSlot(key, value);
      if (mirror && !mirroredSlotKeys.has(mirror.key) && !batch.has(mirror.key)) {
        mirroredSlotKeys.add(mirror.key);
        try {
          await putCloudSaveValue(mirror.key, mirror.value);
          results.push({
            key: mirror.key,
            ok: true,
            bodyChars: estimateCloudBodyChars(mirror.key, mirror.value),
            slimmed: false,
          });
        } catch (mirrorError) {
          syncQueue.set(mirror.key, mirror.value);
          scheduleCloudSync();
          results.push({
            key: mirror.key,
            ok: false,
            bodyChars: estimateCloudBodyChars(mirror.key, mirror.value),
            slimmed: false,
            status: mirrorError?.status || 0,
            code: mirrorError?.code || 'sync_failed',
            message: mirrorError?.message || 'Falha ao espelhar slot',
          });
        }
      }
      applyLocalCheckpointTrim(key, value);
      results.push({ key, ok: true, bodyChars, slimmed: bodyChars < rawPayloadChars(value) });
    } catch (error) {
      if (!handleSyncAuthFailure(error) && !handleSyncInvalidKeyFailure(error, key)) {
        console.warn('[brfut] falha ao sincronizar save', key, error);
        syncQueue.set(key, value);
        scheduleCloudSync();
      }
      results.push({
        key,
        ok: false,
        bodyChars,
        slimmed: bodyChars < rawPayloadChars(value),
        status: error?.status || 0,
        code: error?.code || 'sync_failed',
        message: error?.message || 'Falha ao sincronizar',
      });
    }
  }

  const failed = results.filter(entry => !entry.ok);
  const seasonOk = results.some(entry => entry.key === SAVE_KEYS.season && entry.ok);
  const careerOk = results.some(entry => entry.key === SAVE_KEYS.career && entry.ok);
  const synced = results.length - failed.length;

  return {
    ok: synced > 0 && seasonOk && careerOk,
    synced,
    failed: failed.map(entry => entry.key),
    errors: failed,
    mode: 'cloud',
    reason: failed.length ? failed[0]?.code || 'sync_failed' : null,
    seasonOk,
    careerOk,
  };
}

function localSavesSnapshot() {
  const out = {};
  SYNCABLE_KEYS.forEach(key => {
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) out[key] = JSON.parse(raw);
    } catch {
      /* ignore corrupt entry */
    }
  });
  try {
    const indexRaw = localStorage.getItem(CAREER_INDEX_KEY);
    if (indexRaw) out[CAREER_INDEX_KEY] = JSON.parse(indexRaw);
  } catch {
    /* ignore */
  }
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !isSlotBundleKey(key)) continue;
      const raw = localStorage.getItem(key);
      if (raw != null) out[key] = JSON.parse(raw);
    }
  } catch {
    /* ignore */
  }
  return out;
}

function flushSyncQueue() {
  syncTimer = 0;
  if (!isCloudStorageActive() || !syncQueue.size) return;
  const batch = new Map(syncQueue);
  syncQueue.clear();
  batch.forEach((value, key) => {
    putCloudSaveValue(key, value)
      .then(() => {
        const mirror = mirrorFullSaveToActiveSlot(key, value);
        if (mirror) queueCloudSave(mirror.key, mirror.value);
        applyLocalCheckpointTrim(key, value);
      })
      .catch(error => {
        if (handleSyncAuthFailure(error)) return;
        if (handleSyncInvalidKeyFailure(error, key)) return;
        warnSyncOnce(`sync-${key}`, '[brfut] falha ao sincronizar save', key, error);
        syncQueue.set(key, value);
        scheduleCloudSync();
      });
  });
}

function scheduleCloudSync() {
  if (!isCloudStorageActive() || isSyncAuthBlocked()) return;
  if (syncTimer) return;
  syncTimer = window.setTimeout(flushSyncQueue, SYNC_DEBOUNCE_MS);
}

export function queueCloudSave(key, value) {
  if (!isCloudStorageActive() || isSyncAuthBlocked() || !isSyncableSaveKey(key)) return;
  syncQueue.set(key, value);
  scheduleCloudSync();
}

export function queueCloudDelete(key) {
  if (!isCloudStorageActive() || !isSyncableSaveKey(key)) return;
  syncQueue.delete(key);
  authedFetch(`/api/saves/${encodeURIComponent(key)}`, { method: 'DELETE' }).catch(error => {
    console.warn('[brfut] falha ao apagar save na nuvem local', key, error);
  });
}

/** Aguarda DELETE na nuvem (Novo Jogo — evita merge do save antigo no reload). */
export async function flushCloudDeletesAsync(keys = [SAVE_KEYS.career, SAVE_KEYS.season]) {
  if (!isCloudStorageActive() || !getAuthToken()) return { ok: true, deleted: [] };
  const expanded = [...new Set(keys.flatMap(k => saveKeyVariants(k)))];
  const results = await Promise.all(
    expanded.map(async key => {
      if (!isSyncableSaveKey(key)) return { key, ok: false };
      try {
        await authedFetch(`/api/saves/${encodeURIComponent(key)}`, { method: 'DELETE' });
        return { key, ok: true };
      } catch (error) {
        console.warn('[brfut] falha ao apagar save na nuvem', key, error);
        return { key, ok: false, error };
      }
    }),
  );
  return { ok: results.every(entry => entry.ok), deleted: results.filter(entry => entry.ok).map(entry => entry.key) };
}

export async function loginWithGoogleIdToken(idToken, { remember = true } = {}) {
  // Login Google sempre persiste a sessão — save na nuvem exige token após home→jogo.
  const body = await postAuthJson('/api/auth/google', { idToken });
  setAuthToken(body.token, { remember: remember !== false });
  currentUser = body.user;
  cloudActive = true;
  syncAuthBlockedUntil = 0;
  backendAvailable = true;
  syncCloudLocalTrimFlag();
  return initStorageBackend({ skipProbe: true, preferMigrate: true, force: true });
}

export async function loginAccount(username, password, { remember = false } = {}) {
  const body = await postAuthJson('/api/auth/login', { username, password });
  setAuthToken(body.token, { remember });
  currentUser = body.user;
  cloudActive = true;
  syncAuthBlockedUntil = 0;
  backendAvailable = true;
  syncCloudLocalTrimFlag();
  return initStorageBackend({ skipProbe: true, force: true });
}

export async function registerAccount(username, password, displayName, { remember = false } = {}) {
  const body = await postAuthJson('/api/auth/register', {
    username,
    password,
    displayName,
  });
  setAuthToken(body.token, { remember });
  currentUser = body.user;
  cloudActive = true;
  syncAuthBlockedUntil = 0;
  backendAvailable = true;
  syncCloudLocalTrimFlag();
  return initStorageBackend({ skipProbe: true, preferMigrate: true, force: true });
}

export async function logoutAccount() {
  try {
    if (getAuthToken()) await authedFetch('/api/auth/logout', { method: 'POST' });
  } catch {
    /* ignore */
  }
  setAuthToken('');
  currentUser = null;
  cloudActive = false;
  remoteSavesCache = null;
  backendAvailable = null;
  backendProbeAt = 0;
  storageInitPromise = null;
  syncAuthBlockedUntil = 0;
  syncCloudLocalTrimFlag();
  stopPresenceHeartbeat();
  syncQueue.clear();
  if (syncTimer) {
    window.clearTimeout(syncTimer);
    syncTimer = 0;
  }
  // Cancela One Tap residual do Google, se existir.
  try {
    window.google?.accounts?.id?.disableAutoSelect?.();
  } catch {
    /* ignore */
  }
}

/** Encerra presença/fila ao sair da página. NÃO apaga o token aqui.
 *  pagehide também dispara em navegação interna (home→jogo / novo save) e
 *  limpar sessionStorage no meio do caminho deixava a conta “logada” na UI
 *  anterior e SALVO LOCAL no jogo. Sessão sem “lembrar” já morre com a aba;
 *  logout explícito continua em logoutAccount(). */
export function endBrowserSession() {
  flushCloudSync({ keepalive: true });
  stopPresenceHeartbeat();
  syncQueue.clear();
  if (syncTimer) {
    window.clearTimeout(syncTimer);
    syncTimer = 0;
  }
  // Mantém token + cloudActive para a próxima página da mesma origem.
}

async function migrateLocalToCloud({ overwrite = false } = {}) {
  const local = localSavesSnapshot();
  if (!Object.keys(local).length) return { imported: [], skipped: [] };
  return authedFetch('/api/saves/migrate', {
    method: 'POST',
    body: JSON.stringify({ saves: local, overwrite }),
  });
}

let storageInitPromise = null;

/** Somente testes — reinicia mutex de hidratação. */
export function resetStorageBackendState() {
  storageInitPromise = null;
  backendAvailable = null;
  backendProbeAt = 0;
  cloudActive = false;
  remoteSavesCache = null;
  currentUser = null;
  syncQueue.clear();
  syncAuthBlockedUntil = 0;
}

/** Alias — hidratação idempotente (mutex interno). */
export async function ensureStorageHydrated(options = {}) {
  return initStorageBackend(options);
}

/**
 * Inicializa backend de storage: valida sessão, baixa saves e opcionalmente migra localStorage.
 * @returns {Promise<{ mode: 'local'|'cloud', user?: object, dataRoot?: string }>}
 */
export async function initStorageBackend({ skipProbe = false, preferMigrate = false, force = false } = {}) {
  if (storageInitPromise && !force) return storageInitPromise;
  storageInitPromise = initStorageBackendImpl({ skipProbe, preferMigrate }).catch(error => {
    storageInitPromise = null;
    throw error;
  });
  return storageInitPromise;
}

async function initStorageBackendImpl({ skipProbe = false, preferMigrate = false } = {}) {
  if (!skipProbe && !(await probeBackend())) {
    cloudActive = false;
    currentUser = null;
    syncCloudLocalTrimFlag();
    return { mode: 'local' };
  }

  const token = getAuthToken();
  if (!token) {
    cloudActive = false;
    currentUser = null;
    syncCloudLocalTrimFlag();
    return { mode: 'local', backend: true };
  }

  try {
    const me = await authedFetch('/api/auth/me');
    currentUser = me.user;
    cloudActive = true;
  } catch (error) {
    setAuthToken('');
    cloudActive = false;
    currentUser = null;
    syncCloudLocalTrimFlag();
    return { mode: 'local', backend: true, authError: error?.message };
  }

  const remote = await authedFetch('/api/saves');
  const remoteSaves = remote?.saves || {};
  setRemoteSavesCache(remoteSaves);
  const hasRemoteCareer = remoteHasCareer(remoteSaves);
  const hasLocalCareer = localHasAnyCareerPayload();
  const freshCareerBoot = consumeFreshCareerBoot();

  try {
    if (!hasRemoteCareer && hasLocalCareer && preferMigrate !== false) {
      await migrateLocalToCloud();
      const refreshed = await authedFetch('/api/saves');
      setRemoteSavesCache(refreshed?.saves || {});
      mergeRemoteSaves(refreshed?.saves || {}, { skipCareerSeasonHydrate: freshCareerBoot });
    } else {
      mergeRemoteSaves(remoteSaves, { skipCareerSeasonHydrate: freshCareerBoot });
    }
  } catch (error) {
    warnSyncOnce(
      'hydrate-merge-failed',
      '[brfut] falha ao sincronizar saves com a nuvem — usando cópia local',
      error?.message || error,
    );
    try {
      mergeRemoteSaves(remoteSaves, { skipCareerSeasonHydrate: freshCareerBoot });
    } catch {
      /* ignore */
    }
  }

  syncCloudLocalTrimFlag();
  if (cloudActive && getAuthToken()) startPresenceHeartbeat();

  return {
    mode: 'cloud',
    user: currentUser,
    backend: true,
  };
}

export async function fetchBackendHealth() {
  const ok = await probeBackend();
  if (!ok) return null;
  try {
    return await authedFetch('/api/health');
  } catch {
    return null;
  }
}

/** Config do login Google (health ou endpoint dedicado). */
export async function fetchGoogleAuthConfig() {
  const health = await fetchBackendHealth();
  if (health && ('googleAuthEnabled' in health || 'googleClientId' in health)) {
    const clientId = health.googleClientId || '';
    return {
      enabled: !!health.googleAuthEnabled && !!clientId,
      clientId,
    };
  }
  try {
    const response = await fetch(apiUrl('/api/auth/google/config'), { cache: 'no-store' });
    if (!response.ok) return { enabled: false, clientId: '' };
    const body = await parseJsonResponse(response);
    const clientId = body?.clientId || '';
    return { enabled: !!body?.enabled && !!clientId, clientId };
  } catch {
    return { enabled: false, clientId: '' };
  }
}

/** Contagem de cadastros e jogadores ON (API local 5081). */
export async function fetchPlayerStats() {
  const health = await fetchBackendHealth();
  if (!health || typeof health.registered !== 'number') return null;
  return {
    registered: health.registered,
    online: Number(health.online) || 0,
    onlineWindowSec: Number(health.onlineWindowSec) || 300,
  };
}

function pingPresence() {
  if (!isCloudStorageActive()) return;
  authedFetch('/api/auth/me').catch(() => {});
}

/** Mantém lastSeenAt atualizado enquanto o jogador está com aba aberta. */
export function startPresenceHeartbeat() {
  if (presenceTimer || typeof window === 'undefined') return;
  if (!isCloudStorageActive()) return;
  pingPresence();
  presenceTimer = window.setInterval(pingPresence, PRESENCE_INTERVAL_MS);
}

export function stopPresenceHeartbeat() {
  if (!presenceTimer || typeof window === 'undefined') return;
  window.clearInterval(presenceTimer);
  presenceTimer = 0;
}

export async function updateAccountProfile({ displayName, avatar } = {}) {
  const payload = {};
  if (displayName != null) payload.displayName = displayName;
  if (avatar !== undefined) payload.avatar = avatar;
  const body = await authedFetch('/api/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  currentUser = body.user;
  return body.user;
}

export async function fetchAccountAvatarObjectUrl() {
  if (!isCloudStorageActive() || !currentUser?.hasAvatar) return '';
  try {
    const token = getAuthToken();
    const response = await fetch(apiUrl('/api/auth/avatar'), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: 'no-store',
    });
    if (!response.ok) return '';
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch {
    return '';
  }
}

/** Baixa uma chave de save da nuvem (slot bundle, índice, etc.). */
export async function fetchRemoteSaveKey(key) {
  if (!isCloudStorageActive()) return null;
  if (remoteSavesCache) {
    const cached = readCachedRemoteSave(key);
    return cached === undefined ? null : cached;
  }
  try {
    const body = await authedFetch(`/api/saves/${encodeURIComponent(key)}`);
    if (body == null) return null;
    const value =
      typeof body === 'object' && body !== null && 'value' in body ? body.value : body;
    rememberRemoteSave(key, value);
    return value;
  } catch {
    return null;
  }
}

/** Merge bundle do slot com nuvem (sem sobrescrever local mais novo). */
export async function mergeSlotBundleFromCloud(slotId) {
  if (!slotId || !isCloudStorageActive()) return;
  const bundle = slotBundleKeys(slotId);
  await Promise.all(
    Object.values(bundle).map(async key => {
      const remote = await fetchRemoteSaveKey(key);
      if (remote == null) return;
      const local = readLocalSave(key);
      const winner = local ? pickNewerSave(local, remote, key) : remote;
      try {
        localStorage.setItem(key, JSON.stringify(winner));
      } catch {
        /* ignore quota */
      }
    }),
  );
}

/** @deprecated Use mergeSlotBundleFromCloud — mantido por compatibilidade. */
export async function hydrateSlotBundleFromCloud(slotId) {
  return mergeSlotBundleFromCloud(slotId);
}
