"""Flask application factory."""
import os
import logging
from flask import Flask, jsonify, request
from .config import Config
from .extensions import db, migrate, jwt, cors, mail, limiter


def create_app(config_class: type = Config) -> Flask:
    app = Flask(__name__, static_folder="static", static_url_path="/static")
    app.config.from_object(config_class)

    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    # ---------- Production safety checks ----------
    if os.getenv("FLASK_ENV", "development") == "production":
        weak = []
        if app.config["SECRET_KEY"] in ("dev-secret", "", None):
            weak.append("SECRET_KEY")
        if app.config["JWT_SECRET_KEY"] in ("dev-jwt-secret", "", None):
            weak.append("JWT_SECRET_KEY")
        if weak:
            raise RuntimeError(f"Refusing to start: weak/default secrets in production: {weak}")
        if "*" in app.config["CORS_ORIGINS"]:
            raise RuntimeError("Refusing to start: CORS_ORIGINS='*' is not allowed in production")

    # ---------- Init extensions ----------
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    mail.init_app(app)
    limiter.init_app(app)
    cors.init_app(
        app,
        resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}},
        supports_credentials=True,
        expose_headers=["Content-Disposition"],
        max_age=600,
    )

    # ---------- Security headers ----------
    @app.after_request
    def _security_headers(resp):
        resp.headers.setdefault("X-Content-Type-Options", "nosniff")
        resp.headers.setdefault("X-Frame-Options", "DENY")
        resp.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        resp.headers.setdefault("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
        resp.headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        if request.is_secure or os.getenv("FORCE_HSTS", "false").lower() == "true":
            resp.headers.setdefault(
                "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
            )
        return resp

    # ---------- Reject oversized JSON bodies early ----------
    @app.before_request
    def _reject_huge_json():
        cl = request.content_length or 0
        if cl and cl > app.config["MAX_CONTENT_LENGTH"]:
            return jsonify(error="payload_too_large"), 413

    # Register models so SQLAlchemy sees them
    from .models import (  # noqa: F401
        user, client, service, category, project,
        quotation, invoice, payment, company, smtp,
        activity, notification, tax,
    )

    # Blueprints
    from .routes.auth import bp as auth_bp
    from .routes.dashboard import bp as dashboard_bp
    from .routes.clients import bp as clients_bp
    from .routes.services import bp as services_bp
    from .routes.categories import bp as categories_bp
    from .routes.projects import bp as projects_bp
    from .routes.quotations import bp as quotations_bp
    from .routes.invoices import bp as invoices_bp
    from .routes.payments import bp as payments_bp
    from .routes.company import bp as company_bp
    from .routes.smtp import bp as smtp_bp
    from .routes.users import bp as users_bp
    from .routes.reports import bp as reports_bp
    from .routes.activity import bp as activity_bp
    from .routes.notifications import bp as notifications_bp

    for bp in (
        auth_bp, dashboard_bp, clients_bp, services_bp, categories_bp,
        projects_bp, quotations_bp, invoices_bp, payments_bp, company_bp,
        smtp_bp, users_bp, reports_bp, activity_bp, notifications_bp,
    ):
        prefix = f"/api{bp.url_prefix}" if bp.url_prefix else "/api"
        app.register_blueprint(bp, url_prefix=prefix)

    # JWT error handlers -> consistent JSON
    @jwt.unauthorized_loader
    def _missing(_msg):
        return jsonify(error="missing_token"), 401

    @jwt.invalid_token_loader
    def _invalid(_msg):
        return jsonify(error="invalid_token"), 401

    @jwt.expired_token_loader
    def _expired(_h, _p):
        return jsonify(error="token_expired"), 401

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    @app.errorhandler(404)
    def not_found(_e):
        return jsonify(error="not_found"), 404

    @app.errorhandler(400)
    def bad_request(e):
        return jsonify(error="bad_request", message=str(e.description)), 400

    @app.errorhandler(413)
    def too_large(_e):
        return jsonify(error="payload_too_large"), 413

    @app.errorhandler(429)
    def rate_limited(e):
        return jsonify(error="rate_limited", message=str(e.description)), 429

    @app.errorhandler(500)
    def server_error(e):  # pragma: no cover
        app.logger.exception(e)
        return jsonify(error="server_error"), 500

    # ---------- SPA Frontend Fallback Server ----------
    # Serves the compiled index.html for unmatched client-side routes in production
    dist_dir = os.path.join(app.root_path, "static", "dist")
    
    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def catch_all(path):
        # Ignore API calls so they fall through to 404 handler
        if path.startswith("api/") or path.startswith("api"):
            return jsonify(error="not_found"), 404
            
        # Try serving the physical file from the dist directory (js, css, images, etc.)
        file_path = os.path.join(dist_dir, path)
        if path and os.path.exists(file_path):
            from flask import send_from_directory
            return send_from_directory(dist_dir, path)
            
        # Fallback to index.html for single-page application routing
        if os.path.exists(os.path.join(dist_dir, "index.html")):
            from flask import send_file
            return send_file(os.path.join(dist_dir, "index.html"))
            
        return jsonify(error="not_found"), 404

    if not app.debug:
        logging.basicConfig(level=logging.INFO)

    return app
