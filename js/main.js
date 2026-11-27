/**
 * Entrada do jogo (index.html).
 *
 * Carrega o armazenamento persistente (IndexedDB) ANTES de importar o jogo:
 * os módulos leem saves de forma síncrona, inclusive durante a importação.
 */
import { initPersistentStore } from './core/storage-backend.js';

initPersistentStore().finally(() => import('./main-app.js'));
