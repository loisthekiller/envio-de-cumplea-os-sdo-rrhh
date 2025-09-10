# Etapa 1: Dependencias (usar Node 20 por requisitos de algunas libs)
FROM node:20-alpine AS deps
WORKDIR /app
# Copiar manifests (lock puede no existir en algunos casos)
COPY package.json ./
COPY package-lock.json* ./
# Intentar instalación limpia; si el lock no coincide o falta, usar npm install como fallback
RUN set -eux; \
    if [ -f package-lock.json ]; then \
      echo "Usando npm ci"; \
      (npm ci --omit=dev || (echo 'Fallo npm ci, usando npm install' && npm install --omit=dev)); \
    else \
      echo "No hay package-lock.json, usando npm install"; \
      npm install --omit=dev; \
    fi;

# Etapa 2: Runtime minimal
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production \
    TZ=America/Argentina/Buenos_Aires

# Crear directorios necesarios
RUN mkdir -p logs uploads baileys_auth static views

# Copiar sólo lo necesario
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY views ./views
COPY static ./static
# Copiar imágenes disponibles. Si sólo existe foto-ok.png, la duplicamos como foto.png para compatibilidad.
COPY foto-ok.png* ./
COPY foto.png* ./
RUN if [ ! -f foto.png ] && [ -f foto-ok.png ]; then cp foto-ok.png foto.png; fi || true

# Exponer puerto configurado (default 3000)
EXPOSE 3000

# Healthcheck simple (si responde la raíz)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

# Volúmenes para datos que no queremos en la imagen final
VOLUME ["/app/uploads", "/app/baileys_auth", "/app/logs"]

# Comando
CMD ["node", "src/server.js"]
