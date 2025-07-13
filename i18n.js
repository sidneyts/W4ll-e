const i18next = require('i18next');
const FsBackend = require('i18next-fs-backend');
const path = require('path');
const { app } = require('electron');

// Esta função agora retorna uma promessa que resolve quando o i18next está pronto.
const initI18n = () => {
  return i18next
    .use(FsBackend)
    .init({
      lng: 'pt', // Pode alterar para 'en' para testar
      fallbackLng: 'en',
      backend: {
        loadPath: path.join(app.getAppPath(), 'locales/{{lng}}.json'),
      },
      interpolation: {
        escapeValue: false,
      },
    });
};

// Exporta a instância inicializada e a função de inicialização
module.exports = { i18next, initI18n };
