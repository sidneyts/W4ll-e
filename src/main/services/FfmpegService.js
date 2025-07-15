// src/main/services/FfmpegService.js
const { spawn } = require('child_process');
const path = require('path');
const { app } = require('electron');
const os = require('os');
const fs = require('fs');

// --- Configuração dos Binários ---

const isPackaged = app.isPackaged;
const isWindows = os.platform() === 'win32';

const ffmpegPath = isPackaged
  ? path.join(process.resourcesPath, 'ffmpeg')
  : path.join(__dirname, '..', '..', '..', 'ffmpeg');

const FFMPEG_BINARY = isWindows ? 'ffmpeg.exe' : 'ffmpeg';
const FFPROBE_BINARY = isWindows ? 'ffprobe.exe' : 'ffprobe';

const FFMPEG_CMD = path.join(ffmpegPath, FFMPEG_BINARY);
const FFPROBE_CMD = path.join(ffmpegPath, FFPROBE_BINARY);

// --- Funções do Serviço ---

/**
 * Obtém informações de um arquivo de vídeo (dimensões, duração).
 * @param {string} filePath - Caminho para o arquivo de vídeo.
 * @returns {Promise<object|null>} Um objeto com as informações ou null em caso de erro.
 */
function getVideoInfo(filePath) {
    return new Promise((resolve, reject) => {
        try {
            if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
                console.warn(`[FfmpegService] Tentativa de analisar um caminho que não é um arquivo: ${filePath}`);
                resolve(null);
                return;
            }
        } catch (e) {
            reject(new Error(`Falha ao verificar o status do arquivo: ${filePath}`));
            return;
        }

        const ffprobe = spawn(FFPROBE_CMD, [
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_streams',
            '-show_format',
            filePath
        ]);

        let jsonData = '';
        ffprobe.stdout.on('data', (data) => {
            jsonData += data.toString();
        });

        ffprobe.stderr.on('data', (data) => {
            console.error(`FFprobe stderr: ${data}`);
        });

        ffprobe.on('close', (code) => {
            if (code === 0 && jsonData) {
                try {
                    const info = JSON.parse(jsonData);
                    const stream = info.streams.find(s => s.codec_type === 'video');
                    if (!stream) {
                        resolve(null);
                        return;
                    }
                    const duration = info.format && info.format.duration ? parseFloat(info.format.duration) : 10.0;
                    resolve({ width: stream.width, height: stream.height, duration: duration });
                } catch (e) {
                    reject(new Error('Falha ao analisar a saída do ffprobe.'));
                }
            } else {
                reject(new Error(`ffprobe encerrou com código ${code}`));
            }
        });

        ffprobe.on('error', (err) => {
            reject(err);
        });
    });
}

/**
 * Renderiza um vídeo com base em um preset e reporta o progresso.
 * @param {object} options
 * @param {string} options.inputPath - Caminho do vídeo de origem.
 * @param {string} options.outputPath - Caminho onde o vídeo final será salvo.
 * @param {object} options.preset - O objeto de preset com as configurações.
 * @param {object} options.encoderSettings - As configurações de codificação.
 * @param {function} options.onProgress - Callback para reportar o progresso (0-100).
 * @returns {Promise<void>}
 */
function renderVideo({ inputPath, outputPath, preset, encoderSettings, onProgress }) {
    return new Promise((resolve, reject) => {
        const { width, height, duration, applyBar, letterbox, barSize } = preset;
        const sourceDuration = preset.sourceDuration;

        let timeFilter = '';
        if (sourceDuration && duration && Math.abs(sourceDuration - duration) > 0.5) {
            const ptsMultiplier = duration / sourceDuration;
            timeFilter = `,setpts=${ptsMultiplier.toFixed(4)}*PTS`;
        }

        let filter;
        if (letterbox) {
            filter = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1${timeFilter}`;
        } else if (applyBar) {
            const effectiveBarSize = barSize || 0;
            const contentHeight = height - effectiveBarSize;
            filter = `scale=${width}:${contentHeight},pad=${width}:${height}:0:0:color=black,setsar=1${timeFilter}`;
        } else {
            filter = `scale=${width}:${height},setsar=1${timeFilter}`;
        }

        const args = [
            '-i', inputPath,
            '-vf', filter,
            '-t', duration,
            '-c:v', 'libx264',
            '-preset', encoderSettings.encoderPreset || 'fast',
            '-crf', (encoderSettings.qualityFactor || 25).toString(),
            '-an',
            '-y',
            outputPath
        ];

        const ffmpeg = spawn(FFMPEG_CMD, args);

        ffmpeg.stderr.on('data', (data) => {
            const output = data.toString();
            const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
            if (timeMatch) {
                const hours = parseInt(timeMatch[1], 10);
                const minutes = parseInt(timeMatch[2], 10);
                const seconds = parseInt(timeMatch[3], 10);
                const currentTime = (hours * 3600) + (minutes * 60) + seconds;
                const progress = Math.min(100, Math.floor((currentTime / duration) * 100));
                onProgress(progress);
            }
        });

        ffmpeg.on('close', (code) => {
            if (code === 0) {
                onProgress(100);
                resolve();
            } else {
                reject(new Error(`ffmpeg encerrou com código de erro ${code}`));
            }
        });

        ffmpeg.on('error', (err) => {
            reject(err);
        });
    });
}

module.exports = {
    getVideoInfo,
    renderVideo,
};
