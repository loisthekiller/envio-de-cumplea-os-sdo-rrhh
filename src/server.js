const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const XLSX = require('xlsx');
const { logWhatsApp, logExcel, logMessage, logError } = require('./logger');
const config = require('./config');

const app = express();
const port = config.server.port;

// Middleware para parsear JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuración de multer para subir archivos
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const uploadDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    cb(null, 'contactos.xlsx');
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function(req, file, cb) {
    if (file.mimetype !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' && 
        file.mimetype !== 'application/vnd.ms-excel') {
      logError('Intento de subir archivo no válido', { mimetype: file.mimetype });
      return cb(new Error('Solo se permiten archivos Excel'));
    }
    cb(null, true);
  }
});

// Servir archivos estáticos desde la carpeta views
app.use(express.static(path.join(__dirname, '..', 'views')));

// Servir archivos estáticos desde la carpeta static
app.use('/static', express.static(path.join(__dirname, '..', 'static')));

// Ruta para servir la imagen de vista previa
app.get('/foto.png', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'foto.png'));
});

// Ruta para obtener el código QR
app.get('/qr', (req, res) => {
  if (currentQR) {
    res.json({ success: true, qr: currentQR });
  } else if (isClientReady) {
    res.json({ success: true, connected: true, message: 'WhatsApp ya está conectado' });
  } else {
    res.json({ success: false, message: 'Código QR no disponible' });
  }
});


// Inicializa cliente WhatsApp
let sock;
let isClientReady = false;
let contactos = [];
let currentQR = null;

async function initBaileys() {
    try {
        logWhatsApp('Iniciando conexión con WhatsApp');
        const { state, saveCreds } = await useMultiFileAuthState('baileys_auth');

        sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            syncFullHistory: false,
            browser: ['WhatsApp Bot', 'Chrome', '4.0.0'],
            markOnlineOnConnect: true
        });

        // Manejo de conexión
        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                console.log('\n🔄 NUEVO CÓDIGO QR DISPONIBLE');
                console.log('═'.repeat(60));
                console.log('📱 Abre WhatsApp > Dispositivos vinculados > Vincular dispositivo');
                console.log('📷 Escanea el código QR que aparece a continuación:');
                console.log('═'.repeat(60));
                qrcode.generate(qr, { small: true });
                console.log('═'.repeat(60));
                currentQR = qr;
                logWhatsApp('Código QR generado', { timestamp: new Date().toISOString() });
            }

            if (connection === 'close') {
                const statusCode = (lastDisconnect?.error)?.output?.statusCode;
                const reason = DisconnectReason[statusCode];
                
                console.log('\n❌ CONEXIÓN WHATSAPP CERRADA');
                console.log('═'.repeat(60));
                console.log('📱 Estado WhatsApp: Desconectado');
                console.log('🔍 Razón:', reason || 'Desconocida');
                console.log('🔢 Código:', statusCode || 'N/A');
                console.log('═'.repeat(60));
                
                logWhatsApp('Conexión cerrada', { reason, statusCode });
                
                isClientReady = false;
                currentQR = null;

                if (statusCode === DisconnectReason.loggedOut) {
                    console.log('🚪 Sesión cerrada. Se requiere nuevo escaneo QR.');
                    logWhatsApp('Sesión cerrada, requiere nuevo QR');
                } else {
                    console.log('🔄 Reintentando conexión automáticamente...');
                    logWhatsApp('Reintentando conexión...');
                    setTimeout(() => initBaileys(), 3000);
                }
            } else if (connection === 'open') {
                console.log('\n✅ WHATSAPP CONECTADO EXITOSAMENTE');
                console.log('═'.repeat(60));
                console.log('📱 Estado WhatsApp: Conectado');
                console.log('🕐 Hora conexión:', new Date().toLocaleTimeString('es-AR'));
                console.log('🌐 Sistema listo en: http://localhost:' + port);
                console.log('═'.repeat(60));
                
                logWhatsApp('Conexión establecida exitosamente', { 
                    timestamp: new Date().toISOString(),
                    port: port 
                });
                isClientReady = true;
                currentQR = null;

                // Mensaje de prueba para verificar la conexión
                sock.sendMessage("status@broadcast", { 
                    text: "🏥 Bot del Sanatorio del Oeste conectado exitosamente!" 
                }).then(() => {
                    logWhatsApp('Mensaje de prueba enviado');
                }).catch(err => {
                    logError('Error al enviar mensaje de prueba', err);
                });
            }
        });

        // Guardar credenciales
        sock.ev.on('creds.update', saveCreds);

        // Manejo de mensajes entrantes
        sock.ev.on('messages.upsert', async m => {
            try {
                const msg = m.messages[0];
                if (!msg.message) return;
                logMessage('Mensaje recibido', { 
                    from: msg.key.remoteJid,
                    type: Object.keys(msg.message)[0]
                });
            } catch (err) {
                logError('Error al procesar mensaje entrante', err);
            }
        });

    } catch (error) {
        logError('Error al inicializar Baileys', error);
        setTimeout(() => {
            logWhatsApp('Reintentando conexión en 5 segundos');
            initBaileys();
        }, 5000);
    }
}

