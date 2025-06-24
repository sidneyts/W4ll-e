// FALA TESTE
const { contextBridge, ipcRenderer } = require('electron');

/**
 * A ponte de contexto (Context Bridge) expõe de forma segura APIs do backend (main.js)
 * para a interface (script.js), sem expor todo o objeto `ipcRenderer`.
 */
contextBridge.exposeInMainWorld('ipcRenderer', {
  /**
   * Envia uma mensagem do processo de renderização para o processo principal.
   * @param {string} channel - O canal da mensagem.
   * @param {*} data - Os dados a serem enviados.
   */
  send: (channel, data) => ipcRenderer.send(channel, data),

  /**
   * Ouve mensagens vindas do processo principal.
   * @param {string} channel - O canal da mensagem a ser ouvido.
   * @param {Function} func - A função de callback a ser executada quando uma mensagem for recebida.
   */
  on: (channel, func) => {
    // Cria um listener que repassa os argumentos para a função de callback
    const subscription = (event, ...args) => func(...args);
    ipcRenderer.on(channel, subscription);

    // Opcional: Retorna uma função para remover o listener, útil para limpeza em componentes React/Vue
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  }
});
