const P = require('pino');
const silentLogger = P({ level: 'silent' });
process.env['BAILEYS_NO_LOGGING'] = 'true';
const chalk = require('chalk');
// Función para calcular el resumen
function calcularResumen(enviados, errores, contactos) {
  const total = contactos.length || 0;
  const tasaExito = total > 0 ? Math.round((enviados / total) * 100) : 0;
  return { enviados, errores, total, tasaExito };
}

// Función para mostrar el resumen en consola con colores
function mostrarResumen(resumen) {
  console.clear();
  console.log(chalk.bold('📋 RESUMEN ENVÍO\n'));

  console.log(chalk.green(`✔ Enviados: ${resumen.enviados}`));
  console.log(chalk.red(`✖ Errores: ${resumen.errores}`));
  console.log(chalk.cyan(`📊 Total: ${resumen.total}`));

  let colorTasa =
    resumen.tasaExito >= 80
      ? chalk.green
      : resumen.tasaExito >= 50
      ? chalk.yellow
      : chalk.red;

  console.log(colorTasa(`📈 Tasa de éxito: ${resumen.tasaExito}%`));
}
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const XLSX = require('xlsx');
const { logWhatsApp, logExcel, logMessage, logError } = require('./logger');
// Filtrar logs innecesarios en consola
const originalConsoleLog = console.log;
console.log = function(...args) {
  // Filtrar todos los logs de Baileys
  if (typeof args[0] === 'string' && args[0].includes('baileys')) return;
  if (typeof args[0] === 'object' && args[0]?.class === 'baileys') return;
  
  // Filtrar mensajes JSON que contengan datos técnicos
  if (typeof args[0] === 'string' && args[0].startsWith('{') && args[0].includes('"level"')) return;
  
  // Filtrar logs de conexión muy detallados
  if (typeof args[0] === 'string' && 
    (args[0].includes('created new mutex') || 
     args[0].includes('processing sender keys') || 
     args[0].includes('fetching sender key'))) return;
  
  // Permitir logs importantes y mensajes del sistema
  originalConsoleLog.apply(console, args);
};
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

// Ruta para servir la nueva imagen de cumpleaños
app.get('/foto-ok.png', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'foto-ok.png'));
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
let lastError = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
let reconnectDelay = 3000;

