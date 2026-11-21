"""WSGI Entrypoint for Gunicorn or Waitress production hosting."""
from app import create_app, db
from app.utils.seed import seed_defaults
from sqlalchemy import text

app = create_app()

with app.app_context():
    # Ensure database schema is built
    db.create_all()
    # Migrate table updates dynamically if missing
    try:
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
    seed_defaults()

if __name__ == "__main__":
    # If run directly as a python script, use Waitress to host the API on port 5000
    from waitress import serve
    print("Serving Crafzio API via Waitress on port 5000...")
    serve(app, host="0.0.0.0", port=5000)
else:
    # Exposed application object for Gunicorn
    application = app
