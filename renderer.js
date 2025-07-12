// renderer.js

// --- DOM Elements ---
const appWrapper = document.getElementById('app-wrapper');
const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
const dropZone = document.getElementById('drop-zone');
const queueList = document.getElementById('queue-list');
const clientNameInput = document.getElementById('client-name');
const logModal = document.getElementById('log-modal');
const closeModalBtn = document.querySelector('.modal-close-btn');
const logOutput = document.getElementById('log-output');

// Action Buttons
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const cancelBtn = document.getElementById('cancel-btn');
const logBtn = document.getElementById('log-btn');
const clearQueueBtn = document.getElementById('clear-queue-btn');

// Window Controls
const closeWindowBtn = document.getElementById('close-btn');
const minimizeWindowBtn = document.getElementById('minimize-btn');
const maximizeWindowBtn = document.getElementById('maximize-btn');

// --- State ---
let videoQueue = []; 
let finalLogContent = '';
let draggedItem = null;
let isProcessing = false;
let isPaused = false;

// --- Platform Detection ---
document.body.classList.add(`platform-${window.electronAPI.getPlatform()}`);


// --- UI Update Functions ---

function updateButtonsState() {
    const hasItems = videoQueue.length > 0;
    const hasPendingItems = videoQueue.some(v => v.status === 'pending');

    if (isProcessing) {
        startBtn.style.display = 'none';
        clearQueueBtn.style.display = 'none';
        logBtn.style.display = 'none';
        pauseBtn.style.display = 'inline-flex';
        cancelBtn.style.display = 'inline-flex';
        pauseBtn.textContent = isPaused ? 'Retomar' : 'Pausar';
    } else {
        startBtn.style.display = hasPendingItems ? 'inline-flex' : 'none';
        pauseBtn.style.display = 'none';
        cancelBtn.style.display = 'none';
        clearQueueBtn.style.display = hasItems ? 'inline-flex' : 'none';
        logBtn.style.display = finalLogContent ? 'inline-flex' : 'none';
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
        return;
    }

    videoQueue.forEach((video) => {
        const videoItem = document.createElement('div');
        videoItem.className = `video-item ${video.status}`;
        videoItem.dataset.path = video.path;
        videoItem.draggable = !isProcessing;

        const fileName = video.path.split(/[\\/]/).pop();
        
        videoItem.innerHTML = `
            <div class="drag-handle" title="Arrastar para reordenar">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
            </div>
            <div class="video-info">
                <div class="file-name">${fileName}</div>
                <progress id="progress-${btoa(video.path)}" value="${video.status === 'completed' ? 100 : 0}" max="100"></progress>
            </div>
            <div class="queue-controls">
                ${video.status === 'completed' ? 
                    `<div class="queue-btn" title="Concluído"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6 text-green-400"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>` :
                    `<button class="queue-btn" data-action="delete" title="Excluir da fila" ${isProcessing ? 'disabled' : ''}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>`
                }
            </div>
        `;
        queueList.appendChild(videoItem);
    });
    updateButtonsState();
}

function addFilesToQueue(filePaths) {
    if (!filePaths || filePaths.length === 0) return;
    filePaths.forEach(path => {
        if (!videoQueue.some(v => v.path === path)) {
            videoQueue.push({ path: path, status: 'pending' });
        }
    });
    updateQueueUI();
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
    const pendingVideos = videoQueue.filter(v => v.status === 'pending').map(v => v.path);
    if (pendingVideos.length > 0) {
        isProcessing = true;
        isPaused = false;
        finalLogContent = '';
        updateButtonsState();
        const clientName = clientNameInput.value.trim();
        window.electronAPI.startQueue({ videos: pendingVideos, clientName: clientName });
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

queueList.addEventListener('click', (event) => {
    const button = event.target.closest('.queue-btn');
    if (!button || button.disabled) return;
    const action = button.dataset.action;
    if (action === 'delete') {
        const videoItem = button.closest('.video-item');
        const filePath = videoItem.dataset.path;
        videoQueue = videoQueue.filter(v => v.path !== filePath);
        updateQueueUI();
    }
});

logBtn.addEventListener('click', () => {
    logOutput.textContent = finalLogContent;
    logModal.style.display = 'flex';
});
closeModalBtn.addEventListener('click', () => { logModal.style.display = 'none'; });
window.addEventListener('click', (event) => { if (event.target === logModal) { logModal.style.display = 'none'; } });

closeWindowBtn.addEventListener('click', () => window.electronAPI.closeWindow());
minimizeWindowBtn.addEventListener('click', () => window.electronAPI.minimizeWindow());
maximizeWindowBtn.addEventListener('click', () => window.electronAPI.maximizeWindow());

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

window.electronAPI.handleFinalLog((event, log) => {
    finalLogContent = log;
    isProcessing = false;
    isPaused = false;
    updateButtonsState();
});

// --- Initialization ---
updateQueueUI();