async function initBaileys() {
  try {
    logWhatsApp('Iniciando conexión con WhatsApp');
    const path = require('path');
    const QRCode = require('qrcode');
    const { fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth');

    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      browser: ['WhatsApp Bot', 'Chrome', '4.0.0'],
      markOnlineOnConnect: true,
      syncFullHistory: false,
      logger: silentLogger
    });

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        currentQR = qr;
        logWhatsApp('Código QR generado', { timestamp: new Date().toISOString() });
        console.clear();
        console.log(chalk.bold.bgYellow.black('\n¡Escanea este código QR con WhatsApp!'));
        qrcode.generate(qr, { small: true });
        // Guardar QR como imagen PNG
        const qrPath = path.join(__dirname, '..', 'qr-code.png');
        try {
          await QRCode.toFile(qrPath, qr, {
            color: { dark: '#000000', light: '#FFFFFF' },
            width: 300
          });
          console.log(chalk.green(`QR guardado en archivo: ${qrPath}`));
        } catch (qrError) {
          console.log(chalk.red(`Error al guardar QR: ${qrError}`));
        }
      } else if (!isClientReady && !currentQR) {
        // Si no hay QR y no está listo, sugerir limpiar la carpeta de autenticación
        console.log(chalk.red('No se pudo generar el QR. Intenta limpiar la carpeta "baileys_auth" y reiniciar.'));
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error)?.output?.statusCode;
        const reason = DisconnectReason[statusCode];
        isClientReady = false;
        currentQR = null;
        lastError = reason || 'Desconocida';
        logWhatsApp('Conexión cerrada', { reason, statusCode });

        reconnectAttempts++;
        if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
          console.log('❌ Se alcanzó el máximo de intentos de reconexión.');
          logError('Máximo de intentos de reconexión alcanzado');
          return;
        }
        reconnectDelay = Math.min(reconnectDelay * 2, 60000); // backoff exponencial hasta 1 min
        setTimeout(() => initBaileys(), reconnectDelay);
      } else if (connection === 'open') {
        isClientReady = true;
        currentQR = null;
        lastError = null;
        reconnectAttempts = 0;
        reconnectDelay = 3000;
        logWhatsApp('Conexión establecida exitosamente', { timestamp: new Date().toISOString(), port });
        sock.sendMessage("status@broadcast", { text: "🏥 Bot del Sanatorio del Oeste conectado exitosamente!" })
          .then(() => logWhatsApp('Mensaje de prueba enviado'))
          .catch(err => logError('Error al enviar mensaje de prueba', err));
      }
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('messages.upsert', async m => {
      try {
        const msg = m.messages[0];
        if (!msg.message) return;
        logMessage('Mensaje recibido', { from: msg.key.remoteJid, type: Object.keys(msg.message)[0] });
      } catch (err) {
        logError('Error al procesar mensaje entrante', err);
      }
    });
  } catch (error) {
    lastError = error.message;
    logError('Error al inicializar Baileys', error);
    reconnectAttempts++;
    if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
      logError('Máximo de intentos de reconexión alcanzado');
      return;
    }
    reconnectDelay = Math.min(reconnectDelay * 2, 60000);
    setTimeout(() => initBaileys(), reconnectDelay);
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

  function normalizarTelefono(telefono) {
    // Si es número, conviértelo a string sin decimales ni notación científica
    if (typeof telefono === 'number') {
      return telefono.toFixed(0);
    }
    // Si es string en notación científica, conviértelo a número y luego a string
    if (typeof telefono === 'string' && telefono.includes('E')) {
      const num = Number(telefono);
      if (!isNaN(num)) return num.toFixed(0);
    }
    // Elimina espacios, puntos y caracteres no numéricos
    return telefono ? String(telefono).replace(/[^\d]/g, '') : '';
  }

  function validarNumero(numero) {
    // Valida que el número tenga entre 10 y 15 dígitos y solo números
    return typeof numero === 'string' && /^\d{10,15}$/.test(numero);
  }

  try {
    let imagePath = path.join(__dirname, '..', 'foto.png');
    if (!fs.existsSync(imagePath)) {
      imagePath = path.join(__dirname, '..', 'foto-ok.png');
      if (!fs.existsSync(imagePath)) {
        logError('Imagen no encontrada', { path: imagePath });
        return res.status(404).json({
          success: false,
          error: 'Imagen no encontrada',
          message: 'No se encontró la imagen para enviar. Verifique que el archivo foto.png o foto-ok.png exista en la carpeta del proyecto.'
        });
      }
    }

    const imageBuffer = fs.readFileSync(imagePath);
    let enviados = 0;
    let errores = 0;

    logMessage('Iniciando envío de mensajes', { total: contactos.length });

    console.clear();
    // Mostrar barra de progreso inicial
    const mostrarBarraProgreso = (actual, total, contactoActual, tiempoInicio) => {
      const porcentaje = Math.floor((actual / total) * 100);
      const completado = Math.floor((porcentaje / 100) * 40); // 40 caracteres de ancho para la barra
      let colorBarra = chalk.green;
      if (porcentaje < 50) colorBarra = chalk.yellow;
      if (porcentaje < 20) colorBarra = chalk.red;
      const barra = colorBarra('█'.repeat(completado)) + chalk.gray('░'.repeat(40 - completado));
      const resumenActual = calcularResumen(enviados, errores, contactos);

      // Calcular tiempo estimado restante
      let tiempoRestante = '';
      if (tiempoInicio && actual > 0) {
        const ahora = Date.now();
        const tiempoTranscurrido = (ahora - tiempoInicio) / 1000; // segundos
        const tiempoPorContacto = tiempoTranscurrido / actual;
        const faltan = total - actual;
        const segundosRestantes = Math.round(tiempoPorContacto * faltan);
        const minutos = Math.floor(segundosRestantes / 60);
        const segundos = segundosRestantes % 60;
        tiempoRestante = ` | ⏳ Estimado: ${minutos}m ${segundos}s`;
      }

      // Imprimir barra en una sola línea, sobrescribiendo la anterior
      process.stdout.write(`\r${chalk.bold('📱')} ${chalk.cyan('Progreso:')} ${chalk.cyan(porcentaje + '%')} [${barra}] ${actual}/${total}${tiempoRestante} ${chalk.green('✓ ' + enviados)}${chalk.white(' | ')}${chalk.red('✗ ' + errores)} ${chalk.cyan('👤')} ${contactoActual ? chalk.yellow(contactoActual.nombre || 'Desconocido') : 'N/A'}   `);
    };
    
    // Mostrar barra inicial
  const tiempoInicio = Date.now();
  mostrarBarraProgreso(0, contactos.length, null, tiempoInicio);

    for (let i = 0; i < contactos.length; i++) {
  const contacto = contactos[i];
  // Mostrar progreso
  mostrarBarraProgreso(i, contactos.length, contacto, tiempoInicio);
      
      try {
        contacto.telefono = normalizarTelefono(contacto.telefono);
        if (!contacto.telefono || !contacto.nombre || !contacto.codigo || !contacto.vencimiento) {
          logError('Datos incompletos de contacto', contacto);
          contacto.estado = 'Error';
          errores++;
          mostrarBarraProgreso(i + 1, contactos.length, contacto);
          continue;
        }
        if (!validarNumero(contacto.telefono)) {
          logError('Número inválido', contacto);
          contacto.estado = 'Error';
          errores++;
          mostrarBarraProgreso(i + 1, contactos.length, contacto);
          continue;
        }

        const chatId = `${contacto.telefono}@s.whatsapp.net`;
        const message = config.message.template
          .replace('{nombre}', contacto.nombre)
          .replace('{codigo}', contacto.codigo)
          .replace('{vencimiento}', contacto.vencimiento);

        let enviado = false;
        try {
          await sock.sendMessage(chatId, { image: imageBuffer, caption: message });
          enviado = true;
        } catch (error) {
          logError('Primer intento fallido, reintentando...', { contacto, error });
          try {
            await sock.sendMessage(chatId, { image: imageBuffer, caption: message });
            enviado = true;
          } catch (error2) {
            logError('Segundo intento fallido', { contacto, error2 });
          }
        }

        if (enviado) {
          logMessage('Mensaje enviado', { nombre: contacto.nombre, telefono: contacto.telefono, progreso: `${i + 1}/${contactos.length}` });
          contacto.estado = 'Enviado';
          enviados++;
          // Actualizar barra de progreso al enviar exitosamente
          mostrarBarraProgreso(i + 1, contactos.length, contacto, tiempoInicio);
        } else {
          contacto.estado = 'Error';
          errores++;
          // Actualizar barra de progreso también en caso de error
          mostrarBarraProgreso(i + 1, contactos.length, contacto, tiempoInicio);
        }

        if (i < contactos.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        logError('Error al enviar mensaje', { error, contacto });
        contacto.estado = 'Error';
        errores++;
        // Actualizar barra de progreso en caso de error
  mostrarBarraProgreso(i + 1, contactos.length, contacto, tiempoInicio);
      }
    }

    // Mostrar resumen compacto y ordenado
    const resumen = calcularResumen(enviados, errores, contactos);
    console.clear();
    // Resumen completo pero compacto
    console.log(chalk.bold('═'.repeat(50)));
    console.log(chalk.bold('📊 RESUMEN DE ENVÍO'));
    console.log(chalk.bold('─'.repeat(50)));
    
    // Estado de conexión
    console.log(
      chalk.bold('📱 WhatsApp: ') + (isClientReady ? chalk.green('CONECTADO') : chalk.red('DESCONECTADO'))
    );
    
    // Resultados del envío
    let colorTasa = resumen.tasaExito >= 80 ? chalk.green : resumen.tasaExito >= 50 ? chalk.yellow : chalk.red;
    console.log(
      chalk.green('✓ ') + chalk.bold('Enviados: ') + chalk.green(resumen.enviados) + 
      chalk.white(' | ') + 
      chalk.red('✗ ') + chalk.bold('Errores: ') + chalk.red(resumen.errores) + 
      chalk.white(' | ') +
      chalk.cyan('⚡ ') + chalk.bold('Tasa: ') + colorTasa(resumen.tasaExito + '%')
    );
    
    // Hora de finalización
    console.log(chalk.bold('⏰ Finalizado: ') + chalk.cyan(new Date().toLocaleTimeString('es-AR')));
    console.log(chalk.bold('═'.repeat(50)));

    res.json({
      success: true,
      message: `Proceso completado. Mensajes enviados: ${resumen.enviados}. Errores: ${resumen.errores}.`,
      ...resumen
    });
  } catch (error) {
    logError('Error general al enviar mensajes', error);
    res.status(500).json({
      success: false,
      error: 'Error al enviar mensajes',
      message: error.message
    });
  }
});
// Ruta para consultar el estado de WhatsApp
app.get('/status', (req, res) => {
  res.json({
    connected: isClientReady,
    qr: currentQR || null,
    lastError: lastError || null,
    reconnectAttempts
  });
});

