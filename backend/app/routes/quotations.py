from datetime import date, datetime
from decimal import Decimal
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func
from ..extensions import db
from ..models.quotation import Quotation, QuotationItem
from ..models.invoice import Invoice, InvoiceItem
from ..models.company import CompanySettings
from ..utils.crud import paginate

bp = Blueprint("quotations", __name__, url_prefix="/quotations")


def _next_quotation_number():
    cs = CompanySettings.query.first()
    prefix = (cs.quotation_prefix if cs else "QUO") or "QUO"
    fy = (cs.financial_year if cs else "2026-27") or "2026-27"
    last = db.session.query(func.max(Quotation.id)).scalar() or 0
    return f"{prefix}/{fy}/{last + 1:05d}"


def _parse_date(v, d=None):
    return datetime.strptime(v, "%Y-%m-%d").date() if v else d


def _totals(items, discount=0):
    sub = sum(Decimal(str(i.get("quantity", 0))) * Decimal(str(i.get("rate", 0))) for i in items)
    tax = sum(Decimal(str(i.get("quantity", 0))) * Decimal(str(i.get("rate", 0))) *
              Decimal(str(i.get("tax_rate", 0))) / Decimal("100") for i in items)
    return sub, tax, sub - Decimal(str(discount or 0)) + tax


@bp.get("")
@jwt_required()
def list_quotations():
    q = Quotation.query.order_by(Quotation.created_at.desc())
    items, meta = paginate(q)
    return jsonify(data=[i.to_dict() for i in items], meta=meta)


@bp.get("/<int:qid>")
@jwt_required()
def get_quotation(qid):
    return jsonify(Quotation.query.get_or_404(qid).to_dict(deep=True))


@bp.post("")
@jwt_required()
def create_quotation():
    data = request.get_json() or {}
    sub, tax, total = _totals(data.get("items") or [], data.get("discount", 0))
    q = Quotation(
        quotation_number=_next_quotation_number(), client_id=data["client_id"],
        quotation_date=_parse_date(data.get("quotation_date"), date.today()),
        valid_until=_parse_date(data.get("valid_until")), currency=data.get("currency", "INR"),
        notes=data.get("notes"), terms=data.get("terms"),
        subtotal=sub, tax=tax, discount=data.get("discount", 0), grand_total=total,
        status=data.get("status", "draft"),
    )
    for it in data.get("items") or []:
        amt = Decimal(str(it.get("quantity", 0))) * Decimal(str(it.get("rate", 0)))
        amt += amt * Decimal(str(it.get("tax_rate", 0))) / Decimal("100")
        q.items.append(QuotationItem(
            service_id=it.get("service_id"), description=it.get("description"),
            quantity=it.get("quantity", 1), rate=it.get("rate", 0),
            tax_rate=it.get("tax_rate", 18), amount=amt,
        ))
    db.session.add(q); db.session.commit()
    return jsonify(q.to_dict(deep=True)), 201


@bp.delete("/<int:qid>")
@jwt_required()
def delete_quotation(qid):
    q = Quotation.query.get_or_404(qid); db.session.delete(q); db.session.commit()
    return jsonify(ok=True)


@bp.post("/<int:qid>/convert")
@jwt_required()
def convert_to_invoice(qid):
    q = Quotation.query.get_or_404(qid)
    from .invoices import _next_invoice_number, _recalculate
    inv = Invoice(
        invoice_number=_next_invoice_number(), client_id=q.client_id,
        invoice_date=date.today(), currency=q.currency, notes=q.notes, terms=q.terms,
        discount=q.discount, created_by=int(get_jwt_identity()), status="draft",
    )
    for it in q.items:
        inv.items.append(InvoiceItem(
            service_id=it.service_id, description=it.description, quantity=it.quantity,
            rate=it.rate, tax_rate=it.tax_rate,
        ))
    _recalculate(inv)
    db.session.add(inv)
    q.status = "converted"
    q.converted_invoice_id = None  # set after flush below
    db.session.flush()
    q.converted_invoice_id = inv.id
    db.session.commit()
    return jsonify(inv.to_dict(deep=True)), 201
