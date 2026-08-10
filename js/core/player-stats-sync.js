/**
 * Outbox incremental de estatísticas.
 * IndexedDB mantém partidas até a API confirmar; o save principal continua
 * sendo o fallback para jogo offline e migração de carreiras antigas.
 */
import {
  ACTIVE_SLOT_SESSION_KEY,
  BRFUT_API_ORIGIN,
  CAREER_INDEX_KEY,
} from './constants.js';

const DB_NAME = 'brfut-player-stats';
const DB_VERSION = 1;
const STORE = 'match-outbox';
const AUTH_TOKEN_KEY = 'brfut-auth-token';
let flushing = false;

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

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function activeCareerId() {
  try {
    const session = sessionStorage.getItem(ACTIVE_SLOT_SESSION_KEY);
    if (session) return session;
    const index = JSON.parse(localStorage.getItem(CAREER_INDEX_KEY) || 'null');
    return index?.activeSlotId || null;
  } catch {
    return null;
  }
}

function apiUrl(path) {
  const origin = String(BRFUT_API_ORIGIN || '').replace(/\/+$/, '');
  return `${origin}${path}`;
}

function toApiMatch(log) {
  return {
    fixtureId: log.fixtureId || log.id,
    season: Number(log.season),
    competitionId: log.competition || 'LEAGUE',
    round: log.round ?? null,
    homeClub: log.home,
    awayClub: log.away,
    homeGoals: Number(log.homeGoals) || 0,
    awayGoals: Number(log.awayGoals) || 0,
    playedAt: log.date || new Date().toISOString(),
    players: (log.players || []).map(row => ({
      playerId: row.key,
      name: row.name,
      clubId: row.club,
      started: !!row.started,
      minutes: Number(row.minutes) || 0,
      goals: Number(row.goals) || 0,
      assists: Number(row.assists) || 0,
      ownGoals: Number(row.ownGoals) || 0,
      yellow: !!row.yellow,
      red: !!row.red,
      passes: Number(row.passes) || 0,
      rating: row.rating == null ? null : Number(row.rating),
    })),
  };
}

export async function queuePlayerStatsMatch(log) {
  const careerId = activeCareerId();
  if (!careerId || !log?.id) return false;
  try {
    const db = await openDb();
    if (!db) return false;
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({
      id: `${careerId}:${log.fixtureId || log.id}`,
      careerId,
      match: toApiMatch(log),
      queuedAt: Date.now(),
    });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    void flushPlayerStatsOutbox();
    return true;
  } catch {
    return false;
  }
}

export async function queuePlayerStatsHistory(logs) {
  const careerId = activeCareerId();
  if (!careerId || !Array.isArray(logs) || !logs.length) return 0;
  try {
    const db = await openDb();
    if (!db) return 0;
    const tx = db.transaction(STORE, 'readwrite');
    logs.forEach(log => {
      if (!log?.id) return;
      tx.objectStore(STORE).put({
        id: `${careerId}:${log.fixtureId || log.id}`,
        careerId,
        match: toApiMatch(log),
        queuedAt: Date.now(),
      });
    });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    void flushPlayerStatsOutbox();
    return logs.length;
  } catch {
    return 0;
  }
}

/**
 * Compara o buffer local com o manifesto confirmado pela API e reenfileira
 * apenas partidas ausentes. Em falha de rede, reenfileira tudo: o PUT da API
 * é idempotente por fixtureId.
 */
export async function reconcilePlayerStatsHistory(logs) {
  const careerId = activeCareerId();
  if (!careerId || !Array.isArray(logs) || !logs.length) return 0;
  const seasons = [...new Set(logs.map(log => Number(log?.season)).filter(Boolean))];
  const confirmed = new Set();
  for (const season of seasons) {
    const data = await statsGet(
      `/api/careers/${encodeURIComponent(careerId)}/stats/matches?season=${encodeURIComponent(season)}`,
    );
    (data?.matches || []).forEach(row => confirmed.add(String(row.fixture_id || row.fixtureId)));
  }
  const missing = logs.filter(log => !confirmed.has(String(log?.fixtureId || log?.id)));
  return queuePlayerStatsHistory(missing.length || seasons.length ? missing : logs);
}