// Función para mostrar información del sistema al inicio
function mostrarInfoSistema() {
  console.clear();
  console.log(chalk.bold('═'.repeat(50)));
  console.log(chalk.bold('📱 SISTEMA DE ENVÍO DE CUMPLEAÑOS - SDO'));
  console.log(chalk.bold('─'.repeat(50)));
  
  // Estado de WhatsApp
  let estado = isClientReady ? chalk.green('✅ EN LÍNEA') : chalk.red('❌ DESCONECTADO');
  console.log(chalk.bold('📱 Estado WhatsApp: ') + estado);
  
  // Servidor web
  console.log(chalk.bold('🌐 Servidor: ') + chalk.cyan(`http://${config.server.host}:${port}`));
  
  // Hora actual
  console.log(chalk.bold('⏰ Hora: ') + chalk.cyan(new Date().toLocaleTimeString('es-AR')));
  
  console.log(chalk.bold('═'.repeat(50)));
}

// Iniciar el servidor
app.listen(port, () => {
  mostrarInfoSistema();
  
  // Iniciar Baileys sin mensajes adicionales en la consola
  initBaileys();
  
  // Registrar en el log pero no en la consola
  logMessage('Sistema iniciado correctamente', { 
    puerto: port,
    url: `http://${config.server.host}:${port}`,
    directorio: __dirname
  });
});