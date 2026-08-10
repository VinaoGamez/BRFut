import { ACTIVE_SLOT_SESSION_KEY, BRFUT_API_ORIGIN, CAREER_INDEX_KEY } from './constants.js';

const AUTH_TOKEN_KEY = 'brfut-auth-token';
const DB_NAME = 'brfut-career-history';
const DB_VERSION = 1;
const STORE = 'season-outbox';
const SYNCED_PREFIX = 'brfut-career-history-synced';
let flushing = false;

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

export async function queueSeasonHistorySync(archive, managerRanking = null) {
  const careerId = activeCareerId();
  const season = Number(archive?.careerSeason);
  if (!careerId || !season) return false;
  const checksum = String(archive?.checksum || 'legacy');
  try {
    if (localStorage.getItem(`${SYNCED_PREFIX}:${careerId}:${season}`) === checksum) return true;
  } catch { /* continue with outbox */ }
  const seasonManagers = managerRanking && Array.isArray(managerRanking.managers)
    ? {
        formulaVersion: managerRanking.formulaVersion,
        managers: managerRanking.managers.map(manager => ({
          id: manager.id,
          name: manager.name,
          careerHistory: {
            seasons: (manager.careerHistory?.seasons || [])
              .filter(row => Number(row?.season) === season),
          },
        })).filter(manager => manager.careerHistory.seasons.length),
      }
    : null;
  try {
    const db = await openDb();
    if (!db) return false;
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({
      id: `${careerId}:${season}`,
      careerId,
      season,
      checksum,
      archive,
      managerRanking: seasonManagers,
      queuedAt: Date.now(),
    });
    await transactionDone(tx);
    void flushCareerHistoryOutbox();
    return true;
  } catch {
    return false;
  }
}

export async function flushCareerHistoryOutbox() {
  if (flushing || typeof fetch !== 'function') return { ok: false, reason: 'busy' };
  let token;
  try { token = localStorage.getItem(AUTH_TOKEN_KEY); } catch { return { ok: false, reason: 'storage' }; }
  if (!token) return { ok: false, reason: 'auth' };
  flushing = true;
  try {
    const db = await openDb();
    if (!db) return { ok: false, reason: 'indexeddb' };
    const entries = await requestResult(db.transaction(STORE).objectStore(STORE).getAll());
    let synced = 0;
    for (const entry of entries) {
      const response = await fetch(apiUrl(`/api/careers/${encodeURIComponent(entry.careerId)}/seasons/${entry.season}`), {
        method: 'PUT',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ archive: entry.archive, managerRanking: entry.managerRanking }),
      });
      if (!response.ok) return { ok: false, reason: `http_${response.status}`, synced };
      try { localStorage.setItem(`${SYNCED_PREFIX}:${entry.careerId}:${entry.season}`, entry.checksum || 'legacy'); } catch { /* ignore */ }
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(entry.id);
      await transactionDone(tx);
      window.dispatchEvent(new CustomEvent('brfut:season-history-synced', {
        detail: { careerId: entry.careerId, season: entry.season, checksum: entry.checksum },
      }));
      synced += 1;
    }
    return { ok: true, synced };
  } catch {
    return { ok: false, reason: 'network' };
  } finally {
    flushing = false;
  }
}

export async function fetchStructuredSeasonHistory(season) {
  const careerId = activeCareerId();
  let token;
  try { token = localStorage.getItem(AUTH_TOKEN_KEY); } catch { return null; }
  if (!careerId || !token || !season) return null;
  try {
    const response = await fetch(apiUrl(`/api/careers/${encodeURIComponent(careerId)}/seasons/${Number(season)}`), {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    return response.ok ? response.json() : null;
  } catch { return null; }
}

export async function fetchStructuredManagerHistory(managerId) {
  const careerId = activeCareerId();
  let token;
  try { token = localStorage.getItem(AUTH_TOKEN_KEY); } catch { return null; }
  if (!careerId || !token || !managerId) return null;
  try {
    const response = await fetch(apiUrl(`/api/careers/${encodeURIComponent(careerId)}/managers/${encodeURIComponent(managerId)}`), {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    return response.ok ? response.json() : null;
  } catch { return null; }
}

export async function fetchStructuredClubHistory(clubId) {
  const careerId = activeCareerId();
  let token;
  try { token = localStorage.getItem(AUTH_TOKEN_KEY); } catch { return null; }
  if (!careerId || !token || !clubId) return null;
  try {
    const response = await fetch(apiUrl(`/api/careers/${encodeURIComponent(careerId)}/clubs/${encodeURIComponent(clubId)}`), {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    return response.ok ? response.json() : null;
  } catch { return null; }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void flushCareerHistoryOutbox());
  window.addEventListener('brfut:auth-changed', () => void flushCareerHistoryOutbox());
  setTimeout(() => void flushCareerHistoryOutbox(), 0);
}
