from datetime import datetime
from ..extensions import db


class SmtpSettings(db.Model):
    __tablename__ = "smtp_settings"
    id = db.Column(db.Integer, primary_key=True)
    host = db.Column(db.String(150))
    port = db.Column(db.Integer, default=587)
    username = db.Column(db.String(150))
    password = db.Column(db.String(500))  # encrypted at rest (fernet) if desired
    from_email = db.Column(db.String(150))
    from_name = db.Column(db.String(150))
    reply_to = db.Column(db.String(150))
    use_tls = db.Column(db.Boolean, default=True)
    use_ssl = db.Column(db.Boolean, default=False)
    enabled = db.Column(db.Boolean, default=True)

    # IMAP for inbox / received mail
    imap_host = db.Column(db.String(150))
    imap_port = db.Column(db.Integer, default=993)
    imap_username = db.Column(db.String(150))
    imap_password = db.Column(db.String(500))
    imap_use_ssl = db.Column(db.Boolean, default=True)
    imap_folder = db.Column(db.String(80), default="INBOX")
    imap_enabled = db.Column(db.Boolean, default=False)

    # Invoice email template (Jinja-ish placeholders)
    invoice_email_subject = db.Column(db.String(255), default="Invoice {inv} from {company}")
    invoice_email_template = db.Column(db.Text)

    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self, mask=True):
        d = {c.name: getattr(self, c.name) for c in self.__table__.columns}
        if mask:
            if d.get("password"):
                d["password"] = "***"
            if d.get("imap_password"):
                d["imap_password"] = "***"
        return d


class EmailLog(db.Model):
    __tablename__ = "email_logs"
    id = db.Column(db.Integer, primary_key=True)
    to_email = db.Column(db.String(255))
    subject = db.Column(db.String(255))
    template = db.Column(db.String(80))
    status = db.Column(db.String(30))  # sent, failed, queued
    error = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id, "to_email": self.to_email, "subject": self.subject,
            "template": self.template, "status": self.status, "error": self.error,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
