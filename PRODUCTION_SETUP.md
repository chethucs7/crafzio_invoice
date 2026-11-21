# 🚀 Crafzio Invoicing & Billing System — Production VPS Deployment Guide

This guide details how to build, deploy, and host **Crafzio** on a production Linux or Windows VPS.

---

## 🚀 Deployment on Coolify Panel (Easiest)

Coolify can automatically deploy this application using either **Nixpacks** (via the created `nixpacks.toml` file) or the **Dockerfile**.

### Steps to Deploy:
1. **Create a New Resource**: In Coolify, select **New Resource** -> **Application** -> **Private Repository** (GitHub/GitLab).
2. **Select Branch**: Choose the repository branch you want to deploy.
3. **Build Pack Configuration**:
   - Coolify will automatically detect the `nixpacks.toml` file at the root.
   - Alternatively, you can change the build pack to **Dockerfile** in Coolify's general settings tab.
4. **Ports**: Ensure the destination port is set to **`5000`** in Coolify's settings (as Gunicorn/Waitress hosts the frontend and backend together on port 5000).
5. **Environment Variables**: Go to the **Environment Variables** tab in Coolify and configure the following production secrets:
   ```env
   SECRET_KEY="your-strong-production-secret-key"
   JWT_SECRET_KEY="your-strong-production-jwt-secret-key"
   DB_USER="invoice"
   DB_PASSWORD="your-normal-user-password"
   DB_HOST="mysql-internal-url-from-coolify"
   DB_PORT="3306"
   DB_NAME="invoice"
   FLASK_ENV="production"
   ```
6. **Deploy**: Click **Deploy** in the Coolify dashboard. The panel will compile the frontend Vite assets, prepare the Python backend container, run migrations, and serve the application with a public domain URL automatically.

---

## 🛠️ Option 1: Docker Deployment (Recommended)
Docker is the cleanest, easiest way to run the entire stack (built React frontend + Waitress Python backend) inside a single container on port `5000`.

### 1. Build the Docker Image
From the root of your project directory, build the image:
```bash
docker build -t crafzio-app .
```

### 2. Run the Container
Launch the container and map port `5000`. Provide environment secrets:
```bash
docker run -d \
  -p 5000:5000 \
  --name crafzio \
  -e SECRET_KEY="your-strong-secret-key" \
  -e JWT_SECRET_KEY="your-strong-jwt-secret-key" \
  -e DB_USER="root" \
  -e DB_PASSWORD="yourdbpassword" \
  -e DB_HOST="your-mysql-vps-ip-or-host" \
  -e DB_NAME="invoicedb" \
  crafzio-app
```

---

## 🛠️ Option 2: Manual VPS Deployment (Gunicorn + Nginx)
Use this option to host the API using a WSGI server (Gunicorn) and serve the frontend static bundle directly via Nginx.

### 📋 Prerequisites (Ubuntu VPS)
```bash
sudo apt update
sudo apt install python3-pip python3-venv nginx mysql-server -y
```

### 1. Database Setup
Create the MySQL database and user:
```sql
CREATE DATABASE invoicedb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'crafzio_user'@'localhost' IDENTIFIED BY 'secure_password';
GRANT ALL PRIVILEGES ON invoicedb.* TO 'crafzio_user'@'localhost';
FLUSH PRIVILEGES;
```

### 2. Backend Setup
1. Clone the files to your server (e.g., `/var/www/crafzio`).
2. Create a virtual environment and install packages:
   ```bash
   cd /var/www/crafzio/backend
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```
3. Set up environment variables in a `/var/www/crafzio/backend/.env` file:
   ```env
   SECRET_KEY="production-secret-key"
   JWT_SECRET_KEY="jwt-production-secret-key"
   DB_USER="crafzio_user"
   DB_PASSWORD="secure_password"
   DB_HOST="localhost"
   DB_NAME="invoicedb"
   FLASK_ENV="production"
   ```
4. Run migrations:
   ```bash
   python3 migrate.py
   ```

### 3. Create Backend Systemd Service
Create a system service file `/etc/systemd/system/crafzio-backend.service`:
```ini
[Unit]
Description=Crafzio Backend Invoicing API
After=network.target

[Service]
User=www-data
WorkingDirectory=/var/www/crafzio/backend
EnvironmentFile=/var/www/crafzio/backend/.env
ExecStart=/var/www/crafzio/backend/venv/bin/gunicorn --workers 3 --bind 127.0.0.1:5000 wsgi:application

[Install]
WantedBy=multi-match.target
```
Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable crafzio-backend
sudo systemctl start crafzio-backend
```

### 4. Build Frontend
1. On your local machine or build server:
   ```bash
   npm install
   npm run build
   ```
2. Upload the `dist/` build directory to your VPS at `/var/www/crafzio/frontend/dist`.

### 5. Nginx Configuration
Create an Nginx configuration file `/etc/nginx/sites-available/crafzio`:
```nginx
server {
    listen 80;
    server_name yourdomain.com; # Replace with your domain or IP address

    # Frontend SPA files
    location / {
        root /var/www/crafzio/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Static assets uploaded through backend (Company logo, etc.)
    location /static/ {
        alias /var/www/crafzio/backend/app/static/;
    }

    # API routes forward to Gunicorn WSGI
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
Enable site and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/crafzio /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 🔒 Security Recommendations
1. **SSL Encryption**: Add HTTPS using Let's Encrypt (Certbot):
   ```bash
   sudo apt install certbot python3-certbot-nginx -y
   sudo certbot --nginx -d yourdomain.com
   ```
2. **Firewall Rules**: Lock down unused ports:
   ```bash
   sudo ufw allow 'Nginx Full'
   sudo ufw enable
   ```
