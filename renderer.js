// renderer.js

// --- DOM Elements ---
const appWrapper = document.getElementById('app-wrapper');
const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
const dropZone = document.getElementById('drop-zone');
const queueList = document.getElementById('queue-list');
const clientNameInput = document.getElementById('client-name');

// Log Modal
const logModal = document.getElementById('log-modal');
const closeModalBtn = document.querySelector('.modal-close-btn');
const logOutput = document.getElementById('log-output');

// Presets Elements
const presetsModal = document.getElementById('presets-modal');
const managePresetsBtn = document.getElementById('manage-presets-btn');
const presetsModalCloseBtn = document.getElementById('presets-modal-close-btn');
const savedPresetsList = document.getElementById('saved-presets-list');
const presetForm = document.getElementById('preset-form');
const presetFormTitle = document.getElementById('preset-form-title');
const deletePresetBtn = document.getElementById('delete-preset-btn');
const applyBarCheckbox = document.getElementById('preset-applyBar');
const barSizeContainer = document.getElementById('bar-size-container');
const presetsCheckboxList = document.getElementById('presets-checkbox-list');

// Action Buttons
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const cancelBtn = document.getElementById('cancel-btn');
const logBtn = document.getElementById('log-btn');
const clearQueueBtn = document.getElementById('clear-queue-btn');

// --- Window Controls from HTML ---
const closeWindowBtn = document.getElementById('close-btn');
const minimizeWindowBtn = document.getElementById('minimize-btn');
const maximizeWindowBtn = document.getElementById('maximize-btn');


// --- State ---
let videoQueue = []; 
let finalLogContent = '';
let draggedItem = null;
let isProcessing = false;
let isPaused = false;
let presets = [];
let activePresetId = null;

// --- Platform Detection ---
document.body.classList.add(`platform-${window.electronAPI.getPlatform()}`);


// --- UI Update Functions ---

function updateButtonsState() {
    const hasItems = videoQueue.length > 0;
    const hasPendingItems = videoQueue.some(v => v.status === 'pending' || v.status === 'error' || v.status === 'cancelled');
    const hasSelectedPresets = presetsCheckboxList.querySelectorAll('input:checked').length > 0;

    if (isProcessing) {
        startBtn.style.display = 'none';
        clearQueueBtn.style.display = 'none';
        logBtn.style.display = 'none';
        pauseBtn.style.display = 'inline-flex';
        cancelBtn.style.display = 'inline-flex';
        pauseBtn.textContent = isPaused ? 'Retomar' : 'Pausar';
        managePresetsBtn.disabled = true;
    } else {
        startBtn.style.display = hasPendingItems && hasSelectedPresets ? 'inline-flex' : 'none';
        pauseBtn.style.display = 'none';
        cancelBtn.style.display = 'none';
        clearQueueBtn.style.display = hasItems ? 'inline-flex' : 'none';
        logBtn.style.display = finalLogContent ? 'inline-flex' : 'none';
        managePresetsBtn.disabled = false;
    }
}

function updateQueueUI() {
    queueList.innerHTML = '';
    
    if (videoQueue.length === 0) {
        const p = document.createElement('p');
        p.textContent = 'Fila vazia';
        p.className = 'text-center text-slate-400 p-4';
        queueList.appendChild(p);
        updateButtonsState();
        updatePresetAvailability();
        return;
    }

    videoQueue.forEach((video) => {
        const videoItem = document.createElement('div');
        videoItem.className = `video-item ${video.status}`;
        videoItem.dataset.path = video.path;
        videoItem.draggable = !isProcessing;

        const fileName = video.path.split(/[\\/]/).pop();
        
        let statusIcon = '';
        if (video.status === 'completed') {
            statusIcon = `<div class="queue-btn" title="Concluído"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6 text-green-400"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>`;
        } else if (video.status === 'error') {
            statusIcon = `<button class="queue-btn" data-action="show-log" title="Erro na renderização. Clique para ver o log.">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6 text-red-400"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                          </button>`;
        } else {
            statusIcon = `<button class="queue-btn" data-action="delete" title="Excluir da fila" ${isProcessing ? 'disabled' : ''}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>`;
        }

        videoItem.innerHTML = `
            <div class="drag-handle" title="Arrastar para reordenar">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
            </div>
            <div class="video-info">
                <div class="file-name">${fileName}</div>
                <progress id="progress-${btoa(video.path)}" value="${video.status === 'completed' || video.status === 'error' ? 100 : 0}" max="100"></progress>
            </div>
            <div class="queue-controls">
                ${statusIcon}
            </div>
        `;
        queueList.appendChild(videoItem);

        if (video.status === 'error') {
            const progressBar = videoItem.querySelector('progress');
            progressBar.classList.add('error');
        }
    });
    updateButtonsState();
}

