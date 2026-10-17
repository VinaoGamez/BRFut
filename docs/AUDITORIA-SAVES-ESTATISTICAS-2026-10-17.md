# Auditoria de saves e estatísticas — 17/10/2026

## Escopo e método

Inspeção do código, do pacote instalado em `C:\Program Files\BR Fut` (0.2.2) e de uma cópia isolada do perfil `%APPDATA%\BR Fut`. Foram rastreados criação, listagem, gravação manual, troca de carreira, atualização do elenco, estatísticas, compactação, restauração offline e transição de temporada. A instalação e o perfil originais não foram modificados.

## Causas confirmadas e correções

| Gravidade | Problema | Correção |
|---|---|---|
| Crítica | Criação de carreira, troca de clube e virada de temporada gravavam versão interna 7; o índice aceitava versão 8. Saves existiam, mas eram ocultados e novas cópias eram criadas. | Todos os produtores usam `SAVE_VERSION.career`. Recuperação conservadora de v7 quando o calendário da Série C comprova o formato atual e o marcador de migração corresponde ao ciclo atual. |
| Crítica | A compactação de temporada removia `brfut-player-history`, inclusive offline. | O histórico não é removido para gravar a temporada. Recuperação das fichas exatas ainda pendentes no IndexedDB, com controle de duplicidade e identidade de carreira. |
| Alta | O retorno do salvamento ignorava falhas de cópia para o slot e de escrita do índice. | Falhas são propagadas; o save manual verifica temporada, carreira, elenco, histórico, bundle e índice. |
| Alta | Alguns caminhos não persistiam o elenco, permitindo regeneração e perda de correspondência com IDs históricos ao reabrir. | Gravação do elenco atual junto à carreira, respeitando troca de clube; bootstrap preserva o elenco quando estava ausente do payload. |
| Alta | Restauração do snapshot local de estaduais exigia autenticação. | Leitura local funciona offline; falhas de API preservam o fallback local. |
| Alta | Troca ou reparação de slot podia manter histórico de outra carreira ou usar apenas nome do clube como identidade. | Limpeza das chaves ausentes ao trocar de carreira, proteção de dados ativos mais novos e validação de identidade no reparo. |
| Média | O painel de desempenho ficava cortado pelo layout sem rolagem e excluía registros de jogadores ausentes do plantel atual. | Rolagem acessível e filtro entre elenco atual e histórico do clube, identificando registros fora do elenco. |
| Média | Save offline concluído podia mostrar “ENTRE NA CONTA”. | Confirmação “SALVO LOCAL”; exceções deixam uma mensagem de falha e permitem nova tentativa. |

## Recuperação observada na cópia do perfil

- Duas carreiras distintas voltaram a ser listadas.
- Oito payloads de carreira compatíveis puderam ser atualizados (incluindo cache ativo e bundles duplicados).
- Foram identificadas 53 fichas de partidas vinculáveis às duas carreiras: 8 em uma e 45 na outra. São registros existentes, não partidas recalculadas.
- Registros de outras carreiras sem vínculo comprovável permanecem no banco e não são misturados.
- Os bundles duplicados originais não são apagados automaticamente.

## Validação

- Suíte completa: 73/73 suítes passaram, com diretório temporário de testes dentro do projeto. A primeira execução havia encontrado bloqueios de permissão no diretório temporário do ambiente em três suítes; a execução no diretório permitido passou.
- Novos testes cobrem migração compatível/incompatível, duplicidade, leitura do card, manutenção do histórico na compactação, erros reais simulados de quota, falha de índice, isolamento de slots, IDs de elenco e restauração de estaduais sem login.
- Teste em Electron com cópia do perfil: carregar, recuperar histórico, registrar uma partida controlada, abrir elenco/card, salvar, fechar o processo e reabrir. Os totais persistidos permaneceram idênticos e o card manteve jogos e nota.
- Inspeção visual do painel de desempenho e verificação de integridade de imports/assets.

## Limites

Dados já removidos e sem outra cópia não podem ser reconstruídos integralmente. Fichas de estatísticas não contêm todos os atributos de um elenco antigo: seus registros são exibidos como fora do elenco quando o ID não pertence ao plantel atual. A recuperação não inventa jogadores, gols ou notas.

Há avisos de conflitos de descanso no calendário gerado. Eles não foram tratados nesta correção e não impediram os testes de persistência. Esta auditoria cobre os fluxos relatados e a suíte automatizada disponível; não equivale a validar manualmente todas as combinações de campeonatos de uma carreira longa.

A versão 0.2.3 é um pacote local de correção, sem publicação no GitHub. O instalador preserva o perfil existente; a recuperação ocorre no carregamento da versão corrigida. Não é necessário apagar os dados do jogo.
