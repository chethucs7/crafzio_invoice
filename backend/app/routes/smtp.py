import os
import tempfile
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from ..utils.auth import role_required
from ..extensions import db
from ..models.smtp import SmtpSettings, EmailLog
from ..utils.mailer import send_email, test_connection, fetch_inbox, fetch_email_body, delete_email, render_invoice_email
from ..models.invoice import Invoice
from ..models.company import CompanySettings

bp = Blueprint("smtp", __name__, url_prefix="/smtp")


def _get() -> SmtpSettings:
    s = SmtpSettings.query.first()
    if not s:
        s = SmtpSettings(); db.session.add(s); db.session.commit()
    return s


@bp.get("")
@jwt_required()
def get_smtp():
    return jsonify(_get().to_dict())


@bp.put("")
@role_required("admin")
def update_smtp():
    s = _get()
    data = request.get_json() or {}
    for k, v in data.items():
        # keep existing secrets when caller sends empty/masked values
        if k in ("password", "imap_password") and (not v or v == "***"):
            continue
        if hasattr(s, k):
            setattr(s, k, v)
    db.session.commit()
    return jsonify(s.to_dict())


@bp.post("/test-connection")
@jwt_required()
def test():
    data = request.get_json(silent=True) or _get().to_dict(mask=False)
    ok, msg = test_connection(data)
    return jsonify(ok=ok, message=msg)


@bp.post("/test-email")
@jwt_required()
def test_email():
    data = request.get_json(silent=True) or {}
    to = data.get("to")
    if not to:
        return jsonify(error="to_required"), 400
    ok, error_msg = send_email(to, "SMTP test — Invoice System",
                    "<p>This is a test email from your Invoice System.</p>", template="test")
    return jsonify(ok=ok, error=error_msg)


@bp.post("/send")
@jwt_required()
def send_custom():
    """Send a custom email from the compose dialog."""
    # Support both JSON and multipart/form-data (for file attachments)
    if request.content_type and "multipart" in request.content_type:
        to = request.form.get("to")
        subject = request.form.get("subject") or "(No Subject)"
        body = request.form.get("body", "")
        html = f'<p style="font-family:sans-serif;line-height:1.6">{body.replace(chr(10), "<br/>")}</p>'
    else:
        data = request.get_json(silent=True) or {}
        to = data.get("to")
        subject = data.get("subject") or "(No Subject)"
        html = data.get("html") or f'<p>{data.get("body", "")}</p>'
    if not to:
        return jsonify(error="to_required"), 400
    recipients = [t.strip() for t in to.split(",") if t.strip()]

    # Save uploaded files to temp paths
    temp_paths = []
    try:
        for f in request.files.getlist("attachments"):
            suffix = os.path.splitext(f.filename)[1] if f.filename else ""
            tf = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
            f.save(tf.name)
            tf.close()
            temp_paths.append((tf.name, f.filename))

        # Rename temp files to original names in a temp dir for proper filenames
        named_paths = []
        tmpdir = tempfile.mkdtemp()
        for tmp_path, orig_name in temp_paths:
            named = os.path.join(tmpdir, orig_name or "attachment")
            os.rename(tmp_path, named)
            named_paths.append(named)

        ok, error_msg = send_email(recipients, subject, html,
                                   attachments=named_paths, template="compose")
    finally:
        import shutil
        for tp, _ in temp_paths:
            try: os.unlink(tp)
            except Exception: pass
        try: shutil.rmtree(tmpdir, ignore_errors=True)
        except Exception: pass

    return jsonify(ok=ok, error=error_msg)


@bp.get("/logs")
@jwt_required()
def logs():
    rows = EmailLog.query.order_by(EmailLog.created_at.desc()).limit(200).all()
    return jsonify(data=[r.to_dict() for r in rows])


@bp.get("/inbox")
@jwt_required()
def inbox():
    limit = int(request.args.get("limit", 50))
    ok, res = fetch_inbox(limit)
    if not ok:
        return jsonify(ok=False, error=res, data=[]), 200
    return jsonify(ok=True, data=res)


@bp.get("/inbox/<msg_id>")
@jwt_required()
def inbox_message(msg_id):
    """Fetch full body of a single inbox message."""
    ok, res = fetch_email_body(msg_id)
    if not ok:
        return jsonify(ok=False, error=res), 200
    return jsonify(ok=True, data=res)


@bp.post("/inbox/<msg_id>/delete")
@jwt_required()
def inbox_delete(msg_id):
    """Permanently delete an inbox message via IMAP."""
    ok, msg = delete_email(msg_id)
    if not ok:
        return jsonify(ok=False, error=msg), 200
    return jsonify(ok=True)


@bp.post("/invoice-preview")
@jwt_required()
def invoice_preview():
    """Preview rendered invoice email using current template + optional invoice id."""
    data = request.get_json(silent=True) or {}
    company = CompanySettings.query.first()
    inv = None
    if data.get("invoice_id"):
        inv = Invoice.query.get(data["invoice_id"])
    if not inv:
        inv = Invoice.query.order_by(Invoice.id.desc()).first()
    if not inv:
        return jsonify(subject="Invoice preview", html="<p>No invoices to preview yet.</p>")
    # temp override template on settings without saving
    s = _get()
    orig_subj, orig_html = s.invoice_email_subject, s.invoice_email_template
    if "subject" in data:
        s.invoice_email_subject = data["subject"]
    if "template" in data:
        s.invoice_email_template = data["template"]
    subject, html = render_invoice_email(inv, company)
    s.invoice_email_subject, s.invoice_email_template = orig_subj, orig_html
    db.session.rollback()  # discard the temp changes
    return jsonify(subject=subject, html=html)


@bp.get("/gmail-preset")
@jwt_required()
def gmail_preset():
    return jsonify({
        "host": "smtp.gmail.com", "port": 587,
        "use_tls": True, "use_ssl": False,
        "imap_host": "imap.gmail.com", "imap_port": 993, "imap_use_ssl": True,
        "note": "Use a Google App Password (Google Account → Security → 2FA → App passwords).",
    })
