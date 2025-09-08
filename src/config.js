// Configuración del Sistema de Cumpleaños - Sanatorio del Oeste
module.exports = {
  // Configuración del servidor
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost'
  },

  // Configuración de WhatsApp
  whatsapp: {
    browser: ['Sanatorio del Oeste Bot', 'Chrome', '4.0.0'],
    printQRInTerminal: true,
    syncFullHistory: false,
    markOnlineOnConnect: true,
    retryDelay: 3000 // milisegundos
  },

  // Configuración de archivos
  files: {
    uploadDir: 'uploads',
    imageFile: 'foto.png',
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ]
  },

  // Configuración de logging
  logging: {
    level: 'info',
    errorFile: 'logs/error.log',
    combinedFile: 'logs/combined.log',
    maxsize: 5242880, // 5MB
    maxFiles: 5
  },

  // Configuración de mensajes
  message: {
    template: '🎉 ¡Buenos días, {nombre}!\n\nDesde el Sanatorio del Oeste 🏥 queremos desearte un muy feliz cumpleaños 🎉💐.\n\nPara celebrar tu mes especial, te enviamos dos obsequios exclusivos:\n\n🎬 Voucher para el cine Hoyts ({codigo}) – recordá revisar la fecha de vencimiento ({vencimiento}) y el modo de canje.\n\n💆🏻 Voucher para una limpieza facial, para que disfrutes un momento de relajación y cuidado personal.\n\n¡Esperamos que los disfrutes y tengas un cumpleaños inolvidable!\n\nAtte: Recursos Humanos',
    delayBetweenMessages: 2000, // milisegundos
    maxRetries: 3
  },

  // Configuración de Excel
  excel: {
    requiredColumns: ['nombre', 'telefono', 'codigo', 'vencimiento'],
    sheetName: 'Hoja1' // nombre por defecto de la hoja
  },

  // Información de la organización
  organization: {
    name: 'Sanatorio del Oeste',
    department: 'Departamento de Recursos Humanos',
    contact: '11-5509-6732'
  }
};
