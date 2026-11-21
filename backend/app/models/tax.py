from ..extensions import db


class TaxSetting(db.Model):
    __tablename__ = "tax_settings"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    rate = db.Column(db.Numeric(5, 2), default=0)
    type = db.Column(db.String(30), default="GST")

    def to_dict(self):
        return {"id": self.id, "name": self.name, "rate": float(self.rate or 0), "type": self.type}


class Currency(db.Model):
    __tablename__ = "currencies"
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(10), unique=True)
    symbol = db.Column(db.String(10))
    name = db.Column(db.String(80))

    def to_dict(self):
        return {"id": self.id, "code": self.code, "symbol": self.symbol, "name": self.name}
