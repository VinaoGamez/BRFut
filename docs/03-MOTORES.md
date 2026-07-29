# 03 — Motores

Referência dos motores em **`js/engine/`** (regras sem DOM direto). O compositor em `js/legacy/engine.js` instancia factories e passa dependências.

---

## Mapa por domínio

### Partida e simulação

| Módulo | Export principal | Papel |
|--------|------------------|-------|
| `match-tuning.js` | `ENGINE_TUNING`, `createSimLineupBuilder` | Calibração, foul/blowout, escalação sim |
| `match-core.js` | `FORMATION_PERFORMANCE`, `roundTactic` | Formações, papéis, tática por rodada |
| `match-sim.js` | `createRoundMatchSimulator` | `simulateRoundMatch` (90 min) |
| `match-live.js` | `createLiveMatchActions` | `shot`, `buildAttack`, passes ao vivo |
| `match-live-orchestration.js` | `createLiveMatchOrchestration` | tick/advance/foul, pênaltis, shootout |
| `match-live-away-subs.js` | `createAwaySubController` | Banco e substituições do adversário |
| `match-availability.js` | `createMatchAvailability` | Workload, disponibilidade, commit pós-jogo |
| `match-ratings.js` | ratings ao vivo | `profile`, `liveOverall`, confronto |
| `match-clock.js` | relógio / acréscimos | Tempos, stoppage |
| `live-match-persist.js` | snapshot ao vivo | Save/restore partida em andamento |
| `knockout-shootout.js` | disputa mata-mata | Sorteio e sequência de pênaltis |

### Rodada, temporada, calendário

| Módulo | Export principal | Papel |
|--------|------------------|-------|
| `round-advance.js` | `createRoundAdvanceEngine` | Commit rodada liga/estadual/Copa |
| `round-advance.js` (via) | `advanceSeasonRound`, `simulateIdleRound` | Avanço pós-partida usuário |
| `season-transition.js` | `createSeasonTransitionEngine` | Promoções, rebaixamentos, novo ano |
| `season-save-writer.js` | `createSeasonSaveWriter` | Serialização `brfut-season` |
| `career-calendar.js` | `createCareerCalendar` | Data corrente, batches, avanço |
| `calendar-week-advance.js` | `createCalendarWeekAdvance` | Semana a semana, treinos |
| `season-scheduler.js` | datas, ocupação | Agenda CBF, conflitos |
| `season-calendar-plan.js` | orçamento anual | Distribuição liga/copa/D |
| `league-fixtures.js` | calendário liga | Turno/returno, balanceamento |
| `competition-calendar.js` | fixtures nacionais | Materialização de datas |

### Carreira e mundo

| Módulo | Export principal | Papel |
|--------|------------------|-------|
| `career-pyramid-bootstrap.js` | `bootstrapCareerDivisionTeams` | Pirâmide A–D |
| `career-clubs-bootstrap.js` | `bootstrapCareerClubs` | Elencos, worldRosters |
| `career-persistence.js` | `createCareerPersistence` | Debounce save, Novo Jogo |
| `career-club-replacement.js` | cascade host | Origem de carreira / vítima |
| `brazil-official-pyramid.js` | pirâmide CBF | Import Brasfoot, UF |
| `world-rosters.js` | `collectWorldRosters` | Snapshot elencos mercado |
| `player-generation.js` | `generatePlayer` | Atributos procedurais |

### Copa, Série D, ranking

| Módulo | Papel |
|--------|-------|
| `cup-fixture-runtime.js`, `cup-tie-advance.js` | Fases Copa do Brasil |
| `serie-d-format.js`, `serie-d-knockout-advance.js` | Grupos e mata-mata D |
| `national-ranking.js`, `national-ranking-finalize.js` | Ranking nacional |
| `recopa-national.js` | Recopa entre campeões |
| `world-cup-competition.js` | Copa do Mundo (quadrienal) |

### Elenco, lesões, disciplina

| Módulo | Papel |
|--------|-------|
| `injury.js` | Catálogo, risco, reabilitação |
| `fatigue.js` | Cansaço, treino, desgaste ao vivo |
| `discipline.js` | Cartões, suspensões por competição |
| `player-history.js` | Histórico, notas, líderes |
| `player-development.js` | Evolução pós-temporada |
| `training-development.js` | Treinos semanais, XP |

### Economia e mercado

| Módulo | Papel |
|--------|-------|
| `economy.js` | Orçamento, bilheteria, upgrades |
| `bank-loan.js` | Empréstimo, juros compostos |
| `club-solvency.js` | Insolvência, restrição mercado |
| `transfers.js` | Motor de transferências/ empréstimos |
| `transfer-division-fit.js` | Fit entre divisões |

### Estadual e seleções

| Módulo | Papel |
|--------|-------|
| `state-league.js` + satellites | Campeonato estadual |
| `national-team-offers.js` | Convocações |

---

## RNG

- Seed da carreira (`savedNewGame.seed`).
- `gameRandom()` no compositor — LCG determinístico por save.
- Usado em geração procedural, eventos de partida, mercado IA.

---

## Partida ao vivo (resumo)

1. **`match-live-entry`** — abre modal, restore snapshot, `#playMatch`.
2. **`match-live-orchestration`** — `tick` → `advance` → eventos.
3. **`match-live.js`** — construção, duelo, finalização.
4. **`match-live-session`** — resumo final, `#finalNext`, avanço rodada.
5. **`round-advance`** — commit quando usuário confirma.

Ritmo do relógio: Opções → `brfut-pace` (ver [08-JOGADAS-E-RITMO.md](./08-JOGADAS-E-RITMO.md)).

---

## Testes

Motores estáveis têm suíte em `scripts/*-tests.mjs` incluída em `npm run test:all`.

---

## Documentação relacionada

- [Jogadas e ritmo](./08-JOGADAS-E-RITMO.md)
- [Rotinas e fluxos](./04-ROTINAS-FLUXOS.md)
- [Ecossistema econômico](./10-ECOSSISTEMA-ECONOMICO.md)
