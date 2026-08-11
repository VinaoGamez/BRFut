/** Persistência API-first dos 27 Estaduais, fora do save principal/localStorage. */
import { ACTIVE_SLOT_SESSION_KEY, BRFUT_API_ORIGIN, CAREER_INDEX_KEY } from './constants.js';
import { authSessionSignal, authenticatedFetchOptions } from './auth-session.js';

const DB_NAME = 'brfut-state-leagues';
const DB_VERSION = 1;
const STORE = 'snapshot-outbox';
let flushing = false;
let prefetchedSnapshot = null;
let apiCapabilityPromise = null;

async function stateLeagueApiAvailable() {
  if (apiCapabilityPromise) return apiCapabilityPromise;
  apiCapabilityPromise = fetch(apiUrl('/api/health'), { cache: 'no-store' })
    .then(async response => {
      if (!response.ok) return false;
      const data = await response.json();
      return data?.capabilities?.stateLeagues === true;
    })
    .catch(() => false);
  return apiCapabilityPromise;
}

function activeCareerId() {
  try {
    return sessionStorage.getItem(ACTIVE_SLOT_SESSION_KEY)
      || JSON.parse(localStorage.getItem(CAREER_INDEX_KEY) || 'null')?.activeSlotId
      || null;
  } catch {
    return null;
  }
}

function apiUrl(path) {
  return `${String(BRFUT_API_ORIGIN || '').replace(/\/+$/, '')}${path}`;
}

function openDb() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function pendingStateLeagueSnapshot(careerId, season) {
  try {
    const db = await openDb();
    if (!db) return null;
    const row = await requestResult(
      db.transaction(STORE).objectStore(STORE).get(`${careerId}:${season}`),
    );
    return row?.snapshot || null;
  } catch {
    return null;
  }
}

export async function queueStateLeagueSnapshot(snapshot) {
  const careerId = activeCareerId();
  const season = Number(snapshot?.seasonYear);
  if (!careerId || !season || !snapshot?.competitions) return false;
  try {
    const db = await openDb();
    if (!db) return false;
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({
      id: `${careerId}:${season}`,
      careerId,
      season,
      snapshot,
      queuedAt: Date.now(),
    });
    await transactionDone(tx);
    void flushStateLeagueOutbox();
    return true;
  } catch {
    return false;
  }
}

export async function flushStateLeagueOutbox() {
  if (flushing || typeof fetch !== 'function') return { ok: false, reason: 'busy' };
  if (!authSessionSignal()) return { ok: false, reason: 'auth' };
  if (!(await stateLeagueApiAvailable())) return { ok: false, reason: 'unsupported' };
  flushing = true;
  try {
    const db = await openDb();
    if (!db) return { ok: false, reason: 'indexeddb' };
    const rows = await requestResult(db.transaction(STORE).objectStore(STORE).getAll());
    let synced = 0;
    for (const row of rows) {
      const response = await fetch(
        apiUrl(`/api/careers/${encodeURIComponent(row.careerId)}/state-leagues/${row.season}`),
        authenticatedFetchOptions({
          method: 'PUT',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ snapshot: row.snapshot }),
        }),
      );
      if (!response.ok) return { ok: false, reason: `http_${response.status}`, synced };
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(row.id);
      await transactionDone(tx);
      synced += 1;
    }
    return { ok: true, synced };
  } catch {
    return { ok: false, reason: 'network' };
  } finally {
    flushing = false;
  }
}

export async function prefetchStateLeagueSnapshot(season) {
  const careerId = activeCareerId();
  const year = Number(season);
  prefetchedSnapshot = null;
  if (!careerId || !year || !authSessionSignal()) return null;
  const pending = await pendingStateLeagueSnapshot(careerId, year);
  if (!(await stateLeagueApiAvailable())) {
    prefetchedSnapshot = pending;
    return prefetchedSnapshot;
  }
  try {
    const response = await fetch(
      apiUrl(`/api/careers/${encodeURIComponent(careerId)}/state-leagues/${year}`),
      authenticatedFetchOptions({ cache: 'no-store' }),
    );
    if (!response.ok) return null;
    const data = await response.json();
    prefetchedSnapshot = data?.snapshot || pending || null;
    return prefetchedSnapshot;
  } catch {
    prefetchedSnapshot = pending;
    return prefetchedSnapshot;
  }
}

export function consumePrefetchedStateLeagueSnapshot() {
  const snapshot = prefetchedSnapshot;
  prefetchedSnapshot = null;
  return snapshot;
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void flushStateLeagueOutbox());
  window.addEventListener('brfut:auth-changed', () => void flushStateLeagueOutbox());
  setTimeout(() => void flushStateLeagueOutbox(), 0);
}
