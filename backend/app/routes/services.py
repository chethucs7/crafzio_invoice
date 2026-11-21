from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from ..extensions import db
from ..models.service import Service
from ..utils.crud import paginate, apply_search

bp = Blueprint("services", __name__, url_prefix="/services")


@bp.get("")
@jwt_required()
def list_services():
    q = Service.query
    cat = request.args.get("category_id")
    if cat:
        q = q.filter_by(category_id=int(cat))
    q = apply_search(q, Service, ["name", "hsn_sac", "description"])
    q = q.order_by(Service.name.asc())
    items, meta = paginate(q, 50)
    return jsonify(data=[s.to_dict() for s in items], meta=meta)


@bp.get("/<int:sid>")
@jwt_required()
def get_service(sid):
    return jsonify(Service.query.get_or_404(sid).to_dict())


@bp.post("")
@jwt_required()
def create_service():
    data = request.get_json() or {}
    if not data.get("name"):
        return jsonify(error="name_required"), 400
    s = Service(**{k: v for k, v in data.items() if hasattr(Service, k)})
    db.session.add(s); db.session.commit()
    return jsonify(s.to_dict()), 201


@bp.put("/<int:sid>")
@jwt_required()
def update_service(sid):
    s = Service.query.get_or_404(sid)
    for k, v in (request.get_json() or {}).items():
        if hasattr(s, k):
            setattr(s, k, v)
    db.session.commit()
    return jsonify(s.to_dict())


@bp.delete("/<int:sid>")
@jwt_required()
def delete_service(sid):
    s = Service.query.get_or_404(sid); db.session.delete(s); db.session.commit()
    return jsonify(ok=True)


@bp.post("/<int:sid>/duplicate")
@jwt_required()
def duplicate_service(sid):
    s = Service.query.get_or_404(sid)
    d = Service(name=f"{s.name} (Copy)", category_id=s.category_id,
                description=s.description, price=s.price, gst_rate=s.gst_rate,
                unit=s.unit, hsn_sac=s.hsn_sac)
    db.session.add(d); db.session.commit()
    return jsonify(d.to_dict()), 201
