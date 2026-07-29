/**
 * Cliente da API local BR Football (porta 5081).
 * Espelha saves do localStorage em Documentos/BR Fut quando o usuário está logado.
 */
import { SAVE_KEYS, BRFUT_API_ORIGIN } from './constants.js';
import { pickNewerSave, saveFreshness } from './save-sync.js';

const AUTH_TOKEN_KEY = 'brfut-auth-token';
const AUTH_REMEMBER_KEY = 'brfut-auth-remember';
const SYNCABLE_KEYS = Object.values(SAVE_KEYS);
const SYNC_DEBOUNCE_MS = 400;
const PRESENCE_INTERVAL_MS = 120_000;

let backendAvailable = null;
let cloudActive = false;
let currentUser = null;
const syncQueue = new Map();
let syncTimer = 0;
let presenceTimer = 0;

const apiUrl = path => new URL(path, BRFUT_API_ORIGIN || window.location.origin).toString();

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
    const remembered = localStorage.getItem(AUTH_REMEMBER_KEY) === '1';
    if (remembered) {
      return localStorage.getItem(AUTH_TOKEN_KEY) || '';
    }
    return sessionStorage.getItem(AUTH_TOKEN_KEY) || '';
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

export function getCloudUser() {
  return currentUser;
}

export async function probeBackend() {
  if (backendAvailable != null) return backendAvailable;
  try {
    const response = await fetch(apiUrl('/api/health'), { cache: 'no-store' });
    if (!response.ok) {
      backendAvailable = false;
      return false;
    }
    const body = await parseJsonResponse(response);
    backendAvailable = body?.ok === true && body?.service === 'brfut-api';
  } catch {
    backendAvailable = false;
  }
  return backendAvailable;
}

async function authedFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body != null && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(apiUrl(path), { ...options, headers, cache: 'no-store' });
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

