"""Send email via DB-stored SMTP settings + read inbox via IMAP."""
import imaplib
import email as email_lib
import smtplib
from email.header import decode_header, Header
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from pathlib import Path

from ..extensions import db
from ..models.smtp import SmtpSettings, EmailLog


def _get_settings() -> SmtpSettings | None:
    return SmtpSettings.query.first()


def send_email(to, subject: str, html: str, attachments=None,
               template: str = "generic", cc=None, bcc=None) -> tuple[bool, str | None]:
    s = _get_settings()
    if not s or not s.enabled:
        err = "SMTP is disabled"
        _log(to, subject, template, "failed", err)
        return False, err

    recipients = [to] if isinstance(to, str) else list(to)
    all_rcpts = recipients + (cc or []) + (bcc or [])

    msg = MIMEMultipart()
    msg["From"] = f"{s.from_name} <{s.from_email}>" if s.from_name else s.from_email
    msg["To"] = ", ".join(recipients)
    if cc:
        msg["Cc"] = ", ".join(cc)
    if s.reply_to:
        msg["Reply-To"] = s.reply_to
    msg["Subject"] = Header(subject, "utf-8")
    msg.attach(MIMEText(html, "html", "utf-8"))

    for path in attachments or []:
        p = Path(path)
        if not p.exists():
            continue
        part = MIMEBase("application", "octet-stream")
        part.set_payload(p.read_bytes())
        encoders.encode_base64(part)
        part.add_header("Content-Disposition", f'attachment; filename="{p.name}"')
        msg.attach(part)

    try:
        if s.use_ssl:
            server = smtplib.SMTP_SSL(s.host, s.port, timeout=20)
        else:
            server = smtplib.SMTP(s.host, s.port, timeout=20)
            if s.use_tls:
                server.starttls()
        if s.username:
            server.login(s.username, s.password)
        server.sendmail(s.from_email, all_rcpts, msg.as_bytes())
        server.quit()
        _log(recipients[0], subject, template, "sent", None)
        return True, None
    except Exception as e:  # noqa: BLE001
        err_msg = str(e)
        _log(recipients[0], subject, template, "failed", err_msg)
        return False, err_msg


def _log(to, subject: str, template: str, status: str, error):
    try:
        to_str = to if isinstance(to, str) else ", ".join(to)
        db.session.add(EmailLog(to_email=to_str, subject=subject, template=template, status=status, error=error))
        db.session.commit()
    except Exception:  # noqa: BLE001
        db.session.rollback()


def test_connection(settings: dict) -> tuple[bool, str]:
    try:
        if settings.get("use_ssl"):
            srv = smtplib.SMTP_SSL(settings["host"], int(settings["port"]), timeout=10)
        else:
            srv = smtplib.SMTP(settings["host"], int(settings["port"]), timeout=10)
            if settings.get("use_tls", True):
                srv.starttls()
        if settings.get("username"):
            srv.login(settings["username"], settings["password"])
        srv.quit()
        return True, "OK"
    except Exception as e:  # noqa: BLE001
        return False, str(e)


# ---------- IMAP inbox ----------
def _decode(v) -> str:
    if not v:
        return ""
    parts = decode_header(v)
    out = ""
    for text, enc in parts:
        if isinstance(text, bytes):
            try:
                out += text.decode(enc or "utf-8", errors="replace")
            except LookupError:
                out += text.decode("utf-8", errors="replace")
        else:
            out += text
    return out


def fetch_inbox(limit: int = 30) -> tuple[bool, list | str]:
    s = _get_settings()
    if not s or not s.imap_enabled or not s.imap_host:
        return False, "IMAP not configured"
    try:
        if s.imap_use_ssl:
            m = imaplib.IMAP4_SSL(s.imap_host, s.imap_port or 993, timeout=20)
        else:
            m = imaplib.IMAP4(s.imap_host, s.imap_port or 143, timeout=20)
        m.login(s.imap_username or s.username, s.imap_password or s.password)
        m.select(s.imap_folder or "INBOX", readonly=True)
        typ, data = m.search(None, "ALL")
        if typ != "OK":
            m.logout()
            return False, "IMAP search failed"
        ids = data[0].split()
        ids = ids[-limit:][::-1]  # newest first
        out = []
        for i in ids:
            typ, msg_data = m.fetch(i, "(RFC822.HEADER)")
            if typ != "OK" or not msg_data or not msg_data[0]:
                continue
            hdr = email_lib.message_from_bytes(msg_data[0][1])
            out.append({
                "id": i.decode(),
                "from": _decode(hdr.get("From")),
                "to": _decode(hdr.get("To")),
                "subject": _decode(hdr.get("Subject")),
                "date": _decode(hdr.get("Date")),
            })
        m.logout()
        return True, out
    except Exception as e:  # noqa: BLE001
        return False, str(e)


