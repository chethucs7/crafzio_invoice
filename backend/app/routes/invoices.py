from datetime import date, datetime
from decimal import Decimal
from flask import Blueprint, request, jsonify, send_file, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func
from ..extensions import db
from ..models.invoice import Invoice, InvoiceItem
from ..models.company import CompanySettings
from ..models.client import Client
from ..utils.crud import paginate, apply_search
from ..utils.pdf import generate_invoice_pdf
from ..utils.mailer import send_email, render_invoice_email
from ..utils.activity import log_activity
from ..utils.auth import current_user

bp = Blueprint("invoices", __name__, url_prefix="/invoices")


def _parse_date(v, default=None):
    if not v:
        return default
    return datetime.strptime(v, "%Y-%m-%d").date()


def _next_invoice_number() -> str:
    cs = CompanySettings.query.first()
    prefix = (cs.invoice_prefix if cs else "INV") or "INV"
    fy = (cs.financial_year if cs else "2026-27") or "2026-27"
    last = db.session.query(func.max(Invoice.id)).scalar() or 0
    return f"{prefix}/{fy}/{last + 1:05d}"


def _recalculate(inv: Invoice):
    subtotal = Decimal("0")
    tax = Decimal("0")
    cgst = Decimal("0")
    sgst = Decimal("0")
    igst = Decimal("0")
    for it in inv.items:
        qty = Decimal(str(it.quantity or 0))
        rate = Decimal(str(it.rate or 0))
        disc = Decimal(str(it.discount or 0))
        line = qty * rate - disc
        line_tax = line * Decimal(str(it.tax_rate or 0)) / Decimal("100")
        it.amount = line + line_tax
        subtotal += line
        tax += line_tax
    # split tax evenly across CGST+SGST unless overridden
    igst = Decimal(str(inv.igst or 0))
    if igst > 0:
        cgst = sgst = Decimal("0")
    else:
        cgst = tax / 2
        sgst = tax / 2
    inv.subtotal = subtotal
    inv.tax = tax
    inv.cgst = cgst
    inv.sgst = sgst
    inv.igst = igst
    extra = Decimal(str(inv.extra_charges or 0))
    disc_total = Decimal(str(inv.discount or 0))
    inv.grand_total = subtotal - disc_total + tax + extra + Decimal(str(inv.round_off or 0))
    inv.balance_due = Decimal(str(inv.grand_total)) - Decimal(str(inv.amount_paid or 0))
    if inv.balance_due <= 0 and inv.grand_total > 0:
        inv.status = "paid"
    elif Decimal(str(inv.amount_paid or 0)) > 0:
        inv.status = "partial"
    if inv.due_date and inv.due_date < date.today() and inv.balance_due > 0:
        inv.status = "overdue"


@bp.get("")
@jwt_required()
def list_invoices():
    q = Invoice.query
    status = request.args.get("status")
    cid = request.args.get("client_id")
    if status:
        # Support comma-separated statuses e.g. "unpaid,partial,sent"
        statuses = [s.strip() for s in status.split(",") if s.strip()]
        if len(statuses) == 1:
            q = q.filter_by(status=statuses[0])
        else:
            q = q.filter(Invoice.status.in_(statuses))
    if cid:
        q = q.filter_by(client_id=int(cid))
    q = apply_search(q, Invoice, ["invoice_number", "notes"])
    q = q.order_by(Invoice.created_at.desc())
    items, meta = paginate(q)
    return jsonify(data=[i.to_dict() for i in items], meta=meta)


@bp.get("/<int:iid>")
@jwt_required()
def get_invoice(iid):
    return jsonify(Invoice.query.get_or_404(iid).to_dict(deep=True))


@bp.post("")
@jwt_required()
def create_invoice():
    data = request.get_json() or {}
    if not data.get("client_id"):
        return jsonify(error="client_id_required"), 400

    inv = Invoice(
        invoice_number=data.get("invoice_number") or _next_invoice_number(),
        client_id=data["client_id"], project_id=data.get("project_id"),
        invoice_date=_parse_date(data.get("invoice_date"), date.today()),
        due_date=_parse_date(data.get("due_date")),
        currency=data.get("currency", "INR"),
        payment_terms=data.get("payment_terms"),
        notes=data.get("notes"), terms=data.get("terms"),
        discount=data.get("discount", 0), extra_charges=data.get("extra_charges", 0),
        round_off=data.get("round_off", 0), status=data.get("status", "draft"),
        authorized_signatory=data.get("authorized_signatory") or (current_user().name if current_user() else None),
        created_by=int(get_jwt_identity()),
    )
    for idx, it in enumerate(data.get("items") or []):
        inv.items.append(InvoiceItem(
            service_id=it.get("service_id"), description=it.get("description"),
            quantity=it.get("quantity", 1), unit=it.get("unit"),
            rate=it.get("rate", 0), discount=it.get("discount", 0),
            tax_rate=it.get("tax_rate", 18), sort_order=idx,
        ))
    _recalculate(inv)
    # copy overrides
    for k in ("subtotal", "tax", "cgst", "sgst", "igst", "grand_total", "amount_paid", "balance_due"):
        if k in data:
            setattr(inv, k, data[k])
    if "grand_total" in data or "amount_paid" in data:
        inv.balance_due = Decimal(str(inv.grand_total)) - Decimal(str(inv.amount_paid or 0))
    db.session.add(inv); db.session.commit()
    log_activity(current_user().id if current_user() else None, "create", "invoice", inv.id, inv.invoice_number)
    return jsonify(inv.to_dict(deep=True)), 201


