const chalk = require('chalk');

/**
 * Utilidades de formateo para consola
 */

/**
 * Muestra una barra de progreso en consola
 * @param {number} actual - Número actual
 * @param {number} total - Total
 * @param {Object} contactoActual - Contacto actual
 * @param {number} tiempoInicio - Timestamp de inicio
 * @param {number} enviados - Mensajes enviados
 * @param {number} errores - Errores
 */
function mostrarBarraProgreso(actual, total, contactoActual, tiempoInicio, enviados, errores) {
    const porcentaje = Math.floor((actual / total) * 100);
    const completado = Math.floor((porcentaje / 100) * 40);

    let colorBarra = chalk.green;
    if (porcentaje < 50) colorBarra = chalk.yellow;
    if (porcentaje < 20) colorBarra = chalk.red;

    const barra = colorBarra('█'.repeat(completado)) + chalk.gray('░'.repeat(40 - completado));

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

    process.stdout.write(
        `\r${chalk.bold('📱')} ${chalk.cyan('Progreso:')} ${chalk.cyan(porcentaje + '%')} ` +
        `[${barra}] ${actual}/${total}${tiempoRestante} ` +
        `${chalk.green('✓ ' + enviados)}${chalk.white(' | ')}${chalk.red('✗ ' + errores)} ` +
        `${chalk.cyan('👤')} ${contactoActual ? chalk.yellow(contactoActual.nombre || 'Desconocido') : 'N/A'}   `
    );
}

/**
 * Muestra el resumen de envío en consola
 * @param {Object} resumen - { enviados, errores, total, tasaExito }
 * @param {boolean} isConfigured - Si la API está configurada
 */
function mostrarResumenEnvio(resumen, isConfigured) {
    console.clear();
    console.log(chalk.bold('═'.repeat(50)));
    console.log(chalk.bold('📊 RESUMEN DE ENVÍO'));
    console.log(chalk.bold('─'.repeat(50)));

    console.log(
        chalk.bold('📱 WhatsApp API: ') +
        (isConfigured ? chalk.green('CONFIGURADO') : chalk.red('NO CONFIGURADO'))
    );

    let colorTasa = resumen.tasaExito >= 80 ? chalk.green :
        resumen.tasaExito >= 50 ? chalk.yellow : chalk.red;

    console.log(
        chalk.green('✓ ') + chalk.bold('Enviados: ') + chalk.green(resumen.enviados) +
        chalk.white(' | ') +
        chalk.red('✗ ') + chalk.bold('Errores: ') + chalk.red(resumen.errores) +
        chalk.white(' | ') +
        chalk.cyan('⚡ ') + chalk.bold('Tasa: ') + colorTasa(resumen.tasaExito + '%')
    );

    console.log(chalk.bold('⏰ Finalizado: ') + chalk.cyan(new Date().toLocaleTimeString('es-AR')));
    console.log(chalk.bold('═'.repeat(50)));
}

/**
 * Muestra información del sistema al inicio
 * @param {number} port - Puerto del servidor
 * @param {string} host - Host del servidor
 * @param {boolean} isConfigured - Si la API está configurada
 */
function mostrarInfoSistema(port, host, isConfigured) {
    console.clear();
    console.log(chalk.bold('═'.repeat(50)));
    console.log(chalk.bold('📱 SISTEMA DE ENVÍO DE CUMPLEAÑOS - SDO'));
    console.log(chalk.bold('─'.repeat(50)));

    let estado = isConfigured ? chalk.green('✅ CONFIGURADO') : chalk.red('❌ NO CONFIGURADO');
    console.log(chalk.bold('📱 WhatsApp Business API: ') + estado);

    console.log(chalk.bold('🌐 Servidor: ') + chalk.cyan(`http://${host}:${port}`));
    console.log(chalk.bold('⏰ Hora: ') + chalk.cyan(new Date().toLocaleTimeString('es-AR')));
    console.log(chalk.bold('═'.repeat(50)));

    if (!isConfigured) {
        console.log(chalk.yellow('\n⚠️  ADVERTENCIA: Credenciales de WhatsApp no configuradas'));
        console.log(chalk.yellow('Por favor configure el archivo .env con sus credenciales de Meta'));
        console.log(chalk.yellow('Consulte .env.example para ver el formato requerido\n'));
    }
}

module.exports = {
    mostrarBarraProgreso,
    mostrarResumenEnvio,
    mostrarInfoSistema
};
