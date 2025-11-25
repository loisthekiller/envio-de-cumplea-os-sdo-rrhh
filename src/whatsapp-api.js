const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const { logWhatsApp, logError } = require('./utils/logger');

/**
 * Módulo para integración con WhatsApp Business Cloud API
 * Documentación: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

class WhatsAppAPI {
    constructor(config) {
        this.token = config.token;
        this.phoneNumberId = config.phoneNumberId;
        this.apiVersion = config.apiVersion || 'v18.0';
        this.baseUrl = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}`;
    }

    /**
     * Verifica que las credenciales estén configuradas
     */
    isConfigured() {
        return !!(this.token && this.phoneNumberId);
    }

    /**
     * Envía un mensaje de texto simple
     * @param {string} to - Número de teléfono con código de país (ej: 5491123456789)
     * @param {string} text - Texto del mensaje
     */
    async sendTextMessage(to, text) {
        try {
            const response = await axios.post(
                `${this.baseUrl}/messages`,
                {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: to,
                    type: 'text',
                    text: { body: text }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            logWhatsApp('Mensaje de texto enviado', {
                to,
                messageId: response.data.messages[0].id
            });

            return { success: true, data: response.data };
        } catch (error) {
            logError('Error al enviar mensaje de texto', error);
            return {
                success: false,
                error: error.response?.data || error.message
            };
        }
    }

    /**
     * Sube una imagen y obtiene su ID
     * @param {string} imagePath - Ruta al archivo de imagen
     */
    async uploadImage(imagePath) {
        try {
            const formData = new FormData();
            formData.append('messaging_product', 'whatsapp');
            formData.append('file', fs.createReadStream(imagePath));
            formData.append('type', 'image/png');

            const response = await axios.post(
                `${this.baseUrl}/media`,
                formData,
                {
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        ...formData.getHeaders()
                    }
                }
            );

            logWhatsApp('Imagen subida', { mediaId: response.data.id });
            return { success: true, mediaId: response.data.id };
        } catch (error) {
            logError('Error al subir imagen', error);
            return {
                success: false,
                error: error.response?.data || error.message
            };
        }
    }

    /**
     * Envía un mensaje con imagen y caption
     * @param {string} to - Número de teléfono con código de país
     * @param {string} imagePath - Ruta al archivo de imagen
     * @param {string} caption - Texto del mensaje
     */
    async sendImageMessage(to, imagePath, caption) {
        try {
            // Primero subir la imagen
            const uploadResult = await this.uploadImage(imagePath);

            if (!uploadResult.success) {
                return uploadResult;
            }

            // Luego enviar el mensaje con la imagen
            const response = await axios.post(
                `${this.baseUrl}/messages`,
                {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: to,
                    type: 'image',
                    image: {
                        id: uploadResult.mediaId,
                        caption: caption
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            logWhatsApp('Mensaje con imagen enviado', {
                to,
                messageId: response.data.messages[0].id,
                mediaId: uploadResult.mediaId
            });

            return { success: true, data: response.data };
        } catch (error) {
            logError('Error al enviar mensaje con imagen', error);
            return {
                success: false,
                error: error.response?.data || error.message
            };
        }
    }

    /**
     * Envía un mensaje usando una plantilla de Meta aprobada
     * @param {string} to - Número de teléfono con código de país
     * @param {string} templateName - Nombre de la plantilla aprobada
     * @param {string} languageCode - Código de idioma (ej: 'es_AR')
     * @param {Array} parameters - Array de parámetros para la plantilla
     * @param {string} imagePath - Ruta al archivo de imagen (opcional)
     */
    async sendTemplateMessage(to, templateName, languageCode, parameters, imagePath = null) {
        try {
            const components = [];
            
            // Si hay imagen, subirla y agregar al header
            if (imagePath) {
                const uploadResult = await this.uploadImage(imagePath);
                if (!uploadResult.success) {
                    return uploadResult;
                }
                
                components.push({
                    type: "header",
                    parameters: [{
                        type: "image",
                        image: {
                            id: uploadResult.mediaId
                        }
                    }]
                });
            }

            // Construir el componente de body con los parámetros
            components.push({
                type: "body",
                parameters: parameters.map(param => ({
                    type: "text",
                    text: param
                }))
            });

            const response = await axios.post(
                `${this.baseUrl}/messages`,
                {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: to,
                    type: 'template',
                    template: {
                        name: templateName,
                        language: {
                            code: languageCode
                        },
                        components: components
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            logWhatsApp('Mensaje de plantilla enviado', {
                to,
                template: templateName,
                messageId: response.data.messages[0].id
            });

            return { success: true, data: response.data };
        } catch (error) {
            const errorDetails = {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
                statusText: error.response?.statusText
            };
            
            logError('Error al enviar mensaje de plantilla', {
                error: errorDetails,
                template: templateName,
                to: to
            });
            
            return {
                success: false,
                error: errorDetails
            };
        }
    }

    /**
     * Verifica el estado de la conexión con la API
     */
    async checkStatus() {
        try {
            const response = await axios.get(
                `${this.baseUrl}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.token}`
                    }
                }
            );

            logWhatsApp('Estado de API verificado', {
                phoneNumber: response.data.display_phone_number
            });

            return {
                success: true,
                connected: true,
                phoneNumber: response.data.display_phone_number,
                verifiedName: response.data.verified_name
            };
        } catch (error) {
            logError('Error al verificar estado de API', error);
            return {
                success: false,
                connected: false,
                error: error.response?.data || error.message
            };
        }
    }
}

module.exports = WhatsAppAPI;
