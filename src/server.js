const chalk = require('chalk');
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const config = require('./config');
const messageService = require('./services/message.service');
const { logWhatsApp, logExcel, logMessage, logError } = require('./utils/logger');

// Función para calcular el resumen
function calcularResumen(enviados, errores, contactos) {
  const total = contactos.length || 0;
  const tasaExito = total > 0 ? Math.round((enviados / total) * 100) : 0;
  return { enviados, errores, total, tasaExito };
}

const app = express();
const port = config.server.port;

// Middleware para parsear JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuración de multer para subir archivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, 'contactos.xlsx');
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    if (file.mimetype !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' &&
      file.mimetype !== 'application/vnd.ms-excel') {
      logError('Intento de subir archivo no válido', { mimetype: file.mimetype });
      return cb(new Error('Solo se permiten archivos Excel'));
    }
    cb(null, true);
  }
});

// Servir archivos estáticos desde la carpeta views
app.use(express.static(path.join(__dirname, 'views')));

// Servir archivos estáticos desde la carpeta static
app.use('/static', express.static(path.join(__dirname, 'public', 'static')));

// Variables globales
let contactos = [];
let apiStatus = { connected: false, configured: false };

// Verificar configuración de WhatsApp al inicio
async function verificarConfiguracionWhatsApp() {
  try {
    const status = await messageService.checkWhatsAppStatus();
    apiStatus = status;
    
    if (status.configured && status.connected) {
      logWhatsApp('WhatsApp Business API configurada y conectada', {
        phoneNumber: status.phoneNumber,
        verifiedName: status.verifiedName
      });
      console.log(chalk.green('✅ WhatsApp Business API conectada exitosamente'));
      if (status.phoneNumber) {
        console.log(chalk.cyan(`📱 Número: ${status.phoneNumber}`));
      }
      if (status.verifiedName) {
        console.log(chalk.cyan(`✓ Nombre verificado: ${status.verifiedName}`));
      }
    } else if (status.configured && !status.connected) {
      logError('WhatsApp API configurada pero no conectada', status.error);
      console.log(chalk.yellow('⚠️  WhatsApp API configurada pero con problemas de conexión'));
      console.log(chalk.red(`Error: ${status.error}`));
    } else {
      logError('WhatsApp API no configurada');
      console.log(chalk.red('❌ WhatsApp Business API no configurada'));
      console.log(chalk.yellow('Por favor configura las credenciales en el archivo .env'));
    }
  } catch (error) {
    logError('Error al verificar configuración de WhatsApp', error);
    console.log(chalk.red('❌ Error al verificar WhatsApp API:', error.message));
  }
}

// Ruta para obtener el código QR (legacy - ya no aplica con API oficial)
app.get('/qr', (req, res) => {
  res.json({ 
    success: true, 
    connected: apiStatus.connected,
    message: 'API oficial de WhatsApp Business - No requiere QR',
    apiConfigured: apiStatus.configured
  });
});

