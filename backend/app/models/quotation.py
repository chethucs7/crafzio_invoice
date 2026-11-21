from datetime import datetime
from ..extensions import db


class Quotation(db.Model):
    __tablename__ = "quotations"
    id = db.Column(db.Integer, primary_key=True)
    quotation_number = db.Column(db.String(50), unique=True, nullable=False)
    client_id = db.Column(db.Integer, db.ForeignKey("clients.id"), nullable=False)
    quotation_date = db.Column(db.Date, nullable=False)
    valid_until = db.Column(db.Date)
    currency = db.Column(db.String(10), default="INR")
    notes = db.Column(db.Text)
    terms = db.Column(db.Text)
    subtotal = db.Column(db.Numeric(12, 2), default=0)
    discount = db.Column(db.Numeric(12, 2), default=0)
    tax = db.Column(db.Numeric(12, 2), default=0)
    grand_total = db.Column(db.Numeric(12, 2), default=0)
    status = db.Column(db.String(20), default="draft")  # draft, sent, approved, rejected, converted
    version = db.Column(db.Integer, default=1)
    converted_invoice_id = db.Column(db.Integer, db.ForeignKey("invoices.id"))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    client = db.relationship("Client", backref="quotations")
    items = db.relationship("QuotationItem", backref="quotation", cascade="all, delete-orphan")

    def to_dict(self, deep=False):
        d = {
            "id": self.id,
            "quotation_number": self.quotation_number,
            "client_id": self.client_id,
            "client": self.client.name if self.client else None,
            "quotation_date": self.quotation_date.isoformat() if self.quotation_date else None,
            "valid_until": self.valid_until.isoformat() if self.valid_until else None,
            "currency": self.currency,
            "notes": self.notes,
            "terms": self.terms,
            "subtotal": float(self.subtotal or 0),
            "discount": float(self.discount or 0),
            "tax": float(self.tax or 0),
            "grand_total": float(self.grand_total or 0),
            "status": self.status,
            "version": self.version,
        }
        if deep:
            d["items"] = [i.to_dict() for i in self.items]
        return d


class QuotationItem(db.Model):
    __tablename__ = "quotation_items"
    id = db.Column(db.Integer, primary_key=True)
    quotation_id = db.Column(db.Integer, db.ForeignKey("quotations.id", ondelete="CASCADE"))
    service_id = db.Column(db.Integer, db.ForeignKey("services.id"))
    description = db.Column(db.Text)
    quantity = db.Column(db.Numeric(10, 2), default=1)
    rate = db.Column(db.Numeric(12, 2), default=0)
    tax_rate = db.Column(db.Numeric(5, 2), default=18)
    amount = db.Column(db.Numeric(12, 2), default=0)

    def to_dict(self):
        return {
            "id": self.id, "service_id": self.service_id, "description": self.description,
            "quantity": float(self.quantity or 0), "rate": float(self.rate or 0),
            "tax_rate": float(self.tax_rate or 0), "amount": float(self.amount or 0),
        }
