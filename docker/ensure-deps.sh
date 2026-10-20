#!/bin/sh
# Install dependencies only when package-lock.json changed since the image build.
# node_modules lives in a named volume, so `npm ci` never touches the host tree.
set -e
cd /app

if [ ! -f package-lock.json ]; then
  exec npm run dev
fi

current="$(sha256sum package-lock.json | cut -d' ' -f1)"
stamp="/app/node_modules/.deps-hash"

if [ ! -f "$stamp" ] || [ "$(cat "$stamp")" != "$current" ]; then
  echo "Installing dependencies (package-lock.json changed)..."
  npm ci
  printf '%s' "$current" > "$stamp"
fi

exec npm run dev
