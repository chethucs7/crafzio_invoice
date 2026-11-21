from datetime import datetime
import bcrypt
from ..extensions import db


class Role(db.Model):
    __tablename__ = "roles"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)  # admin, manager, accountant, employee
    description = db.Column(db.String(255))


class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    phone = db.Column(db.String(40))
    avatar = db.Column(db.String(255))
    role_id = db.Column(db.Integer, db.ForeignKey("roles.id"), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    permissions = db.Column(db.String(255), default="")
    reset_token = db.Column(db.String(120))
    reset_token_expiry = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    role = db.relationship("Role", backref="users")

    def set_password(self, password: str) -> None:
        self.password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    def check_password(self, password: str) -> bool:
        try:
            return bcrypt.checkpw(password.encode(), self.password_hash.encode())
        except (ValueError, TypeError):
            return False

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "phone": self.phone,
            "avatar": self.avatar,
            "role": self.role.name if self.role else None,
            "is_active": self.is_active,
            "permissions": self.permissions or "",
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
