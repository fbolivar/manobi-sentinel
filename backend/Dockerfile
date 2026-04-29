# syntax=docker/dockerfile:1.7
# ---------- Stage 1: build ----------
FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm install --legacy-peer-deps
COPY . .
ARG SKIP_TESTS=0
RUN if [ "$SKIP_TESTS" = "1" ]; then echo "Skipping tests"; else npm test -- --ci --passWithNoTests; fi
RUN npm run build && npm prune --omit=dev --legacy-peer-deps
RUN cp src/reportes/generators/logo-base64.txt dist/reportes/generators/ 2>/dev/null || true

# ---------- Stage 2: runtime ----------
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends wget ca-certificates gnupg lsb-release dumb-init tini chromium fonts-liberation tar gzip \
 && install -d /usr/share/postgresql-common/pgdg \
 && wget -O /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc \
 && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends postgresql-client-16 \
 && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
RUN useradd -m -u 1001 nest && chown -R nest:nest /app
USER nest
EXPOSE 3000
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/main.js"]
