#!/usr/bin/env bash
# Control the local Homebrew PostgreSQL used in development.
# Usage: npm run pg -- start|stop|status|psql [psql args...]
set -euo pipefail

FORMULA="postgresql@18"
BIN="/opt/homebrew/opt/$FORMULA/bin"   # keg-only: not on PATH by default

cmd="${1:-status}"
shift || true

case "$cmd" in
  start)  brew services run "$FORMULA" ;;    # run now, do NOT register at login
  stop)   brew services stop "$FORMULA" ;;
  status) "$BIN/pg_isready" -h 127.0.0.1 -p 5432 ;;
  psql)   exec "$BIN/psql" "$@" ;;
  *)      echo "usage: $0 start|stop|status|psql [args]" >&2; exit 64 ;;
esac
