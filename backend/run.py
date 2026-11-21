"""Entrypoint. Creates tables + seeds admin on first run, then serves the API."""
from app import create_app, db
from app.utils.seed import seed_defaults

app = create_app()

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        # Ensure columns exist on tables
        try:
            from sqlalchemy import text
            with db.engine.connect() as conn:
                try:
                    conn.execute(text("ALTER TABLE invoices ADD COLUMN authorized_signatory VARCHAR(100)"))
                    conn.commit()
                except Exception:
                    pass
                try:
                    conn.execute(text("ALTER TABLE users ADD COLUMN permissions VARCHAR(255) DEFAULT ''"))
                    conn.commit()
                except Exception:
                    pass
        except Exception:
            pass
        # Force migration trigger
        print("MIGRATION: Synchronizing database tables and default seed data...")
        seed_defaults()
    app.run(host="0.0.0.0", port=5000, debug=True)
