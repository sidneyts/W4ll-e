// src/renderer/renderer.js

// Importa os módulos e suas funções de inicialização
import * as state from './state.js';
import * as ui from './ui.js';
import { initEventListeners } from './events.js';
import { initIpcHandlers } from './ipc.js';

/**
 * Aplica as traduções na interface.
 */
async function applyTranslations() {
    const translations = await window.electronAPI.getTranslations();
    state.setTranslations(translations);
    
    document.querySelectorAll('[data-i18n-key]').forEach(el => {
        const key = el.getAttribute('data-i18n-key');
        if (translations[key]) el.textContent = translations[key];
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (translations[key]) el.placeholder = translations[key];
    });

    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (translations[key]) el.title = translations[key];
    });
}

/**
 * Carrega os presets e atualiza a UI.
 */
async function initializePresets() {
    const loadedPresets = await window.electronAPI.loadPresets();
    state.setPresets(loadedPresets);
    ui.renderPresetCheckboxes();
    ui.updatePresetAvailability();
}

/**
 * Função principal de inicialização do renderer.
 */
async function main() {
    // Define a plataforma no corpo do documento para estilização específica
    document.body.classList.add(`platform-${window.electronAPI.getPlatform()}`);
    
    await applyTranslations();
    initEventListeners();
    initIpcHandlers();
    ui.updateQueueUI();
    await initializePresets();
}

// Inicia a aplicação quando o DOM estiver pronto.
window.addEventListener('DOMContentLoaded', main);
