# 11 — Estado do calendário internacional e continental

> Documento de estado, escrito em 16/10/2026.
> Serve para responder rápido: **o que existe no calendário hoje, o que não
> existe, e por que**. Leia antes de mexer em janelas ou em blackouts.

## Aviso importante

Houve um desencontro entre o que se acreditava implementado e o que está de fato
no repositório. O modelo de calendário internacional (ciclo de 4 anos, Copas por
edição, campanha de classificatórias, janelas FIFA, reservas continentais) **foi
descrito como concluído, mas nunca foi commitado.** A restauração do repositório
veio do GitHub em `f7e6b7d`, que não continha esse trabalho.

Verificado por busca de símbolos no repositório — todos com **0 ocorrências**:

```
international-calendar.js          não existe
continental-calendar.js            não existe
WORLD_CUP_EDITIONS                 0 ocorrências
qualifyingMatchdays                0 ocorrências
clubStoppages                      0 ocorrências
effectiveLeagueWindow              0 ocorrências
INTERNATIONAL_WINDOWS_BLOCK_CLUBS  0 ocorrências
auditCalendarCapacity              0 ocorrências
```

Buscar no disco inteiro `D:\BR FUT` também não encontra os arquivos. Não há
stash, branch ou commit oculto que os recupere.

## O que existe hoje

| Item | Onde | Estado |
|---|---|---|
| Âncora do ciclo de 4 anos | `season-calendar-cycle.js` | ✅ funciona |
| Janela da Copa do Mundo | `season-calendar-mold.js` → `WORLD_CUP_WINDOW` | ⚠️ **datas de 2026 fixas** |
| Janelas FIFA | `season-calendar-mold.js` → `FIFA_FRIENDLY_WINDOWS` | ⚠️ **4 janelas ad-hoc de 9 dias** |
| Janelas das divisões | `season-calendar-mold.js` → `LEAGUE_DIVISION_MOLD` | ⚠️ **janelas originais** |
| Blackouts de clube | `season-calendar-cycle.js` → `getHardClubBlackouts` | ✅ funciona (só Copa) |
| Agendador com fallback de meio de semana | `season-scheduler.js` | ✅ existe |

### Pontos que precisam de atenção

1. **`WORLD_CUP_WINDOW` é único e tem as datas de 2026** (11/jun a 19/jul).
   É aplicado a **todo** ano de Copa. Então 2030, 2034 e adiante usam as datas
   de 2026 — a Copa de 2030 (Marrocos, Portugal, Espanha) está com o calendário
   errado.

2. **As janelas FIFA são 4 e ad-hoc** (março, junho, setembro, novembro), cada
   uma com 9 dias. As janelas reais da FIFA têm 7 dias. Uma janela de 9 dias
   atravessa dois fins de semana, o que bloqueia mais rodada do que deveria.
   Existem 9 janelas oficiais por ciclo de quatro anos.

3. **`LEAGUE_DIVISION_MOLD` está com as janelas originais:**

   | Divisão | Início | Fim | `matchCount` |
   |---|---|---|---|
   | A | 28/jan | 6/dez | 38 |
   | B | 14/fev | 28/set | 38 |
   | C | 5/abr | 25/out | `null` |
   | D | 5/abr | 13/set | 10 |

   A Série B termina em setembro — é apertado demais para 38 rodadas. A Série D
   termina em 13 de setembro para 10 rodadas de grupo.

4. **Não existe modelo de classificação por fase.** A tabela da Série C não é
   pontuada fora da fase 1 (ver `roundFeedsDivisionStandings` em
   `national-round-sim.js`), mas não há equivalente para Copa: a Copa do Mundo
   não tem fase classificatória modelada.

## O que falta construir

1. **Ciclo internacional de 4 anos** com fases explícitas. Copa a cada 4 anos,
   e nos anos sem Copa uma campanha de classificatórias — que para os clubes
   significa paragens, só que menores.
2. **Copa por edição**: 2026 e 2030 com datas reais; anos posteriores herdam a
   última edição conhecida, marcado como aproximação.
3. **9 janelas FIFA reais**, de 7 dias cada.
4. **Janela efetiva da divisão**: a que estende o fim da divisão pelos dias de
   Copa, para a Série A não perder rodadas no ano da Copa.
5. **Reservas continentais** (Libertadores e Sul-Americana) por clube, sem
   bloquear a temporada — a Série C e D não jogam CONMEBOL.
6. **Auditoria de capacidade**: quantas rodadas cada divisão cabe no seu
   intervalo, ano a ano.

## Por que isso importa para a Série C

A CBF expande a Série C: **20 clubes em 2026, 24 em 2027, 28 a partir de 2028**.
No formato de três fases isso dá 27, 31 e 35 rodadas. A janela atual vai de 5 de
abril a 25 de outubro.

**Sem uma auditoria feita com o código real, qualquer número sobre transbordo é
palpite.** Foi exatamente esse o erro: um número de transbordo para 2028–2029 foi
apresentado como medido, mas vinha de uma auditoria feita com código que não
está no repositório.

Antes de decidir se a janela da Série C deve ir até novembro, é preciso rodar a
auditoria com `auditCalendarCapacity()` de verdade — e é ela que está na lista de
faltando.

## Regra prática

Qualquer afirmação sobre capacidade de calendário tem que vir de um comando que
roda no repositório, com a saída colada. Se não der para rodar, não é medido,
é estimativa — e tem que ser dito assim.