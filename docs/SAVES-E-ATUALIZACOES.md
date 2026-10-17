# Saves, versões e recuperação

## Onde a carreira é salva

- O app desktop usa `localStorage` do Electron, não o perfil de um navegador.
- A pasta de dados do aplicativo tem o nome fixo `BR Fut`.
- O caminho esperado é `%APPDATA%\BR Fut\Local Storage\leveldb`.
- A instalação de uma versão nova não deve apagar essa pasta.
- A desinstalação não remove dados do aplicativo (`deleteAppDataOnUninstall: false`).
- A mesma origem `app://brfut` é mantida entre versões.

## Como a carreira é encontrada

- O índice de carreiras fica em `brfut-career-index`.
- Os slots usam `brfut-slot-<id>-career`, `brfut-slot-<id>-season` e o histórico
  correspondente.
- O formato legado também é reconhecido:
  `brfut-career`, `brfut-season`, `brfut-player-history`, `futmanager-pace`.
- O carregamento primeiro tenta o slot ativo e, se necessário, recupera do slot
  completo.
- Se o slot ativo não estiver na sessão, ele é recuperado do índice.

## O que uma atualização deve preservar

- Pasta `%APPDATA%\BR Fut`.
- Carreiras, temporada ativa, histórico, configurações e slots.
- Antes de instalar ou atualizar, salve a carreira e feche o jogo.
- Um instalador novo com a mesma origem não apaga dados automaticamente.

## O que uma atualização pode alterar

- O overall pode ser recalculado a partir dos atributos já existentes.
- Atributos e identidade de jogador não são inventados por uma atualização.
- Mudanças incompatíveis devem ser anunciadas explicitamente.

## Se a carreira não aparecer

1. Feche o jogo e verifique se a pasta `%APPDATA%\BR Fut` ainda existe.
2. Confirme que a nova versão foi instalada na mesma máquina.
3. Não instale uma versão antiga sobre uma carreira já migrada: isso pode
   falhar ou ignorar dados novos.
4. Se necessário, faça backup da pasta `%APPDATA%\BR Fut` antes de qualquer
   reinstalação.

## Diagnóstico

- A versão instalada aparece no menu Ajuda > Sobre o BR Fut.
- O painel de atualizações pode ser aberto na home e na carreira.
- O download é manual e não substitui arquivos isolados.
- O relatório de versões está em `docs/releases/<versão>.md`.

## Alinhamento com atualizações

- Mesmo nome de aplicativo: `BR Fut`.
- Mesma origem do esquema: `app://brfut`.
- Mesmo diretório de dados do usuário.
- Mesmo identificador do instalador: `br.com.brfut.desktop`.
- A atualização não deve apagar dados de usuário.

Os caminhos de Electron e as chaves de storage permanecem estáveis entre
versões. A pasta de dados não muda com a atualização.