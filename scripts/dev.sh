#!/usr/bin/env bash
# Run the API and the dashboard dev servers together; Ctrl-C stops both.
#
#   scripts/dev.sh
#
# The API expects Postgres on the DSN in DATABASE_URL (the compose stack
# publishes it on 127.0.0.1:55432).

set -m

(cd server && exec npm run dev) &
api=$!
(cd web && exec npm run dev) &
web=$!

cleanup() {
  kill -TERM -"$api" 2>/dev/null
  kill -TERM -"$web" 2>/dev/null
}

trap 'cleanup; exit 0' INT TERM
trap cleanup EXIT

wait
