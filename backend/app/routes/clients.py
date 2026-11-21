from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from ..extensions import db
from ..models.client import Client
from ..utils.crud import paginate, apply_search
from ..utils.auth import current_user
from ..utils.activity import log_activity

bp = Blueprint("clients", __name__, url_prefix="/clients")


@bp.get("")
@jwt_required()
def list_clients():
    q = Client.query
    status = request.args.get("status")
    if status:
        q = q.filter_by(status=status)
    q = apply_search(q, Client, ["name", "company_name", "email", "phone", "gst_number"])
    q = q.order_by(Client.created_at.desc())
    items, meta = paginate(q)
    return jsonify(data=[c.to_dict() for c in items], meta=meta)


@bp.get("/<int:cid>")
@jwt_required()
def get_client(cid):
    c = Client.query.get_or_404(cid)
    from ..models.invoice import Invoice
    invoices = [i.to_dict() for i in Invoice.query.filter_by(client_id=cid).order_by(Invoice.created_at.desc()).all()]
    outstanding = sum(i["balance_due"] for i in invoices)
    return jsonify(client=c.to_dict(), invoices=invoices, outstanding=outstanding)


@bp.post("")
@jwt_required()
def create_client():
    data = request.get_json() or {}
    if not data.get("name"):
        return jsonify(error="name_required"), 400
    c = Client(**{k: v for k, v in data.items() if hasattr(Client, k)})
    db.session.add(c)
    db.session.commit()
    log_activity(current_user().id if current_user() else None, "create", "client", c.id, c.name)
    return jsonify(c.to_dict()), 201


@bp.put("/<int:cid>")
@jwt_required()
def update_client(cid):
    c = Client.query.get_or_404(cid)
    data = request.get_json() or {}
    for k, v in data.items():
        if hasattr(c, k):
            setattr(c, k, v)
    db.session.commit()
    log_activity(current_user().id if current_user() else None, "update", "client", c.id, c.name)
    return jsonify(c.to_dict())


@bp.delete("/<int:cid>")
@jwt_required()
def delete_client(cid):
    c = Client.query.get_or_404(cid)
    db.session.delete(c)
    db.session.commit()
    log_activity(current_user().id if current_user() else None, "delete", "client", cid)
    return jsonify(ok=True)


@bp.post("/<int:cid>/archive")
@jwt_required()
def archive_client(cid):
    c = Client.query.get_or_404(cid)
    c.status = "archived"
    db.session.commit()
    return jsonify(c.to_dict())


@bp.post("/<int:cid>/restore")
@jwt_required()
def restore_client(cid):
    c = Client.query.get_or_404(cid)
    c.status = "active"
    db.session.commit()
    return jsonify(c.to_dict())
