# Invoice Management System — Flask + MySQL Backend

Production-ready REST API for the Professional Invoice & Client Management System.

## Stack
- Python 3.10+
- Flask 3 + Flask-SQLAlchemy + Flask-Migrate + Flask-JWT-Extended + Flask-CORS + Flask-Mail
- MySQL 8 (via PyMySQL)
- ReportLab (PDF generation)
- bcrypt (password hashing)

## Quick start

```bash
cd backend
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # fill DB + JWT + SMTP creds
# create the MySQL database once:
mysql -u root -p -e "CREATE DATABASE invoicedb CHARACTER SET utf8mb4;"
flask --app run.py db upgrade   # or: python run.py  (auto-creates tables + seeds admin)
python run.py
```

API served at `http://localhost:5000/api`.

Default admin (auto-seeded on first run):
- email: `admin@example.com`
- password: `Admin@123`

## Project layout

```
backend/
├── app/
│   ├── __init__.py          # Flask factory, extension init
│   ├── config.py
│   ├── extensions.py
│   ├── models/              # SQLAlchemy models (one file per domain)
│   ├── routes/              # Blueprints (auth, clients, invoices, ...)
│   ├── utils/               # PDF, email, JWT, decorators
│   └── templates/email/     # HTML email templates
├── run.py                   # entry point
├── requirements.txt
└── .env.example
```

## API

All endpoints under `/api`. JWT bearer token required except `/api/auth/login`
and `/api/auth/forgot-password`.

Modules: `auth`, `dashboard`, `clients`, `services`, `categories`, `projects`,
`quotations`, `invoices`, `payments`, `company`, `smtp`, `users`, `reports`,
`activity`, `notifications`.

Full route list: `GET /api/routes` (dev only).

## Frontend

The React frontend (deployed on Lovable) expects this API at the URL set in
its `VITE_API_URL` env var. Default: `http://localhost:5000/api`. Make sure
CORS `CORS_ORIGINS` in `.env` includes your frontend URL.
