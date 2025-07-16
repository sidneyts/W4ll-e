// src/renderer/state.js

// Este módulo centraliza o estado da aplicação do lado do renderer.

// --- Estado Geral ---
export let activeTab = 'converter'; // 'converter' ou 'superled'
export let translations = {};
export let draggedItem = null;

// --- Estado do Conversor Padrão ---
export let videoQueue = [];
export let finalLogContent = '';
export let isProcessing = false;
export let isPaused = false;
export let presets = [];
export let activePresetId = null;

// --- NOVO: Estado do Criador SUPERLED ---
export let superLedPanels = {
    left: [], // Cada item será { path, status, error, info }
    center: [],
    right: []
};
export let isSuperLedProcessing = false;
export let superLedLog = '';

// --- Funções de Modificação de Estado (Setters) ---

// Geral
export function setActiveTab(tab) { activeTab = tab; }
export function setTranslations(newTranslations) { translations = newTranslations; }
export function setDraggedItem(item) { draggedItem = item; }

// Conversor
export function setVideoQueue(newQueue) { videoQueue = newQueue; }
export function setFinalLogContent(content) { finalLogContent = content; }
export function setIsProcessing(status) { isProcessing = status; }
export function setIsPaused(status) { isPaused = status; }
export function setPresets(newPresets) { presets = newPresets; }
export function setActivePresetId(id) { activePresetId = id; }

// SUPERLED
export function setSuperLedPanelVideos(panel, videos) {
    if (superLedPanels[panel]) {
        superLedPanels[panel] = videos;
    }
}
export function addVideosToSuperLedPanel(panel, videos) {
    if (superLedPanels[panel]) {
        const currentVideos = superLedPanels[panel];
        const newVideos = videos.filter(v => !currentVideos.some(cv => cv.path === v.path));
        const combined = [...currentVideos, ...newVideos];
        // Limita a 3 vídeos por painel
        superLedPanels[panel] = combined.slice(0, 3);
    }
}
export function setIsSuperLedProcessing(status) { isSuperLedProcessing = status; }
export function setSuperLedLog(log) { superLedLog = log; }
export function appendToSuperLedLog(message) { superLedLog += message + '\n'; }
