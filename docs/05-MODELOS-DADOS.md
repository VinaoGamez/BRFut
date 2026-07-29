# 05 — Modelos de dados

## Chaves `localStorage` (canônicas)

Prefixo **`brfut-*`**. Migração automática de `matchday-*` via `save-key-normalizer.js`.

| Chave | Conteúdo |
|-------|----------|
| `brfut-career` | Save principal da carreira ativa |
| `brfut-season` | Estado da temporada em curso |
| `brfut-training-rules` | Regras de treino (antes/depois/livre) |
| `brfut-live-match` | Snapshot partida ao vivo |
| `brfut-player-history` | Histórico estatístico global |
| `brfut-last-seen-build` | Alerta de atualização |
| `brfut-career-index` | Índice de slots (máx. 5) |
| `brfut-active-slot-id` | Slot ativo na sessão |

### Bundles por slot

```
brfut-slot-{id}-career
brfut-slot-{id}-season
brfut-slot-{id}-player-history
brfut-slot-{id}-live-match
```

`activateSlot(id)` copia o bundle do slot para as chaves **ativas** acima.

### Preferências (não sync obrigatório)

| Chave | Valores |
|-------|---------|
| `brfut-pace` | `fast` \| `standard` \| `detailed` (legado: `futmanager-pace`) |
| `brfut-autosave-mode` | modo autosave |

---

## API nuvem

- **GET/PUT** `/api/saves` — payload chave→JSON (mesmas chaves canônicas).
- Merge: timestamp + `save-sync.js` + `mergeSlotBundleFromCloud`.
- Dados VPS: `/var/lib/brfut/data/saves/` (ver [VPS-LOCAWEB.md](./VPS-LOCAWEB.md)).

---

## Career save (`brfut-career`)

Campos principais (evolução contínua — ver `MODULE_VERSIONS` em `constants.js`):

```typescript
interface CareerSave {
  seed: number
  clubName: string
  managerName: string
  division: 'A' | 'B' | 'C' | 'D'
  season: number                    // ex: 2026
  clubStatus?: { environment, support, board, finances, budget }
  divisionTeams?: Record<string, string[]>
  worldRosters?: Record<string, Player[]>
  userRoster?: Player[]
  worldSeed?: number
  foundingClubName?: string
  careerClubHistory?: string[]
  regionalBaseClubs?: string[]
  nationalTeamCode?: string
  preferences?: { pace, … }
  pendingSponsorChoice?: boolean
  // … extensões por feature (transfers, youth, bank loan, …)
}
```

---

## Season save (`brfut-season`)

Estado volátil da temporada — regravado com debounce (`career-persistence` + `season-save-writer`):

- `currentRound`, calendário materializado
- Tabelas, copa, Série D, estadual, ranking parcial
- `liveMatchSnapshot` (espelho legacy)
- Mensagens da temporada (cap em `MEMORY_LIMITS`)
- Objetivos, crise manager, empréstimo, etc.

`clearSeasonSave()` — apaga temporada; carreira permanece.

---

## Player history

- Chave global ou por slot (`brfut-slot-*-player-history`).
- `playerKey = slug(nome) + '#' + idade` (evolução: `playerId`).
- Sobrevive avanço de temporada; limpo em `clearCareerData('career'|'all')`.

---

## Slots (índice)

```typescript
interface CareerIndex {
  slots: Array<{
    id: string
    label: string              // "{Clube} {Ano}" automático
    clubName: string
    season: number
    updatedAt: string
  }>
  activeSlotId?: string
}
```

Limite: **5 slots** (`canCreateSlot`).

---

## Limpeza unificada

`clearCareerData(scope)` em `save-clear.js`:

| scope | Efeito |
|-------|--------|
| `session` | Flags de sessão, live match ativo |
| `career` | Carreira + temporada + histórico do slot |
| `all` | Todos slots + índice + nuvem (DELETE) |

---

## Versionamento

- `BUILD_VERSION` / release notes — alerta testers.
- `MODULE_VERSIONS` — migrações por módulo ao hidratar save.

---

## Documentação relacionada

- [Arquitetura — Persistência](./02-ARQUITETURA.md)
- [Hospedagem — backup](./07-HOSPEDAGEM.md)
