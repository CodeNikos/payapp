#!/bin/bash
set -euo pipefail

export PYTHONUNBUFFERED=1
export PYTHONPATH="${PYTHONPATH:-}:$(pwd)/backend"

PORT="${PORT:-80}"

echo "=== PayApp start ==="
echo "Working directory: $(pwd)"
echo "Python: $(python3 --version 2>/dev/null || python --version)"
echo "PORT=${PORT}"
echo "DB_HOST=${DB_HOST:-<unset>}"
echo "DB_NAME=${DB_NAME:-<unset>}"
echo "DB_PORT=${DB_PORT:-<unset>}"
echo "ALLOWED_HOSTS=${ALLOWED_HOSTS:-<unset>}"

cd backend

echo "=== Running seed.py ==="
if ! python -u seed.py; then
  echo "ERROR: seed.py falló. Revisa DB_HOST/DB_USER/DB_PASSWORD/DB_NAME y que la base esté asignada a la app."
  exit 1
fi

echo "=== Starting uvicorn on 0.0.0.0:${PORT} ==="
exec python -u -m uvicorn app.main:app --host 0.0.0.0 --port "${PORT}"
