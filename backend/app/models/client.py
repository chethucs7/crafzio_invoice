from datetime import datetime
from ..extensions import db


class Client(db.Model):
    __tablename__ = "clients"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    company_name = db.Column(db.String(200))
    contact_person = db.Column(db.String(150))
    email = db.Column(db.String(150), index=True)
    phone = db.Column(db.String(40))
    whatsapp = db.Column(db.String(40))
    gst_number = db.Column(db.String(40))
    pan = db.Column(db.String(40))
    address = db.Column(db.Text)
    city = db.Column(db.String(80))
    state = db.Column(db.String(80))
    country = db.Column(db.String(80), default="India")
    pin = db.Column(db.String(20))
    website = db.Column(db.String(200))
    notes = db.Column(db.Text)
    status = db.Column(db.String(20), default="active")  # active, inactive, archived
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self) -> dict:
        return {c.name: getattr(self, c.name) for c in self.__table__.columns} | {
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
