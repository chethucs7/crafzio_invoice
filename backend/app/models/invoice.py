from datetime import datetime
from ..extensions import db


class Invoice(db.Model):
    __tablename__ = "invoices"
    id = db.Column(db.Integer, primary_key=True)
    invoice_number = db.Column(db.String(50), unique=True, nullable=False, index=True)
    client_id = db.Column(db.Integer, db.ForeignKey("clients.id"), nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id"))
    invoice_date = db.Column(db.Date, nullable=False)
    due_date = db.Column(db.Date)
    currency = db.Column(db.String(10), default="INR")
    payment_terms = db.Column(db.String(100))
    notes = db.Column(db.Text)
    terms = db.Column(db.Text)

    subtotal = db.Column(db.Numeric(12, 2), default=0)
    discount = db.Column(db.Numeric(12, 2), default=0)
    tax = db.Column(db.Numeric(12, 2), default=0)
    cgst = db.Column(db.Numeric(12, 2), default=0)
    sgst = db.Column(db.Numeric(12, 2), default=0)
    igst = db.Column(db.Numeric(12, 2), default=0)
    extra_charges = db.Column(db.Numeric(12, 2), default=0)
    round_off = db.Column(db.Numeric(12, 2), default=0)
    grand_total = db.Column(db.Numeric(12, 2), default=0)
    amount_paid = db.Column(db.Numeric(12, 2), default=0)
    balance_due = db.Column(db.Numeric(12, 2), default=0)

    status = db.Column(db.String(20), default="draft")  # draft, sent, paid, partial, overdue, cancelled
    pdf_path = db.Column(db.String(255))
    authorized_signatory = db.Column(db.String(100))
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    client = db.relationship("Client", backref="invoices")
    project = db.relationship("Project", backref="invoices")
    items = db.relationship("InvoiceItem", backref="invoice", cascade="all, delete-orphan")
    payments = db.relationship("Payment", backref="invoice", cascade="all, delete-orphan")

    def to_dict(self, deep: bool = False):
        d = {
            "id": self.id,
            "invoice_number": self.invoice_number,
            "client_id": self.client_id,
            "client": self.client.name if self.client else None,
            "client_data": self.client.to_dict() if (deep and self.client) else None,
            "project_id": self.project_id,
            "invoice_date": self.invoice_date.isoformat() if self.invoice_date else None,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "currency": self.currency,
            "payment_terms": self.payment_terms,
            "notes": self.notes,
            "terms": self.terms,
            "subtotal": float(self.subtotal or 0),
            "discount": float(self.discount or 0),
            "tax": float(self.tax or 0),
            "cgst": float(self.cgst or 0),
            "sgst": float(self.sgst or 0),
            "igst": float(self.igst or 0),
            "extra_charges": float(self.extra_charges or 0),
            "round_off": float(self.round_off or 0),
            "grand_total": float(self.grand_total or 0),
            "amount_paid": float(self.amount_paid or 0),
            "balance_due": float(self.balance_due or 0),
            "status": self.status,
            "pdf_path": self.pdf_path,
            "authorized_signatory": self.authorized_signatory,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if deep:
            d["items"] = [i.to_dict() for i in self.items]
            d["payments"] = [p.to_dict() for p in self.payments]
        return d


class InvoiceItem(db.Model):
    __tablename__ = "invoice_items"
    id = db.Column(db.Integer, primary_key=True)
    invoice_id = db.Column(db.Integer, db.ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    service_id = db.Column(db.Integer, db.ForeignKey("services.id"))
    description = db.Column(db.Text)
    quantity = db.Column(db.Numeric(10, 2), default=1)
    unit = db.Column(db.String(40))
    rate = db.Column(db.Numeric(12, 2), default=0)
    discount = db.Column(db.Numeric(12, 2), default=0)
    tax_rate = db.Column(db.Numeric(5, 2), default=18)
    amount = db.Column(db.Numeric(12, 2), default=0)
    sort_order = db.Column(db.Integer, default=0)
    service = db.relationship("Service")

    def to_dict(self):
        return {
            "id": self.id,
            "service_id": self.service_id,
            "description": self.description,
            "quantity": float(self.quantity or 0),
            "unit": self.unit,
            "rate": float(self.rate or 0),
            "discount": float(self.discount or 0),
            "tax_rate": float(self.tax_rate or 0),
            "amount": float(self.amount or 0),
            "sort_order": self.sort_order,
        }
