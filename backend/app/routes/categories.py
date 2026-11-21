from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from ..extensions import db
from ..models.category import Category

bp = Blueprint("categories", __name__, url_prefix="/categories")


@bp.get("")
@jwt_required()
def list_categories():
    return jsonify(data=[c.to_dict() for c in Category.query.order_by(Category.name).all()])


@bp.post("")
@jwt_required()
def create_category():
    data = request.get_json() or {}
    if not data.get("name"):
        return jsonify(error="name_required"), 400
    c = Category(name=data["name"], description=data.get("description"))
    db.session.add(c); db.session.commit()
    return jsonify(c.to_dict()), 201


@bp.put("/<int:cid>")
@jwt_required()
def update_category(cid):
    c = Category.query.get_or_404(cid)
    for k, v in (request.get_json() or {}).items():
        if hasattr(c, k):
            setattr(c, k, v)
    db.session.commit()
    return jsonify(c.to_dict())


@bp.delete("/<int:cid>")
@jwt_required()
def delete_category(cid):
    c = Category.query.get_or_404(cid); db.session.delete(c); db.session.commit()
    return jsonify(ok=True)
