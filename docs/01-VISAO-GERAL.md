# 01 — Visão geral

## O que é o BR Fut

Simulador de gestão de futebol brasileiro no navegador. O jogador assume um clube (Séries A–D), gerencia elenco, táticas, calendário, finanças, lesões e disputa Brasileirão, Copa do Brasil, estaduais (quando habilitado), ranking nacional e seleções.

## Público e objetivo

- Single-player com save local e **sincronização opcional** via conta (API `api.brfut.com.br`).
- Até **5 slots** de carreira por conta (`{Clube} {Ano}` automático).
- Foco em calendário CBF, pirâmide oficial de clubes e partidas ao vivo tick-a-tick.

## Como jogar

### Desenvolvimento (Vite)

```powershell
npm install
npm run dev
```

Abra http://localhost:5080/home.html → login (se nuvem) → Novo Jogo / Continuar.

### Testers (bundle hardened)

```powershell
npm run build
py scripts\tester-server.py --port 5081 --bind 127.0.0.1
```

http://127.0.0.1:5081/home.html

### Sem Node

`INICIAR-JOGO.bat` — Python `http.server` na porta 5080 (módulos ES nativos).

## Componentes principais

| Componente | Arquivo | Papel |
|------------|---------|-------|
| Landing | `home.html` + `js/home.js` | Login, slots, nova carreira |
| Shell | `index.html` | Views + modal de partida |
| Entry jogo | `js/main.js` | Auth, `prepareGameSession`, `bootEngine` |
| Compositor | `js/legacy/engine.js` | Wiring, estado de sessão, handlers restantes |
| Motores | `js/engine/*` | Regras puras (sim, temporada, economia…) |
| Features | `js/feature/*` | UI por tela (`create*Feature(deps)`) |
| Core | `js/core/*` | Save, slots, sync, constantes |

## Divisões jogáveis

| Divisão | Clubes | Formato (resumo) |
|---------|--------|------------------|
| Série A | 20 | 38 rodadas, turno e returno |
| Série B | 20 | Acesso + playoffs |
| Série C | 20–28 (por temporada) | Pontos corridos |
| Série D | 96 | Grupos + mata-mata |

## Tecnologias

- **Vite 6** + ES modules
- HTML5 / CSS3 (majoritariamente estático em `css/`)
- `localStorage` + API REST (saves na nuvem)
- Testes: `scripts/*-tests.mjs`, `npm run test:all`

## Documentação relacionada

- [Arquitetura](./02-ARQUITETURA.md)
- [Motores](./03-MOTORES.md)
- [Modelos de dados](./05-MODELOS-DADOS.md)
- [Documentação completa](./DOCUMENTACAO-COMPLETA.md)
