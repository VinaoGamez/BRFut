# Overall derivado e participação limitada no motor

## Fonte principal

`js/engine/player-overall.js` contém os pesos normalizados por posição.
São parâmetros de desenho do jogo, não avaliações de futebol real.

- `overallRaw` é a média ponderada sem arredondamento de interface.
- `overall` é `Math.round(overallRaw)`.
- O cálculo não consulta OVR anterior, potencial, clube, moral, cansaço ou flags.
- Armação entra nos pesos de linha; bola parada entra nas posições pertinentes.
- Reflexos de atacante não elevam seu OVR. Um bom cobrador não vira jogador
  completo só por ter um atributo alto.

## Geração

A faixa do clube e a idade alimentam o sorteio de atributos, não um campo OVR.
Posição, assinatura e perfil selecionado diferenciam atributos. O perfil é
registrado em `generationProfile` e não é um multiplicador oculto na partida.
Sua seleção e seu incremento são parâmetros de projeto.

Especialistas mantêm as probabilidades e elegibilidades existentes, mas sua
habilidade é construída a partir do próprio atributo e do perfil de campo,
não de `player.overall`. Os tratamentos específicos de especialista no motor
permanecem: removê-los exige uma comparação separada, ainda não aprovada.

OVR só é calculado após todos os atributos e especialidades. As faixas iniciais
das divisões são preservadas mediante ajuste dos atributos, nunca cortando
apenas o OVR exibido. O potencial é sorteado depois e não fica abaixo da
capacidade calculada. Nomes passam pelo gerador nacional unificado.

## Evolução e potencial

Treino e pulsos alteram atributos e depois recalculam OVR. Nenhum caminho
restaura o OVR antigo para esconder atributos já modificados.

O potencial é verificado ANTES de autorizar um incremento de atributo. Um
atributo individual pode superar o potencial geral: especialidade não é a
mesma coisa que capacidade total. O potencial não cresce com o treino.

Os pulsos mantêm as regras de idade, utilização e limites anuais existentes.
Seu delta orienta um orçamento de mudanças nos atributos relevantes; com
atributos discretos, o orçamento pode não ser consumido integralmente.
O treino mantém seus próprios limites anuais e por atributo, persistindo a
capacidade inicial do período. Não confundir limites de treino com um teto
anual unificado de todos os caminhos de desenvolvimento.

## Saves

Elencos profissionais e jovens recalculam o OVR ao hidratar. A migração não
renomeia jogadores, não muda IDs nem reescreve atributos ou histórico. Na
primeira reconciliação, um potencial abaixo da capacidade já existente é
ajustado para comportá-la; não reduzimos atributos para fazer o save caber.
Consequentemente, OVR de saves antigos pode mudar para refletir os atributos.
Especialidades não são rebaixadas automaticamente ao mudar de divisão.

## Motor

O simulador de rodada e a orquestração ao vivo usam a mesma contribuição:

```text
clamp((OVR próprio - OVR adversário) * 0,075, -1,5, +1,5)
```

Ela entra somente no controle coletivo/posse. Saem o termo direto no xG,
bônus de criação/conversão dependentes da diferença de OVR, freio de goleadas
por OVR e impulsos iniciais por OVR do ao vivo. O freio por placar permanece.
Os perfis de ação ao vivo não recebem novamente a diferença de OVR.
O OVR efetivo ao vivo aceita a escala 1–99, sem piso artificial de 50.

Não foram alterados setores, curva de desgaste ou IA de seleção/substituição.
O freio adicional por perfil não foi implementado. Não há alegação de que
os dois motores produzam partidas idênticas: compartilham estes princípios.

## Verificação

```text
node scripts/player-overall-tests.mjs
node scripts/match-overall-model-tests.mjs
node scripts/player-generation-sim.mjs 42 200
npm run test:all
npm run build
```

Os testes incluem pureza e monotonicidade, geração nas quatro divisões, nomes,
especialistas, potencial, treino, regressão, migração, roundtrip, nove carreiras
por 25 temporadas, 6.000 partidas pareadas e chamadas reais de finalização ao
vivo. O teste de ações ao vivo não substitui uma partida completa via interface.
