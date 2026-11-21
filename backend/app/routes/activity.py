from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from ..models.activity import ActivityLog

bp = Blueprint("activity", __name__, url_prefix="/activity")


@bp.get("")
@jwt_required()
def list_activity():
    rows = ActivityLog.query.order_by(ActivityLog.created_at.desc()).limit(200).all()
    return jsonify(data=[r.to_dict() for r in rows])
