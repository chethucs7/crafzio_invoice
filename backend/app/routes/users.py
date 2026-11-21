from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models.user import User, Role
from ..utils.auth import role_required, current_user
from ..utils.mailer import send_email

bp = Blueprint("users", __name__, url_prefix="/users")


@bp.get("")
@role_required("admin", "manager")
def list_users():
    return jsonify(data=[u.to_dict() for u in User.query.order_by(User.created_at.desc()).all()])


@bp.get("/roles")
@jwt_required()
def list_roles():
    return jsonify(data=[{"id": r.id, "name": r.name} for r in Role.query.all()])


@bp.post("")
@role_required("admin")
def create_user():
    data = request.get_json() or {}
    email = data.get("email", "").lower().strip()
    if not email:
        return jsonify(error="email_required"), 400
    if User.query.filter_by(email=email).first():
        return jsonify(error="email_exists"), 400

    role = Role.query.get(data["role_id"])
    if not role:
        return jsonify(error="invalid_role_id"), 400

    password = data.get("password") or "Password@123"

    u = User(
        name=data["name"],
        email=email,
        phone=data.get("phone"),
        role_id=data["role_id"],
        is_active=data.get("is_active", True),
        permissions=data.get("permissions", "")
    )
    u.set_password(password)
    db.session.add(u)
    db.session.commit()

    # Send credential email
    subject = "Welcome to Crafzio — Your Account Credentials"
    html = f"""
    <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px">
      <h2 style="color:#0f172a;margin-bottom:16px">Welcome to Crafzio</h2>
      <p>Hello <b>{u.name}</b>,</p>
      <p>An administrator has created a <b>{role.name}</b> account for you. Here are your login details:</p>
      <div style="background:#f8fafc;padding:16px;border-radius:8px;margin:16px 0">
        <p style="margin:4px 0"><b>Email:</b> {u.email}</p>
        <p style="margin:4px 0"><b>Temporary Password:</b> <code style="background:#e2e8f0;padding:2px 4px;border-radius:4px">{password}</code></p>
      </div>
      <p>Please change your password immediately after logging in.</p>
      <hr style="border:0;border-top:1px solid #e2e8f0;margin:24px 0" />
      <p style="font-size:12px;color:#64748b">This email was sent automatically. Please do not reply.</p>
    </div>
    """
    send_email(u.email, subject, html, template="welcome")

    return jsonify(u.to_dict()), 201


@bp.put("/<int:uid>")
@role_required("admin")
def update_user(uid):
    u = User.query.get_or_404(uid)
    data = request.get_json() or {}
    for k in ("name", "email", "phone", "role_id", "is_active", "permissions"):
        if k in data:
            setattr(u, k, data[k].lower() if k == "email" else data[k])
    if data.get("password"):
        u.set_password(data["password"])
    db.session.commit()
    return jsonify(u.to_dict())


@bp.delete("/<int:uid>")
@role_required("admin")
def delete_user(uid):
    u = User.query.get_or_404(uid)
    # Don't allow self deletion
    if u.id == int(get_jwt_identity()):
        return jsonify(error="cannot_delete_self"), 400
    db.session.delete(u)
    db.session.commit()
    return jsonify(ok=True)


@bp.post("/change-password")
@jwt_required()
def change_password():
    """Change logged-in user's password."""
    data = request.get_json() or {}
    old = data.get("current_password")
    new = data.get("new_password")
    if not old or not new:
        return jsonify(error="current_and_new_password_required"), 400
    u = User.query.get(int(get_jwt_identity()))
    if not u or not u.check_password(old):
        return jsonify(error="invalid_current_password"), 400
    u.set_password(new)
    db.session.commit()
    return jsonify(ok=True)


@bp.post("/<int:uid>/reset-password")
@role_required("admin")
def reset_user_password(uid):
    """Admin resets a staff member's password and emails it to them."""
    u = User.query.get_or_404(uid)
    data = request.get_json() or {}
    new_pw = data.get("password")
    if not new_pw:
        return jsonify(error="password_required"), 400

    u.set_password(new_pw)
    db.session.commit()

    # Send email notification
    subject = "Crafzio — Your Password Has Been Reset"
    html = f"""
    <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px">
      <h2 style="color:#0f172a;margin-bottom:16px">Password Reset Notification</h2>
      <p>Hello <b>{u.name}</b>,</p>
      <p>An administrator has reset the password for your account on Crafzio.</p>
      <div style="background:#f8fafc;padding:16px;border-radius:8px;margin:16px 0">
        <p style="margin:4px 0"><b>Email:</b> {u.email}</p>
        <p style="margin:4px 0"><b>New Password:</b> <code style="background:#e2e8f0;padding:2px 4px;border-radius:4px">{new_pw}</code></p>
      </div>
      <p>Please log in and update your password immediately.</p>
      <hr style="border:0;border-top:1px solid #e2e8f0;margin:24px 0" />
      <p style="font-size:12px;color:#64748b">This email was sent automatically. Please do not reply.</p>
    </div>
    """
    send_email(u.email, subject, html, template="password_reset")

    return jsonify(ok=True)
