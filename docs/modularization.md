# Modularização — Matchday Alpha

## Camadas

| Pasta | Responsabilidade |
|-------|------------------|
| `js/engine/` | Regras puras, sem DOM/localStorage direto |
| `js/feature/` | UI por tela; consome engine via deps |
| `js/core/` | Save, constantes, event-bus |
| `js/ui/` | DOM helpers, router, crests |
| `js/legacy/engine.js` | **Compositor** — boot, wiring, estado mínimo de sessão |

## Regras

1. **Lógica nova não entra em `legacy/engine.js`** — só instanciar factories e passar deps.
2. **Arquivo-alvo ≤ ~400 linhas**; acima de ~600 linhas, planejar split (subpasta + `index.js`, padrão `club-status/`).
3. **Engine testável** — todo módulo em `js/engine/` deve ter suíte em `scripts/*-tests.mjs` e entrar em `npm run test:all` quando estável.
4. **Feature flags** para módulos em validação local (`FEATURES` + define Vite).
5. **`MODULE_VERSIONS`** ao alterar formato de save/API de um módulo.

## Extraído (2026-07)

- `js/engine/career-persistence.js` — carreira, debounce de temporada, sync de elencos, Novo Jogo
- `js/engine/career-calendar.js` — data corrente, avanço, batches, `parseSavedCalendarDate`

## Próximas extrações (ordem)

1. `season-save.js` — serialização da temporada (`writeSeasonSave`)
2. `competition-orchestrator.js` — commit de rodada nacional/estadual/Copa
3. `career-bootstrap.js` — nova carreira, pirâmide, elencos
4. Subpastas `economy/` e `transfers/` (padrão `club-status/`)

## Workspace (Cursor)

Manter `.cursorignore` na raiz ignorando `dist/`, `tmp-*`, `agent-transcripts/`, import Brasfoot grande — reduz OOM no IDE.

## CI

```powershell
npm run test:all
npm run build
```

Rebuild 5081 após mudanças jogáveis (ver regras do projeto).
