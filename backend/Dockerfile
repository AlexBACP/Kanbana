# ── Etapa 1: build ────────────────────────────────────────────────────────────
FROM node:20-slim AS build
WORKDIR /app
# Dependencias (incluye dev: necesitamos @nestjs/cli para compilar)
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Etapa 2: runtime ───────────────────────────────────────────────────────────
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Solo dependencias de producción
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
# Artefacto compilado
COPY --from=build /app/dist ./dist
# Carpetas de uploads (main.ts también las crea al arrancar)
RUN mkdir -p uploads/avatars uploads/attachments uploads/banners
EXPOSE 3000
CMD ["node", "dist/main.js"]
