// src/renderer/dom.js

export const appWrapper = document.getElementById('app-wrapper');
export const clientNameInput = document.getElementById('client-name');

// --- Abas ---
export const tabConverterBtn = document.getElementById('tab-converter');
export const tabSuperLedBtn = document.getElementById('tab-superled');
export const converterView = document.getElementById('converter-view');
export const superLedView = document.getElementById('superled-view');

// --- Visão do Conversor Padrão ---
export const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
export const dropZone = document.getElementById('drop-zone');
export const queueList = document.getElementById('queue-list');
export const presetsCheckboxList = document.getElementById('presets-checkbox-list');
export const startBtn = document.getElementById('start-btn');
export const pauseBtn = document.getElementById('pause-btn');
export const cancelBtn = document.getElementById('cancel-btn');
export const logBtn = document.getElementById('log-btn');
export const clearQueueBtn = document.getElementById('clear-queue-btn');

// --- Visão do Criador SUPERLED ---
export const superLedPanelContainers = document.querySelectorAll('.panel-container');
export const startSuperLedBtn = document.getElementById('start-superled-btn');
export const superLedProgressContainer = document.getElementById('superled-progress-container');
export const superLedProgressBar = document.getElementById('superled-progress-bar');
export const superLedLogContainer = document.getElementById('superled-log-container');
export const superLedLogOutput = document.getElementById('superled-log-output');

// --- Modais e Botões Gerais ---
export const logModal = document.getElementById('log-modal');
export const logModalCloseBtn = document.getElementById('log-modal-close-btn');
export const logOutput = document.getElementById('log-output');

export const presetsModal = document.getElementById('presets-modal');
export const managePresetsBtn = document.getElementById('manage-presets-btn');
export const presetsModalCloseBtn = document.getElementById('presets-modal-close-btn');
export const savedPresetsList = document.getElementById('saved-presets-list');
export const presetFormContainer = document.getElementById('preset-form-container');
export const presetForm = document.getElementById('preset-form');
export const deletePresetBtn = document.getElementById('delete-preset-btn');
export const addNewPresetBtn = document.getElementById('add-new-preset-btn');
export const importPresetsBtn = document.getElementById('import-presets-btn');
export const exportPresetsBtn = document.getElementById('export-presets-btn');

export const settingsModal = document.getElementById('settings-modal');
export const settingsBtn = document.getElementById('settings-btn');
export const settingsModalCloseBtn = document.getElementById('settings-modal-close-btn');
export const languageSelect = document.getElementById('language-select');
export const encoderPresetSelect = document.getElementById('encoder-preset-select');
export const qualityFactorSlider = document.getElementById('quality-factor-slider');
export const qualityFactorValue = document.getElementById('quality-factor-value');
export const checkForUpdatesBtn = document.getElementById('check-for-updates-btn');

export const genericModal = document.getElementById('generic-modal');
export const genericModalTitle = document.getElementById('generic-modal-title');
export const genericModalMessage = document.getElementById('generic-modal-message');
export const genericModalButtons = document.getElementById('generic-modal-buttons');
export const genericModalConfirmBtn = document.getElementById('generic-modal-confirm-btn');
export const genericModalCancelBtn = document.getElementById('generic-modal-cancel-btn');

// --- Controles da Janela ---
export const closeWindowBtn = document.getElementById('close-btn');
export const minimizeWindowBtn = document.getElementById('minimize-btn');
export const maximizeWindowBtn = document.getElementById('maximize-btn');
