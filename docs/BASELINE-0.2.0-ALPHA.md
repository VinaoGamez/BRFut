# Referência funcional preservada

- Referência confirmada pelo usuário: `release/BR-Fut-0.2.0-alpha-instalador.exe`.
- SHA-256: `0C4408571FC07A22C73636C1F5357C3F7B031D9273D08684A6744050A9AE3C80`.
- Tamanho verificado: 94.986.226 bytes.
- O fonte atual e `release/win-unpacked` não são considerados equivalentes a esse instalador.
- A identificação do commit exato que produziu esse binário ainda está pendente.

O instalador de referência não deve ser sobrescrito. Validar candidatos em saída
separada e perfil de usuário isolado. Não testar contra a carreira real.

## Estabilização de estatísticas

Correções: limpeza de armazenamento preserva histórico, partida em andamento e
slots inativos; ledger de partidas contabilizadas sobrevive à poda dos relatórios;
substituição de relatório aplica diferença em vez de reconstruir totais com logs
incompletos; adaptador remoto dos cards corrigido; painel de desempenho local no elenco.

A migração do ledger só pode identificar os logs que ainda existem no save antigo.
Não é possível reconstruir com exatidão partidas cujos detalhes já foram apagados.
A migração de dados volumosos para armazenamento transacional e o arquivamento
permanente de relatórios continuam necessários para carreiras longas.

## Aceitação de uma próxima versão Windows

Testar em perfil isolado: criar carreira, disputar partida completa, conferir card
e elenco, salvar, fechar/reabrir, trocar slots, avançar temporada e verificar totais.
Testar instalação limpa, atualização e cancelamento do assistente. O teste unitário
não substitui esses cenários. Só publicar depois dessas verificações.

## Validação do candidato 0.2.2-alpha.1

- 71/71 suítes automatizadas aprovadas.
- Build offline e compilação do instalador NSIS concluídos.
- Payload `app.asar` executado em Electron com perfil temporário isolado:
  home e jogo sem exceções, sem imagens quebradas e sem splash travado.
- Cliques em Carregar carreira e Nova carreira abriram os fluxos correspondentes.
- Carreira de teste criada, painel com 27 jogadores e carreira preservada após reload.
- Painel validado no navegador com registros sintéticos: filtro de competição,
  nota média, ausência de registros e escape de nomes.
- Regressão de save/load, duplicidade e substituição de partidas coberta em memória.

O teste do payload não equivale à instalação Windows real nem a uma partida completa
no executável. Instalação limpa/atualização/cancelamento e carreira longa continuam
como critérios de homologação. O candidato não foi publicado nem instalado sobre
a versão funcional do usuário.
