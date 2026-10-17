# Setores e participantes no motor

Implementação da proposta validada em laboratório. Os parâmetros são de desenho
do jogo, não estimativas extraídas de outro jogo ou do futebol real.

## Uma fonte para os dois motores

`js/engine/match-sectors.js` compartilha médias de contribuição e pesos de
participação entre `match-sim.js` e `match-ratings.js`.

| Posição | Ataque | Passe | Defesa |
|---|---:|---:|---:|
| GOL | 0 | 0,10 | 0 |
| ZAG | 0,05 | 0,25 | 1 |
| LAT | 0,20 | 0,50 | 0,80 |
| VOL | 0,15 | 0,80 | 0,80 |
| MC | 0,35 | 1 | 0,40 |
| MEI | 0,70 | 1 | 0,15 |
| PE/PD | 0,80 | 0,60 | 0,10 |
| ATA | 1 | 0,25 | 0,05 |

Os pesos não somam habilidade ao jogador. A média é normalizada pela soma
dos pesos dos participantes, preservando a escala dos atributos. O goleiro
continua sendo avaliado pelos atributos de goleiro separadamente.

- Ataque usa contribuições ponderadas de finalização, velocidade, drible e armação.
- Passe usa contribuições ponderadas de passe e armação.
- Defesa usa contribuições ponderadas de marcação e desarme.
- Overall e fadiga média continuam com pesos uniformes, não pesos de setor.
- Na seleção do participante, o fator de posição multiplica a habilidade da
  tarefa, preservando os modificadores existentes de cartão e improvisação.
- No simulador, criação e assistência indicam explicitamente o setor de passe.
- MEI também é elegível para finalizar ao vivo, inclusive como adversário.

As regras de elegibilidade dos dois motores não foram todas unificadas; foi
corrigida a exclusão específica de MEI validada nos testes. Não há alegação de
que os dois motores produzam jogos idênticos.

## Escopo preservado

Não foram modificados pesos das formações, curva de desgaste, atributos
permanentes, OVR derivado, potencial, nomes ou saves. Não há novos flancos,
posicionamento espacial, instruções táticas ou seleção de substitutos.
As médias usam a posição do jogador; penalidades de improvisação existentes
continuam separadas. Isso não é um modelo novo de função tática por slot.

## Regressões

```text
node scripts/match-sectors-tests.mjs
node scripts/match-overall-model-tests.mjs
npm run test:all
npm run build
```

Cobertura direta:

- escala e segurança de setores vazios;
- finalização do goleiro não aumenta ataque coletivo;
- distribuição do goleiro ainda contribui para passe;
- investimento igual em grupos diferentes produz contribuições diferentes;
- perfis ao vivo dos dois clubes usam as mesmas funções;
- MEI participa de finalizações e respeita bloqueios de disponibilidade;
- 40.000 construções reais de `buildAttack`, 20.000 por cenário: MEI com
  finalização 60/80 fez 193/301 gols, mantendo 4.904 chutes totais por cenário;
- 8.000 partidas do simulador: invariância à finalização do goleiro e vantagem
  do investimento em finalização nos atacantes sobre o mesmo investimento no meio;
- regressões do OVR limitado continuam registradas na suíte;
- testes travam os bônus de formação e exemplos da curva de desgaste.

As construções ao vivo têm estado reiniciado a cada ação e simplificações de
contato/lesões. Não substituem uma partida completa via interface, nem demonstram
ausência geral de estratégias dominantes. Empacotamento do EXE é etapa separada.