// Ruta principal
app.get('/', (req, res) => {
  const htmlPath = path.join(__dirname, '..', 'views', 'index.html');
  console.log('🔍 Buscando archivo HTML en:', htmlPath);
  
  // Verificar si el archivo existe
  if (fs.existsSync(htmlPath)) {
    console.log('✅ Archivo HTML encontrado');
    res.sendFile(htmlPath);
  } else {
    console.log('❌ Archivo HTML NO encontrado');
    console.log('📁 Contenido del directorio views:');
    try {
      const viewsDir = path.join(__dirname, '..', 'views');
      const files = fs.readdirSync(viewsDir);
      files.forEach(file => console.log('   -', file));
    } catch (error) {
      console.log('❌ Error al leer directorio views:', error.message);
    }
    res.status(404).send('Archivo index.html no encontrado');
  }
});

// Ruta para obtener los contactos
app.get('/destinatarios', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  
  if (!contactos || contactos.length === 0) {
    logMessage('Consulta de destinatarios - Sin contactos');
    return res.json({ success: false, message: 'No hay contactos cargados' });
  }
  
  const contactosConEstado = contactos.map(contacto => ({
    ...contacto,
    estado: contacto.estado || 'Pendiente'
  }));
  
  logMessage('Consulta de destinatarios', { cantidad: contactos.length });
  res.json({ success: true, contactos: contactosConEstado });
});

// Ruta para limpiar datos
app.post('/limpiar-datos', (req, res) => {
  try {
    // Limpiar la variable de contactos
    contactos = [];
    
    // Intentar eliminar el archivo Excel si existe
    const excelFilePath = path.join(__dirname, '..', 'uploads', 'contactos.xlsx');
    if (fs.existsSync(excelFilePath)) {
      fs.unlinkSync(excelFilePath);
    }
    
    console.log('\n🧹 DATOS LIMPIADOS');
    console.log('═'.repeat(60));
    console.log('✅ Contactos eliminados de memoria');
    console.log('✅ Archivo Excel eliminado');
    console.log('⏰ Hora:', new Date().toLocaleTimeString('es-AR'));
    console.log('═'.repeat(60));
    
    logMessage('Datos limpiados exitosamente');
    res.json({ success: true, message: 'Datos limpiados exitosamente' });
  } catch (error) {
    console.log('❌ Error al limpiar datos:', error.message);
    logError('Error al limpiar datos', { error: error.message });
    res.status(500).json({ success: false, message: 'Error al limpiar datos' });
  }
});

