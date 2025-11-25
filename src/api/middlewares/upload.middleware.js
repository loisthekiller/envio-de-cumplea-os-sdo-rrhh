const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { logError } = require('../utils/logger');
const { validarTipoExcel } = require('../utils/validators');

/**
 * Configuración de multer para subir archivos Excel
 */
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '..', '..', 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, 'contactos.xlsx');
    }
});

/**
 * Middleware de validación de archivos
 */
const fileFilter = function (req, file, cb) {
    if (!validarTipoExcel(file.mimetype)) {
        logError('Intento de subir archivo no válido', { mimetype: file.mimetype });
        return cb(new Error('Solo se permiten archivos Excel (.xlsx, .xls)'));
    }
    cb(null, true);
};

/**
 * Configuración de multer
 */
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    }
});

module.exports = upload;
