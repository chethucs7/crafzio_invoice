from datetime import date, datetime, timedelta
from sqlalchemy import func
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from ..extensions import db
from ..models.invoice import Invoice
from ..models.client import Client
from ..models.project import Project

bp = Blueprint("dashboard", __name__, url_prefix="/dashboard")


@bp.get("/stats")
@jwt_required()
def stats():
    today = date.today()
    month_start = today.replace(day=1)
    year_start = today.replace(month=1, day=1)

    def sum_between(start, end=None):
        q = db.session.query(func.coalesce(func.sum(Invoice.amount_paid), 0)).filter(Invoice.invoice_date >= start)
        if end:
            q = q.filter(Invoice.invoice_date < end)
        return float(q.scalar() or 0)

    today_rev = sum_between(today, today + timedelta(days=1))
    month_rev = sum_between(month_start)
    year_rev = sum_between(year_start)

    pending = float(db.session.query(func.coalesce(func.sum(Invoice.balance_due), 0))
                    .filter(Invoice.status.in_(["sent", "partial", "draft"])).scalar() or 0)
    paid_total = float(db.session.query(func.coalesce(func.sum(Invoice.amount_paid), 0)).scalar() or 0)
    overdue = float(db.session.query(func.coalesce(func.sum(Invoice.balance_due), 0))
                    .filter(Invoice.due_date < today, Invoice.balance_due > 0).scalar() or 0)

    total_clients = Client.query.count()
    active_clients = Client.query.filter_by(status="active").count()
    inactive_clients = Client.query.filter(Client.status != "active").count()

    projects_running = Project.query.filter(Project.status.in_(["planning", "in_progress"])).count()
    projects_completed = Project.query.filter_by(status="completed").count()

    invoices_generated = Invoice.query.count()
    gst_collected = float(db.session.query(func.coalesce(func.sum(Invoice.tax + Invoice.cgst + Invoice.sgst + Invoice.igst), 0)).scalar() or 0)

    # monthly revenue for last 12 months
    rows = db.session.execute(db.text("""
        SELECT DATE_FORMAT(invoice_date, '%Y-%m') AS ym,
               COALESCE(SUM(amount_paid),0) AS paid
        FROM invoices
        WHERE invoice_date >= :start
        GROUP BY ym ORDER BY ym
    """), {"start": today - timedelta(days=365)}).all()
    monthly = [{"month": r.ym, "revenue": float(r.paid)} for r in rows]

    # status pie
    status_rows = db.session.execute(db.text(
        "SELECT status, COUNT(*) AS c FROM invoices GROUP BY status"
    )).all()
    status_pie = [{"status": r.status, "count": int(r.c)} for r in status_rows]

    latest_invoices = [i.to_dict() for i in Invoice.query.order_by(Invoice.created_at.desc()).limit(5).all()]
    latest_clients = [c.to_dict() for c in Client.query.order_by(Client.created_at.desc()).limit(5).all()]
    upcoming = [i.to_dict() for i in Invoice.query
                .filter(Invoice.due_date >= today, Invoice.balance_due > 0)
                .order_by(Invoice.due_date.asc()).limit(5).all()]

    # Incoming payment schedule — due invoices bucketed by when they are due
    def _due_in_range(start, end):
        rows = Invoice.query.filter(
            Invoice.due_date >= start,
            Invoice.due_date < end,
            Invoice.balance_due > 0,
        ).order_by(Invoice.due_date.asc()).all()
        return [
            {
                "id": i.id,
                "invoice_number": i.invoice_number,
                "client": i.client.name if i.client else "",
                "due_date": i.due_date.isoformat() if i.due_date else None,
                "balance_due": float(i.balance_due),
                "status": i.status,
            }
            for i in rows
        ]

    in_7 = _due_in_range(today, today + timedelta(days=7))
    in_30 = _due_in_range(today + timedelta(days=7), today + timedelta(days=30))
    in_90 = _due_in_range(today + timedelta(days=30), today + timedelta(days=90))
    overdue_list = [
        {
            "id": i.id,
            "invoice_number": i.invoice_number,
            "client": i.client.name if i.client else "",
            "due_date": i.due_date.isoformat() if i.due_date else None,
            "balance_due": float(i.balance_due),
            "status": i.status,
        }
        for i in Invoice.query.filter(
            Invoice.due_date < today, Invoice.balance_due > 0
        ).order_by(Invoice.due_date.asc()).all()
    ]

    incoming = {
        "overdue": {"items": overdue_list, "total": sum(x["balance_due"] for x in overdue_list)},
        "next_7": {"items": in_7, "total": sum(x["balance_due"] for x in in_7)},
        "next_30": {"items": in_30, "total": sum(x["balance_due"] for x in in_30)},
        "next_90": {"items": in_90, "total": sum(x["balance_due"] for x in in_90)},
    }

    return jsonify(
        today_revenue=today_rev, monthly_revenue=month_rev, yearly_revenue=year_rev,
        pending=pending, paid=paid_total, overdue=overdue,
        total_clients=total_clients, active_clients=active_clients, inactive_clients=inactive_clients,
        projects_running=projects_running, projects_completed=projects_completed,
        invoices_generated=invoices_generated, gst_collected=gst_collected,
        monthly=monthly, status_pie=status_pie,
        latest_invoices=latest_invoices, latest_clients=latest_clients, upcoming_due=upcoming,
        incoming=incoming,
    )
