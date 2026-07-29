# Modularização — BR Fut

## Camadas

| Pasta | Responsabilidade |
|-------|------------------|
| `js/engine/` | Regras puras, sem DOM/localStorage direto |
| `js/feature/` | UI por tela; consome engine via deps |
| `js/core/` | Save, constantes, sync, slots |
| `js/ui/` | DOM helpers, router, crests |
| `js/legacy/engine.js` | **Compositor** — boot, wiring, estado mínimo de sessão (~7,5k linhas) |

## Regras

1. **Lógica nova não entra em `legacy/engine.js`** — só instanciar factories e passar deps.
2. **Arquivo-alvo ≤ ~400 linhas**; acima de ~600 linhas, planejar split (subpasta + `index.js`).
3. **Engine testável** — módulo estável → suíte em `scripts/*-tests.mjs` + `npm run test:all`.
4. **Feature flags** — `FEATURES` + define Vite.
5. **`MODULE_VERSIONS`** ao alterar formato de save/API.

## Extraído (2026-07)

### Core / sync
- `save-key-normalizer.js`, `career-activate.js`, `save-clear.js`
- `storage-api.js`, `career-slot-manager.js`, `save-sync.js`

### Engine / boot
- `career-persistence.js`, `career-calendar.js`
- `career-pyramid-bootstrap.js`, `career-clubs-bootstrap.js`
- `season-save-writer.js`, `round-advance.js`

### Partida ao vivo
- `match-availability.js`, `match-live-away-subs.js`
- `match-live-orchestration.js`, `live-match-persist.js`

### Features
- `championship-page/`, `match-live-entry/`, `match-live-session/`, `match-live-ui/`
- `match-live-audio/lazy.js`
- `dashboard`, `tactics`, `calendar-view`, `options`, `economy`, `transfers`, …

## Próximo (opcional)

1. Wiring fino economy/transfers → subpastas estilo `club-status/`
2. Event-bus para persist/sync
3. Bloco médico/tratamento → feature dedicada

## CI local

```powershell
npm run test:all
npm run build
py scripts\tester-server.py --port 5081 --bind 127.0.0.1
```

Ver [PLANO-MODULARIZACAO.md](./PLANO-MODULARIZACAO.md) para histórico de fases.
