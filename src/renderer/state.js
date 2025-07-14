// src/renderer/state.js

// Este módulo centraliza o estado da aplicação do lado do renderer.
// Usamos 'let' e exportamos os objetos/arrays para que possam ser modificados por outros módulos.

export let videoQueue = [];
export let finalLogContent = '';
export let draggedItem = null;
export let isProcessing = false;
export let isPaused = false;
export let presets = [];
export let activePresetId = null;
export let translations = {};

// Funções para modificar o estado (Setters)
export function setVideoQueue(newQueue) { videoQueue = newQueue; }
export function setFinalLogContent(content) { finalLogContent = content; }
export function setDraggedItem(item) { draggedItem = item; }
export function setIsProcessing(status) { isProcessing = status; }
export function setIsPaused(status) { isPaused = status; }
export function setPresets(newPresets) { presets = newPresets; }
export function setActivePresetId(id) { activePresetId = id; }
export function setTranslations(newTranslations) { translations = newTranslations; }
