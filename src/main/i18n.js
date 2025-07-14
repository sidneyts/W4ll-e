// src/main/i18n.js
const i18next = require('i18next');
const FsBackend = require('i18next-fs-backend');
const path = require('path');
const { app } = require('electron');

/**
 * Inicializa a instância do i18next para carregar os arquivos de tradução.
 * Retorna uma promessa que resolve quando a inicialização está completa.
 */
const initI18n = () => {
  // CORREÇÃO: Simplifica a lógica de caminho. app.getAppPath() funciona de forma
  // fiável tanto em desenvolvimento quanto na aplicação empacotada (aponta para a raiz do app.asar).
  const localesPath = path.join(app.getAppPath(), 'locales');

  return i18next
    .use(FsBackend)
    .init({
      lng: 'pt', // Idioma padrão
      fallbackLng: 'en', // Idioma de fallback
      backend: {
        // Usa o caminho dinâmico para carregar os JSONs de tradução
        loadPath: path.join(localesPath, '{{lng}}.json'),
      },
      interpolation: {
        escapeValue: false, // Não é necessário para o Electron
      },
      // Adiciona um log de depuração para ajudar a diagnosticar problemas de carregamento
      debug: !app.isPackaged, // Ativa o debug apenas em modo de desenvolvimento
    });
};

// Exporta a instância e a função de inicialização
module.exports = { i18next, initI18n };
