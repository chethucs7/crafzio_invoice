#!/usr/bin/env bash
# One-shot deploy / update script for the Crafzio backend on a Debian/Ubuntu VPS.
# Run from the backend/ directory as a user with sudo access.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/crafzio/backend}"
SERVICE="${SERVICE:-crafzio-api}"

echo "==> Ensuring app dir: $APP_DIR"
sudo mkdir -p "$APP_DIR"
sudo chown -R "$USER:$USER" "$APP_DIR"

echo "==> Syncing code"
rsync -av --delete \
    --exclude venv --exclude __pycache__ --exclude '*.pyc' \
    --exclude '.env' --exclude 'app/static/uploads' \
    ./ "$APP_DIR/"

cd "$APP_DIR"

echo "==> Python venv"
if [ ! -d venv ]; then
    python3 -m venv venv
fi
./venv/bin/pip install --upgrade pip wheel
./venv/bin/pip install -r requirements.txt gunicorn

echo "==> Checking .env"
if [ ! -f .env ]; then
    echo "!! No .env found. Copy .env.production.example -> .env and edit before restart."
    exit 1
fi

echo "==> Running migrations"
set -a; . ./.env; set +a
./venv/bin/python migrate.py

echo "==> Installing systemd unit"
sudo cp deploy/crafzio-api.service "/etc/systemd/system/${SERVICE}.service"
sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE"
sudo systemctl restart "$SERVICE"

sudo chown -R www-data:www-data "$APP_DIR/app/static"

echo "==> Status"
sudo systemctl --no-pager status "$SERVICE" | head -n 15

echo "✓ Deploy complete. Check: journalctl -u ${SERVICE} -f"
