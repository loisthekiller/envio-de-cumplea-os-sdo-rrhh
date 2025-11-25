# ============================================
# Dockerfile para API - Sanatorio del Oeste
# Sistema de Envío de Cumpleaños
# ============================================

# ============================================
# Etapa 1: Dependencias
# ============================================
FROM node:20.11.0-alpine AS dependencies

LABEL maintainer="Sanatorio del Oeste - Sistemas"
LABEL description="Dependencias para API de envío de cumpleaños"

WORKDIR /app

# Copiar archivos de dependencias
COPY package.json package-lock.json* ./

# Instalar dependencias de producción
RUN set -eux; \
    apk add --no-cache --virtual .build-deps \
    python3 \
    make \
    g++; \
    if [ -f package-lock.json ]; then \
    npm ci --omit=dev --no-audit --no-fund; \
    else \
    npm install --omit=dev --no-audit --no-fund; \
    fi; \
    apk del .build-deps; \
    npm cache clean --force

# ============================================
# Etapa 2: Runtime
# ============================================
FROM node:20.11.0-alpine AS runtime

LABEL maintainer="Sanatorio del Oeste - Sistemas"
LABEL description="API de envío de cumpleaños - WhatsApp Business"
LABEL version="3.0.0"

# Instalar dependencias del sistema
RUN apk add --no-cache \
    wget \
    ca-certificates \
    tzdata

# Crear usuario no-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Cambiar ownership del directorio
RUN chown -R nodejs:nodejs /app

# Copiar dependencias desde etapa anterior
COPY --from=dependencies --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copiar código de la aplicación
COPY --chown=nodejs:nodejs package.json ./
COPY --chown=nodejs:nodejs src ./src

# Crear directorios necesarios con permisos correctos
RUN mkdir -p logs uploads && \
    chown -R nodejs:nodejs logs uploads

# Cambiar a usuario no-root
USER nodejs

# Variables de entorno por defecto (pueden ser sobrescritas)
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

# Exponer puerto
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Comando de inicio
CMD ["node", "src/server.js"]
