# syntax=docker/dockerfile:1
# HomeRecord Flask app container

FROM python:3.11-slim AS base

# Prevent Python from writing pyc files and enable stdout flushing
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    FLASK_ENV=production

# Set workdir to the repository root
WORKDIR /app

# Install OS packages (if needed later, keep minimal)
RUN apt-get update -y && apt-get install -y --no-install-recommends \
    build-essential \
 && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better layer caching
COPY app/requirements.txt ./app/requirements.txt

# Install Python dependencies (include gunicorn)
RUN pip install --no-cache-dir -r ./app/requirements.txt gunicorn

# Copy application source
COPY app ./app

# Create runtime directories (DB, uploads)
RUN mkdir -p ./app/instance \
    && mkdir -p ./app/static/uploads/task_images

# Expose service port
EXPOSE 5050

# Default environment (override in production using -e SECRET_KEY=...)
ENV SECRET_KEY="change-me-in-production"

# Copy and use entrypoint to run migration before boot
COPY app/docker-entrypoint.sh ./app/docker-entrypoint.sh
RUN chmod +x ./app/docker-entrypoint.sh

# Run with entrypoint (runs migration, then Gunicorn)
WORKDIR /app/app
ENTRYPOINT ["/app/app/../app/docker-entrypoint.sh"]