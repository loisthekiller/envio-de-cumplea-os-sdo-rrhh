# Etapa 1: Dependencias
FROM node:18-alpine AS deps
WORKDIR /app
# Instalar dependencias solo si cambian los manifests
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Etapa 2: Runtime
FROM node:18-alpine
WORKDIR /app
ENV NODE_ENV=production \
    TZ=America/Argentina/Buenos_Aires

# Crear directorios necesarios
RUN mkdir -p logs uploads src/baileys_auth static views

# Copiar sólo lo necesario
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY views ./views
COPY static ./static
COPY foto.png ./

# Exponer puerto configurado (default 3000)
EXPOSE 3000

# Healthcheck simple (si responde la raíz)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

# Volúmenes para datos que no queremos en la imagen final
VOLUME ["/app/uploads", "/app/src/baileys_auth", "/app/logs"]

# Comando
CMD ["node", "src/server.js"]
