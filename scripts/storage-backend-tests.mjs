/**
 * Testes da camada de armazenamento (js/core/storage-backend.js) com IndexedDB simulado.
 */
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';

class MemoryStorage {
  constructor() { this.map = new Map(); this.quota = Infinity; }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()].at(i) ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) {
    const size = [...this.map.entries()].reduce((n, [key, val]) => n + (key === k ? 0 : val.length), 0) + String(v).length;
    if (size > this.quota) { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; }
    this.map.set(k, String(v));
  }
  removeItem(k) { this.map.delete(k); }
  clear() { this.map.clear(); }
}

globalThis.localStorage = new MemoryStorage();
const mod = await import('../js/core/storage-backend.js');
const { storage, initPersistentStore, flushPersistentStore, resetPersistentStoreForTests, MIRROR_MAX_CHARS } = mod;
const big = (ch, n = MIRROR_MAX_CHARS + 10) => ch.repeat(n);
let passed = 0;
const test = async (name, fn) => { await fn(); passed += 1; console.log('ok ', name); };

await test('antes do init delega ao localStorage', () => {
  storage.setItem('brfut-pre', 'x');
  assert.equal(localStorage.getItem('brfut-pre'), 'x');
  assert.equal(storage.getItem('brfut-pre'), 'x');
});

await test('init migra saves grandes do localStorage para o IndexedDB', async () => {
  localStorage.setItem('brfut-career', big('c'));
  localStorage.setItem('brfut-pace', 'rapido');
  assert.equal(await initPersistentStore(), true);
  assert.equal(storage.getItem('brfut-career').length, MIRROR_MAX_CHARS + 10);
  assert.equal(localStorage.getItem('brfut-career'), null, 'grande sai do localStorage');
  assert.equal(localStorage.getItem('brfut-pace'), 'rapido', 'pequeno continua espelhado');
});

await test('gravação grande não esbarra na cota do localStorage', async () => {
  localStorage.quota = 200_000;
  storage.setItem('brfut-season', big('s', 3_000_000));
  storage.setItem('brfut-slot-a-season', big('t', 3_000_000));
  await flushPersistentStore();
  assert.equal(storage.getItem('brfut-season').length, 3_000_000);
  localStorage.quota = Infinity;
});

await test('dados sobrevivem a uma recarga (novo init lê o IndexedDB)', async () => {
  storage.setItem('brfut-index', '{"v":2}');
  storage.removeItem('brfut-pre');
  await flushPersistentStore();
  resetPersistentStoreForTests();
  assert.equal(await initPersistentStore(), true);
  assert.equal(storage.getItem('brfut-season').length, 3_000_000);
  assert.equal(storage.getItem('brfut-index'), '{"v":2}');
  assert.equal(storage.getItem('brfut-pre'), null);
});

await test('cópia de emergência no localStorage tem prioridade no próximo boot', async () => {
  // Simula uma gravação grande cuja transação não concluiu: só a cópia de emergência ficou.
  localStorage.setItem('brfut-career', big('n'));
  resetPersistentStoreForTests();
  await initPersistentStore();
  assert.equal(storage.getItem('brfut-career').at(0), 'n');
  assert.equal(localStorage.getItem('brfut-career'), null, 'volta para o IndexedDB e sai do localStorage');
});

await test('regravar valor grande remove espelho antigo do localStorage', async () => {
  localStorage.setItem('brfut-player-history', 'pequeno');
  storage.setItem('brfut-player-history', big('h'));
  assert.equal(localStorage.getItem('brfut-player-history'), null);
});

await test('key/length/clear seguem a interface do localStorage', async () => {
  const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i));
  assert.ok(keys.includes('brfut-season'));
  storage.clear();
  assert.equal(storage.length, 0);
  await flushPersistentStore();
  resetPersistentStoreForTests();
  await initPersistentStore();
  assert.equal(storage.length, 0);
});

console.log(`\n${passed} testes de armazenamento OK`);
