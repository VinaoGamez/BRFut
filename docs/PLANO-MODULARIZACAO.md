# Plano de modularização — BR Fut (Alpha 02+)

Documento de referência da migração incremental. Builds públicas: **`Alpha V.X.YY`** (+0,05 por release). Ver `js/core/release-notes.js` e `CHANGELOG.md`.

## Estrutura atual (2026-07)

```
js/
  main.js                      ← entry index.html
  home.js                      ← entry home.html
  core/
    constants.js, save.js, event-bus.js
    storage-api.js, career-slot-manager.js
    save-key-normalizer.js, career-activate.js, save-clear.js
  engine/                        (~120 módulos)
    injury, match-*, season-*, transfers, economy, …
    career-pyramid-bootstrap.js, career-clubs-bootstrap.js
    season-save-writer.js, round-advance.js
  ui/
    dom.js, router.js, boot-gate.js, …
  feature/                       (~32 módulos)
    dashboard, tactics, calendar-view, options, …
    championship-page/, match-live-entry/, match-live-session/, …
  legacy/
    engine.js                    ← compositor (~7,5k linhas)
```

## Regras

1. **Motores não tocam DOM** — só regras e estado via deps.
2. **Features não alteram simulação** — UI + handlers.
3. **Save versionado** — `MODULE_VERSIONS` em `constants.js`.
4. **CSS estático** — sem `createElement('style')` nas features (exceto hardening).
5. **Lógica nova não entra em `legacy/engine.js`** — só wiring.

## Fases

| Fase | Escopo | Status |
|------|--------|--------|
| A | Vite, save, dom, router, messages | **Concluída** |
| B | injury, match-tuning, match-core, match-sim, match-live | **Concluída** |
| C | dashboard, tactics, calendar-view, player-cells | **Concluída** |
| D | build testers, guia, feedback | **Concluída** |
| E | economy, season-summary, options, live-day-matches, fatigue, match-live-ui | **Concluída** |
| F | match-availability, match-live-away-subs, match-live-orchestration, match-live-session | **Concluída** |
| G | championship-page, match-live-entry, pyramid/clubs bootstrap, lazy audio, round-advance wiring | **Concluída** |
| **Sync** | slots, cloud merge, activateSlot, save-clear, boot-order tests | **Concluída** |

### Fase G — extrações do compositor

- `feature/championship-page/` — UI campeonatos (~1,3k linhas extraídas)
- `feature/match-live-entry/` — play/restore/pênaltis (~750 linhas)
- `engine/career-pyramid-bootstrap.js` — pirâmide A–D
- `engine/career-clubs-bootstrap.js` — elencos e worldRosters
- `feature/match-live-audio/lazy.js` — code-split áudio
- `markBootReady` centralizado em `main.js`
- Compositor: ~9,2k → ~7,5k linhas

### Fase Sync — persistência

- `save-key-normalizer.js` — chaves `brfut-*`
- `career-activate.js` — `activateSlot`, `prepareGameSession`
- `save-clear.js` — API unificada de limpeza
- `storage-api.js` — mutex boot, merge bundle
- Testes: `career-slot-tests`, `career-sync-tests`, `boot-order-tests`

## Próximo (opcional)

- Subpastas `economy/` e `transfers/` (padrão `club-status/`) — wiring fino no compositor
- Event-bus para persist/sync
- Feature médica (tratamento pós-jogo) extraída do compositor

## Comandos

```bash
npm install
npm run dev      # http://127.0.0.1:5080
npm run build    # dist/
npm run test:all
```

Tester hardened: http://127.0.0.1:5081/home.html

Ver também: [modularization.md](./modularization.md)
