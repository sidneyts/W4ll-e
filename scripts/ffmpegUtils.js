// utils/ffmpegUtils.js

const os = require('os');
const isWindows = os.platform() === 'win32';

// Define o caminho para o FFMPEG com base no sistema operacional.
// No Windows, ele espera que o FFmpeg esteja em C:\ffmpeg\bin\
// No Mac/Linux, ele espera que esteja no caminho padrão /usr/local/bin/
// Adiciona flags para reduzir o "ruído" no console, mostrando apenas os erros.
const FFMPEG = isWindows
  ? `"C:\\ffmpeg\\bin\\ffmpeg.exe" -loglevel error -hide_banner`
  : "/usr/local/bin/ffmpeg -loglevel error -hide_banner";

// Define o caminho para o FFPROBE, seguindo a mesma lógica.
const FFPROBE = isWindows
  ? `"C:\\ffmpeg\\bin\\ffprobe.exe"`
  : "/usr/local/bin/ffprobe";

// Exporta as constantes usando a sintaxe CommonJS (module.exports)
module.exports = { FFMPEG, FFPROBE };
