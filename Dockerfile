# ==========================================================
# Multi-stage Dockerfile for Crafzio Invoicing System
# ==========================================================

# --- Stage 1: Build the frontend ---
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package.json bun.lock tsconfig.json vite.config.ts components.json ./
COPY src ./src
COPY public ./public
RUN npm install
RUN npm run build

# --- Stage 2: Build & run the Python backend ---
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies (needed for cryptography and pillow)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libffi-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy backend application
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./

# Copy built frontend static assets into the backend static folder
# so that Flask can serve both the API and the SPA interface together!
COPY --from=frontend-builder /app/dist ./app/static/dist

# Expose server port
EXPOSE 5000

# Start Flask with Waitress production server
CMD ["python", "wsgi.py"]
