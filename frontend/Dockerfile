# ── Etapa 1: build (Vite) ──────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Empaquetamos con Vite directamente (esbuild). El type-check (tsc -b) se deja
# para CI/dev: no debe bloquear la construcción de la imagen de producción.
RUN npx vite build

# ── Etapa 2: servir estáticos con nginx ─────────────────────────────────────────
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
