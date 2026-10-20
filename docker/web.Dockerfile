# Dashboard image: dependencies are baked in, the source is bind-mounted at runtime.
# Build context is the project root:  docker build -f docker/web.Dockerfile .
FROM node:22-alpine

WORKDIR /app

COPY web/package.json web/package-lock.json ./
RUN npm ci && sha256sum package-lock.json | cut -d' ' -f1 > /app/node_modules/.deps-hash

COPY web/index.html web/tsconfig.json web/tsconfig.app.json web/tsconfig.node.json web/vite.config.ts ./
COPY web/public ./public
COPY web/src ./src

COPY docker/ensure-deps.sh /usr/local/bin/ensure-deps
RUN chmod +x /usr/local/bin/ensure-deps

ENV VITE_HOST=0.0.0.0
ENV VITE_PORT=5173
# Bind mounts on Docker Desktop do not deliver inotify events reliably.
ENV VITE_POLLING=1

EXPOSE 5173

CMD ["ensure-deps"]
