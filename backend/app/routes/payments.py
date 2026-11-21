from datetime import datetime
from decimal import Decimal
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from ..extensions import db
from ..models.payment import Payment
from ..models.invoice import Invoice
from ..utils.activity import log_activity
from ..utils.auth import current_user

bp = Blueprint("payments", __name__, url_prefix="/payments")


def _parse_date(v):
    return datetime.strptime(v, "%Y-%m-%d").date() if v else None


@bp.get("")
@jwt_required()
def list_payments():
    q = Payment.query
    iid = request.args.get("invoice_id")
    if iid:
        q = q.filter_by(invoice_id=int(iid))
    return jsonify(data=[p.to_dict() for p in q.order_by(Payment.payment_date.desc()).all()])


@bp.post("")
@jwt_required()
def create_payment():
    data = request.get_json() or {}
    if not data.get("invoice_id") or not data.get("amount"):
        return jsonify(error="invoice_id_and_amount_required"), 400
    inv = Invoice.query.get_or_404(data["invoice_id"])
    p = Payment(
        invoice_id=inv.id,
        payment_date=_parse_date(data.get("payment_date")) or datetime.utcnow().date(),
        amount=data["amount"], method=data.get("method"),
        transaction_id=data.get("transaction_id"),
        reference_number=data.get("reference_number"),
        upi_reference=data.get("upi_reference"), notes=data.get("notes"),
    )
    db.session.add(p)
    inv.amount_paid = float(inv.amount_paid or 0) + float(data["amount"])
    inv.balance_due = float(inv.grand_total or 0) - float(inv.amount_paid)
    if inv.balance_due <= 0:
        inv.status = "paid"
    elif inv.amount_paid > 0:
        inv.status = "partial"
    db.session.commit()
    log_activity(current_user().id if current_user() else None, "record_payment", "invoice", inv.id,
                 f"{data['amount']}")
    return jsonify(p.to_dict()), 201


@bp.delete("/<int:pid>")
@jwt_required()
def delete_payment(pid):
    p = Payment.query.get_or_404(pid)
    inv = Invoice.query.get(p.invoice_id)
    if inv:
        inv.amount_paid = float(inv.amount_paid or 0) - float(p.amount)
        inv.balance_due = float(inv.grand_total or 0) - float(inv.amount_paid)
        if inv.amount_paid <= 0:
            inv.status = "sent"
        elif inv.balance_due > 0:
            inv.status = "partial"
    db.session.delete(p); db.session.commit()
    return jsonify(ok=True)