export async function flushPlayerStatsOutbox() {
  if (flushing || typeof fetch !== 'function') return { ok: false, reason: 'busy' };
  let token = null;
  try {
    token = localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return { ok: false, reason: 'storage' };
  }
  if (!token) return { ok: false, reason: 'auth' };
  flushing = true;
  try {
    const db = await openDb();
    if (!db) return { ok: false, reason: 'indexeddb' };
    const entries = await requestResult(db.transaction(STORE).objectStore(STORE).getAll());
    const groups = new Map();
    entries.forEach(entry => {
      if (!groups.has(entry.careerId)) groups.set(entry.careerId, []);
      groups.get(entry.careerId).push(entry);
    });
    let synced = 0;
    for (const [careerId, rows] of groups) {
      for (let offset = 0; offset < rows.length; offset += 25) {
        const batch = rows.slice(offset, offset + 25);
        const response = await fetch(apiUrl(`/api/careers/${encodeURIComponent(careerId)}/stats/matches`), {
          method: 'POST',
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ matches: batch.map(row => row.match) }),
        });
        if (!response.ok) return { ok: false, reason: `http_${response.status}`, synced };
        const tx = db.transaction(STORE, 'readwrite');
        batch.forEach(row => tx.objectStore(STORE).delete(row.id));
        await new Promise((resolve, reject) => {
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error);
        });
        synced += batch.length;
      }
    }
    return { ok: true, synced };
  } catch {
    return { ok: false, reason: 'network' };
  } finally {
    flushing = false;
  }
}

async function statsGet(path) {
  let token = null;
  try {
    token = localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
  if (!token) return null;
  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 2500) : null;
    const response = await fetch(apiUrl(path), {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: controller?.signal,
    });
    if (timer) clearTimeout(timer);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export async function deleteCareerStats(careerId) {
  if (!careerId || typeof fetch !== 'function') return false;
  let token = null;
  try {
    token = localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return false;
  }
  if (!token) return false;
  try {
    const response = await fetch(
      apiUrl(`/api/careers/${encodeURIComponent(careerId)}/stats`),
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    return response.ok;
  } catch {
    return false;
  }
}

export async function fetchPlayerSeasonStats(playerId, season, clubId = null) {
  const careerId = activeCareerId();
  if (!careerId || !playerId || !season) return null;
  const club = clubId ? `&club=${encodeURIComponent(clubId)}` : '';
  return statsGet(
    `/api/careers/${encodeURIComponent(careerId)}/stats/players/${encodeURIComponent(playerId)}?season=${encodeURIComponent(season)}${club}`,
  );
}

export async function fetchClubSeasonStats(clubId, season, competitionId = null) {
  const careerId = activeCareerId();
  if (!careerId || !clubId || !season) return null;
  const competition = competitionId ? `&competition=${encodeURIComponent(competitionId)}` : '';
  return statsGet(
    `/api/careers/${encodeURIComponent(careerId)}/stats/clubs/${encodeURIComponent(clubId)}/squad?season=${encodeURIComponent(season)}${competition}`,
  );
}

export async function fetchSeasonLeaders(season, { competitionId = null, metric = 'goals' } = {}) {
  const careerId = activeCareerId();
  if (!careerId || !season) return null;
  const competition = competitionId ? `&competition=${encodeURIComponent(competitionId)}` : '';
  return statsGet(
    `/api/careers/${encodeURIComponent(careerId)}/stats/leaders?season=${encodeURIComponent(season)}&metric=${encodeURIComponent(metric)}${competition}`,
  );
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void flushPlayerStatsOutbox());
  window.addEventListener('brfut:auth-changed', () => void flushPlayerStatsOutbox());
  setTimeout(() => void flushPlayerStatsOutbox(), 0);
}
