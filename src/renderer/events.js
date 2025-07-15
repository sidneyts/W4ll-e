// src/renderer/events.js
import * as dom from './dom.js';
import * as state from './state.js';
import * as ui from './ui.js';

/**
 * Função genérica para inicializar a lógica de arrastar e soltar em uma lista.
 * @param {HTMLElement} listElement - O elemento da lista (ex: queueList, savedPresetsList).
 * @param {string} itemSelector - O seletor para os itens arrastáveis (ex: '.video-item').
 * @param {function} onDropCallback - Função a ser chamada após o drop, recebe a nova ordem dos IDs/paths.
 */
function initDragAndDrop(listElement, itemSelector, onDropCallback) {
    let draggedElement = null;

    const getDragAfterElement = (container, y) => {
        const draggableElements = [...container.querySelectorAll(`${itemSelector}:not(.dragging)`)];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    };

    listElement.addEventListener('dragstart', (e) => {
        draggedElement = e.target.closest(itemSelector);
        if (draggedElement) {
            setTimeout(() => {
                draggedElement.classList.add('dragging');
            }, 0);
        }
    });

    listElement.addEventListener('dragend', () => {
        if (draggedElement) {
            draggedElement.classList.remove('dragging');
            draggedElement = null;
        }
    });

    listElement.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (!draggedElement) return;
        const afterElement = getDragAfterElement(listElement, e.clientY);
        if (afterElement == null) {
            listElement.appendChild(draggedElement);
        } else {
            listElement.insertBefore(draggedElement, afterElement);
        }
    });

    listElement.addEventListener('drop', (e) => {
        e.preventDefault();
        const newOrder = [...listElement.querySelectorAll(itemSelector)].map(item => item.dataset.id || item.dataset.path);
        onDropCallback(newOrder);
    });
}

/**
 * Inicializa a funcionalidade "scrubbable" para inputs numéricos.
 */
