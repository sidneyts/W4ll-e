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
  // Determina o caminho para a pasta 'locales' de forma robusta,
  // funcionando tanto em desenvolvimento quanto com o app empacotado.
  const localesPath = app.isPackaged
    ? path.join(process.resourcesPath, 'locales')
    : path.join(app.getAppPath(), 'locales');

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
    });
};

// Exporta a instância e a função de inicialização
module.exports = { i18next, initI18n };
