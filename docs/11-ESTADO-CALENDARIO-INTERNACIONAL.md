# 11 — Estado do calendário internacional e continental

> Documento de estado. A seção **Reconstrução** diz o que foi refeito e quando;
> o resto é referência rápida das regras.
>
> Ver `js/engine/international-calendar.js` e `js/engine/season-calendar-mold.js`.

## Aviso importante — leia antes de confiar em qualquer número

Houve um desencontro entre o que se acreditava implementado e o que estava no
repositório. O modelo de calendário internacional **foi descrito como concluído,
mas nunca tinha sido commitado.** A restauração veio do GitHub em `f7e6b7d`,
que não tinha esse trabalho.

Verificado por busca de símbolos — todos com **0 ocorrências** na época:

```
international-calendar.js          não existia
continental-calendar.js            não existia
WORLD_CUP_EDITIONS                 0 ocorrências
qualifyingMatchdays                0 ocorrências
clubStoppages                      0 ocorrências
effectiveLeagueWindow              0 ocorrências
INTERNATIONAL_WINDOWS_BLOCK_CLUBS  0 ocorrências
auditCalendarCapacity              0 ocorrências
```

Buscar no disco inteiro `D:\BR FUT` também não encontrava os arquivos. Não havia
stash, branch ou commit oculto.

**A regra que saiu disso:** qualquer afirmação sobre capacidade de calendário tem
que vir de um comando que roda no repositório, com a saída colada. Se não der para
rodar, não é medido, é estimativa — e tem que ser dito assim. Hoje existe:
`node scripts/season-calendar-br-grid-validation.mjs`.

## Reconstrução (16/10/2026)

O que foi refeito, e o que estava quebrado no caminho:

| Antes | Agora |
|---|---|
| Copa com as datas de 2026 em todo ano de Copa | `worldCupWindow(ano)`, com 2026 e 2030 reais |
| 4 janelas FIFA fixas (9 dias) aplicadas a qualquer ano | 9 janelas oficiais de 2026–2030 |
| Blackout da Copa só do 1º ao último jogo | Da liberação dos jogadores (17 dias antes) ao fim |
| Janelas FIFA `soft: true` — o agendador as ignorava | `hard: true` — param o calendário |
| Série B 14/fev–28/out, Série C 5/abr–25/out | B 25/jan–20/dez, C 5/abr–20/dez |
| Grade gerava 38 rodadas na Série C | Total vem do formato de três fases (27/31/35) |
| Série C e D recebiam 10–12 jogos continentais | Só A e B têm vaga CONMEBOL |

### Datas oficiais usadas

**Copa de 2026** — 11/jun a 19/jul (Canadá, México, EUA). Último jogo de clube em
24/mai, liberação dos jogadores em 25/mai, com exceção até 30/mai para os vices de
competição continental. Resto + liberação + torneio = **56 dias**.

**Copa de 2030** — 8/jun a 21/jul (Marrocos, Portugal, Espanha).

**Janelas masculinas FIFA 2026–2030.** Setembro e outubro são um bloco único de
18 dias:

| Ano | Janelas |
|---|---|
| 2026 | 9–17/nov |
| 2027 | 22–30/mar, 7–15/jun, 20/set–5/out, 8–16/nov |
| 2028 | 20–28/mar, 29/mai–6/jun, 18/set–3/out, 13–21/nov |
| 2029 | 19–27/mar, 4–12/jun, 24/set–9/out, 12–20/nov |
| 2030 | 18–26/mar, 3–11/jun, 23/set–8/out, 11–19/nov |

Em ano de Copa a janela de junho é omitida: o torneio já cobre aquele período, e
somar os dois contaria os mesmos dias duas vezes.

## O ciclo de quatro anos

O ciclo tem **quatro** anos, não três: o ano da Copa mais os três de
classificação. **Não existe ano neutro.**

`isWorldCupYear()` usa a **periodicidade**, com 2026 como referência — não uma
lista de edições. Era esse o bug: consultando a lista, 2034 não era Copa.

### Ano de Copa

Uma paragem só, da liberação dos jogadores ao fim do torneio: 56 dias em 2026,
61 em 2030.

### Ano de classificação

Quatro janelas FIFA. O custo para o clube é bem menor que a Copa, porque só
parte do elenco é liberada e a classificatória não é disputada por todos. O custo
nunca passa da própria janela.

