"""Activity logging helper."""
from flask import request
from ..extensions import db
from ..models.activity import ActivityLog


def log_activity(user_id: int | None, action: str, entity: str = "", entity_id: int | None = None, detail: str = ""):
    try:
        ip = request.headers.get("X-Forwarded-For", request.remote_addr) if request else None
    except RuntimeError:
        ip = None
    log = ActivityLog(user_id=user_id, action=action, entity=entity,
                     entity_id=entity_id, detail=detail, ip_address=ip)
    db.session.add(log)
    db.session.commit()
