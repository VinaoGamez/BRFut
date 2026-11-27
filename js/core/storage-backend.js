/**
 * Armazenamento persistente do BR Fut.
 *
 * Interface igual à do `localStorage` (getItem/setItem/removeItem/key/length),
 * mas, depois de `initPersistentStore()`, os dados vivem em memória e são
 * gravados no IndexedDB — que comporta centenas de MB, contra ~5 MB do
 * localStorage (uma carreira passava de 2 MB já na primeira rodada).
 *
 * Regras:
 * - Leituras são síncronas (memória), como o jogo sempre esperou.
 * - Gravações vão para o IndexedDB em lote (uma transação por microtarefa).
 * - Valores pequenos (≤ MIRROR_MAX_CHARS) também ficam no localStorage: é
 *   gravação síncrona, sobrevive a uma navegação imediata e serve de reserva.
 * - Ao esconder/fechar a página, gravações grandes ainda pendentes ganham uma
 *   cópia de emergência no localStorage (se couber); no próximo boot o
 *   localStorage tem prioridade e a cópia volta para o IndexedDB.
 * - Sem IndexedDB (Node/testes, navegação privada restrita) tudo continua
 *   indo direto ao localStorage, com o mesmo comportamento de antes.
 */

const DB_NAME = 'brfut';
const DB_VERSION = 1;
const STORE = 'kv';
export const MIRROR_MAX_CHARS = 64 * 1024;

const memory = new Map();
const pending = new Map(); // key -> string (put) | null (delete)
let db = null;
let ready = false;
let flushScheduled = false;
let initPromise = null;

function legacy() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

function openDb() {
  return new Promise((resolve, reject) => {
    const idb = globalThis.indexedDB;
    if (!idb) {
      reject(new Error('indexeddb_unavailable'));
      return;
    }
    const request = idb.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('indexeddb_open_failed'));
    request.onblocked = () => reject(new Error('indexeddb_blocked'));
  });
}

function readAll(database) {
  return new Promise((resolve, reject) => {
    const out = new Map();
    const tx = database.transaction(STORE, 'readonly');
    const cursorRequest = tx.objectStore(STORE).openCursor();
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor) return;
      if (typeof cursor.value === 'string') out.set(String(cursor.key), cursor.value);
      cursor.continue();
    };
    tx.oncomplete = () => resolve(out);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function writeBatch(entries) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    entries.forEach(([key, value]) => {
      if (value === null) store.delete(key);
      else store.put(value, key);
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function flush() {
  flushScheduled = false;
  if (!db || !pending.size) return Promise.resolve();
  const entries = [...pending.entries()];
  pending.clear();
  return writeBatch(entries).catch(error => {
    // Recoloca o que falhou (sem sobrescrever gravações mais novas) e avisa uma vez.
    entries.forEach(([key, value]) => {
      if (!pending.has(key)) pending.set(key, value);
    });
    console.warn('[brfut] falha ao gravar no IndexedDB', error);
    scheduleFlush();
  });
}

function scheduleFlush() {
  if (flushScheduled) return;
  flushScheduled = true;
  queueMicrotask(flush);
}

function mirrorToLegacy(key, value) {
  const ls = legacy();
  if (!ls) return;
  try {
    if (value === null || value.length > MIRROR_MAX_CHARS) ls.removeItem(key);
    else ls.setItem(key, value);
  } catch {
    /* cota do localStorage: o IndexedDB continua sendo a fonte de verdade */
  }
}

function emergencyCopy() {
  const ls = legacy();
  if (!ls) return;
  pending.forEach((value, key) => {
    if (value === null || value.length <= MIRROR_MAX_CHARS) return;
    try {
      ls.setItem(key, value);
    } catch {
      /* sem espaço: depende do IndexedDB concluir a transação */
    }
  });
  flush();
}

export const storage = {
  getItem(key) {
    key = String(key);
    if (!ready) return legacy()?.getItem(key) ?? null;
    return memory.has(key) ? memory.get(key) : null;
  },
  setItem(key, value) {
    key = String(key);
    value = String(value);
    if (!ready) {
      legacy()?.setItem(key, value);
      return;
    }
    memory.set(key, value);
    pending.set(key, value);
    mirrorToLegacy(key, value);
    scheduleFlush();
  },
  removeItem(key) {
    key = String(key);
    if (!ready) {
      legacy()?.removeItem(key);
      return;
    }
    memory.delete(key);
    pending.set(key, null);
    mirrorToLegacy(key, null);
    scheduleFlush();
  },
  key(index) {
    if (!ready) return legacy()?.key(index) ?? null;
    const keys = [...memory.keys()];
    return index >= 0 && index < keys.length ? keys.at(index) : null;
  },
  get length() {
    if (!ready) return legacy()?.length ?? 0;
    return memory.size;
  },
  clear() {
    if (!ready) {
      legacy()?.clear();
      return;
    }
    [...memory.keys()].forEach(key => this.removeItem(key));
  },
};

/** true quando os dados estão no IndexedDB (e não só no localStorage). */
export function isPersistentStoreActive() {
  return ready;
}

/** Garante que gravações pendentes chegaram ao IndexedDB. */
export function flushPersistentStore() {
  return flush();
}

/**
 * Carrega o IndexedDB para a memória e migra o que estiver no localStorage.
 * Idempotente; chamar antes de importar o restante do jogo.
 */
export function initPersistentStore() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      db = await openDb();
      const stored = await readAll(db);
      stored.forEach((value, key) => memory.set(key, value));
      // O localStorage tem prioridade: é a gravação síncrona mais recente
      // (espelho de valores pequenos ou cópia de emergência de um grande).
      const ls = legacy();
      const migrated = [];
      if (ls) {
        for (let i = 0; i < ls.length; i += 1) {
          const key = ls.key(i);
          if (key === null) continue;
          const value = ls.getItem(key);
          if (value === null) continue;
          if (memory.get(key) !== value) {
            memory.set(key, value);
            pending.set(key, value);
          }
          if (value.length > MIRROR_MAX_CHARS) migrated.push(key);
        }
      }
      // Gravação estrita: se falhar, cai no catch e nada sai do localStorage.
      const initial = [...pending.entries()];
      pending.clear();
      if (initial.length) await writeBatch(initial);
      // Só depois de gravado no IndexedDB os valores grandes saem do localStorage.
      migrated.forEach(key => {
        try {
          ls.removeItem(key);
        } catch {
          /* ignore */
        }
      });
      ready = true;
      if (typeof window !== 'undefined') {
        window.addEventListener('pagehide', emergencyCopy);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'hidden') emergencyCopy();
        });
      }
    } catch (error) {
      ready = false;
      db = null;
      memory.clear();
      pending.clear();
      console.warn('[brfut] IndexedDB indisponível — usando localStorage', error);
    }
    return ready;
  })();
  return initPromise;
}

/** Somente testes: volta ao estado inicial. */
export function resetPersistentStoreForTests() {
  memory.clear();
  pending.clear();
  ready = false;
  db = null;
  initPromise = null;
}
