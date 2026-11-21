from datetime import datetime
from ..extensions import db


class Project(db.Model):
    __tablename__ = "projects"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    client_id = db.Column(db.Integer, db.ForeignKey("clients.id"))
    assigned_user_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    start_date = db.Column(db.Date)
    end_date = db.Column(db.Date)
    technology = db.Column(db.String(255))
    status = db.Column(db.String(30), default="planning")  # planning, in_progress, completed, on_hold
    cost = db.Column(db.Numeric(12, 2), default=0)
    advance_paid = db.Column(db.Numeric(12, 2), default=0)
    description = db.Column(db.Text)
    attachments = db.Column(db.Text)  # JSON string of URLs
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    client = db.relationship("Client", backref="projects")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "client_id": self.client_id,
            "client": self.client.name if self.client else None,
            "assigned_user_id": self.assigned_user_id,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "technology": self.technology,
            "status": self.status,
            "cost": float(self.cost or 0),
            "advance_paid": float(self.advance_paid or 0),
            "pending": float((self.cost or 0) - (self.advance_paid or 0)),
            "description": self.description,
        }
