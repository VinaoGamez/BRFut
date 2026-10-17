/**
 * BR Fut — processo principal do aplicativo dektop.
 *
 * O jogo é uma aplicação web com módulos ES. Módulos ES não carregam por
 * `file://` (o Chromium bloqueia por CORS), então em vez de `loadFile()` o app
 * serve o `dist/` por um esquema próprio, `app://`. Vantagens sobre um servidor
 * HTTP local: não ocupa porta, não conflita com nada na máquina, e sobrevive a
 * firewall porque nunca sai para a rede.
 *
 * `.cjs` de propósito: o package.json do projeto é `"type": "module"`, e um
 * `main.js` seria interpretado como ESM e quebraria na hora.
 */
const { app, BrowserWindow, Menu, protocol, net, shell, dialog, ipcMain } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { readFileSync } = require('node:fs');
const { createUpdateService, isTrustedDesktopSender } = require('./updates.cjs');

const RAIZ = path.join(__dirname, '..');
const DIST = path.join(RAIZ, 'dist');
const ENTRADA = 'home.html';
const ESQUEMA = 'app';
const HOST = 'brfut';

// Electron tira o nome da pasta de dados do `name` do package.json, que aqui é
// "brfut-alpha" — o app se chamaria BR Fut mas salvaria em
// %APPDATA%\brfut-alpha. Fixa o nome para a pasta ficar %APPDATA%\BR Fut.
app.setName('BR Fut');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

// Sem isto o esquema é tratado como "não padrão": sem origem, sem fetch e sem
// suporte a módulos ES. Precisa ser declarado antes do app ficar pronto.
protocol.registerSchemesAsPrivileged([
  {
    scheme: ESQUEMA,
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
  },
]);

/** Só o que está dentro do dist é servido. Qualquer `..` é recusado. */
function resolverCaminho(urlPath) {
  const limpo = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  const relativo = limpo === '/' || limpo === '' ? ENTRADA : limpo.replace(/^\/+/, '');
  const alvo = path.join(DIST, relativo);
  const normalizado = path.resolve(alvo);
  // Traversal: `/../../Windows/System32` resolve para fora do dist.
  if (normalizado !== path.resolve(DIST) && !normalizado.startsWith(path.resolve(DIST) + path.sep)) {
    return null;
  }
  return normalizado;
}

