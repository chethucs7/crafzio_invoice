from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models.notification import Notification

bp = Blueprint("notifications", __name__, url_prefix="/notifications")


@bp.get("")
@jwt_required()
def list_notifs():
    uid = int(get_jwt_identity())
    rows = Notification.query.filter_by(user_id=uid).order_by(Notification.created_at.desc()).limit(50).all()
    return jsonify(data=[r.to_dict() for r in rows])


@bp.post("/<int:nid>/read")
@jwt_required()
def mark_read(nid):
    n = Notification.query.get_or_404(nid)
    n.read = True; db.session.commit()
    return jsonify(n.to_dict())
