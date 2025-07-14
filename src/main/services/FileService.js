// src/main/services/FileService.js
const fs = require('fs');
const path = require('path');

/**
 * Garante que um diretório exista, criando-o se necessário.
 * @param {string} dirPath - O caminho do diretório a ser verificado/criado.
 * @returns {Promise<void>}
 */
async function ensureDirExists(dirPath) {
    try {
        await fs.promises.mkdir(dirPath, { recursive: true });
    } catch (error) {
        // Ignora o erro se o diretório já existir, mas lança outros erros.
        if (error.code !== 'EEXIST') {
            throw error;
        }
    }
}

/**
 * Move um arquivo de uma origem para um destino.
 * @param {string} sourcePath - O caminho do arquivo original.
 * @param {string} destPath - O caminho de destino.
 * @returns {Promise<void>}
 */
async function moveFile(sourcePath, destPath) {
    await fs.promises.rename(sourcePath, destPath);
}

/**
 * Remove um arquivo ou diretório de forma segura.
 * @param {string} itemPath - O caminho do item a ser removido.
 * @returns {Promise<void>}
 */
async function removeItem(itemPath) {
    try {
        if (fs.existsSync(itemPath)) {
            const stats = await fs.promises.stat(itemPath);
            if (stats.isDirectory()) {
                await fs.promises.rm(itemPath, { recursive: true, force: true });
            } else {
                await fs.promises.unlink(itemPath);
            }
        }
    } catch (error) {
        console.error(`Falha ao remover o item ${itemPath}:`, error);
        // Não lança o erro para não interromper o fluxo de limpeza.
    }
}

/**
 * Gera um nome de arquivo único para evitar sobreposições.
 * Se "base_1.mp4" já existe, ele tentará "base_2.mp4", e assim por diante.
 * @param {string} folder - A pasta onde o arquivo será salvo.
 * @param {string} baseName - O nome base sem a extensão.
 * @param {string} extension - A extensão do arquivo (ex: ".mp4").
 * @returns {string} - O nome de arquivo final e único.
 */
function getUniqueFileName(folder, baseName, extension) {
    const sanitizedBaseName = baseName.replace(/[\\?%*:|"<>]/g, '-');
    let finalName = sanitizedBaseName + extension;
    if (!fs.existsSync(path.join(folder, finalName))) {
        return finalName;
    }
    let counter = 1;
    while (true) {
        finalName = `${sanitizedBaseName}_${counter}${extension}`;
        if (!fs.existsSync(path.join(folder, finalName))) {
            return finalName;
        }
        counter++;
    }
}


module.exports = {
    ensureDirExists,
    moveFile,
    removeItem,
    getUniqueFileName,
};