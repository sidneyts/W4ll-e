// src/renderer/renderer.js
import * as state from './state.js';
import * as ui from './ui.js';
import { initEventListeners } from './events.js';
import { initIpcHandlers } from './ipc.js';

/**
 * Aplica as traduções em todos os elementos da UI marcados com atributos i18n.
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
 * Carrega os presets do backend e inicializa a UI correspondente.
 */
async function initializePresets() {
    const loadedPresets = await window.electronAPI.loadPresets();
    state.setPresets(loadedPresets);
    ui.renderPresetCheckboxes();
    ui.updatePresetAvailability();
}

/**
 * Função principal de inicialização do processo de renderização (frontend).
 */
async function main() {
    // Adiciona uma classe ao corpo do documento para estilização específica da plataforma (macOS/Windows)
    document.body.classList.add(`platform-${window.electronAPI.getPlatform()}`);
    
    // A ordem de inicialização é crucial para evitar erros de referência:
    
    // 1. Carrega as traduções para que a UI inicial seja exibida no idioma correto.
    await applyTranslations();
    
    // 2. Prepara os handlers de IPC para que o frontend possa receber eventos do backend a qualquer momento.
    initIpcHandlers();
    
    // 3. Ativa todos os event listeners para que a UI seja interativa.
    initEventListeners();
    
    // 4. Renderiza o estado inicial da UI (fila vazia, botões corretos).
    ui.updateQueueUI(); 
    
    // 5. Carrega os presets e os exibe na UI.
    await initializePresets();
}

// Inicia a aplicação quando o DOM estiver completamente carregado.
window.addEventListener('DOMContentLoaded', main);
