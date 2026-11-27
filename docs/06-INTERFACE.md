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

## Regra de alinhamento de cartões e tabelas (obrigatória)

Definida pelo dono do projeto em 27/11/2026. **Nenhuma tela pode quebrar esta regra.**

- Cartões, tabelas e painéis que ficam **lado a lado na mesma linha** têm a **mesma altura** e as bordas de cima e de baixo alinhadas.
- O cartão menor **estica** para ocupar o espaço da linha (não sobra "degrau" embaixo). Conteúdo extra vai para o rodapé do cartão (`margin-top: auto`) ou o cartão ganha respiro interno; nunca fica um buraco.
- Implementação: grade (`display: grid`) com `align-items: stretch` (padrão) e cartões com `height: 100%` / `box-sizing: border-box`; em flex, `align-items: stretch` e filhos sem altura fixa.
- Quando a grade quebra para uma coluna (celular), a regra não se aplica entre linhas diferentes.
- Vale para o jogo e para as pranchetas de proposta no canvas de design.
- Checagem: toda revisão de tela roda uma auditoria automática no navegador que mede os cartões e colunas da mesma linha e acusa diferença de borda inferior acima de 4 px (PC em 1366×768, 1600×900 e 1920×1080).
- Colunas com conteúdo longo (ex.: Táticas) ficam na altura da coluna principal e rolam por dentro, em vez de crescer e deixar as vizinhas para trás.

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