async function addFilesToQueue(filePaths) {
    if (!filePaths || filePaths.length === 0) return;
    for (const path of filePaths) {
        if (!videoQueue.some(v => v.path === path)) {
            const info = await window.electronAPI.getVideoInfo(path);
            videoQueue.push({ path: path, status: 'pending', error: null, info: info });
        }
    }
    updateQueueUI();
    updatePresetAvailability();
}

// --- Presets Logic ---

function updatePresetAvailability() {
    if (videoQueue.length === 0) {
        presetsCheckboxList.querySelectorAll('label').forEach(label => {
            const checkbox = document.getElementById(label.htmlFor);
            if (checkbox) checkbox.disabled = false;
            label.classList.remove('disabled', 'checked');
            label.title = '';
        });
        updateButtonsState();
        return;
    }

    presets.forEach(preset => {
        const checkbox = document.getElementById(`preset-check-${preset.id}`);
        if (!checkbox) return;

        const isCompatibleWithAnyVideo = videoQueue.some(video => {
            if (!video.info) return false;
            const sourceRatio = video.info.width / video.info.height;
            const presetRatio = preset.width / preset.height;
            const ratioDiff = Math.abs(sourceRatio - presetRatio);
            const timeDiff = Math.abs(video.info.duration - preset.duration);
            return ratioDiff <= 0.2 && timeDiff <= 2;
        });

        const label = checkbox.parentElement;
        checkbox.disabled = !isCompatibleWithAnyVideo;
        
        if (!isCompatibleWithAnyVideo) {
            checkbox.checked = false;
            label.classList.add('disabled');
            label.classList.remove('checked');
            label.title = 'Incompatível com qualquer vídeo na fila.';
        } else {
            label.classList.remove('disabled');
            label.title = '';
        }
    });
    updateButtonsState();
}

function renderPresetCheckboxes() {
    presetsCheckboxList.innerHTML = '';
    // Revert to a simple vertical list layout
    presetsCheckboxList.className = 'flex-grow space-y-2 pr-2 overflow-y-auto custom-scrollbar';

    presets.forEach(preset => {
        const label = document.createElement('label');
        // Use the list-item style class
        label.className = 'preset-checkbox-label';
        label.htmlFor = `preset-check-${preset.id}`;
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `preset-check-${preset.id}`;
        checkbox.value = preset.id;
        // The checkbox is now visible and styled by CSS
        
        const span = document.createElement('span');
        span.textContent = preset.name;
        
        label.appendChild(checkbox);
        label.appendChild(span);
        
        checkbox.addEventListener('change', () => {
            // The 'checked' class will be used to style the activated state
            label.classList.toggle('checked', checkbox.checked);
            updateButtonsState();
        });
        
        presetsCheckboxList.appendChild(label);
    });
}

function renderSavedPresetsList() {
    savedPresetsList.innerHTML = '';
    const newPresetItem = document.createElement('div');
    newPresetItem.textContent = '+ Adicionar Novo Preset';
    newPresetItem.className = 'saved-preset-item font-bold text-purple-300';
    newPresetItem.addEventListener('click', () => {
        activePresetId = null;
        presetForm.reset();
        barSizeContainer.style.display = 'none';
        presetFormTitle.textContent = 'Adicionar Novo Preset';
        deletePresetBtn.style.display = 'none';
        document.querySelectorAll('.saved-preset-item.active').forEach(el => el.classList.remove('active'));
        newPresetItem.classList.add('active');
    });
    savedPresetsList.appendChild(newPresetItem);

    presets.forEach(preset => {
        const item = document.createElement('div');
        item.textContent = preset.name;
        item.className = 'saved-preset-item';
        item.dataset.id = preset.id;
        if (preset.id === activePresetId) {
            item.classList.add('active');
        }
        item.addEventListener('click', () => {
            activePresetId = preset.id;
            presetFormTitle.textContent = 'Editar Preset';
            document.getElementById('preset-id').value = preset.id;
            document.getElementById('preset-name').value = preset.name;
            document.getElementById('preset-width').value = preset.width;
            document.getElementById('preset-height').value = preset.height;
            document.getElementById('preset-duration').value = preset.duration;
            applyBarCheckbox.checked = preset.applyBar;
            document.getElementById('preset-letterbox').checked = preset.letterbox;
            document.getElementById('preset-barSize').value = preset.barSize || 0;
            barSizeContainer.style.display = preset.applyBar ? 'block' : 'none';
            deletePresetBtn.style.display = 'inline-flex';
            renderSavedPresetsList();
        });
        savedPresetsList.appendChild(item);
    });

    if (!activePresetId) {
        newPresetItem.classList.add('active');
    }
}

