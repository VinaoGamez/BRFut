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
  bridgeVersion: '2.0.0',
  canal: 'electron',
  // O jogo é de tela cheia de uso único: nada abre janela auxiliar.
  novaJanela: false,
  sair: () => ipcRenderer.send('app:quit'),
  updates: {
    getStatus: () => ipcRenderer.invoke('updates:status'),
    check: () => ipcRenderer.invoke('updates:check'),
    setAutoCheck: value => ipcRenderer.invoke('updates:preference', value),
    openNotes: () => ipcRenderer.invoke('updates:notes'),
    openInstaller: () => ipcRenderer.invoke('updates:installer'),
    openHistory: () => ipcRenderer.invoke('updates:history'),
    onStatus: callback => {
      if (typeof callback !== 'function') return () => {};
      const listener = (_event, status) => callback(status);
      ipcRenderer.on('updates:state', listener);
      return () => ipcRenderer.removeListener('updates:state', listener);
    },
  },
});
