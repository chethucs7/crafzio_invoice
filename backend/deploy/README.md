# Crafzio Backend – Production VPS Deployment

Target: Ubuntu 22.04 / Debian 12 VPS with MySQL 8, Nginx, and Python 3.11+.

## 1. Server prerequisites (one time)

```bash
sudo apt update && sudo apt install -y \
    python3 python3-venv python3-pip \
    mysql-server nginx certbot python3-certbot-nginx \
    build-essential libssl-dev libffi-dev pkg-config \
    default-libmysqlclient-dev rsync
```

## 2. Create MySQL database & user

```bash
sudo mysql <<'SQL'
CREATE DATABASE crafzio CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'crafzio'@'localhost' IDENTIFIED BY 'STRONG_PASSWORD_HERE';
GRANT ALL PRIVILEGES ON crafzio.* TO 'crafzio'@'localhost';
FLUSH PRIVILEGES;
SQL
```

## 3. First deploy

From your local machine, in the `backend/` folder:

```bash
# Push code to the VPS (or clone your git repo on the VPS instead)
rsync -av --exclude venv --exclude __pycache__ ./ user@vps:/tmp/crafzio-backend/

# On the VPS
ssh user@vps
sudo mkdir -p /var/www/crafzio && sudo chown -R $USER:$USER /var/www/crafzio
cp -r /tmp/crafzio-backend /var/www/crafzio/backend
cd /var/www/crafzio/backend

# Configure secrets
cp .env.production.example .env
nano .env    # fill in DB, SECRET_KEY, JWT_SECRET_KEY, SMTP, CORS_ORIGINS

# Run deploy script (creates venv, installs deps, migrates, installs systemd unit)
bash deploy/deploy.sh
```

Generate strong secrets:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(64))"
```

## 4. Nginx + HTTPS

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/crafzio
sudo sed -i 's/api.yourdomain.com/api.YOURDOMAIN.com/g' /etc/nginx/sites-available/crafzio
sudo ln -sf /etc/nginx/sites-available/crafzio /etc/nginx/sites-enabled/crafzio
sudo nginx -t && sudo systemctl reload nginx

sudo certbot --nginx -d api.YOURDOMAIN.com
```

## 5. Verify

```bash
curl https://api.YOURDOMAIN.com/api/health
# -> {"status":"ok"}

sudo systemctl status crafzio-api
sudo journalctl -u crafzio-api -f
```

## 6. Point the frontend at the VPS

In the React app, set the API base URL to `https://api.YOURDOMAIN.com/api`
(via `.env` -> `VITE_API_URL`) and rebuild.

Also add the frontend origin(s) to `CORS_ORIGINS` in the backend `.env`
and restart: `sudo systemctl restart crafzio-api`.

## 7. Updates / redeploys

From local backend/ folder:

```bash
rsync -av --exclude venv --exclude .env ./ user@vps:/var/www/crafzio/backend/
ssh user@vps 'cd /var/www/crafzio/backend && bash deploy/deploy.sh'
```

`deploy.sh` re-runs `migrate.py`, which is idempotent — it will add new tables
without touching existing data. For destructive resets use `python migrate.py --reset`.

## 8. Backups (recommended)

```bash
# /etc/cron.daily/crafzio-db-backup
mysqldump --single-transaction crafzio | gzip > /var/backups/crafzio-$(date +\%F).sql.gz
find /var/backups -name 'crafzio-*.sql.gz' -mtime +14 -delete
```

## Security checklist

- [ ] `FLASK_ENV=production` and unique `SECRET_KEY` / `JWT_SECRET_KEY`
- [ ] `CORS_ORIGINS` set to explicit frontend domains (no `*`)
- [ ] Default admin password changed after first login
- [ ] HTTPS via certbot, `FORCE_HSTS=true`
- [ ] UFW: `sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable`
- [ ] MySQL user restricted to `localhost`
- [ ] Daily DB backups configured
