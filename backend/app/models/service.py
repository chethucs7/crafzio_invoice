from datetime import datetime
from ..extensions import db


class Service(db.Model):
    __tablename__ = "services"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey("categories.id"))
    description = db.Column(db.Text)
    price = db.Column(db.Numeric(12, 2), default=0)
    gst_rate = db.Column(db.Numeric(5, 2), default=18)
    unit = db.Column(db.String(40), default="Nos")
    hsn_sac = db.Column(db.String(40))
    image = db.Column(db.String(255))
    featured = db.Column(db.Boolean, default=False)
    status = db.Column(db.String(20), default="active")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    category = db.relationship("Category", backref="services")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "category_id": self.category_id,
            "category": self.category.name if self.category else None,
            "description": self.description,
            "price": float(self.price or 0),
            "gst_rate": float(self.gst_rate or 0),
            "unit": self.unit,
            "hsn_sac": self.hsn_sac,
            "image": self.image,
            "featured": self.featured,
            "status": self.status,
        }
