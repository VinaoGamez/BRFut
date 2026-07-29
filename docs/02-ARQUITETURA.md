# 02 — Arquitetura

## Padrão

**Monolito cliente modular** — Vite + ES modules. Regras em `js/engine/` e `js/feature/`; `js/legacy/engine.js` é o **compositor** (~7,5k linhas): boot, wiring de factories e estado mínimo de sessão.

## Camadas

```
┌─────────────────────────────────────────────────────────────┐
│  home.html → js/home.js  │  index.html → js/main.js        │
├─────────────────────────────────────────────────────────────┤
│  js/feature/*     UI (dashboard, tactics, options, …)       │
├─────────────────────────────────────────────────────────────┤
│  js/legacy/engine.js   compositor + handlers residuais      │
├─────────────────────────────────────────────────────────────┤
│  js/engine/*      motores puros (match, season, transfers)  │
├─────────────────────────────────────────────────────────────┤
│  js/core/*        save, slots, sync API, career-activate    │
├─────────────────────────────────────────────────────────────┤
│  js/ui/*          dom, router, crests, boot-gate            │
├─────────────────────────────────────────────────────────────┤
│  localStorage + API nuvem (5081 / api.brfut.com.br)         │
└─────────────────────────────────────────────────────────────┘
```

## Fluxo de boot (`index.html`)

1. **`runCareerBootMigration()`** — migra `matchday-*` → `brfut-*`, slots legados.
2. **Auth gate** — sem token → redirect `home.html` (exceto reload pendente).
3. **`prepareGameSession({ slotId })`** — hidratação única da nuvem + `activateSlot`.
4. **`bootEngine()`** — pirâmide, clubes, calendário, features, partida.
5. **`markBootReady()`** — só em `main.js` (libera splash).

## Extrações recentes do compositor (2026-07)

| Módulo | Responsabilidade |
|--------|------------------|
| `engine/career-pyramid-bootstrap.js` | Pirâmide A–D (CBF ou fallback) |
| `engine/career-clubs-bootstrap.js` | Elencos IA, `worldRosters`, cascade host |
| `engine/season-save-writer.js` | `createSeasonSaveWriter` / `persistSeason` |
| `engine/round-advance.js` | `createRoundAdvanceEngine` |
| `feature/championship-page/` | UI Campeonatos, bracket Copa/Série D |
| `feature/match-live-entry/` | `#playMatch`, restore snapshot, pênaltis |
| `feature/match-live-audio/lazy.js` | Chunk dinâmico de áudio ao vivo |
| `core/save-key-normalizer.js` | Chaves canônicas local/remoto |
| `core/career-activate.js` | `activateSlot`, `prepareGameSession` |
| `core/save-clear.js` | `clearCareerData(scope)` |

Lista completa: [modularization.md](./modularization.md).

## Persistência (Fase Sync)

| Módulo | Função |
|--------|--------|
| `save-key-normalizer.js` | `matchday-*` → `brfut-*` |
| `storage-api.js` | Cliente API, merge remoto, mutex de boot |
| `career-slot-manager.js` | Índice + bundles por slot (máx. 5) |
| `career-activate.js` | Pipeline **`activateSlot()`** |
| `save-clear.js` | **`clearCareerData('session'|'career'|'all')`** |
| `save-sync.js` | Merge temporada/carreira local vs nuvem |

### Boot idempotente

- `ensureStorageHydrated()` / `initStorageBackend()` — **uma vez** por sessão.
- `activateSlot(id)` — merge bundle remoto, flush slot anterior, copia bundle → chaves ativas.

## Estado de sessão (`bootEngine`)

Variáveis no closure do compositor (não globais):

- `clubs`, `userClub`, `careerSeason`, `savedNewGame`, `validSavedSeason`
- `cupCompetition`, `nationalCompetitions`, `calendarGames`, …
- Features instanciadas via `create*Feature({ getX, setX, … })`

## Lazy loading

- Calendário, mercado UI, base juvenil: `createLazyFeature()` em `engine/lazy-feature-loader.js`.
- Áudio ao vivo: `createLazyMatchLiveAudio()` — chunk `match-live-*.js` separado no build.

## Testes de regressão (sync/boot)

```powershell
node scripts/career-slot-tests.mjs
node scripts/career-sync-tests.mjs
node scripts/boot-order-tests.mjs
npm run test:all
```

## CSS

Build Vite — CSS em `css/` linkado em `index.html` / importado nos entries. Features **não** injetam `<style>` (exceto `security/tester-hardening.js`).

## Documentação relacionada

- [Plano de modularização](./PLANO-MODULARIZACAO.md)
- [Motores](./03-MOTORES.md)
- [Rotinas e fluxos](./04-ROTINAS-FLUXOS.md)
- [VPS / API](./VPS-LOCAWEB.md)
