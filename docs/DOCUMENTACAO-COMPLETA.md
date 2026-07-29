# BR Fut — Documentação técnica completa

**Produto:** BR Fut (Matchday Football → rebrand)  
**Build de referência:** Alpha V.4.20  
**Tipo:** Simulador de gestão de clube (browser, SPA modular)  
**Stack:** Vite 6, ES modules, localStorage + API REST  
**Última revisão:** Julho 2026

---

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Arquitetura](#2-arquitetura)
3. [Boot e sessão](#3-boot-e-sessão)
4. [Persistência e slots](#4-persistência-e-slots)
5. [Motores de simulação](#5-motores-de-simulação)
6. [Partida ao vivo](#6-partida-ao-vivo)
7. [Temporada e calendário](#7-temporada-e-calendário)
8. [Economia e mercado](#8-economia-e-mercado)
9. [Interface](#9-interface)
10. [Build, testes e hospedagem](#10-build-testes-e-hospedagem)
11. [Referência rápida](#11-referência-rápida)
12. [Documentos especializados](#12-documentos-especializados)

---

## 1. Visão geral

O **BR Fut** é um jogo de gestão de futebol brasileiro executado no navegador. O jogador cria ou continua uma carreira (até 5 slots na nuvem), gerencia elenco, táticas, finanças e disputa campeonatos nacionais, Copa do Brasil, ranking e seleções.

### Características

- **Cliente modular:** ~120 motores em `js/engine/`, ~32 features em `js/feature/`, compositor em `js/legacy/engine.js`.
- **Partidas ao vivo:** simulação tick-a-tick com narração, substituições, pênaltis e shootout.
- **Universo procedural:** seed determinística; pirâmide CBF 2026 quando import disponível.
- **Sync opcional:** conta + API; merge local/remoto por slot.

### Pontos de entrada

| Arquivo | Função |
|---------|--------|
| `home.html` | Landing, login, slots |
| `index.html` | Shell do jogo |
| `js/main.js` | Boot auth + `bootEngine` |
| `js/home.js` | Lógica da home |

### URLs

| Ambiente | URL |
|----------|-----|
| Dev | http://localhost:5080/home.html |
| Testers | http://127.0.0.1:5081/home.html |
| Público | https://vinaogamez.github.io/BRFut/home.html |

---

## 2. Arquitetura

### Camadas

```
home.js / main.js
    → feature/*     (UI, create*Feature(deps))
    → legacy/engine.js   (compositor, wiring)
    → engine/*      (regras puras)
    → core/*        (save, sync, constants)
    → ui/*          (dom, router)
```

### Compositor

`bootEngine()` em `js/legacy/engine.js`:

1. Carrega save (`loadCareerSave`, `loadSeasonSave`).
2. `bootstrapCareerDivisionTeams` + `bootstrapCareerClubs`.
3. Instancia motores (injury, economy, transfers, …).
4. Instancia features (dashboard, tactics, championship-page, …).
5. Liga handlers de rodada (`createRoundAdvanceEngine`).
6. Hidrata UI e agenda pós-boot (partida ao vivo, idle CPU).

Estado mutável vive no **closure** do boot — não há store global.

### Modularização concluída (resumo)

- Boot carreira: `career-pyramid-bootstrap`, `career-clubs-bootstrap`, `career-persistence`.
- Temporada: `season-save-writer`, `round-advance`, `season-transition`, `calendar-week-advance`.
- Ao vivo: `match-live-orchestration`, `match-live-session`, `match-live-entry`, `match-live-ui`, lazy audio.
- Sync: `career-activate`, `save-key-normalizer`, `career-slot-manager`, `storage-api`.

Detalhes: [PLANO-MODULARIZACAO.md](./PLANO-MODULARIZACAO.md), [modularization.md](./modularization.md).

---

## 3. Boot e sessão

### Home

1. `probeBackend()` — API disponível?
2. Login via `feature/account`.
3. Lista slots → usuário escolhe ou cria.
4. `activateSlot(id)` → redirect `index.html?slot=`.

### Jogo (`main.js`)

```text
runCareerBootMigration()
→ auth gate (token ou home)
→ prepareGameSession({ slotId })
→ bootEngine({ bus, openAccountLogin, … })
→ markBootReady()
```

### Pós-boot

- Restore partida (`match-live-entry.tryRestoreLiveMatch`).
- Simular resto da rodada CPU se idle.
- Preparar transição de temporada se aplicável.

---

## 4. Persistência e slots

### Chaves canônicas (`brfut-*`)

| Chave | Conteúdo |
|-------|----------|
| `brfut-career` | Metadados carreira, pirâmide, worldRosters |
| `brfut-season` | Temporada em curso |
| `brfut-player-history` | Estatísticas acumuladas |
| `brfut-live-match` | Snapshot ao vivo |
| `brfut-career-index` | Até 5 slots |

Bundles: `brfut-slot-{id}-career|season|player-history|live-match`.

### Pipeline `activateSlot`

1. Hidratar storage (mutex único).
2. Merge bundle remoto se logado.
3. Flush + sync slot anterior.
4. Copiar bundle → chaves ativas.

### Limpeza

`clearCareerData('session' | 'career' | 'all')` — ver `save-clear.js`.

Documentação expandida: [05-MODELOS-DADOS.md](./05-MODELOS-DADOS.md).

---

## 5. Motores de simulação

### Partida

- **`match-sim.js`** — partida completa sem UI (`simulateRoundMatch`).
- **`match-live.js`** + **`match-live-orchestration.js`** — ao vivo.
- **`match-tuning.js`** — foul risk, blowout damp, lineups sim.
- **`match-core.js`** — formações e tática efetiva.

### Rodada / temporada

- **`round-advance.js`** — commit após jogo do usuário.
- **`season-transition.js`** — fim de ano, movimentações.
- **`national-round-sim.js`** — jogos CPU em lote.

### Mundo

- **`player-generation.js`** — atributos e overall.
- **`world-rosters.js`** — snapshot para mercado.
- **`brazil-official-pyramid.js`** — clubes reais por UF.

Mapa completo: [03-MOTORES.md](./03-MOTORES.md).

---

## 6. Partida ao vivo

### Fluxo

1. `#playMatch` (`match-live-entry`).
2. Pré-jogo — escalação (`tactics`), `openPreparation`.
3. Relógio — `match-clock` + ritmo (`brfut-pace`).
4. Eventos — orchestration → live actions → DOM (`match-live-ui`).
5. Fim — `renderFinalSummary`, AVANÇAR → `advanceSeasonRound`.

### Persistência mid-match

`live-match-persist.js` grava snapshot; restore no boot ou refresh.

### Áudio

`match-live-audio/lazy.js` — chunk separado; unlock no primeiro gesto.

Teoria de jogadas: [08-JOGADAS-E-RITMO.md](./08-JOGADAS-E-RITMO.md).

---

## 7. Temporada e calendário

- **Calendário CBF** — `season-scheduler`, `season-calendar-plan`, `league-fixtures`.
- **Copa do Brasil** — fases 1–9, entradas por divisão.
- **Série D** — 16×6 grupos, mata-mata (`serie-d-format`).
- **Estadual** — `state-league.js` (feature flag).
- **Treinos** — `training-development.js`, regras em `brfut-training-rules`.

Avanço semanal: `calendar-week-advance.js` integrado ao compositor.

---

## 8. Economia e mercado

- **Orçamento e estádio** — `economy.js`, `stadium-sectors.js`.
- **Empréstimo** — `bank-loan.js` (juros compostos, atraso).
- **Insolvência** — `club-solvency.js` → modais demissão/falência.
- **Mercado** — `transfers.js` + UI lazy; fit entre divisões.

Visão de produto: [10-ECOSSISTEMA-ECONOMICO.md](./10-ECOSSISTEMA-ECONOMICO.md).  
Risco/demissão: [09-RISCO-QUEBRA-FINANCEIRA.md](./09-RISCO-QUEBRA-FINANCEIRA.md).

---

## 9. Interface

Features por view — ver [06-INTERFACE.md](./06-INTERFACE.md).

Padrão factory:

```javascript
const dashboard = createDashboardFeature({
  $, onClick,
  getUserClub: () => userClub,
  getClubs: () => clubs,
  // …
});
dashboard.init();
```

Router: `ui/router.js` + `.nav[data-view]`.

---

## 10. Build, testes e hospedagem

### Build

```powershell
npm run build          # dist/
npm run test:all       # scripts/*-tests.mjs
```

Testers locais: rebuild + `tester-server.py --port 5081`.

### Testes críticos sync

```powershell
node scripts/career-slot-tests.mjs
node scripts/career-sync-tests.mjs
node scripts/boot-order-tests.mjs
```

Detalhes: [07-HOSPEDAGEM.md](./07-HOSPEDAGEM.md), [GUIA-TESTER.md](./GUIA-TESTER.md).

---

## 11. Referência rápida

| Constante | Onde |
|-----------|------|
| `BUILD_VERSION` | `js/core/constants.js` |
| `SAVE_KEYS` | `js/core/constants.js` |
| `FEATURES` | `js/core/constants.js` |
| `MODULE_VERSIONS` | `js/core/constants.js` |
| Release notes | `js/core/release-notes.js` |

| Script | Uso |
|--------|-----|
| `npm run dev` | Desenvolvimento |
| `npm run build` | Produção / 5081 |
| `npm run test:all` | Regressão motores |

---

## 12. Documentos especializados

| Doc | Tema |
|-----|------|
| [INDICE.md](./INDICE.md) | Índice geral |
| [01-VISAO-GERAL.md](./01-VISAO-GERAL.md) | Produto |
| [02-ARQUITETURA.md](./02-ARQUITETURA.md) | Camadas, sync |
| [03-MOTORES.md](./03-MOTORES.md) | Mapa engine |
| [04-ROTINAS-FLUXOS.md](./04-ROTINAS-FLUXOS.md) | Fluxos |
| [05-MODELOS-DADOS.md](./05-MODELOS-DADOS.md) | Saves |
| [06-INTERFACE.md](./06-INTERFACE.md) | UI |
| [07-HOSPEDAGEM.md](./07-HOSPEDAGEM.md) | Deploy |
| [08-JOGADAS-E-RITMO.md](./08-JOGADAS-E-RITMO.md) | Partida |
| [09-RISCO-QUEBRA-FINANCEIRA.md](./09-RISCO-QUEBRA-FINANCEIRA.md) | Finanças |
| [10-ECOSSISTEMA-ECONOMICO.md](./10-ECOSSISTEMA-ECONOMICO.md) | Economia |
| [VPS-LOCAWEB.md](./VPS-LOCAWEB.md) | API / VPS |
| [SECURITY.md](./SECURITY.md) | Hardening |

---

*Documento consolidado — para detalhes algorítmicos profundos, consulte os motores em `js/engine/` e testes em `scripts/`.*
