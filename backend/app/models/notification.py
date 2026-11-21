from datetime import datetime
from ..extensions import db


class Notification(db.Model):
    __tablename__ = "notifications"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    title = db.Column(db.String(200))
    message = db.Column(db.Text)
    type = db.Column(db.String(40))  # info, success, warning, error
    read = db.Column(db.Boolean, default=False)
    link = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id, "title": self.title, "message": self.message,
            "type": self.type, "read": self.read, "link": self.link,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
