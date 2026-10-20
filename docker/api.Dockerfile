# API image: dependencies are baked in, the source is bind-mounted at runtime.
# Build context is the project root:  docker build -f docker/api.Dockerfile .
FROM node:22-alpine

WORKDIR /app

COPY server/package.json server/package-lock.json ./
RUN npm ci && sha256sum package-lock.json | cut -d' ' -f1 > /app/node_modules/.deps-hash

COPY server/tsconfig.json ./
COPY server/src ./src

COPY docker/ensure-deps.sh /usr/local/bin/ensure-deps
RUN chmod +x /usr/local/bin/ensure-deps

ENV HOST=0.0.0.0
ENV PORT=8787
ENV NODE_ENV=development
# Bind mounts on Docker Desktop do not deliver inotify events reliably.
ENV CHOKIDAR_USEPOLLING=1
ENV CHOKIDAR_INTERVAL=400

EXPOSE 8787

CMD ["ensure-deps"]
