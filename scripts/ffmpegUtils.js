// scripts/ffmpegUtils.js

const os = require('os');
const path = require('path');
const { app } = require('electron');
const isWindows = os.platform() === 'win32';

// Esta é a forma correta e segura de verificar se o app está empacotado,
// pois este arquivo só será chamado pelo main.js.
const isPackaged = app.isPackaged;

// Se o app estiver empacotado, os recursos estarão na pasta 'resources'.
// Em modo de desenvolvimento, apontamos para a pasta 'ffmpeg' na raiz do projeto.
const ffmpegPath = isPackaged
  ? path.join(process.resourcesPath, 'ffmpeg')
  : path.join(app.getAppPath(), 'ffmpeg');

const FFMPEG_BINARY = isWindows ? 'ffmpeg.exe' : 'ffmpeg';
const FFPROBE_BINARY = isWindows ? 'ffprobe.exe' : 'ffprobe';

// Monta os comandos finais, garantindo que o caminho esteja entre aspas para evitar problemas com espaços
const FFMPEG = `"${path.join(ffmpegPath, FFMPEG_BINARY)}"`;
const FFPROBE = `"${path.join(ffmpegPath, FFPROBE_BINARY)}"`;

// Exporta as constantes para serem usadas pelo main.js
module.exports = { FFMPEG, FFPROBE, ffmpegPath };