function resetPresetForm() {
    activePresetId = null;
    presetForm.reset();
    barSizeContainer.style.display = 'none';
    presetFormTitle.textContent = 'Adicionar Novo Preset';
    deletePresetBtn.style.display = 'none';
    renderSavedPresetsList();
}

async function initializePresets() {
    presets = await window.electronAPI.loadPresets();
    renderPresetCheckboxes();
    updatePresetAvailability();
}


// --- Drag and Drop Logic ---
queueList.addEventListener('dragstart', (e) => {
    if (isProcessing) return;
    draggedItem = e.target.closest('.video-item');
    if (draggedItem) {
        setTimeout(() => { draggedItem.classList.add('dragging'); }, 0);
    }
});
queueList.addEventListener('dragend', () => {
    if (draggedItem) {
        draggedItem.classList.remove('dragging');
        draggedItem = null;
    }
});
queueList.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (isProcessing) return;
    const afterElement = getDragAfterElement(queueList, e.clientY);
    const currentlyDragged = document.querySelector('.dragging');
    if (currentlyDragged) {
        if (afterElement == null) {
            queueList.appendChild(currentlyDragged);
        } else {
            queueList.insertBefore(currentlyDragged, afterElement);
        }
    }
});
queueList.addEventListener('drop', (e) => {
    e.preventDefault();
    if (isProcessing) return;
    const newQueue = [];
    const items = queueList.querySelectorAll('.video-item');
    items.forEach(item => {
        const path = item.dataset.path;
        const originalVideo = videoQueue.find(v => v.path === path);
        if (originalVideo) {
            newQueue.push(originalVideo);
        }
    });
    videoQueue = newQueue;
    updateQueueUI();
    updatePresetAvailability();
});
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


