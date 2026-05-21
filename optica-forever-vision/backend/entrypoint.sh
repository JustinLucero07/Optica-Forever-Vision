#!/bin/bash
set -e

echo "▶ Corriendo migraciones Alembic..."
alembic upgrade head

echo "▶ Iniciando servidor..."
exec "$@"
