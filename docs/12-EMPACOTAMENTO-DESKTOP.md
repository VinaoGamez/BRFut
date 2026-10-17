# 12 — Empacotamento desktop (Windows)

> Como o BR Fut vira um `.exe` instalável, e o que foi verificado no caminho.

## Resumo

| | |
|---|---|
| Tecnologia | Electron 33 + electron-builder 25 |
| Alvo | Windows x64, instalador NSIS |
| Instalador | **89,8 MB** (era 133,6 MB) |
| Conteúdo do jogo | **15,4 MB** (era 63,4 MB) |
| Instalado | **284 MB** em `%LOCALAPPDATA%\Programs\BR Fut` |
| Dependência de runtime | nenhuma - sem API, sem VPS, sem Python |

O instalador é **74,3 MB de runtime do Electron + 15,5 MB de jogo**. Ver
[Onde o tamanho ainda está](#onde-o-tamanho-ainda-está) para o que isso implica.

Gerar:

```
GERAR-INSTALADOR.bat            -> instalador .exe em release\
GERAR-INSTALADOR.bat --dir      -> só a pasta descompactada, para testar
```

Ou direto: `npm run desktop:dist`.

## Por que Electron

A máquina tem Node e npm, e o registro npm é alcançável. **Rust não está
instalado** - o Tauri daria um instalador de ~15 MB em vez de 89,8 MB, mas exige
instalar Rust e as ferramentas de build do MSVC (1-2 GB) e é o tipo de coisa que
quebra numa máquina recém-formatada. Para um instalador que vai para testers,
**instalar sem erro importa mais que o tamanho** - e o tamanho já caiu 33% sem
trocar de framework. Ver [Onde o tamanho ainda está](#onde-o-tamanho-ainda-está).

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
Instala em `%LOCALAPPDATA%\Programs\BR Fut` (284 MB) e registra o desinstalador
no Painel de Controle.

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

1. `npm run build` gera `dist/` com **15,4 MB** e só duas páginas
2. electron-builder gera `BR-Fut-0.2.0-alpha-instalador.exe` com **89,8 MB**
3. Instalador roda com código de saída 0
4. Instala em `%LOCALAPPDATA%\Programs\BR Fut` (284 MB), cria atalho no menu
   Iniciar e registra o desinstalador
5. O **app instalado** sobe, serve `app://brfut/home.html` e renderiza
6. O jogo entra em `index.html?novo=1` com 4777 nós de DOM e o modal de nova
   carreira completo, **sem nenhum erro de console e sem splash travado**
7. **Todas as 286 imagens do `app.asar` instalado são servidas com 200** —
   167 WebP, nenhuma quebrada
8. A suíte inteira passa: **56/56**, incluindo os dois checks de integridade
   de asset
9. O desinstalador remove tudo

A verificação foi feita falando com o renderer pelo protocolo de debug do
Electron (`--remote-debugging-port`), perguntando ao DOM — não olhando se o
processo estava vivo, que não prova nada.

O passo 7 é o que protege a conversão de imagens. Confiar no build só prova que
o arquivo foi emitido; o que importa é se o app **servido** devolve o conteúdo
certo. Dois scripts, ambos com o app instalado e rodando:

```
npm run desktop:verify:boot <porta>     # telas sobem, sem exceção, sem img quebrada
npm run desktop:verify:assets <porta>   # toda imagem do pacote é servida com 200
```

O de assets coleta os URLs que a página realmente pediu (resource timing), soma
os que você passar à mão, e falha se algum vier 404 ou vazio. Para conferir o
pacote inteiro, sem deixar nada de fora:

```powershell
$urls = npx asar list "$env:LOCALAPPDATA\Programs\BR Fut\resources\app.asar" |
  Where-Object { $_ -match '^\\dist\\.*\.(png|webp|jpg|jpeg|svg|gif|mp3)$' } |
  ForEach-Object { ($_ -replace '^\\dist', '' -replace '\\','/') }
node scripts/verifica-assets-instalado.mjs <porta> @urls
```

Ambos pulam `data:` e `blob:` — imagem inline em base64 não tem arquivo para
checar, e tratá-la como endereço dá 404 falso.

## O que não entra no pacote

Só `dist/`, `electron/main.cjs`, `electron/preload.cjs` e `package.json`. O
repositório tem 167 MB com fontes, `node_modules` e páginas de laboratório; nada
disso vai para o instalador.

## Payload: por que ele estava em 63 MB

O primeiro build carregava 63,4 MB de conteúdo. A maior parte era PNG:

```
manager-cards/   37,2 MB   17 PNGs de 2,2 MB  <- 59% do payload
assets/          21,0 MB   104 PNGs + 42 WebP
brand/            3,1 MB   3 PNGs de ~900 KB
data/             1,7 MB   JSON do mundo
```

Duas conclusões, ambas medidas antes de mexer em qualquer arquivo:

**Os cards de gerente não estavam superdimensionados.** O painel tem
`width: min(510px, calc(75vh - 36px))` com `aspect-ratio: 3/4`, ou seja 510x680
px. O arquivo tem 1024x1536 — um asset 2x, exatamente do tamanho certo para
tela retina. Reduzir a resolução teria sido o erro; o custo estava no **formato**.

**Os ícones de estatística estavam 17x superdimensionados.** São renderizados com
`width="58" height="58"` e o arquivo tinha 1024x1024. Aqui sim, resize.

### O que mudou

`scripts/optimize-assets.py` converte PNG para WebP (Pillow), mantendo a resolução
e só reduzindo quando o tamanho de exibição é muito menor que o arquivo. Os
originais ficam no histórico do git.

| | Antes | Depois |
|---|---|---|
| `manager-cards/` | 37,2 MB (PNG 1024x1536) | 1,9 MB (WebP 1024x1536, q82) |
| `assets/cards/` | 12,4 MB (PNG 682x1024) | ~1,1 MB (WebP, mesma resolução, q85) |
| `brand/` | 3,1 MB | 0,19 MB (ícones de 58px em 256x256) |
| **Total** | **63,4 MB** | **15,4 MB** |

Complemento: o build passou a gerar **só `index.html` e `home.html`**. As sete
páginas de laboratório (`card-lab.html`, `team-lab.html`, …) são ferramenta de
desenvolvimento e o `npm run dev` as serve direto da fonte. Empacotá-las não
economizava nada, porque `js/lab/` também é onde mora o sistema de cards — que é
código de produção: `js/engine/player-card-art.js` importa `js/lab/card-variants.js`,
e é dali que vêm os 79 imports estáticos de arte. Ligar o build dos labs quando
precisar: `BRFUT_BUILD_LABS=true`.

### A armadilha que isso criou

O atualizador de referências troca `arquivo.png` por `arquivo.webp` **por
basename**. Com `assets/ui/goal-ball.png` e um homônimo em outra pasta, a troca
acertou a referência errada: o código passou a pedir `goal-ball.webp`, que não
existia, e o build quebrou.

Pior foi o que o build **não** pegou. Duas formas de referenciar imagem não são
import estático:

```js
import.meta.glob('../../assets/sponsors/icons/*.png', ...)   // glob
`../sponsors/icons/${slug}.png`                             // template literal
```

Nenhuma das duas é reescrita por basename. Depois da conversão, os 19 logos de
patrocinadorexistiam só como `.webp` e o jogo continuava pedindo `.png` — o
build passava limpo, a suíte passava limpa, e o sintoma em execução era um
`<img>` com `naturalWidth === 0`: um retângulo vazio, sem exceção no console.

Viraram dois checks em `scripts/import-integrity-tests.mjs`:

```
✓ todo asset referenciado existe em disco
✓ todo glob e caminho montado bate com um arquivo existente
```

O segundo não resolve o arquivo (o nome é runtime) — confirma que a extensão
pedida existe em algum lugar do diretório alvo, que é o que quebra na troca de
formato.

**Um teste que passa sem detectar nada é pior que não ter teste.** A primeira
versão desse check era exatamente isso: um `catch {}` genérico engolia um
`ReferenceError` do próprio checker, e ele dava `✓` com o bug injetado. Só
descobriu porque o bug foi reintroduzido de propósito para conferir que a falha
aparecia. Vale refazer isso sempre que um check novo entrar:

```powershell
# reintroduz o bug, confere que o teste falha, restaura
```

O `catch` agora só engole `ENOENT` e re-lança qualquer outra coisa.

## Onde o tamanho ainda está

```
instalador total:      89,8 MB
jogo (app.asar):       15,5 MB   17%
runtime Electron:      74,3 MB   83%
```

O Chromium embutido é o piso do Electron e não encolhe com configuração. Mesmo
zerando o conteúdo do jogo, o instalador ficaria perto de 75 MB.

**Para chegar a ~15 MB de instalador seria preciso trocar de framework** — Tauri,
usando o WebView2 que já está em toda máquina Windows 10/11 (aqui: 155.0.4283.45).
O que impede hoje não é técnico: a máquina não tem Rust, e instalar a toolchain
com as ferramentas de build do MSVC é de 1 a 2 GB. A troca também é uma migração
do shell de empacotamento, não um ajuste de configuração.

Medida para decidir, não para estimar: 89,8 MB contra 133,6 MB já é 33% menor, e
15,4 MB de conteúdo para um jogo com calendário internacional, quatro divisões
brasileiras e Continental é conteúdo enxuto.