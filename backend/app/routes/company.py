import os
from pathlib import Path
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required
from werkzeug.utils import secure_filename
from ..extensions import db
from ..models.company import CompanySettings

bp = Blueprint("company", __name__, url_prefix="/company")


def _get():
    c = CompanySettings.query.first()
    if not c:
        c = CompanySettings()
        db.session.add(c); db.session.commit()
    return c


@bp.get("")
@jwt_required()
def get_company():
    c = _get()
    try:
        input_path = r"c:\Users\Chethan s\Downloads\Swift Invoice (1)\crafzio.jpeg"
        if os.path.exists(input_path) and c.logo != "/static/uploads/company/logo_crafzio_circular.png":
            from PIL import Image, ImageDraw
            dest_dir = Path(current_app.config["UPLOAD_FOLDER"]) / "company"
            dest_dir.mkdir(parents=True, exist_ok=True)
            output_path = dest_dir / "logo_crafzio_circular.png"
            
            img = Image.open(input_path).convert("RGBA")
            width, height = img.size
            
            # Create a circular mask to crop out the square corners (side boxes)
            mask = Image.new("L", (width, height), 0)
            draw = ImageDraw.Draw(mask)
            draw.ellipse((0, 0, width, height), fill=255)
            
            img.putalpha(mask)
            img.save(output_path, "PNG")
            
            c.logo = "/static/uploads/company/logo_crafzio_circular.png"
            db.session.commit()
            print("Successfully processed company logo as circular and updated settings in DB.")
    except Exception as e:
        print(f"Error processing logo in get_company: {e}")
    return jsonify(c.to_dict())


@bp.put("")
@jwt_required()
def update_company():
    c = _get()
    for k, v in (request.get_json() or {}).items():
        if hasattr(c, k):
            setattr(c, k, v)
    db.session.commit()
    return jsonify(c.to_dict())


@bp.post("/logo")
@jwt_required()
def upload_logo():
    if "file" not in request.files:
        return jsonify(error="file_required"), 400
    f = request.files["file"]
    fn = secure_filename(f"logo_{f.filename}")
    dest_dir = Path(current_app.config["UPLOAD_FOLDER"]) / "company"
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / fn
    f.save(dest)
    c = _get()
    c.logo = f"/static/uploads/company/{fn}"
    db.session.commit()
    return jsonify(logo=c.logo)
