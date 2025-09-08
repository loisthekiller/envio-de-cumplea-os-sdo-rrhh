# 🏥 Sistema de Envío de Cumpleaños - Sanatorio del Oeste

Sistema automatizado para el envío de mensajes de felicitación de cumpleaños a empleados del Sanatorio del Oeste a través de WhatsApp.

## 🎯 Características

- ✅ **Interfaz web intuitiva** con diseño profesional
- ✅ **Carga masiva** de contactos mediante archivos Excel
- ✅ **Envío automático** de mensajes personalizados vía WhatsApp
- ✅ **Vista previa** del mensaje antes del envío
- ✅ **Seguimiento en tiempo real** del estado de los envíos
- ✅ **Logs detallados** de todas las operaciones
- ✅ **Manejo de errores** robusto

## 🚀 Instalación

### Requisitos previos
- Node.js (versión 16 o superior)
- NPM o Yarn
- Cuenta de WhatsApp para vincular

### Pasos de instalación

1. **Clonar el repositorio**
   ```bash
   git clone https://github.com/loisthekiller/envio-de-cumplea-os-sdo-rrhh.git
   cd envio-de-cumplea-os-sdo-rrhh
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Iniciar el servidor**
   ```bash
   cd src
   node server.js
   ```

4. **Acceder a la aplicación**
   - Abrir navegador en `http://localhost:3000`
   - Escanear el código QR con WhatsApp
   - ¡Listo para usar!

## 📁 Estructura del proyecto

```
envio-de-cumplea-os-sdo-rrhh/
├── src/
│   ├── server.js          # Servidor principal
│   ├── config.js          # Configuraciones
│   └── logger.js          # Sistema de logs
├── views/
│   └── index.html         # Interfaz web
├── static/
│   ├── Logo.png           # Logo del sanatorio
│   └── archivo-ok.png     # Iconos de la interfaz
├── uploads/               # Archivos Excel subidos
├── logs/                  # Archivos de log
└── foto.png              # Imagen para mensajes
```

## 📊 Formato del archivo Excel

El archivo Excel debe tener las siguientes columnas:

| Nombre | Telefono | Codigo | Vencimiento |
|--------|----------|--------|-------------|
| Juan Pérez | 5491123456789 | ABC123 | 31/12/2024 |
| María García | 5491987654321 | DEF456 | 15/01/2025 |

## 🎨 Funcionalidades

### 📱 **Interfaz Web**
- Pantalla de bienvenida profesional
- Carga de archivos Excel con validación
- Lista de destinatarios en tiempo real
- Vista previa del mensaje personalizado

### 📞 **WhatsApp Integration**
- Conexión automática mediante QR
- Envío de mensajes con imagen adjunta
- Manejo de reconexiones automáticas
- Estado de conexión en tiempo real

### 📈 **Monitoreo**
- Logs detallados en consola
- Archivos de log persistentes
- Contadores de envíos exitosos/fallidos
- Progreso en tiempo real

## ⚙️ Configuración

### Puerto del servidor
Modificar en `src/config.js`:
```javascript
module.exports = {
  server: {
    port: 3000  // Cambiar puerto aquí
  }
}
```

### Mensaje personalizado
El mensaje se personaliza automáticamente con:
- `[NOMBRE]` → Nombre del contacto
- `[CODIGO]` → Código del voucher
- `[VENCIMIENTO]` → Fecha de vencimiento

## 🔒 Seguridad

- ✅ Archivos sensibles excluidos del repositorio
- ✅ Validación de tipos de archivo
- ✅ Manejo seguro de sesiones de WhatsApp
- ✅ Logs sin información personal

## 🛠️ Tecnologías utilizadas

- **Backend**: Node.js + Express
- **WhatsApp**: Baileys Library
- **Frontend**: HTML5 + Bootstrap 5
- **File Processing**: XLSX
- **Logging**: Winston

## 📞 Soporte

Para soporte técnico contactar al Departamento de Recursos Humanos del Sanatorio del Oeste.

## 📝 Changelog

Ver [CAMBIOS.md](CAMBIOS.md) para el historial de versiones.

---

**Desarrollado para el Sanatorio del Oeste - Departamento de Recursos Humanos**

## 🐳 Uso con Docker

### Construir la imagen
```bash
docker build -t sanatorio-cumpleanos:latest .
```

### Ejecutar contenedor (persistiendo datos sensibles fuera de la imagen)
```bash
docker run -d \
  --name cumple-sdo \
  -p 3000:3000 \
  -v $(pwd)/uploads:/app/uploads \
  -v $(pwd)/src/baileys_auth:/app/src/baileys_auth \
  -v $(pwd)/logs:/app/logs \
  sanatorio-cumpleanos:latest
```

### Ver logs
```bash
docker logs -f cumple-sdo
```

### Actualizar imagen
```bash
docker build -t sanatorio-cumpleanos:latest .
docker stop cumple-sdo && docker rm cumple-sdo
# volver a ejecutar el comando run
```

### Healthcheck
La imagen incluye un healthcheck que consulta `http://localhost:3000/`.

### Notas
- Montar `baileys_auth` como volumen es imprescindible para no perder la sesión de WhatsApp al recrear el contenedor.
- Montar `uploads` permite reemplazar el Excel sin reconstruir la imagen.
- Montar `logs` conserva el historial entre reinicios.

## 🐳 Docker Compose

### Levantar el servicio
```bash
docker compose up -d --build
```

### Ver logs en vivo
```bash
docker compose logs -f
```

### Reiniciar
```bash
docker compose restart
```

### Detener y eliminar contenedor
```bash
docker compose down
```

### Limpiar volúmenes (atención: borra sesiones y archivos)
```bash
docker compose down -v
```