// --- Event Listeners ---
// This function will be called when the DOM is fully loaded
function setupEventListeners() {
    sidebarToggleBtn.addEventListener('click', () => {
        appWrapper.classList.toggle('sidebar-retracted');
    });
    dropZone.addEventListener('click', () => window.electronAPI.openFileDialog());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); dropZone.classList.add('bg-white/5'); });
    dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); e.stopPropagation(); dropZone.classList.remove('bg-white/5'); });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('bg-white/5');
        const filePaths = Array.from(e.dataTransfer.files).map(f => f.path);
        addFilesToQueue(filePaths);
    });
    startBtn.addEventListener('click', () => {
        videoQueue.forEach(v => {
            if (v.status !== 'completed') {
                v.status = 'pending';
                v.error = null;
            }
        });
        updateQueueUI();
        
        const selectedPresetIds = Array.from(presetsCheckboxList.querySelectorAll('input:checked')).map(input => input.value);
        const selectedPresets = presets.filter(p => selectedPresetIds.includes(p.id));

        const pendingVideos = videoQueue.filter(v => v.status === 'pending').map(v => v.path);
        if (pendingVideos.length > 0 && selectedPresets.length > 0) {
            isProcessing = true;
            isPaused = false;
            finalLogContent = '';
            updateButtonsState();
            const clientName = clientNameInput.value.trim();
            window.electronAPI.startQueue({ videos: pendingVideos, clientName: clientName, selectedPresets: selectedPresets });
        }
    });
    pauseBtn.addEventListener('click', () => {
        isPaused = !isPaused;
        if (isPaused) {
            window.electronAPI.pauseQueue();
        } else {
            window.electronAPI.resumeQueue();
        }
        updateButtonsState();
    });
    cancelBtn.addEventListener('click', () => {
        window.electronAPI.cancelQueue();
        isProcessing = false;
        isPaused = false;
        videoQueue.forEach(v => {
            if (v.status === 'processing' || v.status === 'pending') {
                v.status = 'cancelled';
            }
        });
        updateQueueUI();
    });
    clearQueueBtn.addEventListener('click', () => {
        videoQueue = [];
        finalLogContent = '';
        updateQueueUI();
    });
    logBtn.addEventListener('click', () => {
        logOutput.textContent = finalLogContent;
        logModal.style.display = 'flex';
    });
    closeModalBtn.addEventListener('click', () => { logModal.style.display = 'none'; });
    window.addEventListener('click', (event) => { if (event.target === logModal) { logModal.style.display = 'none'; } });

    // --- Window Controls with Animation ---
    closeWindowBtn.addEventListener('click', (e) => {
        e.preventDefault(); 
        appWrapper.classList.add('app-closing'); 
        setTimeout(() => {
            window.electronAPI.closeWindow();
        }, 200); // Tempo da animação de fechamento
    });

    // Ações diretas para minimizar e maximizar, permitindo a animação nativa
    minimizeWindowBtn.addEventListener('click', () => {
        window.electronAPI.minimizeWindow();
    });
    
    maximizeWindowBtn.addEventListener('click', () => {
        window.electronAPI.maximizeWindow();
    });

    queueList.addEventListener('click', (event) => {
        const button = event.target.closest('.queue-btn');
        if (!button || button.disabled) return;
        
        const action = button.dataset.action;
        const videoItem = button.closest('.video-item');
        const filePath = videoItem.dataset.path;

        if (action === 'delete') {
            videoQueue = videoQueue.filter(v => v.path !== filePath);
            updateQueueUI();
            updatePresetAvailability();
        } else if (action === 'show-log') {
            logOutput.textContent = finalLogContent;
            logModal.style.display = 'flex';
        }
    });

    // Presets Modal Listeners
    managePresetsBtn.addEventListener('click', () => {
        renderSavedPresetsList();
        resetPresetForm();
        presetsModal.style.display = 'flex';
    });
    presetsModalCloseBtn.addEventListener('click', () => {
        presetsModal.style.display = 'none';
    });
    presetForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('preset-id').value;
        const newPreset = {
            id: id || Date.now().toString(),
            name: document.getElementById('preset-name').value,
            width: parseInt(document.getElementById('preset-width').value, 10),
            height: parseInt(document.getElementById('preset-height').value, 10),
            duration: parseInt(document.getElementById('preset-duration').value, 10),
            applyBar: applyBarCheckbox.checked,
            letterbox: document.getElementById('preset-letterbox').checked,
            barSize: parseInt(document.getElementById('preset-barSize').value, 10) || 0,
        };

        if (id) {
            const index = presets.findIndex(p => p.id === id);
            presets[index] = newPreset;
        } else {
            presets.push(newPreset);
        }
        
        window.electronAPI.savePresets(presets);
        renderPresetCheckboxes();
        updatePresetAvailability();
        resetPresetForm();
    });
    deletePresetBtn.addEventListener('click', () => {
        if (activePresetId) {
            presets = presets.filter(p => p.id !== activePresetId);
            window.electronAPI.savePresets(presets);
            renderPresetCheckboxes();
            updatePresetAvailability();
            resetPresetForm();
        }
    });
    applyBarCheckbox.addEventListener('change', (e) => {
        barSizeContainer.style.display = e.target.checked ? 'block' : 'none';
    });
}


// --- IPC Handlers ---
window.electronAPI.handleFilesSelected((event, filePaths) => { addFilesToQueue(filePaths); });
window.electronAPI.handleProgressUpdate((event, { videoPath, progress }) => {
    const progressBar = queueList.querySelector(`#progress-${btoa(videoPath)}`);
    if (progressBar) { progressBar.value = progress; }
});
window.electronAPI.handleProcessingStarted((event, videoPath) => {
    const video = videoQueue.find(v => v.path === videoPath);
    if (video) {
        video.status = 'processing';
        updateQueueUI();
    }
});
window.electronAPI.handleProcessingCompleted((event, videoPath) => {
    const video = videoQueue.find(v => v.path === videoPath);
    if (video) {
        video.status = 'completed';
        updateQueueUI();
    }
});
window.electronAPI.handleProcessingCancelled((event, videoPath) => {
    const video = videoQueue.find(v => v.path === videoPath);
    if (video) {
        video.status = 'cancelled';
        updateQueueUI();
    }
});
window.electronAPI.handleProcessingError((event, { videoPath, error }) => {
    const video = videoQueue.find(v => v.path === videoPath);
    if (video) {
        video.status = 'error';
        video.error = error;
        updateQueueUI();
    }
});
window.electronAPI.handleFinalLog((event, log) => {
    finalLogContent = log;
    isProcessing = false;
    isPaused = false;
    updateButtonsState();
});

// Novo handler para mudança de foco
window.electronAPI.handleWindowFocusChange((event, isFocused) => {
    if (isFocused) {
        appWrapper.classList.remove('app-blurred');
    } else {
        appWrapper.classList.add('app-blurred');
    }
});

// --- Initialization ---
// Wait for the DOM to be fully loaded before running the initialization code
window.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    updateQueueUI();
    initializePresets();
});
