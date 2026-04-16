# syntax=docker/dockerfile:1.7
# ---------- Stage 1: build ----------
FROM node:20-bookworm-slim AS builder
WORKDIR /app
ARG VITE_API_URL
ARG VITE_WS_URL
ARG VITE_TILES_URL
ARG VITE_GEOSERVER_URL
ENV VITE_API_URL=$VITE_API_URL \
    VITE_WS_URL=$VITE_WS_URL \
    VITE_TILES_URL=$VITE_TILES_URL \
    VITE_GEOSERVER_URL=$VITE_GEOSERVER_URL
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .
RUN npm run build

# ---------- Stage 2: runtime (Nginx estático) ----------
FROM nginx:1.27-alpine AS runtime
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
