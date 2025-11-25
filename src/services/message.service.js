const WhatsAppAPI = require('../whatsapp-api');
const config = require('../config');
const { logMessage, logError } = require('../utils/logger');

/**
 * Servicio para gestión de mensajes de WhatsApp
 */
class MessageService {
    constructor() {
        this.whatsappAPI = new WhatsAppAPI({
            token: config.whatsapp.token,
            phoneNumberId: config.whatsapp.phoneNumberId,
            apiVersion: config.whatsapp.apiVersion
        });
        this.contactos = [];
    }

    /**
     * Carga contactos en memoria
     * @param {Array} contactos 
     */
    setContactos(contactos) {
        this.contactos = contactos;
    }

    /**
     * Obtiene todos los contactos
     * @returns {Array}
     */
    getContactos() {
        return this.contactos;
    }

    /**
     * Limpia los contactos de memoria
     */
    clearContactos() {
        this.contactos = [];
    }

    /**
     * Verifica si hay contactos cargados
     * @returns {boolean}
     */
    hasContactos() {
        return this.contactos.length > 0;
    }

    /**
     * Envía mensajes masivos a todos los contactos
     * @param {string} imagePath - Ruta de la imagen
     * @returns {Object} Resultado del envío
     */
    async sendBulkMessages(imagePath) {
        if (!this.whatsappAPI.isConfigured()) {
            throw new Error('WhatsApp API no configurada');
        }

        if (!this.hasContactos()) {
            throw new Error('No hay contactos cargados');
        }

        let enviados = 0;
        let errores = 0;
        const total = this.contactos.length;

        logMessage('Iniciando envío de mensajes', { total });

        for (let i = 0; i < this.contactos.length; i++) {
            const contacto = this.contactos[i];

            try {
                // Validar datos del contacto
                if (!contacto.telefono || !contacto.nombre || !contacto.codigo || !contacto.vencimiento) {
                    logError('Datos incompletos de contacto', contacto);
                    contacto.estado = 'Error';
                    errores++;
                    continue;
                }

                // Personalizar mensaje
                const message = config.message.template
                    .replace('{nombre}', contacto.nombre)
                    .replace('{codigo}', contacto.codigo)
                    .replace('{vencimiento}', contacto.vencimiento);

                // Enviar mensaje
                const result = await this.whatsappAPI.sendImageMessage(
                    contacto.telefono,
                    imagePath,
                    message
                );

                if (result.success) {
                    logMessage('Mensaje enviado', {
                        nombre: contacto.nombre,
                        telefono: contacto.telefono,
                        progreso: `${i + 1}/${total}`
                    });
                    contacto.estado = 'Enviado';
                    enviados++;
                } else {
                    logError('Error al enviar mensaje', { contacto, error: result.error });
                    contacto.estado = 'Error';
                    errores++;
                }

                // Delay entre mensajes
                if (i < this.contactos.length - 1) {
                    await this.delay(config.message.delayBetweenMessages || 2000);
                }
            } catch (error) {
                logError('Error al enviar mensaje', { error, contacto });
                contacto.estado = 'Error';
                errores++;
            }
        }

        const tasaExito = total > 0 ? Math.round((enviados / total) * 100) : 0;

        return {
            enviados,
            errores,
            total,
            tasaExito
        };
    }

    /**
     * Verifica el estado de la API de WhatsApp
     * @returns {Object}
     */
    async checkWhatsAppStatus() {
        if (!this.whatsappAPI.isConfigured()) {
            return {
                connected: false,
                configured: false,
                message: 'Credenciales de WhatsApp Business API no configuradas'
            };
        }

        const status = await this.whatsappAPI.checkStatus();
        return {
            connected: status.connected,
            configured: true,
            phoneNumber: status.phoneNumber || null,
            verifiedName: status.verifiedName || null,
            error: status.error || null
        };
    }

    /**
     * Delay helper
     * @param {number} ms 
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new MessageService();