function registrarProtocolo() {
  protocol.handle(ESQUEMA, async (request) => {
    const url = new URL(request.url);
    const alvo = resolverCaminho(url.pathname);
    if (!alvo) return new Response('Proibido', { status: 403 });
    try {
      const resposta = await net.fetch(pathToFileURL(alvo).toString());
      if (resposta.status === 404) {
        // Sem header de tipo: o net.fetch devolve 404 com corpo HTML do
        // filesystem, que o navegador renderizaria como página de erro.
        return new Response('Não encontrado', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
      }
      const tipo = MIME[path.extname(alvo).toLowerCase()];
      const headers = new Headers(resposta.headers);
      if (tipo) headers.set('content-type', tipo);
      return new Response(resposta.body, { status: resposta.status, headers });
    } catch {
      return new Response('Indisponível', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }
  });
}

let janela = null;
let updates = null;

async function openUpdatePage(kind) {
  if (kind === 'installer') {
    const answer = await dialog.showMessageBox(janela, {
      type: 'info', title: 'Atualização do BR Fut',
      message: 'Salve sua carreira antes de atualizar.',
      detail: 'O download será aberto no navegador. Depois de baixar, feche o BR Fut e execute o instalador. O jogo não será fechado nem atualizado automaticamente.',
      buttons: ['Abrir download', 'Cancelar'], defaultId: 1, cancelId: 1,
    });
    if (answer.response !== 0) return false;
  }
  await shell.openExternal(updates.getOpenUrl(kind));
  return true;
}

async function checkDesktopUpdates() {
  try {
    const status = await updates.check();
    const available = status.state === 'available';
    const message = available ? `BR Fut ${status.release.version} disponível` :
      status.state === 'up-to-date' ? 'Você está na versão mais recente disponível.' :
      status.state === 'no-release' ? 'Ainda não há instalador publicado neste canal.' :
      'Não foi possível consultar as atualizações. Você pode continuar jogando offline.';
    const result = await dialog.showMessageBox(janela, {
      type: 'info', title: `BR Fut ${status.currentVersion}`, message,
      detail: available ? status.release.notes.slice(0, 4000) : 'A consulta não modifica seus saves nem interrompe sua carreira.',
      buttons: available ? ['Ver novidades', 'Baixar instalador', 'Depois'] : ['OK'], cancelId: available ? 2 : 0,
    });
    if (available && result.response < 2) await openUpdatePage(result.response === 0 ? 'notes' : 'installer');
  } catch { /* Closing a window or browser failure must never close the game. */ }
}

function registerDesktopUpdates() {
  let currentNotes = '';
  try { currentNotes = readFileSync(path.join(RAIZ, 'docs', 'releases', `${app.getVersion()}.md`), 'utf8'); } catch {}
  updates = createUpdateService({
    currentVersion: app.getVersion(), currentNotes,
    preferencesPath: path.join(app.getPath('userData'), 'update-preferences.json'),
    fetchImpl: (url, options) => net.fetch(url, options),
    onChange: status => {
      if (janela && !janela.isDestroyed()) janela.webContents.send('updates:state', status);
    },
  });
  const handle = (channel, fn) => ipcMain.handle(channel, (event, ...args) => {
    if (!isTrustedDesktopSender(event, janela?.webContents)) throw new Error('Origem não autorizada');
    return fn(...args);
  });
  handle('updates:status', () => updates.getStatus());
  handle('updates:check', () => updates.check());
  handle('updates:preference', value => updates.setAutoCheck(value));
  handle('updates:notes', () => openUpdatePage('notes'));
  handle('updates:installer', () => openUpdatePage('installer'));
  handle('updates:history', () => openUpdatePage('history'));
  ipcMain.on('app:quit', event => { if (isTrustedDesktopSender(event, janela?.webContents)) app.quit(); });
}

/**
 * Menu do Windows, em português.
 *
 * Fica aqui e não no preload: com `sandbox: true` o preload só enxerga
 * `contextBridge` e `ipcRenderer`, e chamar `Menu` de lá derruba o carregamento
 * do script inteiro.
 */
function montarMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: 'Arquivo',
      submenu: [
        { label: 'Nova aba de carreira', click: () => janela?.focus() },
        { type: 'separator' },
        { label: 'Sair', accelerator: 'Alt+F4', click: () => app.quit() },
      ],
    },
    {
      label: 'Ajuda',
      submenu: [
        { label: 'Verificar atualizações…', click: () => { void checkDesktopUpdates(); } },
        { type: 'separator' },
        {
          label: 'Sobre o BR Fut',
          click: () => dialog.showMessageBox({
            type: 'info',
            title: 'BR Fut',
            message: `BR Fut ${app.getVersion()}`,
            detail: 'Simulador de gestão offline. Atualizações opcionais pelo GitHub Releases, sem instalação automática.',
          }),
        },
      ],
    },
  ]));
}

function criarJanela() {
  janela = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#0b1416',
    title: 'BR Fut',
    show: false,
    autoHideMenuBar: true,
    icon: path.join(DIST, 'brand', 'mark-favicon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  janela.once('ready-to-show', () => janela.show());
  janela.loadURL(`${ESQUEMA}://${HOST}/${ENTRADA}`);

  // Links externos vão para o navegador do sistema, nunca dentro do app.
  janela.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  janela.webContents.on('will-navigate', (evento, url) => {
    if (!url.startsWith(`${ESQUEMA}://${HOST}/`)) {
      evento.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url);
    }
  });

  janela.on('closed', () => { janela = null; });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!janela) return;
    if (janela.isMinimized()) janela.restore();
    janela.focus();
  });

  app.whenReady().then(() => {
    registrarProtocolo();
    registerDesktopUpdates();
    montarMenu();
    criarJanela();
    // Explicit opt-in. Never await a network operation during startup.
    if (updates.getStatus().autoCheck) void updates.check();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) criarJanela();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Falha de esquema/protocolo é o tipo de coisa que só aparece no app pronto.
// Sem isto o usuário vê uma janela em branco e nenhum aviso.
app.on('render-process-gone', (_e, _webContents, detalhes) => {
  dialog.showErrorBox('BR Fut', `O processo de renderização encerrou.\n\n${detalhes?.reason || 'motivo desconhecido'}`);
});

module.exports = { ESQUEMA, HOST, DIST };
