/**
 * Entrada da tela inicial (home.html).
 *
 * Carrega o armazenamento persistente (IndexedDB) antes da tela inicial,
 * que consulta slots e saves de forma síncrona.
 */
import '../css/fonts.css';
import { initPersistentStore } from './core/storage-backend.js';

initPersistentStore().finally(() => import('./home-app.js'));