function initScrubbableInputs() {
    document.querySelectorAll('.scrubbable-label').forEach(label => {
        let input = null;
        const inputId = label.getAttribute('for');
        if (inputId) {
            input = document.getElementById(inputId);
        }
        if (!input) return;

        label.addEventListener('mousedown', (e) => {
            e.preventDefault();
            let initialX = e.clientX;
            let initialValue = parseFloat(input.value) || 0;

            const onMouseMove = (moveEvent) => {
                const deltaX = moveEvent.clientX - initialX;
                const sensitivity = moveEvent.shiftKey ? 0.1 : 1; // Segure Shift para mais precisão
                const newValue = initialValue + Math.round(deltaX * sensitivity);
                
                const min = parseFloat(input.min) || -Infinity;
                const max = parseFloat(input.max) || Infinity;

                input.value = Math.max(min, Math.min(max, newValue));
                
                // Dispara o evento de input para o autosave funcionar
                input.dispatchEvent(new Event('input', { bubbles: true }));
            };

            const onMouseUp = () => {
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
                document.body.style.cursor = '';
            };

            document.body.style.cursor = 'ew-resize';
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        });
    });
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
        state.videoQueue.forEach(v => {
            if (v.status !== 'completed') { v.status = 'pending'; v.error = null; v.progress = 0; }
        });
        
        const selectedPresetIds = Array.from(dom.presetsCheckboxList.querySelectorAll('input:checked')).map(input => input.value);
        const selectedPresets = state.presets.filter(p => selectedPresetIds.includes(p.id));
        const pendingVideos = state.videoQueue.filter(v => ['pending', 'error', 'cancelled', 'error-loading'].includes(v.status));

        if (pendingVideos.length > 0 && selectedPresets.length > 0) {
            state.setIsProcessing(true);
            state.setIsPaused(false);
            state.setFinalLogContent('');
            ui.updateQueueUI();
            ui.updateButtonsState();
            const clientName = dom.clientNameInput.value;
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
        // Carrega as configurações atuais quando o modal é aberto
        const lang = await window.electronAPI.getSetting('language') || 'pt';
        const preset = await window.electronAPI.getSetting('encoderPreset') || 'fast';
        const crf = await window.electronAPI.getSetting('qualityFactor') || 25;
        
        dom.languageSelect.value = lang;
        dom.encoderPresetSelect.value = preset;
        dom.qualityFactorSlider.value = crf;
        dom.qualityFactorValue.textContent = crf;
        
        dom.settingsModal.style.display = 'flex';
    });

    dom.logModalCloseBtn.addEventListener('click', () => { dom.logModal.style.display = 'none'; });
    dom.presetsModalCloseBtn.addEventListener('click', () => { dom.presetsModal.style.display = 'none'; });
    dom.settingsModalCloseBtn.addEventListener('click', () => { dom.settingsModal.style.display = 'none'; });

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
        } else if (action === 'show-log') {
            dom.logOutput.textContent = state.finalLogContent;
            dom.logModal.style.display = 'flex';
        }
    });

    // --- Inicialização do Drag and Drop para as listas ---
    initDragAndDrop(dom.queueList, '.video-item', (newOrder) => {
        const newQueue = newOrder.map(path => state.videoQueue.find(v => v.path === path));
        state.setVideoQueue(newQueue);
        ui.updateQueueUI();
    });

    initDragAndDrop(dom.savedPresetsList, '.saved-preset-item', (newOrder) => {
        const newPresets = newOrder.map(id => state.presets.find(p => p.id === id));
        state.setPresets(newPresets);
        window.electronAPI.savePresets(newPresets);
        ui.renderPresetCheckboxes();
        ui.renderSavedPresetsList();
    });

    initDragAndDrop(dom.presetsCheckboxList, '.preset-checkbox-label', (newOrder) => {
        const newPresets = newOrder.map(id => state.presets.find(p => p.id === id));
        state.setPresets(newPresets);
        window.electronAPI.savePresets(newPresets);
        ui.renderPresetCheckboxes();
        ui.renderSavedPresetsList();
    });

    // --- Lógica de Autosave e Interação do Modal de Presets ---
    function handlePresetFormChange() {
        const id = dom.presetForm.querySelector('#preset-id').value;
        if (!id) return; // Não salva se for um preset novo ainda não criado

        const toleranceValue = parseFloat(dom.ratioToleranceInput.value);
        const finalTolerance = !isNaN(toleranceValue) ? toleranceValue / 100 : 0.2;

        const updatedPresetData = {
            id: id,
            name: dom.presetForm.querySelector('#preset-name').value,
            width: parseInt(dom.presetForm.querySelector('#preset-width').value, 10),
            height: parseInt(dom.presetForm.querySelector('#preset-height').value, 10),
            duration: parseInt(dom.presetDurationInput.value, 10),
            applyBar: dom.applyBarCheckbox.checked,
            letterbox: document.getElementById('preset-letterbox').checked,
            barSize: parseInt(document.getElementById('preset-barSize').value, 10) || 0,
            ratioTolerance: finalTolerance,
            useOriginalDuration: dom.useOriginalDurationCheckbox.checked,
        };

        const updatedPresets = state.presets.map(p => p.id === id ? updatedPresetData : p);
        
        state.setPresets(updatedPresets);
        window.electronAPI.savePresets(state.presets);
        
        // Atualiza o nome na lista da esquerda em tempo real
        const listItem = dom.savedPresetsList.querySelector(`[data-id="${id}"]`);
        if (listItem) {
            listItem.querySelector('span').textContent = updatedPresetData.name;
        }
        ui.renderPresetCheckboxes();
    }

    dom.presetForm.addEventListener('input', handlePresetFormChange);
    initScrubbableInputs(); // Ativa os inputs "scrubbable"

    dom.deletePresetBtn.addEventListener('click', async () => {
        const idToDelete = state.activePresetId;
        if (!idToDelete) return;

        const confirmed = await ui.showConfirm({
            titleKey: 'confirmDeleteTitle',
            messageKey: 'confirmDeletePreset',
            confirmKey: 'delete',
            cancelKey: 'cancel'
        });

        if (confirmed) {
            state.setPresets(state.presets.filter(p => p.id !== idToDelete));
            await window.electronAPI.savePresets(state.presets);
            ui.resetPresetForm();
            ui.renderPresetCheckboxes();
            ui.updatePresetAvailability();
        }
    });
    
    dom.addNewPresetBtn.addEventListener('click', () => {
        const newPreset = {
            id: `preset_${Date.now()}`,
            name: 'Novo Preset',
            width: 1920,
            height: 1080,
            duration: 10,
            applyBar: false,
            letterbox: false,
            barSize: 0,
            ratioTolerance: 0.2,
            useOriginalDuration: false,
        };
        const updatedPresets = [...state.presets, newPreset];
        state.setPresets(updatedPresets);
        window.electronAPI.savePresets(updatedPresets);
        
        ui.renderSavedPresetsList();
        ui.populateFormWithPreset(newPreset);
        ui.renderPresetCheckboxes();
    });

    // --- Controles do Formulário de Predefinições ---
    dom.applyBarCheckbox.addEventListener('change', (e) => {
        dom.barSizeContainer.style.display = e.target.checked ? 'block' : 'none';
        if (e.target.checked) { document.getElementById('preset-letterbox').checked = false; }
        handlePresetFormChange(); // Trigger autosave
    });
    document.getElementById('preset-letterbox').addEventListener('change', (e) => {
        if (e.target.checked) { dom.applyBarCheckbox.checked = false; dom.barSizeContainer.style.display = 'none'; }
        handlePresetFormChange(); // Trigger autosave
    });
    dom.useOriginalDurationCheckbox.addEventListener('change', (e) => {
        dom.presetDurationInput.disabled = e.target.checked;
        handlePresetFormChange(); // Trigger autosave
    });

    // --- Ações do Rodapé do Modal ---
    dom.importPresetsBtn.addEventListener('click', async () => {
        const result = await window.electronAPI.importPresets();
        if (result && !result.success) {
            ui.showAlert('importErrorTitle', result.messageKey);
        }
    });
    dom.exportPresetsBtn.addEventListener('click', async () => {
        const result = await window.electronAPI.exportPresets();
        if (result && !result.success) {
            ui.showAlert('exportErrorTitle', result.messageKey);
        }
    });
    
    // --- Modal de Configurações ---
    dom.languageSelect.addEventListener('change', async (event) => {
        await window.electronAPI.setSetting('language', event.target.value);
    });
    dom.checkForUpdatesBtn.addEventListener('click', () => window.electronAPI.checkForUpdates());

    // NOVO: Listeners para as configurações de codificação
    dom.encoderPresetSelect.addEventListener('change', (event) => {
        window.electronAPI.setSetting('encoderPreset', event.target.value);
    });

    dom.qualityFactorSlider.addEventListener('input', (event) => {
        const value = event.target.value;
        dom.qualityFactorValue.textContent = value;
    });
    
    dom.qualityFactorSlider.addEventListener('change', (event) => {
        window.electronAPI.setSetting('qualityFactor', parseInt(event.target.value, 10));
    });


    // --- Animação da "Gaveta" de Presets ---
    let hoverTimeout;
    const presetsSection = dom.presetsCheckboxList.closest('.presets-section');
    const sidebarContent = presetsSection.closest('.sidebar-content');
    
    dom.presetsCheckboxList.addEventListener('mouseenter', () => {
        if (dom.appWrapper.classList.contains('sidebar-retracted')) return;
        hoverTimeout = setTimeout(() => {
            sidebarContent.classList.add('presets-focused');
        }, 200);
    });

    presetsSection.addEventListener('mouseleave', () => {
        clearTimeout(hoverTimeout);
        sidebarContent.classList.remove('presets-focused');
    });
}
