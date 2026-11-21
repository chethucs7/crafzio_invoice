"""Generic CRUD helpers used by the resource blueprints."""
from flask import request, jsonify
from sqlalchemy import or_
from ..extensions import db


def paginate(query, default_per_page=20):
    page = int(request.args.get("page", 1))
    per_page = min(int(request.args.get("per_page", default_per_page)), 100)
    total = query.count()
    items = query.limit(per_page).offset((page - 1) * per_page).all()
    return items, {"page": page, "per_page": per_page, "total": total,
                   "pages": (total + per_page - 1) // per_page}


def apply_search(query, model, fields: list[str]):
    q = request.args.get("q")
    if q:
        like = f"%{q}%"
        query = query.filter(or_(*[getattr(model, f).ilike(like) for f in fields]))
    return query
