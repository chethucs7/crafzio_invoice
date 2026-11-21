from datetime import datetime
from ..extensions import db


class CompanySettings(db.Model):
    __tablename__ = "company_settings"
    id = db.Column(db.Integer, primary_key=True)
    logo = db.Column(db.String(255))
    company_name = db.Column(db.String(200))
    tagline = db.Column(db.String(255))
    business_name = db.Column(db.String(200))
    address = db.Column(db.Text)
    city = db.Column(db.String(80))
    state = db.Column(db.String(80))
    country = db.Column(db.String(80), default="India")
    pincode = db.Column(db.String(20))
    phone = db.Column(db.String(40))
    alt_phone = db.Column(db.String(40))
    email = db.Column(db.String(150))
    website = db.Column(db.String(200))
    gst_number = db.Column(db.String(40))
    pan_number = db.Column(db.String(40))
    udyam_number = db.Column(db.String(40))
    cin_number = db.Column(db.String(40))
    msme_number = db.Column(db.String(40))
    bank_name = db.Column(db.String(120))
    account_name = db.Column(db.String(150))
    account_number = db.Column(db.String(50))
    ifsc = db.Column(db.String(40))
    swift = db.Column(db.String(40))
    upi_id = db.Column(db.String(80))
    qr_code = db.Column(db.String(255))
    default_currency = db.Column(db.String(10), default="INR")
    currency_symbol = db.Column(db.String(10), default="₹")
    invoice_prefix = db.Column(db.String(20), default="INV")
    quotation_prefix = db.Column(db.String(20), default="QUO")
    financial_year = db.Column(db.String(20), default="2026-27")
    default_tax = db.Column(db.Numeric(5, 2), default=18)
    default_payment_terms = db.Column(db.String(255), default="Net 15")
    late_fee_percent = db.Column(db.Numeric(5, 2), default=0)
    footer_notes = db.Column(db.Text)
    terms_conditions = db.Column(db.Text)
    signature = db.Column(db.String(255))
    stamp = db.Column(db.String(255))
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}
