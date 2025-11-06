#!/usr/bin/env bash
set -euo pipefail

# Ensure we are in the app directory
cd /app/app

echo "[entrypoint] Running DB migration before app boot..."
python script/run_migration.py

echo "[entrypoint] Starting Gunicorn..."
exec gunicorn -w "${GUNICORN_WORKERS:-2}" -b 0.0.0.0:5050 app:app