def fetch_email_body(msg_id: str) -> tuple[bool, dict | str]:
    """Fetch full body of a specific email by IMAP sequence number."""
    s = _get_settings()
    if not s or not s.imap_enabled or not s.imap_host:
        return False, "IMAP not configured"
    try:
        if s.imap_use_ssl:
            m = imaplib.IMAP4_SSL(s.imap_host, s.imap_port or 993, timeout=20)
        else:
            m = imaplib.IMAP4(s.imap_host, s.imap_port or 143, timeout=20)
        m.login(s.imap_username or s.username, s.imap_password or s.password)
        m.select(s.imap_folder or "INBOX", readonly=True)
        typ, msg_data = m.fetch(msg_id.encode(), "(RFC822)")
        if typ != "OK" or not msg_data or not msg_data[0]:
            m.logout()
            return False, "Message not found"
        raw = msg_data[0][1]
        msg = email_lib.message_from_bytes(raw)
        body_plain = ""
        body_html = ""
        if msg.is_multipart():
            for part in msg.walk():
                ct = part.get_content_type()
                cd = str(part.get("Content-Disposition") or "")
                if "attachment" in cd:
                    continue
                charset = part.get_content_charset() or "utf-8"
                payload = part.get_payload(decode=True)
                if payload is None:
                    continue
                decoded = payload.decode(charset, errors="replace")
                if ct == "text/html":
                    body_html = decoded
                elif ct == "text/plain":
                    body_plain = decoded
        else:
            charset = msg.get_content_charset() or "utf-8"
            payload = msg.get_payload(decode=True)
            body_plain = payload.decode(charset, errors="replace") if payload else ""
        m.logout()
        return True, {
            "id": msg_id,
            "from": _decode(msg.get("From")),
            "to": _decode(msg.get("To")),
            "subject": _decode(msg.get("Subject")),
            "date": _decode(msg.get("Date")),
            "body_html": body_html,
            "body_plain": body_plain,
        }
    except Exception as e:  # noqa: BLE001
        return False, str(e)


def delete_email(msg_id: str) -> tuple[bool, str]:
    """Mark an IMAP email as deleted and expunge it."""
    s = _get_settings()
    if not s or not s.imap_enabled or not s.imap_host:
        return False, "IMAP not configured"
    try:
        if s.imap_use_ssl:
            m = imaplib.IMAP4_SSL(s.imap_host, s.imap_port or 993, timeout=20)
        else:
            m = imaplib.IMAP4(s.imap_host, s.imap_port or 143, timeout=20)
        m.login(s.imap_username or s.username, s.imap_password or s.password)
        m.select(s.imap_folder or "INBOX")
        m.store(msg_id.encode(), "+FLAGS", "\\Deleted")
        m.expunge()
        m.logout()
        return True, "Deleted"
    except Exception as e:  # noqa: BLE001
        return False, str(e)


DEFAULT_INVOICE_HTML = """
<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;background:#fff">
  <h2 style="color:#0f172a">Invoice {inv}</h2>
  <p>Dear {name},</p>
  <p>Please find attached your invoice for the amount <b>{sym}{amt}</b>, due on <b>{due}</b>.</p>
  <p>Thank you for your business.</p>
  <hr/>
  <p style="color:#64748b;font-size:12px">{company}</p>
</div>
"""

# Kept for import back-compat
INVOICE_HTML = DEFAULT_INVOICE_HTML


def render_invoice_email(inv, company) -> tuple[str, str]:
    """Return (subject, html) rendered from SMTP-settings template or defaults."""
    s = _get_settings()
    sym = (company.currency_symbol if company else "₹") or "₹"
    ctx = {
        "inv": inv.invoice_number,
        "name": inv.client.name if inv.client else "",
        "sym": sym,
        "amt": f"{float(inv.balance_due):,.2f}",
        "due": inv.due_date.isoformat() if inv.due_date else "—",
        "company": company.company_name if company else "",
    }
    subj_tpl = (s.invoice_email_subject if s and s.invoice_email_subject else "Invoice {inv}") or "Invoice {inv}"
    html_tpl = (s.invoice_email_template if s and s.invoice_email_template else DEFAULT_INVOICE_HTML) or DEFAULT_INVOICE_HTML
    try:
        subject = subj_tpl.format(**ctx)
    except Exception:  # noqa: BLE001
        subject = f"Invoice {ctx['inv']}"
    try:
        html = html_tpl.format(**ctx)
    except Exception:  # noqa: BLE001
        html = DEFAULT_INVOICE_HTML.format(**ctx)
    return subject, html