// Ruta para subir archivo Excel
app.post('/upload', upload.single('excel'), (req, res) => {
  try {
    if (!req.file) {
      console.log('❌ Error: No se recibió ningún archivo');
      logError('Intento de subida sin archivo');
      return res.status(400).json({ error: 'No se ha subido ningún archivo' });
    }

    const excelFilePath = path.join(__dirname, '..', 'uploads', 'contactos.xlsx');
    
    console.log('\n📊 PROCESANDO ARCHIVO EXCEL');
    console.log('═'.repeat(60));
    console.log('📁 Archivo:', req.file.originalname);
    console.log('📏 Tamaño:', Math.round(req.file.size / 1024) + ' KB');
    console.log('📂 Ubicación:', excelFilePath);
    console.log('⏰ Hora procesamiento:', new Date().toLocaleTimeString('es-AR'));
    console.log('═'.repeat(60));
    
    logExcel('Archivo Excel recibido', { 
      originalName: req.file.originalname,
      size: req.file.size,
      path: excelFilePath 
    });
    
    const workbook = XLSX.readFile(excelFilePath);
    const sheet_name = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheet_name];
    contactos = XLSX.utils.sheet_to_json(worksheet);

    // Limpiar nombres de columnas (quitar espacios en blanco)
    contactos = contactos.map(contacto => {
      const cleanContacto = {};
      Object.keys(contacto).forEach(key => {
        const cleanKey = key.trim().toLowerCase();
        cleanContacto[cleanKey] = contacto[key];
      });
      return cleanContacto;
    });

    console.log('✅ Archivo procesado exitosamente');
    console.log('📊 Contactos encontrados:', contactos.length);
    console.log('📋 Hoja procesada:', sheet_name);
    
    // Mostrar muestra de los primeros 3 contactos
    if (contactos.length > 0) {
      console.log('📝 Muestra de contactos:');
      contactos.slice(0, 3).forEach((contacto, index) => {
        console.log(`   ${index + 1}. ${contacto.nombre || 'Sin nombre'} - ${contacto.telefono || 'Sin teléfono'}`);
      });
      if (contactos.length > 3) {
        console.log(`   ... y ${contactos.length - 3} contactos más`);
      }
    }
    console.log('═'.repeat(60));

    logExcel('Archivo Excel procesado exitosamente', { 
      contactos: contactos.length,
      hoja: sheet_name,
      muestra: contactos.slice(0, 3).map(c => ({ nombre: c.nombre, telefono: c.telefono }))
    });
    
    res.json({
      success: true,
      message: `Archivo subido correctamente. Se cargaron ${contactos.length} contactos.`,
      count: contactos.length,
      preview: contactos.slice(0, 5)
    });
  } catch (error) {
    console.log('❌ Error al procesar archivo Excel');
    console.log('🔍 Detalle del error:', error.message);
    console.log('═'.repeat(60));
    
    logError('Error al procesar archivo Excel', error);
    res.status(500).json({ 
      error: 'Error al procesar el archivo',
      message: error.message 
    });
  }
});

