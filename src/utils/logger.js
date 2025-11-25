const winston = require('winston');
const path = require('path');

// Función para formatear la hora
const getFormattedTime = () => {
  const now = new Date();
  return now.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

// Formato personalizado para la consola
const consoleFormat = winston.format.printf(({ level, message, category, timestamp, ...meta }) => {
  const time = getFormattedTime();
  const typeIcons = {
    error: '❌',
    warn: '⚠️',
    info: '📋'
  };
  
  const categoryIcons = {
    whatsapp: '📱',
    excel: '📊',
    message: '💬',
    error: '❌'
  };
  
  const icon = categoryIcons[category] || typeIcons[level] || '📋';
  
    // Resumir datos: solo mostrar lo esencial
    let output = `\n${icon} [${time}] ${level.toUpperCase()}: ${message}`;
    if (meta) {
        // Mostrar solo campos clave
        const resumen = {};
        if (meta.puerto || meta.port) resumen.puerto = meta.puerto || meta.port;
        if (meta.url) resumen.url = meta.url;
        if (meta.from) resumen.from = meta.from;
        if (meta.type) resumen.type = meta.type;
        if (meta.cantidad) resumen.cantidad = meta.cantidad;
        if (meta.error) resumen.error = meta.error;
        if (meta.success !== undefined) resumen.success = meta.success;
        if (meta.mensaje) resumen.mensaje = meta.mensaje;
        // Mostrar solo si hay datos relevantes
        if (Object.keys(resumen).length > 0) {
            output += `\n   Datos: ${JSON.stringify(resumen)}`;
        }
    }
    return output;
});

// Configuración del logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.json()
    ),
    transports: [
        // Guardar logs en archivos
        new winston.transports.File({ 
            filename: path.join(__dirname, '../logs/error.log'), 
            level: 'error' 
        }),
        new winston.transports.File({ 
            filename: path.join(__dirname, '../logs/combined.log')
        }),
        // Mostrar logs en consola con formato mejorado
        new winston.transports.Console({
            format: consoleFormat
        })
    ]
});

// Funciones helper para los logs
const logWhatsApp = (message, data = {}) => {
    logger.info({ category: 'whatsapp', message, ...data });
};

const logExcel = (message, data = {}) => {
    logger.info({ category: 'excel', message, ...data });
};

const logMessage = (message, data = {}) => {
    logger.info({ category: 'message', message, ...data });
};

const logError = (message, error = null) => {
    logger.error({ 
        category: 'error', 
        message,
        error: error ? error.toString() : null,
        stack: error ? error.stack : null
    });
};

module.exports = {
    logWhatsApp,
    logExcel,
    logMessage,
    logError,
    logger
};
