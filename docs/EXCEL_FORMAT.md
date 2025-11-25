# 📊 Formato de Archivo Excel - Sanatorio del Oeste

## Estructura Requerida

El archivo Excel debe tener **exactamente** estas columnas:

| Columna | Nombre | Tipo | Descripción | Ejemplo |
|---------|--------|------|-------------|---------|
| A | nombre | Texto | Nombre completo del empleado | "Juan Carlos Pérez" |
| B | telefono | Número | Número de WhatsApp con código país | 5491123456789 |
| C | codigo | Texto | Código del voucher de cine | "HOYTS2024001" |
| D | vencimiento | Texto | Fecha de vencimiento del voucher | "31/12/2024" |

## ⚠️ Formato Importante

### Columna "telefono"
- **Debe incluir código de país**: Argentina = 54
- **Debe incluir código de área**: CABA = 11
- **Sin espacios, guiones o símbolos**
- **Ejemplo correcto**: `5491123456789`
- **Ejemplo incorrecto**: `+54 11 1234-5678`

### Columna "codigo"
- Código único para cada persona
- Formato sugerido: `HOYTS2024XXX`
- Sin caracteres especiales que puedan causar problemas

### Columna "vencimiento"
- Fecha límite para usar el voucher
- Formato sugerido: `DD/MM/AAAA`
- **Ejemplo correcto**: `31/12/2024`
- **También válido**: `31 de Diciembre 2024`

## 📋 Ejemplo de Archivo Excel

```
| nombre           | telefono      | codigo       | vencimiento |
|------------------|---------------|--------------|-------------|
| Juan Pérez       | 5491123456789 | HOYTS2024001 | 31/12/2024  |
| María González   | 5491198765432 | HOYTS2024002 | 31/12/2024  |
| Carlos Rodríguez | 5491155667788 | HOYTS2024003 | 15/01/2025  |
| Ana Silva        | 5491144332211 | HOYTS2024004 | 31/12/2024  |
```

## ✅ Validaciones del Sistema

El sistema verificará automáticamente:

1. **Presencia de las 4 columnas requeridas** (nombre, telefono, codigo, vencimiento)
2. **Datos no vacíos en ninguna celda**
3. **Formato de número de teléfono válido**
4. **Extensión de archivo (.xlsx)**

## 🚨 Errores Comunes

### ❌ Columnas mal nombradas
```
| Nombre | Teléfono | Código | Vencimiento |  ← Incorrecto
```

### ✅ Columnas correctas
```
| nombre | telefono | codigo | vencimiento |  ← Correcto
```

### ❌ Números de teléfono incorrectos
- `11-1234-5678` (con guiones)
- `+54 11 1234 5678` (con espacios y +)
- `1123456789` (sin código de país)

### ✅ Números de teléfono correctos
- `5491123456789` (formato completo)

## 📁 Ubicación del Archivo

1. Guardar el archivo como `contactos.xlsx`
2. Subirlo através de la interfaz web del sistema
3. El archivo se guardará en la carpeta `uploads/`

## 🔄 Proceso de Carga

1. **Subir archivo** → Sistema valida formato
2. **Validar datos** → Sistema verifica contenido
3. **Vista previa** → Sistema muestra primeros registros
4. **Confirmar** → Listo para envío

## 📞 Soporte

Si tienes problemas con el formato:
1. Revisa este documento
2. Verifica la estructura del Excel
3. Consulta los logs del sistema
4. Contacta al administrador técnico

---

**Recuerda**: Un archivo bien formateado garantiza el éxito del envío masivo.
