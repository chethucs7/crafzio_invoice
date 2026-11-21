from datetime import datetime, timedelta
import secrets
from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token, create_refresh_token, jwt_required, get_jwt_identity,
)
from ..extensions import db, limiter
from ..models.user import User
from ..utils.activity import log_activity
from ..utils.mailer import send_email

bp = Blueprint("auth", __name__, url_prefix="/auth")


@bp.post("/login")
@limiter.limit("10 per minute; 60 per hour")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    if not email or not password or len(email) > 255 or len(password) > 256:
        return jsonify(error="invalid_credentials"), 401
    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password) or not user.is_active:
        return jsonify(error="invalid_credentials"), 401
    access = create_access_token(identity=str(user.id))
    refresh = create_refresh_token(identity=str(user.id))
    log_activity(user.id, "login", "user", user.id)
    return jsonify(access_token=access, refresh_token=refresh, user=user.to_dict())


@bp.post("/refresh")
@jwt_required(refresh=True)
def refresh():
    uid = get_jwt_identity()
    return jsonify(access_token=create_access_token(identity=uid))


@bp.post("/logout")
@jwt_required()
def logout():
    log_activity(int(get_jwt_identity()), "logout", "user")
    return jsonify(ok=True)


@bp.get("/me")
@jwt_required()
def me():
    user = User.query.get(int(get_jwt_identity()))
    return jsonify(user.to_dict()) if user else (jsonify(error="not_found"), 404)


@bp.put("/me")
@jwt_required()
def update_me():
    user = User.query.get(int(get_jwt_identity()))
    if not user:
        return jsonify(error="not_found"), 404
    data = request.get_json() or {}
    for f in ("name", "phone", "avatar"):
        if f in data:
            setattr(user, f, data[f])
    db.session.commit()
    return jsonify(user.to_dict())


@bp.post("/change-password")
@jwt_required()
def change_password():
    user = User.query.get(int(get_jwt_identity()))
    data = request.get_json() or {}
    if not user or not user.check_password(data.get("current_password", "")):
        return jsonify(error="invalid_current_password"), 400
    new = data.get("new_password", "")
    if len(new) < 8:
        return jsonify(error="password_too_short"), 400
    user.set_password(new)
    db.session.commit()
    log_activity(user.id, "change_password", "user", user.id)
    return jsonify(ok=True)


@bp.post("/forgot-password")
@limiter.limit("5 per hour")
def forgot_password():
    data = request.get_json() or {}
    email = (data.get("email") or "").lower()
    user = User.query.filter_by(email=email).first()
    if user:
        user.reset_token = secrets.token_urlsafe(32)
        user.reset_token_expiry = datetime.utcnow() + timedelta(hours=1)
        db.session.commit()
        reset_url = f"{data.get('frontend_url', 'http://localhost:8080')}/auth/reset?token={user.reset_token}"
        send_email(user.email, "Reset your password",
                   f"<p>Click the link to reset your password:</p><p><a href='{reset_url}'>{reset_url}</a></p>",
                   template="password_reset")
    return jsonify(ok=True)


@bp.post("/reset-password")
@limiter.limit("10 per hour")
def reset_password():
    data = request.get_json() or {}
    token = data.get("token")
    new = data.get("new_password", "")
    user = User.query.filter_by(reset_token=token).first()
    if not user or not user.reset_token_expiry or user.reset_token_expiry < datetime.utcnow():
        return jsonify(error="invalid_or_expired_token"), 400
    if len(new) < 8:
        return jsonify(error="password_too_short"), 400
    user.set_password(new)
    user.reset_token = None
    user.reset_token_expiry = None
    db.session.commit()
    return jsonify(ok=True)


@bp.get("/debug-smtp")
def debug_smtp():
    from ..models.smtp import SmtpSettings, EmailLog
    settings = SmtpSettings.query.first()
    if settings:
        settings.enabled = True
        db.session.commit()
    logs = EmailLog.query.order_by(EmailLog.created_at.desc()).limit(10).all()
    
    settings_dict = {}
    if settings:
        settings_dict = {
            "host": settings.host,
            "port": settings.port,
            "username": settings.username,
            "from_email": settings.from_email,
            "from_name": settings.from_name,
            "use_tls": settings.use_tls,
            "use_ssl": settings.use_ssl,
            "enabled": settings.enabled,
        }
        
    return jsonify({
        "settings": settings_dict,
        "logs": [r.to_dict() for r in logs]
    })
