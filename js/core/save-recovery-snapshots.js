/**
 * Checkpoints imutáveis em IndexedDB, criados antes de qualquer merge local/nuvem.
 * Mantém poucas revisões e nunca interfere no boot quando IndexedDB não está disponível.
 */
const DB_NAME = 'brfut-save-recovery';
const DB_VERSION = 1;
const STORE_NAME = 'snapshots';
const MAX_SNAPSHOTS = 5;

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('indexeddb_unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('indexeddb_open_failed'));
  });
}

function localSnapshot() {
  const saves = {};
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || (!key.startsWith('brfut-') && !key.startsWith('matchday-'))) continue;
      const raw = localStorage.getItem(key);
      if (raw == null) continue;
      try {
        saves[key] = JSON.parse(raw);
      } catch {
        saves[key] = raw;
      }
    }
  } catch {
    /* best effort */
  }
  return saves;
}

export async function createRecoverySnapshot(remoteSaves = {}, { reason = 'cloud-merge' } = {}) {
  let db;
  try {
    db = await openDb();
    const createdAt = Date.now();
    const record = {
      id: `${createdAt}-${Math.random().toString(36).slice(2, 9)}`,
      createdAt,
      reason,
      local: localSnapshot(),
      remote: remoteSaves && typeof remoteSaves === 'object' ? remoteSaves : {},
    };
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('snapshot_write_failed'));
    });
    const records = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error || new Error('snapshot_read_failed'));
    });
    const stale = records
      .sort((a, b) => Number(b.createdAt) - Number(a.createdAt))
      .slice(MAX_SNAPSHOTS);
    if (stale.length) {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        stale.forEach(item => tx.objectStore(STORE_NAME).delete(item.id));
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error || new Error('snapshot_prune_failed'));
      });
    }
    return record.id;
  } catch {
    return null;
  } finally {
    db?.close?.();
  }
}

export async function listRecoverySnapshots() {
  let db;
  try {
    db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).getAll();
      request.onsuccess = () =>
        resolve((request.result || []).sort((a, b) => Number(b.createdAt) - Number(a.createdAt)));
      request.onerror = () => reject(request.error || new Error('snapshot_read_failed'));
    });
  } catch {
    return [];
  } finally {
    db?.close?.();
  }
}
