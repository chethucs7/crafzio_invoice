"""Seed default roles, admin user, categories, services on first run."""
from ..extensions import db
from ..config import Config
from ..models.user import Role, User
from ..models.category import Category
from ..models.service import Service
from ..models.company import CompanySettings
from ..models.smtp import SmtpSettings
from ..models.tax import TaxSetting, Currency


DEFAULT_CATEGORIES = [
    "Web Development", "Mobile Development", "Desktop Application",
    "Cloud Services", "Consultation", "Maintenance", "Marketing",
    "Hosting", "Training", "Custom Services",
]

DEFAULT_SERVICES = [
    ("Website Development", "Web Development", 50000, 18),
    ("Web Application Development", "Web Development", 150000, 18),
    ("Flutter App Development", "Mobile Development", 120000, 18),
    ("Android Development", "Mobile Development", 100000, 18),
    ("iOS Development", "Mobile Development", 120000, 18),
    ("Desktop Software", "Desktop Application", 80000, 18),
    ("ERP Development", "Custom Services", 250000, 18),
    ("CRM Development", "Custom Services", 200000, 18),
    ("POS Development", "Custom Services", 90000, 18),
    ("API Development", "Web Development", 40000, 18),
    ("AWS Cloud Deployment", "Cloud Services", 25000, 18),
    ("Azure Deployment", "Cloud Services", 25000, 18),
    ("Hosting (1 year)", "Hosting", 6000, 18),
    ("Domain Registration", "Hosting", 1000, 18),
    ("SSL Certificate", "Hosting", 2500, 18),
    ("Website Maintenance AMC", "Maintenance", 15000, 18),
    ("SEO — 3 months", "Marketing", 30000, 18),
    ("Digital Marketing", "Marketing", 25000, 18),
    ("UI/UX Design", "Web Development", 40000, 18),
    ("Logo Design", "Web Development", 8000, 18),
    ("Consultation (per hour)", "Consultation", 2500, 18),
    ("AI Development", "Custom Services", 300000, 18),
]


def seed_defaults() -> None:
    # roles
    for name in ("admin", "manager", "accountant", "employee"):
        if not Role.query.filter_by(name=name).first():
            db.session.add(Role(name=name, description=name.title()))
    db.session.commit()

    # admin
    admin_role = Role.query.filter_by(name="admin").first()
    if not User.query.filter_by(email=Config.ADMIN_EMAIL).first():
        u = User(name="Administrator", email=Config.ADMIN_EMAIL, role_id=admin_role.id)
        u.set_password(Config.ADMIN_PASSWORD)
        db.session.add(u)
        if Config.ADMIN_PASSWORD in ("Admin@123", "password", "changeme"):
            import logging
            logging.warning(
                "SECURITY: default admin password in use for %s — set ADMIN_PASSWORD in .env "
                "and change it from Settings → Users immediately.",
                Config.ADMIN_EMAIL,
            )

    # categories + services
    for cat in DEFAULT_CATEGORIES:
        if not Category.query.filter_by(name=cat).first():
            db.session.add(Category(name=cat))
    db.session.commit()

    for name, cat_name, price, gst in DEFAULT_SERVICES:
        if not Service.query.filter_by(name=name).first():
            cat = Category.query.filter_by(name=cat_name).first()
            db.session.add(Service(name=name, category_id=cat.id if cat else None,
                                   price=price, gst_rate=gst, unit="Nos"))

    # company settings row
    if not CompanySettings.query.first():
        db.session.add(CompanySettings(
            company_name="Crafzio", business_name="Crafzio Pvt Ltd",
            email="hello@crafzio.com", phone="+91 00000 00000",
            country="India", default_currency="INR", currency_symbol="₹",
            invoice_prefix="INV", quotation_prefix="QUO",
            financial_year="2026-27", default_tax=18, default_payment_terms="Net 15",
            terms_conditions="1. Payment due within 15 days.\n2. Late payments attract 2% monthly interest.",
        ))

    if not SmtpSettings.query.first():
        db.session.add(SmtpSettings(
            host=Config.MAIL_SERVER, port=Config.MAIL_PORT,
            username=Config.MAIL_USERNAME or "", password=Config.MAIL_PASSWORD or "",
            from_email=Config.MAIL_DEFAULT_SENDER, from_name="Crafzio",
            use_tls=Config.MAIL_USE_TLS, use_ssl=Config.MAIL_USE_SSL, enabled=False,
        ))

    for code, sym, name in [("INR", "₹", "Indian Rupee"), ("USD", "$", "US Dollar"),
                            ("EUR", "€", "Euro"), ("GBP", "£", "British Pound")]:
        if not Currency.query.filter_by(code=code).first():
            db.session.add(Currency(code=code, symbol=sym, name=name))

    for name, rate in [("GST 5%", 5), ("GST 12%", 12), ("GST 18%", 18), ("GST 28%", 28)]:
        if not TaxSetting.query.filter_by(name=name).first():
            db.session.add(TaxSetting(name=name, rate=rate, type="GST"))

    db.session.commit()