// Ruta principal
app.get('/', (req, res) => {
  const htmlPath = path.join(__dirname, 'views', 'index.html');
  console.log('🔍 Buscando archivo HTML en:', htmlPath);

  // Verificar si el archivo existe
  if (fs.existsSync(htmlPath)) {
    console.log('✅ Archivo HTML encontrado');
    res.sendFile(htmlPath);
  } else {
    console.log('❌ Archivo HTML NO encontrado');
    console.log('📁 Contenido del directorio views:');
    try {
      const viewsDir = path.join(__dirname, 'views');
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
  if (!apiStatus.configured) {
    logError('Intento de envío sin configuración de WhatsApp API');
    return res.status(503).json({
      success: false,
      error: 'WhatsApp API no configurada',
      message: 'Por favor configure las credenciales de WhatsApp Business API en el archivo .env'
    });
  }

  if (!apiStatus.connected) {
    logError('Intento de envío sin conexión WhatsApp API');
    return res.status(503).json({
      success: false,
      error: 'WhatsApp API no conectada',
      message: 'No se pudo conectar con WhatsApp Business API. Verifique sus credenciales.'
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
    // Buscar imagen en src/public/static primero
    let imagePath = path.join(__dirname, 'public', 'static', 'cumple.jpg');
    if (!fs.existsSync(imagePath)) {
      imagePath = path.join(__dirname, 'public', 'static', 'Logo.png');
      if (!fs.existsSync(imagePath)) {
        imagePath = path.join(__dirname, 'public', 'static', 'archivo-ok.png');
        if (!fs.existsSync(imagePath)) {
          // Fallback a la raíz del proyecto
          imagePath = path.join(__dirname, '..', 'foto.png');
          if (!fs.existsSync(imagePath)) {
            imagePath = path.join(__dirname, '..', 'foto-ok.png');
            if (!fs.existsSync(imagePath)) {
              logError('Imagen no encontrada', { searchPaths: [
                path.join(__dirname, 'public', 'static', 'cumple.jpg'),
                path.join(__dirname, 'public', 'static', 'Logo.png'),
                path.join(__dirname, 'public', 'static', 'archivo-ok.png'),
                path.join(__dirname, '..', 'foto.png'),
                path.join(__dirname, '..', 'foto-ok.png')
              ]});
              return res.status(404).json({
                success: false,
                error: 'Imagen no encontrada',
                message: 'No se encontró la imagen para enviar. Verifique que exista cumple.jpg en src/public/static/'
              });
            }
          }
        }
      }
    }

    let enviados = 0;
    let errores = 0;

    logMessage('Iniciando envío de mensajes', { total: contactos.length });

    console.clear();
    
    // Configurar contactos en el servicio
    messageService.setContactos(contactos);

    // Mostrar barra de progreso inicial
    const mostrarBarraProgreso = (actual, total, contactoActual, tiempoInicio) => {
      const porcentaje = Math.floor((actual / total) * 100);
      const completado = Math.floor((porcentaje / 100) * 40);
      let colorBarra = chalk.green;
      if (porcentaje < 50) colorBarra = chalk.yellow;
      if (porcentaje < 20) colorBarra = chalk.red;
      const barra = colorBarra('█'.repeat(completado)) + chalk.gray('░'.repeat(40 - completado));
      const resumenActual = calcularResumen(enviados, errores, contactos);

      let tiempoRestante = '';
      if (tiempoInicio && actual > 0) {
        const ahora = Date.now();
        const tiempoTranscurrido = (ahora - tiempoInicio) / 1000;
        const tiempoPorContacto = tiempoTranscurrido / actual;
        const faltan = total - actual;
        const segundosRestantes = Math.round(tiempoPorContacto * faltan);
        const minutos = Math.floor(segundosRestantes / 60);
        const segundos = segundosRestantes % 60;
        tiempoRestante = ` | ⏳ Estimado: ${minutos}m ${segundos}s`;
      }

      process.stdout.write(`\r${chalk.bold('📱')} ${chalk.cyan('Progreso:')} ${chalk.cyan(porcentaje + '%')} [${barra}] ${actual}/${total}${tiempoRestante} ${chalk.green('✓ ' + enviados)}${chalk.white(' | ')}${chalk.red('✗ ' + errores)} ${chalk.cyan('👤')} ${contactoActual ? chalk.yellow(contactoActual.nombre || 'Desconocido') : 'N/A'}   `);
    };

    const tiempoInicio = Date.now();
    mostrarBarraProgreso(0, contactos.length, null, tiempoInicio);

    for (let i = 0; i < contactos.length; i++) {
      const contacto = contactos[i];
      mostrarBarraProgreso(i, contactos.length, contacto, tiempoInicio);

      try {
        contacto.telefono = normalizarTelefono(contacto.telefono);
        if (!contacto.telefono || !contacto.nombre || !contacto.codigo || !contacto.vencimiento) {
          logError('Datos incompletos de contacto', contacto);
          contacto.estado = 'Error';
          errores++;
          mostrarBarraProgreso(i + 1, contactos.length, contacto, tiempoInicio);
          continue;
        }
        if (!validarNumero(contacto.telefono)) {
          logError('Número inválido', contacto);
          contacto.estado = 'Error';
          errores++;
          mostrarBarraProgreso(i + 1, contactos.length, contacto, tiempoInicio);
          continue;
        }

        const message = config.message.template
          .replace('{nombre}', contacto.nombre)
          .replace('{codigo}', contacto.codigo)
          .replace('{vencimiento}', contacto.vencimiento);

        // Enviar usando plantilla de Meta o mensaje libre según configuración
        let result;
        if (config.message.useMetaTemplate) {
          // Usar plantilla de Meta aprobada con imagen
          result = await messageService.whatsappAPI.sendTemplateMessage(
            contacto.telefono,
            config.message.metaTemplateName,
            config.message.metaTemplateLanguage,
            [contacto.nombre, contacto.codigo, contacto.vencimiento], // Parámetros de la plantilla
            imagePath // Enviar la imagen cumple.jpg
          );
        } else {
          // Usar mensaje libre (requiere sesión activa)
          result = await messageService.whatsappAPI.sendImageMessage(
            contacto.telefono,
            imagePath,
            message
          );
        }

        if (result.success) {
          logMessage('Mensaje enviado', { 
            nombre: contacto.nombre, 
            telefono: contacto.telefono, 
            progreso: `${i + 1}/${contactos.length}` 
          });
          contacto.estado = 'Enviado';
          enviados++;
        } else {
          logError('Error al enviar mensaje', { contacto, error: result.error });
          console.log(chalk.red(`\n❌ Error enviando a ${contacto.nombre}:`));
          console.log(chalk.yellow(JSON.stringify(result.error, null, 2)));
          contacto.estado = 'Error';
          errores++;
        }

        mostrarBarraProgreso(i + 1, contactos.length, contacto, tiempoInicio);

        if (i < contactos.length - 1) {
          await new Promise(resolve => setTimeout(resolve, config.message.delayBetweenMessages || 2000));
        }
      } catch (error) {
        logError('Error al enviar mensaje', { error, contacto });
        contacto.estado = 'Error';
        errores++;
        mostrarBarraProgreso(i + 1, contactos.length, contacto, tiempoInicio);
      }
    }

    // Mostrar resumen
    const resumen = calcularResumen(enviados, errores, contactos);
    console.clear();
    console.log(chalk.bold('═'.repeat(50)));
    console.log(chalk.bold('📊 RESUMEN DE ENVÍO'));
    console.log(chalk.bold('─'.repeat(50)));

    console.log(
      chalk.bold('📱 WhatsApp: ') + (apiStatus.connected ? chalk.green('CONECTADO') : chalk.red('DESCONECTADO'))
    );

    let colorTasa = resumen.tasaExito >= 80 ? chalk.green : resumen.tasaExito >= 50 ? chalk.yellow : chalk.red;
    console.log(
      chalk.green('✓ ') + chalk.bold('Enviados: ') + chalk.green(resumen.enviados) +
      chalk.white(' | ') +
      chalk.red('✗ ') + chalk.bold('Errores: ') + chalk.red(resumen.errores) +
      chalk.white(' | ') +
      chalk.cyan('⚡ ') + chalk.bold('Tasa: ') + colorTasa(resumen.tasaExito + '%')
    );

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
app.get('/status', async (req, res) => {
  // Refrescar estado
  const status = await messageService.checkWhatsAppStatus();
  apiStatus = status;
  
  res.json({
    connected: status.connected,
    configured: status.configured,
    phoneNumber: status.phoneNumber || null,
    verifiedName: status.verifiedName || null,
    lastError: status.error || null
  });
});

// Función para mostrar información del sistema al inicio
function mostrarInfoSistema() {
  console.clear();
  console.log(chalk.bold('═'.repeat(50)));
  console.log(chalk.bold('📱 SISTEMA DE ENVÍO DE CUMPLEAÑOS - SDO'));
  console.log(chalk.bold('─'.repeat(50)));

  // Estado de WhatsApp
  let estado = apiStatus.connected ? chalk.green('✅ EN LÍNEA') : chalk.red('❌ DESCONECTADO');
  console.log(chalk.bold('📱 Estado WhatsApp API: ') + estado);

  // Servidor web
  console.log(chalk.bold('🌐 Servidor: ') + chalk.cyan(`http://${config.server.host}:${port}`));

  // Hora actual
  console.log(chalk.bold('⏰ Hora: ') + chalk.cyan(new Date().toLocaleTimeString('es-AR')));

  console.log(chalk.bold('═'.repeat(50)));
}

// Iniciar el servidor
app.listen(port, async () => {
  mostrarInfoSistema();

  // Verificar configuración de WhatsApp API
  await verificarConfiguracionWhatsApp();

  // Registrar en el log
  logMessage('Sistema iniciado correctamente', {
    puerto: port,
    url: `http://${config.server.host}:${port}`,
    directorio: __dirname,
    whatsappAPI: 'WhatsApp Business Cloud API'
  });
});