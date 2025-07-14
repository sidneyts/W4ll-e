// src/renderer/dom.js

export const appWrapper = document.getElementById('app-wrapper');
export const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
export const dropZone = document.getElementById('drop-zone');
export const queueList = document.getElementById('queue-list');
export const clientNameInput = document.getElementById('client-name');

// Modals
export const logModal = document.getElementById('log-modal');
export const closeModalBtn = logModal.querySelector('.modal-close-btn');
export const logOutput = document.getElementById('log-output');

export const presetsModal = document.getElementById('presets-modal');
export const managePresetsBtn = document.getElementById('manage-presets-btn');
export const presetsModalCloseBtn = document.getElementById('presets-modal-close-btn');
export const savedPresetsList = document.getElementById('saved-presets-list');
export const presetForm = document.getElementById('preset-form');
export const presetFormTitle = document.getElementById('preset-form-title');
export const deletePresetBtn = document.getElementById('delete-preset-btn');
export const applyBarCheckbox = document.getElementById('preset-applyBar');
export const barSizeContainer = document.getElementById('bar-size-container');
export const presetsCheckboxList = document.getElementById('presets-checkbox-list');

// Novos campos do formulário de preset
export const presetDurationInput = document.getElementById('preset-duration');
export const ratioToleranceInput = document.getElementById('preset-ratioTolerance');
export const useOriginalDurationCheckbox = document.getElementById('preset-useOriginalDuration');


export const settingsModal = document.getElementById('settings-modal');
export const settingsBtn = document.getElementById('settings-btn');
export const settingsModalCloseBtn = document.getElementById('settings-modal-close-btn');
export const languageSelect = document.getElementById('language-select');

// Action Buttons
export const startBtn = document.getElementById('start-btn');
export const pauseBtn = document.getElementById('pause-btn');
export const cancelBtn = document.getElementById('cancel-btn');
export const logBtn = document.getElementById('log-btn');
export const clearQueueBtn = document.getElementById('clear-queue-btn');
export const checkForUpdatesBtn = document.getElementById('check-for-updates-btn');
export const importPresetsBtn = document.getElementById('import-presets-btn');
export const exportPresetsBtn = document.getElementById('export-presets-btn');
export const addNewPresetBtn = document.getElementById('add-new-preset-btn');

// Window Controls
export const closeWindowBtn = document.getElementById('close-btn');
export const minimizeWindowBtn = document.getElementById('minimize-btn');
export const maximizeWindowBtn = document.getElementById('maximize-btn');
