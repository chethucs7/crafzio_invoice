from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from ..extensions import db
from ..models.project import Project
from ..utils.crud import paginate, apply_search

bp = Blueprint("projects", __name__, url_prefix="/projects")


def _parse_date(v):
    return datetime.strptime(v, "%Y-%m-%d").date() if v else None


@bp.get("")
@jwt_required()
def list_projects():
    q = Project.query
    cid = request.args.get("client_id")
    if cid:
        q = q.filter_by(client_id=int(cid))
    q = apply_search(q, Project, ["name", "technology"])
    q = q.order_by(Project.created_at.desc())
    items, meta = paginate(q)
    return jsonify(data=[p.to_dict() for p in items], meta=meta)


@bp.get("/<int:pid>")
@jwt_required()
def get_project(pid):
    return jsonify(Project.query.get_or_404(pid).to_dict())


@bp.post("")
@jwt_required()
def create_project():
    data = request.get_json() or {}
    p = Project(
        name=data.get("name"), client_id=data.get("client_id"),
        assigned_user_id=data.get("assigned_user_id"),
        start_date=_parse_date(data.get("start_date")), end_date=_parse_date(data.get("end_date")),
        technology=data.get("technology"), status=data.get("status", "planning"),
        cost=data.get("cost", 0), advance_paid=data.get("advance_paid", 0),
        description=data.get("description"),
    )
    db.session.add(p); db.session.commit()
    return jsonify(p.to_dict()), 201


@bp.put("/<int:pid>")
@jwt_required()
def update_project(pid):
    p = Project.query.get_or_404(pid)
    data = request.get_json() or {}
    for k in ("name", "client_id", "assigned_user_id", "technology", "status", "cost",
              "advance_paid", "description"):
        if k in data:
            setattr(p, k, data[k])
    if "start_date" in data:
        p.start_date = _parse_date(data["start_date"])
    if "end_date" in data:
        p.end_date = _parse_date(data["end_date"])
    db.session.commit()
    return jsonify(p.to_dict())


@bp.delete("/<int:pid>")
@jwt_required()
def delete_project(pid):
    p = Project.query.get_or_404(pid); db.session.delete(p); db.session.commit()
    return jsonify(ok=True)
