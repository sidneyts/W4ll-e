// src/renderer/events.js

import * as dom from './dom.js';
import * as state from './state.js';
import * as ui from './ui.js';

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.video-item:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

export function initEventListeners() {
    // Sidebar
    dom.sidebarToggleBtn.addEventListener('click', () => {
        dom.appWrapper.classList.toggle('sidebar-retracted');
    });

    // Drag and Drop (Dropzone)
    dom.dropZone.addEventListener('click', () => window.electronAPI.openFileDialog());
    dom.dropZone.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); dom.dropZone.classList.add('bg-white/5'); });
    dom.dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); e.stopPropagation(); dom.dropZone.classList.remove('bg-white/5'); });
    dom.dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dom.dropZone.classList.remove('bg-white/5');
        const paths = Array.from(e.dataTransfer.files).map(f => f.path);
        if (paths.length > 0) {
            window.electronAPI.sendDroppedPaths(paths);
        }
    });

    // Ações da Fila
    dom.startBtn.addEventListener('click', () => {
        // Apenas marca os vídeos como pendentes, não atualiza a UI inteira
        state.videoQueue.forEach(v => {
            if (v.status !== 'completed') { v.status = 'pending'; v.error = null; v.progress = 0; }
        });
        
        const selectedPresetIds = Array.from(dom.presetsCheckboxList.querySelectorAll('input:checked')).map(input => input.value);
        const selectedPresets = state.presets.filter(p => selectedPresetIds.includes(p.id));
        const pendingVideos = state.videoQueue.filter(v => v.status === 'pending');

        if (pendingVideos.length > 0 && selectedPresets.length > 0) {
            state.setIsProcessing(true);
            state.setIsPaused(false);
            state.setFinalLogContent('');
            ui.updateQueueUI(); // Atualiza a UI para mostrar o estado de "processando"
            ui.updateButtonsState();
            const clientName = dom.clientNameInput.value.trim();
            window.electronAPI.startQueue({ videos: pendingVideos, clientName: clientName, selectedPresets: selectedPresets });
        }
    });

    dom.pauseBtn.addEventListener('click', () => {
        state.setIsPaused(!state.isPaused);
        state.isPaused ? window.electronAPI.pauseQueue() : window.electronAPI.resumeQueue();
        ui.updateButtonsState();
    });

    dom.cancelBtn.addEventListener('click', () => window.electronAPI.cancelQueue());

    dom.clearQueueBtn.addEventListener('click', () => {
        state.setVideoQueue([]);
        state.setFinalLogContent('');
        ui.updateQueueUI();
        ui.updatePresetAvailability();
    });

    // --- MODAIS ---
    dom.logBtn.addEventListener('click', () => {
        dom.logOutput.textContent = state.finalLogContent;
        dom.logModal.style.display = 'flex';
    });
    dom.managePresetsBtn.addEventListener('click', () => {
        ui.renderSavedPresetsList();
        ui.resetPresetForm();
        dom.presetsModal.style.display = 'flex';
    });
    dom.settingsBtn.addEventListener('click', async () => {
        const currentLanguage = await window.electronAPI.getSetting('language') || 'pt';
        dom.languageSelect.value = currentLanguage;
        dom.settingsModal.style.display = 'flex';
    });

    dom.closeModalBtn.addEventListener('click', () => { dom.logModal.style.display = 'none'; });
    dom.presetsModalCloseBtn.addEventListener('click', () => { dom.presetsModal.style.display = 'none'; });
    dom.settingsModalCloseBtn.addEventListener('click', () => { dom.settingsModal.style.display = 'none'; });

    window.addEventListener('click', (event) => {
        if (event.target === dom.logModal) dom.logModal.style.display = 'none';
        if (event.target === dom.presetsModal) dom.presetsModal.style.display = 'none';
        if (event.target === dom.settingsModal) dom.settingsModal.style.display = 'none';
    });

    // Controles da Janela
    dom.closeWindowBtn.addEventListener('click', (e) => {
        e.preventDefault();
        dom.appWrapper.classList.add('app-closing');
        setTimeout(() => window.electronAPI.closeWindow(), 200);
    });
    dom.minimizeWindowBtn.addEventListener('click', () => window.electronAPI.minimizeWindow());
    dom.maximizeWindowBtn.addEventListener('click', () => window.electronAPI.maximizeWindow());

    // Ações da lista da fila
    dom.queueList.addEventListener('click', (event) => {
        const button = event.target.closest('.queue-btn');
        if (!button || button.disabled) return;
        const action = button.dataset.action;
        const videoItem = button.closest('.video-item');
        const filePath = videoItem.dataset.path;

        if (action === 'delete') {
            state.setVideoQueue(state.videoQueue.filter(v => v.path !== filePath));
            ui.updateQueueUI();
            ui.updatePresetAvailability();
        } else if (action === 'show-log') {
            dom.logOutput.textContent = state.finalLogContent;
            dom.logModal.style.display = 'flex';
        }
    });

    // Drag and Drop da Fila
    dom.queueList.addEventListener('dragstart', (e) => {
        if (state.isProcessing) return;
        state.setDraggedItem(e.target.closest('.video-item'));
        if (state.draggedItem) { setTimeout(() => { state.draggedItem.classList.add('dragging'); }, 0); }
    });
    dom.queueList.addEventListener('dragend', () => {
        if (state.draggedItem) { state.draggedItem.classList.remove('dragging'); state.setDraggedItem(null); }
    });
    dom.queueList.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (state.isProcessing) return;
        const afterElement = getDragAfterElement(dom.queueList, e.clientY);
        const currentlyDragged = document.querySelector('.dragging');
        if (currentlyDragged) {
            if (afterElement == null) { dom.queueList.appendChild(currentlyDragged); } 
            else { dom.queueList.insertBefore(currentlyDragged, afterElement); }
        }
    });
    dom.queueList.addEventListener('drop', (e) => {
        e.preventDefault();
        if (state.isProcessing) return;
        const newQueue = [];
        const items = dom.queueList.querySelectorAll('.video-item');
        items.forEach(item => {
            const path = item.dataset.path;
            const originalVideo = state.videoQueue.find(v => v.path === path);
            if (originalVideo) newQueue.push(originalVideo);
        });
        state.setVideoQueue(newQueue);
        ui.updateQueueUI();
        ui.updatePresetAvailability();
    });

    // --- Modal de Predefinições ---
    dom.savedPresetsList.addEventListener('click', (event) => {
        const presetItem = event.target.closest('.saved-preset-item');
        if (!presetItem) return;
        const presetId = presetItem.dataset.id;
        const presetToEdit = state.presets.find(p => p.id === presetId);
        if (presetToEdit) {
            ui.populateFormWithPreset(presetToEdit);
            ui.renderSavedPresetsList(); // Re-renderiza para mostrar o item ativo
        }
    });

    dom.presetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('preset-id').value;
        
        const toleranceValue = parseFloat(dom.ratioToleranceInput.value);
        const finalTolerance = !isNaN(toleranceValue) ? toleranceValue / 100 : 0.2;

        const newPresetData = {
            id: id || `preset_${Date.now()}`,
            name: document.getElementById('preset-name').value,
            width: parseInt(document.getElementById('preset-width').value, 10),
            height: parseInt(document.getElementById('preset-height').value, 10),
            duration: parseInt(dom.presetDurationInput.value, 10),
            applyBar: dom.applyBarCheckbox.checked,
            letterbox: document.getElementById('preset-letterbox').checked,
            barSize: parseInt(document.getElementById('preset-barSize').value, 10) || 0,
            ratioTolerance: finalTolerance,
            useOriginalDuration: dom.useOriginalDurationCheckbox.checked,
        };

        if (!newPresetData.name.trim()) { alert('O nome da predefinição não pode estar vazio.'); return; }

        let updatedPresets = id ? state.presets.map(p => p.id === id ? newPresetData : p) : [...state.presets, newPresetData];
        
        state.setPresets(updatedPresets);
        await window.electronAPI.savePresets(state.presets);
        
        state.setActivePresetId(newPresetData.id);
        
        ui.renderPresetCheckboxes();
        ui.updatePresetAvailability();
        ui.renderSavedPresetsList();
    });

    dom.deletePresetBtn.addEventListener('click', async () => {
        const idToDelete = state.activePresetId;
        if (idToDelete && confirm('Tem certeza que deseja excluir esta predefinição?')) {
            state.setPresets(state.presets.filter(p => p.id !== idToDelete));
            await window.electronAPI.savePresets(state.presets);
            ui.renderPresetCheckboxes();
            ui.updatePresetAvailability();
            ui.resetPresetForm();
        }
    });

    // --- Controles do Formulário de Predefinições ---
    dom.applyBarCheckbox.addEventListener('change', (e) => {
        dom.barSizeContainer.style.display = e.target.checked ? 'block' : 'none';
        if (e.target.checked) { document.getElementById('preset-letterbox').checked = false; }
    });
    document.getElementById('preset-letterbox').addEventListener('change', (e) => {
        if (e.target.checked) { dom.applyBarCheckbox.checked = false; dom.barSizeContainer.style.display = 'none'; }
    });
    dom.useOriginalDurationCheckbox.addEventListener('change', (e) => {
        dom.presetDurationInput.disabled = e.target.checked;
    });

    // --- Ações do Rodapé do Modal ---
    dom.addNewPresetBtn.addEventListener('click', ui.resetPresetForm);
    dom.importPresetsBtn.addEventListener('click', async () => {
        const result = await window.electronAPI.importPresets();
        if (result && !result.success) { alert(result.message || 'Falha ao importar o arquivo.'); }
    });
    dom.exportPresetsBtn.addEventListener('click', async () => {
        await window.electronAPI.exportPresets();
    });
    
    // --- Modal de Configurações ---
    dom.languageSelect.addEventListener('change', async (event) => {
        await window.electronAPI.setSetting('language', event.target.value);
    });
    dom.checkForUpdatesBtn.addEventListener('click', () => window.electronAPI.checkForUpdates());
}
