from datetime import datetime
from ..extensions import db


class Payment(db.Model):
    __tablename__ = "payments"
    id = db.Column(db.Integer, primary_key=True)
    invoice_id = db.Column(db.Integer, db.ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    payment_date = db.Column(db.Date, nullable=False)
    amount = db.Column(db.Numeric(12, 2), nullable=False)
    method = db.Column(db.String(40))  # cash, bank_transfer, upi, card, cheque
    transaction_id = db.Column(db.String(120))
    reference_number = db.Column(db.String(120))
    upi_reference = db.Column(db.String(120))
    notes = db.Column(db.Text)
    receipt = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id, "invoice_id": self.invoice_id,
            "payment_date": self.payment_date.isoformat() if self.payment_date else None,
            "amount": float(self.amount or 0), "method": self.method,
            "transaction_id": self.transaction_id, "reference_number": self.reference_number,
            "upi_reference": self.upi_reference, "notes": self.notes, "receipt": self.receipt,
        }
