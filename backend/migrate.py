"""Standalone DB migration + seed script for VPS deployments.

Usage on the VPS:
    source venv/bin/activate
    python migrate.py            # create/upgrade all tables + seed admin
    python migrate.py --reset    # DROP everything and recreate (DANGEROUS)
    python migrate.py --seed-only

It uses SQLAlchemy metadata (db.create_all) so it works with a fresh MySQL
database without needing alembic revisions. Safe to re-run: create_all is
idempotent for existing tables.
"""
import sys
import pymysql
from app import create_app, db
from app.utils.seed import seed_defaults
from app.config import Config


def ensure_database_exists() -> None:
    host = Config.DB_HOST
    port = int(Config.DB_PORT)
    user = Config.DB_USER
    password = Config.DB_PASSWORD
    db_name = Config.DB_NAME

    print(f"Ensuring database `{db_name}` exists on MySQL server at {host}:{port}...")
    try:
        conn = pymysql.connect(
            host=host,
            port=port,
            user=user,
            password=password
        )
        try:
            with conn.cursor() as cursor:
                cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{db_name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
            print(f"[OK] Database `{db_name}` is ready")
        finally:
            conn.close()
    except Exception as e:
        print(f"Warning: Connection/creation of database failed: {e}")


def main() -> int:
    ensure_database_exists()
    args = set(sys.argv[1:])
    app = create_app()
    with app.app_context():
        if "--reset" in args:
            confirm = input("Type 'RESET' to drop ALL tables: ").strip()
            if confirm != "RESET":
                print("Aborted.")
                return 1
            db.drop_all()
            print("[OK] Dropped all tables")

        if "--seed-only" not in args:
            db.create_all()
            # Ensure authorized_signatory column exists on invoices table
            try:
                from sqlalchemy import text
                with db.engine.connect() as conn:
                    try:
                        conn.execute(text("ALTER TABLE invoices ADD COLUMN authorized_signatory VARCHAR(100)"))
                        conn.commit()
                        print("[OK] Added `authorized_signatory` column to `invoices` table")
                    except Exception:
                        pass
                    try:
                        conn.execute(text("ALTER TABLE users ADD COLUMN permissions VARCHAR(255) DEFAULT ''"))
                        conn.commit()
                        print("[OK] Added `permissions` column to `users` table")
                    except Exception:
                        pass
            except Exception:
                pass
            print("[OK] Tables created / verified")

        seed_defaults()
        print("[OK] Seed data ensured (admin user, defaults)")
    print("Migration complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

