# 06 — Interface

## Shell (`index.html`)

- **Sidebar** — `.nav[data-view]`, escudo do clube, temporada
- **Main** — seções `#dashboard`, `#squad`, `#tactics`, …
- **Modais** — partida, opções, tratamento, campeonatos, mercado, etc.
- **Boot gate** — splash até `markBootReady()` (`ui/boot-gate.js`)

Entry: `js/main.js` (não carrega jogo sem auth/slot quando nuvem ativa).

---

## Views e features

| View / área | Feature (`js/feature/`) | Notas |
|-------------|-------------------------|-------|
| Dashboard | `dashboard/` | Próximo jogo, CTA rodada, indicadores |
| Elenco | compositor + `shared/player-cells` | Badges lesão/cartão/fadiga |
| Táticas | `tactics/` | Formação, sliders, campo |
| Calendário | `calendar-view/` (lazy) | Treinos, jogos, relatório |
| Campeonatos | `championship-page/` | Tabelas, pickers, bracket |
| Ranking | `ranking-views/` | Nacional + filtros |
| Mensagens | `messages/` | Feed FM-style, ações pendentes |
| Escritório / Finanças | `economy/` | Orçamento, upgrades, empréstimo |
| Mercado | `transfers/` (lazy UI) | Lista, ofertas, empréstimos |
| Base / Juvenil | `youth-academy/` | Scouts, promoções |
| Opções | `options/` | Ritmo, áudio, nova carreira, tester hub |
| Conta | `account/` | Login, slots, sync |

---

## Partida ao vivo

| Peça | Módulo |
|------|--------|
| Relógio, placar, log | `match-live-ui/` |
| Abrir/restaurar/fechar | `match-live-entry/` |
| Resumo, AVANÇAR | `match-live-session/` |
| Sons | `match-live-audio/` (lazy chunk) |
| Rodada paralela | `live-day-matches/` |

Controles: pausa técnica, stats, adversário, pênaltis, shootout panel.

---

## Modais transversais

| Modal | Feature |
|-------|---------|
| Resumo temporada | `season-summary/` |
| Objetivo / metas | `season-goal-card/` |
| Patrocinadores | `sponsor-picker/` |
| Demissão / crise | `manager-sack/`, `manager-job-warn/` |
| Insolvência | `club-insolvency-warn/`, `club-bankruptcy/` |
| Restrição mercado | `club-financial-restriction/` |
| Aposentadoria | `retirement-modal/` |
| Regras competição | `competition-rules-modal/` |
| Cartas jogador | `player-card-modal/` |
| Guia / feedback tester | `tester-hub/` |

---

## Home (`home.html`)

- Login / conta (`account/inject-modals.js`)
- Lista de slots (`career-slots/`)
- Manutenção (`SITE_MAINTENANCE` em `constants.js`)
- Alerta de build (`ui/update-alert.js`)

---

## CSS

Arquivos estáticos em `css/` — ex.: `layout.css`, `calendar.css`, `tactics-ui.css`, `economy-office.css`. Ordem de cascade preservada no `index.html`.

---

## Acessibilidade / UX

- Hard refresh após deploy (`Ctrl+Shift+R`)
- `brfut-last-seen-build` — popup de novidades (`release-notes.js`)
- Navegação por teclado parcial em modais críticos

---

## Documentação relacionada

- [Rotinas — partida](./04-ROTINAS-FLUXOS.md)
- [Guia tester](./GUIA-TESTER.md)
