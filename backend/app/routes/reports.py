from datetime import date, datetime
from sqlalchemy import func
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from ..extensions import db
from ..models.invoice import Invoice, InvoiceItem
from ..models.payment import Payment

bp = Blueprint("reports", __name__, url_prefix="/reports")


def _range():
    start = request.args.get("start")
    end = request.args.get("end")
    s = datetime.strptime(start, "%Y-%m-%d").date() if start else date(date.today().year, 1, 1)
    e = datetime.strptime(end, "%Y-%m-%d").date() if end else date.today()
    return s, e


@bp.get("/sales")
@jwt_required()
def sales():
    s, e = _range()
    rows = Invoice.query.filter(Invoice.invoice_date.between(s, e)).all()
    total = sum(float(r.grand_total or 0) for r in rows)
    paid = sum(float(r.amount_paid or 0) for r in rows)
    outstanding = sum(float(r.balance_due or 0) for r in rows)
    return jsonify(total=total, paid=paid, outstanding=outstanding, count=len(rows),
                   invoices=[r.to_dict() for r in rows])


@bp.get("/gst")
@jwt_required()
def gst():
    s, e = _range()
    rows = Invoice.query.filter(Invoice.invoice_date.between(s, e)).all()
    return jsonify(
        cgst=sum(float(r.cgst or 0) for r in rows),
        sgst=sum(float(r.sgst or 0) for r in rows),
        igst=sum(float(r.igst or 0) for r in rows),
        total_tax=sum(float((r.cgst or 0) + (r.sgst or 0) + (r.igst or 0) + (r.tax or 0)) for r in rows),
    )


@bp.get("/outstanding")
@jwt_required()
def outstanding():
    rows = Invoice.query.filter(Invoice.balance_due > 0).order_by(Invoice.due_date.asc()).all()
    return jsonify(data=[r.to_dict() for r in rows])