## Janela efetiva da divisão

Regra de absorção (`WC_ABSORPTION_MONTH`):

- divisão que **chega a dezembro** engole a Copa sozinha — reorganiza as rodadas
  em torno do torneio;
- divisão que **termina antes** tem o fim estendido pelos dias de paragem.

| Divisão | Molde | 2026 (Copa) |
|---|---|---|
| A | 28/jan–6/dez | absorve, sem extensão |
| B | 25/jan–20/dez | absorve |
| C | 5/abr–20/dez | absorve |
| D | 5/abr–13/set | estende |

## Duas regras da Copa do Brasil que só apareceram com o calendário real

**Ida no domingo, volta na quarta com 7 dias de intervalo.** Como 7 dias após um
domingo cai noutro domingo, a volta é sempre o **+10**. A última volta que cabe
antes da janela FIFA de novembro é quarta, 4/nov, vinda da ida de 25/out.

**A final não tem dia livre em 2026.** O Brasileirão joga em 8, 22 e 29 de
novembro e em todos os domingos de dezembro; 15 de novembro está na janela FIFA.
A final aceita domingo ou quarta, então sai na **quarta de 18 de novembro** — fora
da janela e fora do dia de rodada. Antes ela disputava 6 de dezembro com a última
rodada da Série A, e os dois finalistas jogavam duas partidas no mesmo dia.

## Continental

Vagas do Brasil: **7 na Libertadores e 6 na Sul-Americana**, todas de clubes da
Série A e da Série B. Série C e Série D nunca tiveram vaga nenhuma.

Em **2026 as 13 vagas brasileiras foram todas da Série A** — a Série B nem entrou.
Isso está registrado em teste (`com a Série A cheia a Série B não entra — como em
2026`), porque a regra do jogo permite a Série B e a realidade daquele ano não
usou.

### Datas de 2026

| | Libertadores | Sul-Americana |
|---|---|---|
| período | 3/fev – 28/nov | 3/mar – 21/nov |
| grupos | 7/abr a 28/mai (6 rodadas) | as mesmas datas |
| pré-classificatória | 3 e 10/fev, 24/fev, 10/mar | fase inicial 3/mar (jogo único) |
| oitavas | 11 e 18/ago | 11 e 18/ago |
| quartas | 15 e 21/set | 15 e 21/set |
| semis | 21 e 28/out | 20 e 21/out |
| final | 28/nov, jogo único | 21/nov, jogo único |
| repescagem | não tem | 21 e 28/jul |

As duas competições jogam as 6 rodadas de grupo nas mesmas datas.

### Distribuição das vagas

- **Libertadores** — o campeão da Copa do Brasil e os 7 primeiros da Série A.
  Quando o campeão da copa já está entre eles, o sétimo lugar entra no lugar dele
  para a vaga não fechar com 6.
- **Sul-Americana** — 6 vagas para quem ficou fora da Libertadores, na ordem da
  Série A. Sobrando vaga, pega da Série B.

### Nada disso bloqueia a temporada

A competição está **desligada in-game** (`enabled: false`). O que existe são as
datas, reservadas **por clube**. É o mesmo desenho da Copa do Brasil, que já mexe
em 126 clubes incluindo C e D sem travar ninguém: data reservada é data do clube
que joga continental, não um feriado geral.

`divisionHasBerth(divisao, competicao)` e `berthAudit(berths)` são as guardas. A
segunda devolve `ok: false` se aparecer qualquer clube de C ou D — está nos testes
como trava contra alguém reintroduzir a regra errada.

## Como auditar a capacidade

```
node scripts/season-calendar-br-grid-validation.mjs
```

Simula um clube em cada divisão, em cada pacote de competições, nos anos de
2026 a 2030. Deve fechar em **100/100**, sem falha de agendamento e sem conflito
de descanso.

Hoje: `100/100`.

Rodar depois de mexer em qualquer janela, banda de copa ou blackout — foi assim
que apareceram as quatro falhas que o modelo novo expôs.

## Quando o navegador não der

```
node scripts/import-integrity-tests.mjs
```

Varre os 261 módulos em `js/` e confere que todo símbolo importado de um módulo
local existe naquele módulo. Foi um export removido no caminho
(`FIFA_FRIENDLY_WINDOWS`) que derrubou 36 suítes de uma vez, e isso não depende
de navegador para pegar.