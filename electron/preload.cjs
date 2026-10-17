/**
 * Ponte mínima entre o processo principal e a página.
 *
 * A janela roda com `sandbox: true`. Em preload com sandbox o Electron só
 * expõe um subconjunto do módulo — `contextBridge` e `ipcRenderer` existem,
 * `Menu` e `dialog` não. Por isso o menu do Windows é montado em
 * `main.cjs`, e aqui fica só a ponte.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('brfutDesktop', {
  versao: '1.0.0',
  canal: 'electron',
  // O jogo é de tela cheia de uso único: nada abre janela auxiliar.
  novaJanela: false,
  sair: () => ipcRenderer.send('app:quit'),
});