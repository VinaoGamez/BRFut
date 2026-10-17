# 12 — Empacotamento desktop (Windows)

> Como o BR Fut vira um `.exe` instalável, e o que foi verificado no caminho.

## Resumo

| | |
|---|---|
| Tecnologia | Electron 33 + electron-builder 25 |
| Alvo | Windows x64, instalador NSIS |
| Instalador | **133,6 MB** |
| Instalado | **332 MB** em `%LOCALAPPDATA%\Programs\BR` |
| Dependência de runtime | nenhuma — sem API, sem VPS, sem Python |

Gerar:

```
GERAR-INSTALADOR.bat            -> instalador .exe em release\
GERAR-INSTALADOR.bat --dir      -> só a pasta descompactada, para testar
```

Ou direto: `npm run desktop:dist`.

## Por que Electron

A máquina tem Node e npm, e o registro npm é alcançável. **Rust não está
instalado** — o Tauri daria um instalador de ~10 MB em vez de 133 MB, mas exige
instalar Rust e as ferramentas de build do MSVC (1–2 GB) e é o tipo de coisa que
quebra numa máquina recém-formatada. Para um instalador que vai para testers,
**instalar sem erro importa mais que o tamanho**.

## O ponto que decide tudo: módulos ES não funcionam em `file://`

O jogo usa `<script type="module">`. O Chromium bloqueia módulo ES vindo de
`file://` por CORS — `loadFile()` deixaria o jogo em branco.

A solução é `electron/main.cjs` registrar um esquema próprio, `app://`, e servir
o `dist/` de dentro do pacote. Vantagens sobre um servidor HTTP local: não ocupa
porta, não conflita com nada, e não depende de rede.

```js
protocol.registerSchemesAsPrivileged([{
  scheme: 'app',
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
}]);
```

`standard` + `secure` são obrigatórios: sem eles o esquema não tem origem e o
CSP do jogo (`default-src 'self'`) bloqueia tudo.

## Limite de caminho

`resolverCaminho()` recusa qualquer `..` que escape do `dist/`. Sem isso o app
serviria o sistema inteiro em `app://`.

## Duas decisões que não são óbvias

**`signAndEditExecutable: false`.** O passo de assinar/editar o executável baixa
o cache `winCodeSign`, que só descompacta com privilégio de symlink — bloqueado
sem Developer Mode ou administrador. Como o app não é assinado, o passo é
dispensável.

Preço: o `.exe` sai **sem ícone embutido e sem metadados de versão**. Para a
versão polida, ligue o Developer Mode em
*Configurações → Atualização e Segurança → Para desenvolvedores* e remova essa
linha do `electron-builder.yml`.

**Menu no processo principal, não no preload.** A janela roda com
`sandbox: true`. Em preload com sandbox o Electron só expõe `contextBridge` e
`ipcRenderer` — chamar `Menu` de lá derruba o carregamento do script inteiro, e
o sintoma é uma janela em branco com
`Unable to load preload script`, que não aponta para a causa.

## Como funciona na máquina do usuário

### O que acontece ao abrir o instalador

Assistente em português: escolhe a pasta, cria o atalho no menu Iniciar (e na
área de trabalho), deixa instalar só para o usuário — sem pedir administrador.
Instala em `%LOCALAPPDATA%\Programs\BR` (332 MB) e registra o desinstalador no
Painel de Controle.

**Desinstalar não apaga as carreiras.** `deleteAppDataOnUninstall: false`.
Reinstalar ou trocar de máquina com a pasta `%APPDATA%\BR Fut` copiada traz as
carreiras junto.

### Como o motor roda

O jogo continua sendo a mesma aplicação web — nenhum código do jogo foi
reescrito para o desktop. O que existe em volta:

1. `electron/main.cjs` cria a janela e registra o esquema `app://`
2. Toda requisição do jogo é servida de dentro do pacote (`app.asar`), do disco
3. `localStorage` é o do Chromium, com um LevelDB em disco

**Não há servidor, porta, Node na máquina do usuário, nem Python.** O app abre
sozinho. O `SKILL` de `probeBackend` vai falhar, e tudo bem: o jogo foi montado
com as variáveis de modo offline embutidas, então nunca espera login.

### Onde ficam os saves

```
%APPDATA%\BR Fut\
├── Local Storage\leveldb\    ← as carreiras (localStorage do Chromium)
├── Preferences               ← janela, idioma
├── Cache / Code Cache / GPUCache
└── Local State
```

Sozinho, ocupa **4,6 MB**. As chaves do jogo (`brfut-career`, `brfut-season`,
`brfut-save-reset-epoch`, slots `brfut-slot-*`) estão todas no LevelDB.

Copiar essa pasta para outro PC transfere as carreiras. O
`SAVE_RESET_EPOCH` funciona igual ao navegador: trocar o valor reinicia as
carreiras — é o mecanismo usado para invalidar saves de formato antigo.

> **Detalhe que custou uma correção:** o Electron tira o nome dessa pasta do
> `name` do `package.json`, que é `brfut-alpha`. Sem `app.setName('BR Fut')` em
> `main.cjs`, o app se chamava "BR Fut" mas salvava em `%APPDATA%\brfut-alpha`.

## Modo offline embutido

`scripts/build-desktop.mjs` monta o `dist/` com as mesmas variáveis do
`INICIAR-BRFUT-OFFLINE-BUILD.bat`:

```
BRFUT_AUTH_REQUIRED=false
BRFUT_API_ORIGIN=
BRFUT_LOCAL_API_TARGET=http://127.0.0.1:9/
```

Um app desktop não tem API nem VPS, então precisa nascer sem elas. Sem isso o
jogo fica esperando login que nunca chega.

## O que foi verificado

A cadeia inteira, não só o build:

1. `npm run build` gera `dist/` (63 MB)
2. electron-builder gera `BR-Fut-0.2.0-alpha-instalador.exe` (133,6 MB)
3. Instalador roda com código de saída 0
4. Instala em `%LOCALAPPDATA%\Programs\BR` (332 MB), cria atalho no menu
   Iniciar e registra o desinstalador
5. O **app instalado** sobe, serve `app://brfut/home.html` e renderiza
6. O jogo entra em `index.html?novo=1` com 4777 nós de DOM e o modal de nova
   carreira completo, **sem nenhum erro de console**
7. O desinstalador remove tudo

A verificação foi feita falando com o renderer pelo protocolo de debug do
Electron (`--remote-debugging-port`), perguntando ao DOM — não olhando se o
processo estava vivo, que não prova nada.

## O que não entra no pacote

Só `dist/`, `electron/main.cjs`, `electron/preload.cjs` e `package.json`. O
repositório tem 167 MB com fontes, `node_modules` e páginas de laboratório; nada
disso vai para o instalador.

## Payload

63 MB de conteúdo, dos quais **37 MB são 17 PNGs de cards de gerente** (2,2 MB
cada). Se o instalador estiver grande demais para o público-alvo, reduzir essas
imagens é o primeiro lugar a mexer.