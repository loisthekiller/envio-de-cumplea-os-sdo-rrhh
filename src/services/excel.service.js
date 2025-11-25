const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const { logExcel, logError } = require('../utils/logger');

/**
 * Servicio para procesamiento de archivos Excel
 */
class ExcelService {
    constructor() {
        this.uploadDir = path.join(__dirname, '..', '..', 'uploads');
        this.excelFilePath = path.join(this.uploadDir, 'contactos.xlsx');
    }

    /**
     * Procesa un archivo Excel y extrae los contactos
     * @returns {Array} Array de contactos
     */
    processExcelFile() {
        try {
            if (!fs.existsSync(this.excelFilePath)) {
                throw new Error('Archivo Excel no encontrado');
            }

            logExcel('Procesando archivo Excel', { path: this.excelFilePath });

            const workbook = XLSX.readFile(this.excelFilePath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            let contactos = XLSX.utils.sheet_to_json(worksheet);

            // Limpiar nombres de columnas
            contactos = this.cleanContactData(contactos);

            logExcel('Archivo Excel procesado exitosamente', {
                contactos: contactos.length,
                hoja: sheetName
            });

            return {
                success: true,
                contactos,
                sheetName,
                count: contactos.length
            };
        } catch (error) {
            logError('Error al procesar archivo Excel', error);
            return {
                success: false,
                error: error.message,
                contactos: []
            };
        }
    }

    /**
     * Limpia los datos de contactos (normaliza nombres de columnas)
     * @param {Array} contactos 
     * @returns {Array}
     */
    cleanContactData(contactos) {
        return contactos.map(contacto => {
            const cleanContacto = {};
            Object.keys(contacto).forEach(key => {
                const cleanKey = key.trim().toLowerCase();
                cleanContacto[cleanKey] = contacto[key];
            });
            return cleanContacto;
        });
    }

    /**
     * Elimina el archivo Excel subido
     */
    deleteExcelFile() {
        try {
            if (fs.existsSync(this.excelFilePath)) {
                fs.unlinkSync(this.excelFilePath);
                logExcel('Archivo Excel eliminado');
                return { success: true };
            }
            return { success: true, message: 'Archivo no existe' };
        } catch (error) {
            logError('Error al eliminar archivo Excel', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Verifica si existe un archivo Excel
     * @returns {boolean}
     */
    hasExcelFile() {
        return fs.existsSync(this.excelFilePath);
    }
}

module.exports = new ExcelService();