// Ruta para enviar mensajes
app.get('/send', async (req, res) => {
  if (!isClientReady || !sock) {
    logError('Intento de envío sin conexión WhatsApp');
    return res.status(503).json({
      success: false,
      error: 'WhatsApp no está listo',
      message: 'El cliente de WhatsApp no está listo. Por favor escanee el código QR y espere a que se conecte.'
    });
  }

  if (contactos.length === 0) {
    logError('Intento de envío sin contactos');
    return res.status(400).json({
      success: false,
      error: 'No hay contactos',
      message: 'No hay contactos cargados. Por favor suba un archivo Excel primero.'
    });
  }

  try {
    const imagePath = path.join(__dirname, '..', 'foto.png');
    if (!fs.existsSync(imagePath)) {
      logError('Imagen no encontrada', { path: imagePath });
      return res.status(404).json({
        success: false,
        error: 'Imagen no encontrada',
        message: 'No se encontró la imagen para enviar. Verifique que el archivo foto.png exista en la carpeta del proyecto.'
      });
    }

    const imageBuffer = fs.readFileSync(imagePath);
    let enviados = 0;
    let errores = 0;

    console.log('\n🚀 INICIANDO ENVÍO DE MENSAJES');
    console.log('═'.repeat(60));
    console.log('📊 Total de contactos:', contactos.length);
    console.log('📱 Estado WhatsApp: Conectado');
    console.log('⏰ Hora inicio:', new Date().toLocaleTimeString('es-AR'));
    console.log('═'.repeat(60));

    logMessage('Iniciando envío de mensajes', { total: contactos.length });

    for (let i = 0; i < contactos.length; i++) {
      const contacto = contactos[i];
      try {
        if (!contacto.telefono || !contacto.nombre || !contacto.codigo || !contacto.vencimiento) {
          console.log(`❌ [${i + 1}/${contactos.length}] Error: Datos incompletos - ${contacto.nombre || 'Sin nombre'}`);
          logError('Datos incompletos de contacto', contacto);
          errores++;
          continue;
        }

        const chatId = `${contacto.telefono}@s.whatsapp.net`;
        // Generar mensaje usando template de configuración
        const message = config.message.template
          .replace('{nombre}', contacto.nombre)
          .replace('{codigo}', contacto.codigo)
          .replace('{vencimiento}', contacto.vencimiento);

        await sock.sendMessage(chatId, {
          image: imageBuffer,
          caption: message
        });

        console.log(`✅ [${i + 1}/${contactos.length}] Enviado a: ${contacto.nombre} (${contacto.telefono})`);
        
        logMessage('Mensaje enviado', { 
          nombre: contacto.nombre, 
          telefono: contacto.telefono,
          progreso: `${i + 1}/${contactos.length}`
        });

        contacto.estado = 'Enviado';
        enviados++;
        
        // Pausa entre mensajes para evitar spam
        if (i < contactos.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
      } catch (error) {
        console.log(`❌ [${i + 1}/${contactos.length}] Error enviando a: ${contacto.nombre} - ${error.message}`);
        logError('Error al enviar mensaje', { 
          error,
          contacto: {
            nombre: contacto.nombre,
            telefono: contacto.telefono
          }
        });
        contacto.estado = 'Error';
        errores++;
      }
    }

    console.log('\n📋 RESUMEN FINAL DEL ENVÍO');
    console.log('═'.repeat(60));
    console.log('✅ Mensajes enviados exitosamente:', enviados);
    console.log('❌ Errores encontrados:', errores);
    console.log('📊 Total procesados:', contactos.length);
    console.log('📈 Tasa de éxito:', Math.round((enviados / contactos.length) * 100) + '%');
    console.log('⏰ Hora finalización:', new Date().toLocaleTimeString('es-AR'));
    console.log('═'.repeat(60));

    logMessage('Envío de mensajes completado', { 
      enviados, 
      errores, 
      total: contactos.length,
      tasaExito: Math.round((enviados / contactos.length) * 100)
    });
    
    res.json({
      success: true,
      message: `Proceso completado. Mensajes enviados: ${enviados}. Errores: ${errores}.`,
      enviados,
      errores,
      total: contactos.length,
      tasaExito: Math.round((enviados / contactos.length) * 100)
    });
  } catch (error) {
    console.log('\n❌ ERROR GENERAL EN EL ENVÍO');
    console.log('═'.repeat(60));
    console.log('🔍 Error:', error.message);
    console.log('⏰ Hora error:', new Date().toLocaleTimeString('es-AR'));
    console.log('═'.repeat(60));
    
    logError('Error general al enviar mensajes', error);
    res.status(500).json({
      success: false,
      error: 'Error al enviar mensajes',
      message: error.message
    });
  }
});

// Función para mostrar información del sistema al inicio
function mostrarInfoSistema() {
  console.clear();
  console.log('\n🏥 SANATORIO DEL OESTE - Sistema de Cumpleaños');
  console.log('═'.repeat(60));
  console.log('📅 Fecha:', new Date().toLocaleDateString('es-AR'));
  console.log('⏰ Hora:', new Date().toLocaleTimeString('es-AR'));
  console.log('🌐 Puerto:', port);
  console.log('📁 Directorio:', __dirname);
  console.log('═'.repeat(60));
  console.log('🔗 URL Local: http://localhost:' + port);
  console.log('📱 Estado WhatsApp: Conectando...');
  console.log('═'.repeat(60));
}

// Iniciar el servidor
app.listen(port, () => {
  mostrarInfoSistema();
  logMessage('Sistema iniciado correctamente', { 
    puerto: port,
    url: `http://localhost:${port}`,
    directorio: __dirname
  });
  initBaileys();
});