@bp.put("/<int:iid>")
@jwt_required()
def update_invoice(iid):
    inv = Invoice.query.get_or_404(iid)
    data = request.get_json() or {}

    # Cache old calculated values to preserve manual overrides if items are not updated
    old_vals = {
        "subtotal": inv.subtotal,
        "tax": inv.tax,
        "cgst": inv.cgst,
        "sgst": inv.sgst,
        "igst": inv.igst,
        "grand_total": inv.grand_total,
        "amount_paid": inv.amount_paid,
        "balance_due": inv.balance_due,
    }

    for k in ("client_id", "project_id", "invoice_number", "currency", "payment_terms", "notes", "terms",
              "discount", "extra_charges", "round_off", "status", "igst"):
        if k in data:
            setattr(inv, k, data[k])
    
    # Only set authorized_signatory from data or fall back to current user's name
    if "authorized_signatory" in data:
        inv.authorized_signatory = data["authorized_signatory"]
    elif not inv.authorized_signatory and current_user():
        inv.authorized_signatory = current_user().name
    if "invoice_date" in data:
        inv.invoice_date = _parse_date(data["invoice_date"])
    if "due_date" in data:
        inv.due_date = _parse_date(data["due_date"])
    if "items" in data:
        InvoiceItem.query.filter_by(invoice_id=inv.id).delete()
        for idx, it in enumerate(data["items"]):
            inv.items.append(InvoiceItem(
                service_id=it.get("service_id"), description=it.get("description"),
                quantity=it.get("quantity", 1), unit=it.get("unit"),
                rate=it.get("rate", 0), discount=it.get("discount", 0),
                tax_rate=it.get("tax_rate", 18), sort_order=idx,
            ))
    _recalculate(inv)

    # Restore manual overrides if items were not modified and fields are not in current request
    if "items" not in data:
        for k, v in old_vals.items():
            if k not in data:
                # Do not restore grand_total/balance_due if discount, extra_charges, or round_off is being updated
                if k in ("grand_total", "balance_due") and any(x in data for x in ("discount", "extra_charges", "round_off")):
                    continue
                setattr(inv, k, v)

    # copy overrides
    for k in ("subtotal", "tax", "cgst", "sgst", "igst", "grand_total", "amount_paid", "balance_due"):
        if k in data:
            setattr(inv, k, data[k])
    if "grand_total" in data or "amount_paid" in data:
        inv.balance_due = Decimal(str(inv.grand_total)) - Decimal(str(inv.amount_paid or 0))
    db.session.commit()
    log_activity(current_user().id if current_user() else None, "update", "invoice", inv.id)
    return jsonify(inv.to_dict(deep=True))


@bp.delete("/<int:iid>")
@jwt_required()
def delete_invoice(iid):
    inv = Invoice.query.get_or_404(iid); db.session.delete(inv); db.session.commit()
    log_activity(current_user().id if current_user() else None, "delete", "invoice", iid)
    return jsonify(ok=True)


@bp.post("/<int:iid>/duplicate")
@jwt_required()
def duplicate_invoice(iid):
    src = Invoice.query.get_or_404(iid)
    dup = Invoice(
        invoice_number=_next_invoice_number(), client_id=src.client_id,
        project_id=src.project_id, invoice_date=date.today(), due_date=src.due_date,
        currency=src.currency, payment_terms=src.payment_terms,
        notes=src.notes, terms=src.terms, discount=src.discount,
        extra_charges=src.extra_charges, round_off=src.round_off, status="draft",
        created_by=int(get_jwt_identity()),
    )
    for it in src.items:
        dup.items.append(InvoiceItem(
            service_id=it.service_id, description=it.description, quantity=it.quantity,
            unit=it.unit, rate=it.rate, discount=it.discount, tax_rate=it.tax_rate,
            sort_order=it.sort_order,
        ))
    _recalculate(dup)
    db.session.add(dup); db.session.commit()
    return jsonify(dup.to_dict(deep=True)), 201


@bp.post("/<int:iid>/status")
@jwt_required()
def set_status(iid):
    inv = Invoice.query.get_or_404(iid)
    status = (request.get_json() or {}).get("status")
    if status not in ("draft", "sent", "paid", "unpaid", "partial", "due", "overdue", "cancelled"):
        return jsonify(error="invalid_status"), 400
    inv.status = status
    db.session.commit()
    return jsonify(inv.to_dict())


@bp.get("/<int:iid>/pdf")
@jwt_required()
def download_pdf(iid):
    inv = Invoice.query.get_or_404(iid)
    path = generate_invoice_pdf(inv)
    inv.pdf_path = path
    db.session.commit()
    return send_file(path, as_attachment=True, download_name=f"{inv.invoice_number}.pdf",
                     mimetype="application/pdf")


@bp.post("/<int:iid>/email")
@jwt_required()
def email_invoice(iid):
    inv = Invoice.query.get_or_404(iid)
    data = request.get_json() or {}
    to = data.get("to") or (inv.client.email if inv.client else None)
    if not to:
        return jsonify(error="recipient_required"), 400
    path = generate_invoice_pdf(inv)
    inv.pdf_path = path
    company = CompanySettings.query.first()
    subject, html = render_invoice_email(inv, company)
    if data.get("subject"):
        subject = data["subject"]
    if data.get("html"):
        html = data["html"]
    ok, error_msg = send_email(
        to=to.split(",") if isinstance(to, str) else to,
        subject=subject, html=html, attachments=[path],
        cc=data.get("cc"), bcc=data.get("bcc"), template="invoice",
    )
    if ok:
        if inv.status == "draft":
            inv.status = "sent"
            db.session.commit()
        return jsonify(ok=True)
    return jsonify(ok=False, error=error_msg)