function readLocalSave(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function mergeRemoteSaves(saves) {
  if (!saves || typeof saves !== 'object') return;
  Object.entries(saves).forEach(([key, rawEntry]) => {
    if (!SYNCABLE_KEYS.includes(key)) return;
    const { value: remoteValue, updatedAt: remoteEnvelopeAt } = normalizeRemoteSaveEntry(rawEntry);
    if (remoteValue == null) return;

    const localValue = readLocalSave(key);
    if (!localValue) {
      try {
        localStorage.setItem(key, JSON.stringify(remoteValue));
      } catch {
        /* ignore quota during hydrate */
      }
      return;
    }

    const winner = pickNewerSave(localValue, remoteValue, key, remoteEnvelopeAt);
    // #region agent log
    if (key === SAVE_KEYS.season && typeof fetch !== 'undefined') {
      fetch('http://127.0.0.1:7743/ingest/6125dd39-2579-4c29-a7c1-51d14474875e', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '25cc52' },
        body: JSON.stringify({
          sessionId: '25cc52',
          location: 'storage-api.js:mergeRemoteSaves',
          message: 'season merge winner',
          data: {
            localRound: localValue?.currentRound,
            remoteRound: remoteValue?.currentRound,
            winnerIsRemote: winner === remoteValue,
            localCal: localValue?.careerCalendarDate,
            remoteCal: remoteValue?.careerCalendarDate,
          },
          hypothesisId: 'D',
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    }
    // #endregion
    try {
      localStorage.setItem(key, JSON.stringify(winner));
    } catch {
      /* ignore quota during hydrate */
    }

    const localScore = saveFreshness(localValue, key);
    const remoteScore = Math.max(saveFreshness(remoteValue, key), remoteEnvelopeAt || 0);
    if (winner === localValue && localScore > remoteScore && isCloudStorageActive()) {
      queueCloudSave(key, localValue);
    }
  });
}

/** Chrome limita corpo de fetch keepalive a ~64 KB — acima disso a requisição falha em silêncio. */
const KEEPALIVE_BODY_LIMIT = 60_000;

function flushSyncQueueKeepalive() {
  if (!isCloudStorageActive() || !syncQueue.size) return;
  const batch = new Map(syncQueue);
  syncQueue.clear();
  const token = getAuthToken();
  batch.forEach((value, key) => {
    const body = JSON.stringify({ value });
    const useKeepalive = body.length <= KEEPALIVE_BODY_LIMIT;
    fetch(apiUrl(`/api/saves/${encodeURIComponent(key)}`), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body,
      keepalive: useKeepalive,
      cache: 'no-store',
    }).catch(error => {
      console.warn('[brfut] falha ao sincronizar save (keepalive)', key, error);
      syncQueue.set(key, value);
    });
    if (!useKeepalive) {
      console.warn(
        '[brfut] save grande demais para keepalive — sync completo na próxima sessão',
        key,
        `${Math.round(body.length / 1024)}KB`,
      );
    }
  });
}

export function flushCloudSync({ urgent = false } = {}) {
  if (!isCloudStorageActive()) return;
  if (syncTimer) {
    window.clearTimeout(syncTimer);
    syncTimer = 0;
  }
  if (urgent) flushSyncQueueKeepalive();
  else flushSyncQueue();
}

/** Aguarda upload na nuvem (sem keepalive — suporta saves grandes). Usado no save manual. */
export async function flushCloudSyncAsync() {
  if (!isCloudStorageActive()) return { ok: true, synced: 0, mode: 'local' };
  if (syncTimer) {
    window.clearTimeout(syncTimer);
    syncTimer = 0;
  }
  if (!syncQueue.size) return { ok: true, synced: 0, mode: 'cloud' };
  const batch = new Map(syncQueue);
  syncQueue.clear();
  const results = await Promise.all(
    [...batch.entries()].map(async ([key, value]) => {
      try {
        await authedFetch(`/api/saves/${encodeURIComponent(key)}`, {
          method: 'PUT',
          body: JSON.stringify({ value }),
        });
        return { key, ok: true };
      } catch (error) {
        console.warn('[brfut] falha ao sincronizar save', key, error);
        syncQueue.set(key, value);
        scheduleCloudSync();
        return { key, ok: false };
      }
    }),
  );
  const failed = results.filter(entry => !entry.ok);
  return {
    ok: failed.length === 0,
    synced: results.length - failed.length,
    failed: failed.map(entry => entry.key),
    mode: 'cloud',
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
  return out;
}

function flushSyncQueue() {
  syncTimer = 0;
  if (!isCloudStorageActive() || !syncQueue.size) return;
  const batch = new Map(syncQueue);
  syncQueue.clear();
  batch.forEach((value, key) => {
    authedFetch(`/api/saves/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    }).catch(error => {
      console.warn('[brfut] falha ao sincronizar save', key, error);
      syncQueue.set(key, value);
      scheduleCloudSync();
    });
  });
}

function scheduleCloudSync() {
  if (!isCloudStorageActive()) return;
  if (syncTimer) return;
  syncTimer = window.setTimeout(flushSyncQueue, SYNC_DEBOUNCE_MS);
}

export function queueCloudSave(key, value) {
  if (!isCloudStorageActive() || !SYNCABLE_KEYS.includes(key)) return;
  syncQueue.set(key, value);
  scheduleCloudSync();
}

export function queueCloudDelete(key) {
  if (!isCloudStorageActive() || !SYNCABLE_KEYS.includes(key)) return;
  syncQueue.delete(key);
  authedFetch(`/api/saves/${encodeURIComponent(key)}`, { method: 'DELETE' }).catch(error => {
    console.warn('[brfut] falha ao apagar save na nuvem local', key, error);
  });
}

export async function loginWithGoogleIdToken(idToken, { remember = false } = {}) {
  const body = await authedFetch('/api/auth/google', {
    method: 'POST',
    body: JSON.stringify({ idToken }),
  });
  setAuthToken(body.token, { remember });
  currentUser = body.user;
  cloudActive = true;
  return initStorageBackend({ skipProbe: true, preferMigrate: true });
}

export async function loginAccount(username, password, { remember = false } = {}) {
  const body = await authedFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setAuthToken(body.token, { remember });
  currentUser = body.user;
  cloudActive = true;
  return initStorageBackend({ skipProbe: true });
}

export async function registerAccount(username, password, displayName, { remember = false } = {}) {
  const body = await authedFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password, displayName }),
  });
  setAuthToken(body.token, { remember });
  currentUser = body.user;
  cloudActive = true;
  return initStorageBackend({ skipProbe: true, preferMigrate: true });
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
  stopPresenceHeartbeat();
  syncQueue.clear();
  if (syncTimer) {
    window.clearTimeout(syncTimer);
    syncTimer = 0;
  }
}

/** Encerra sessão no fechamento da aba (save já deve ter sido gravado antes). */
export function endBrowserSession() {
  flushCloudSync({ urgent: true });
  try {
    const token = getAuthToken();
    if (token && typeof fetch !== 'undefined') {
      fetch(apiUrl('/api/auth/logout'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    /* ignore */
  }
  setAuthToken('');
  currentUser = null;
  cloudActive = false;
  stopPresenceHeartbeat();
  syncQueue.clear();
  if (syncTimer) {
    window.clearTimeout(syncTimer);
    syncTimer = 0;
  }
}

async function migrateLocalToCloud({ overwrite = false } = {}) {
  const local = localSavesSnapshot();
  if (!Object.keys(local).length) return { imported: [], skipped: [] };
  return authedFetch('/api/saves/migrate', {
    method: 'POST',
    body: JSON.stringify({ saves: local, overwrite }),
  });
}

/**
 * Inicializa backend de storage: valida sessão, baixa saves e opcionalmente migra localStorage.
 * @returns {Promise<{ mode: 'local'|'cloud', user?: object, dataRoot?: string }>}
 */
export async function initStorageBackend({ skipProbe = false, preferMigrate = false } = {}) {
  if (!skipProbe && !(await probeBackend())) {
    cloudActive = false;
    currentUser = null;
    return { mode: 'local' };
  }

  const token = getAuthToken();
  if (!token) {
    cloudActive = false;
    currentUser = null;
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
    return { mode: 'local', backend: true, authError: error?.message };
  }

  const remote = await authedFetch('/api/saves');
  const remoteSaves = remote?.saves || {};
  const hasRemoteCareer = remoteHasCareer(remoteSaves);
  const hasLocalCareer = !!localStorage.getItem(SAVE_KEYS.career);

  if (!hasRemoteCareer && hasLocalCareer) {
    await migrateLocalToCloud();
    const refreshed = await authedFetch('/api/saves');
    mergeRemoteSaves(refreshed?.saves || {});
  } else if (hasRemoteCareer) {
    mergeRemoteSaves(remoteSaves);
  }

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
