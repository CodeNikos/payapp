#!/bin/bash
echo "=== PayApp start ==="
export PYTHONUNBUFFERED=1
PORT="${PORT:-80}"
echo "cwd=$(pwd) PORT=$PORT DB_HOST=${DB_HOST:-unset}"

cd backend || exit 1

# Arranque inmediato para el healthcheck de Seenode.
# Migraciones + admin se hacen en el startup de FastAPI (app/main.py).
echo "=== uvicorn 0.0.0.0:${PORT} ==="
exec python -u -m uvicorn app.main:app --host 0.0.0.0 --port "${PORT}"
