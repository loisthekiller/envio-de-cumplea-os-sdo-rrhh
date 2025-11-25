/**
 * Utilidades de validación
 */

/**
 * Normaliza un número de teléfono
 * @param {string|number} telefono 
 * @returns {string}
 */
function normalizarTelefono(telefono) {
    // Si es número, conviértelo a string sin decimales
    if (typeof telefono === 'number') {
        return telefono.toFixed(0);
    }

    // Si es string en notación científica, conviértelo a número
    if (typeof telefono === 'string' && telefono.includes('E')) {
        const num = Number(telefono);
        if (!isNaN(num)) return num.toFixed(0);
    }

    // Elimina espacios, puntos y caracteres no numéricos
    return telefono ? String(telefono).replace(/[^\d]/g, '') : '';
}

/**
 * Valida que un número de teléfono sea válido
 * @param {string} numero 
 * @returns {boolean}
 */
function validarNumero(numero) {
    // Valida que el número tenga entre 10 y 15 dígitos
    return typeof numero === 'string' && /^\d{10,15}$/.test(numero);
}

/**
 * Valida que un contacto tenga todos los campos requeridos
 * @param {Object} contacto 
 * @returns {Object} { valid: boolean, errors: Array }
 */
function validarContacto(contacto) {
    const errors = [];

    if (!contacto.nombre) {
        errors.push('Nombre es requerido');
    }

    if (!contacto.telefono) {
        errors.push('Teléfono es requerido');
    } else {
        const telefonoNormalizado = normalizarTelefono(contacto.telefono);
        if (!validarNumero(telefonoNormalizado)) {
            errors.push('Teléfono inválido (debe tener 10-15 dígitos)');
        }
    }

    if (!contacto.codigo) {
        errors.push('Código es requerido');
    }

    if (!contacto.vencimiento) {
        errors.push('Vencimiento es requerido');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Valida el tipo MIME de un archivo
 * @param {string} mimetype 
 * @returns {boolean}
 */
function validarTipoExcel(mimetype) {
    const tiposPermitidos = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
    ];
    return tiposPermitidos.includes(mimetype);
}

module.exports = {
    normalizarTelefono,
    validarNumero,
    validarContacto,
    validarTipoExcel
};
