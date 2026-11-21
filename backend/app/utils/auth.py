"""Role-based access decorators."""
from functools import wraps
from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
from ..models.user import User


def _uid():
    raw = get_jwt_identity()
    try:
        return int(raw) if raw is not None else None
    except (TypeError, ValueError):
        return None


def role_required(*roles):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            user = User.query.get(_uid())
            if not user or not user.is_active:
                return jsonify(error="unauthorized"), 401
            if roles and (not user.role or user.role.name not in roles):
                return jsonify(error="forbidden"), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def current_user() -> User | None:
    uid = _uid()
    return User.query.get(uid) if uid else None
