"""ReportLab-based professional A4 invoice PDF generator matching target branding design."""
from __future__ import annotations
import os
from datetime import date
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
)
from reportlab.lib.enums import TA_RIGHT, TA_CENTER, TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from flask import current_app

from ..models.invoice import Invoice
from ..models.company import CompanySettings


BRAND = colors.HexColor("#0f2c59")     # Dark Slate Blue
PRIMARY = colors.HexColor("#1d4ed8")   # Blue 600
MUTED = colors.HexColor("#475569")     # Slate 600
LIGHT = colors.HexColor("#f8fafc")     # Slate 50
BORDER_COLOR = colors.HexColor("#e2e8f0") # Slate 200


def _register_fonts() -> tuple[str, str]:
    """Register Segoe UI, Arial or DejaVu Sans to support Unicode characters like Rupee symbol (₹)."""
    font_candidates = [
        # Name regular, Name bold, Regular path, Bold path
        ("SegoeUI", "SegoeUI-Bold", r"C:\Windows\Fonts\segoeui.ttf", r"C:\Windows\Fonts\segoeuib.ttf"),
        ("Arial", "Arial-Bold", r"C:\Windows\Fonts\arial.ttf", r"C:\Windows\Fonts\arialbd.ttf"),
        # Linux standard locations
        ("DejaVuSans", "DejaVuSans-Bold", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
        ("LiberationSans", "LiberationSans-Bold", "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf")
    ]
    
    for name, name_bold, path_reg, path_bold in font_candidates:
        if os.path.exists(path_reg) and os.path.exists(path_bold):
            try:
                pdfmetrics.registerFont(TTFont(name, path_reg))
                pdfmetrics.registerFont(TTFont(name_bold, path_bold))
                return name, name_bold
            except Exception:
                pass
                
    return "Helvetica", "Helvetica-Bold"


def generate_invoice_pdf(invoice: Invoice) -> str:
    """Render an invoice to PDF. Returns absolute file path."""
    company = CompanySettings.query.first()
    upload_dir = Path(current_app.config["UPLOAD_FOLDER"]) / "invoices"
    upload_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{invoice.invoice_number.replace('/', '_')}.pdf"
    filepath = upload_dir / filename

    # Tightened top/bottom margins to guarantee 1-page fit
    doc = SimpleDocTemplate(
        str(filepath), pagesize=A4,
        leftMargin=15 * mm, rightMargin=15 * mm,
        topMargin=10 * mm, bottomMargin=12 * mm,
        title=f"Invoice {invoice.invoice_number}",
    )

    font_name, font_bold = _register_fonts()
    doc.font_name = font_name  # store on doc for footer access

    styles = getSampleStyleSheet()
    
    # Custom styles
    body = ParagraphStyle("body", parent=styles["Normal"], fontName=font_name, fontSize=9, leading=12, textColor=colors.HexColor("#334155"))
    right = ParagraphStyle("right", parent=body, alignment=TA_RIGHT)
    hdr = ParagraphStyle("hdr", parent=styles["Normal"], fontName=font_bold, fontSize=9, leading=12, textColor=colors.whitesmoke)
    
    # Specific style for INVOICE header text to prevent truncation
    inv_title = ParagraphStyle(
        "InvTitle",
        parent=styles["Normal"],
        fontName=font_bold,
        fontSize=28,
        leading=32,
        textColor=colors.HexColor("#0f2c59"),
        alignment=TA_RIGHT
    )
    
    story: list = []
    sym = (company.currency_symbol if company else "₹") or ""
    
    # ---- Company logo processing ----
    logo_cell = ""
    if company and company.logo:
        logo_rel = company.logo
        if logo_rel.startswith("/static/"):
            logo_rel = logo_rel[len("/static/"):]
        elif logo_rel.startswith("static/"):
            logo_rel = logo_rel[len("static/"):]
        logo_path = Path(current_app.static_folder) / logo_rel
        if logo_path.exists():
            try:
                # 30x30 mm logo
                logo_cell = Image(str(logo_path), width=30 * mm, height=30 * mm, kind="proportional")
            except Exception:
                logo_cell = ""

    company_name = (company.company_name if company else "") or ""
    tagline = (company.tagline if company else "") or ""
    address = (company.address if company else "") or ""
    city = (company.city if company else "") or ""
    state = (company.state if company else "") or ""
    pincode = (company.pincode if company else "") or ""
    country = (company.country if company else "India") or "India"
    phone = (company.phone if company else "") or ""
    email = (company.email if company else "") or ""
    website = (company.website if company else "") or ""
    gst = (company.gst_number if company else "") or ""

    company_address_str = f"{city}, {state} {pincode}, {country}" if city or state or pincode else address

    # Left header block (Logo, title, tagline, details)
    left_flow = []
    if logo_cell:
        title_para = Paragraph(f"<font size=20 color='#0f2c59'><b>{company_name}</b></font><br/>"
                               f"<font size=8.5 color='#1d4ed8'><b>{tagline}</b></font>", body)
        logo_title_tbl = Table([[logo_cell, title_para]], colWidths=[33 * mm, 77 * mm])
        logo_title_tbl.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (1, 0), (1, 0), 5),
            ("LEFTPADDING", (0, 0), (0, 0), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
        ]))
        left_flow.append(logo_title_tbl)
    else:
        title_para = Paragraph(f"<font size=20 color='#0f2c59'><b>{company_name}</b></font><br/>"
                               f"<font size=8.5 color='#1d4ed8'><b>{tagline}</b></font>", body)
        left_flow.append(title_para)

    left_flow.append(Spacer(1, 3 * mm))

    info_html = ""
    if company_address_str:
        info_html += f"<b>Address:</b> {company_address_str}<br/>"
    if phone:
        info_html += f"<b>Phone:</b> {phone}<br/>"
    if email:
        info_html += f"<b>Email:</b> {email}<br/>"
    if website:
        info_html += f"<b>Website:</b> {website}<br/>"
    if gst:
        info_html += f"<b>GSTIN:</b> {gst}<br/>"
    
    left_flow.append(Paragraph(f"<font size=8.5 color='#475569'>{info_html}</font>", body))

    # Right header block (Invoice label, number badge, invoice details)
    right_flow = []
    right_flow.append(Paragraph("<b>INVOICE</b>", inv_title))
    right_flow.append(Spacer(1, 2 * mm))
    
    # Pill badge for invoice number
    badge_html = f"<para align='center'><font color='white' size=9><b># {invoice.invoice_number}</b></font></para>"
    badge_tbl = Table([[Paragraph(badge_html, body)]], colWidths=[45 * mm])
    badge_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#1d4ed8")),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
    ]))
    
    # Right align badge table
    badge_wrapper = Table([["", badge_tbl]], colWidths=[20 * mm, 45 * mm])
    badge_wrapper.setStyle(TableStyle([
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    right_flow.append(badge_wrapper)
    right_flow.append(Spacer(1, 3 * mm))
    
    # Details table (Invoice Date, Due Date, Issue Date)
    details_data = [
        [Paragraph("<b>Invoice Date</b>", body), Paragraph(f": &nbsp; {invoice.invoice_date}", body)],
        [Paragraph("<b>Due Date</b>", body), Paragraph(f": &nbsp; {invoice.due_date or '—'}", body)],
        [Paragraph("<b>Issue Date</b>", body), Paragraph(f": &nbsp; {invoice.invoice_date}", body)],
    ]
    details_tbl = Table(details_data, colWidths=[25 * mm, 35 * mm])
    details_tbl.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 1),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
    ]))
    
    details_wrapper = Table([["", details_tbl]], colWidths=[5 * mm, 60 * mm])
    details_wrapper.setStyle(TableStyle([
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    right_flow.append(details_wrapper)

    header_table = Table([[left_flow, right_flow]], colWidths=[115 * mm, 65 * mm])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 4 * mm))

    # Divider Line
    divider = Table([[""]], colWidths=[180 * mm], rowHeights=[0.5 * mm])
    divider.setStyle(TableStyle([
        ("LINEABOVE", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(divider)
    story.append(Spacer(1, 5 * mm))

    # ---- BILL TO Box (Aligned LEFT instead of centered) ----
    c_client = invoice.client
    bill_parts = [
        f"<b>{c_client.name}</b>"
    ]
    if c_client.company_name:
        bill_parts.append(c_client.company_name)
    
    client_addr = []
    if c_client.address:
        client_addr.append(c_client.address)
    city_state_pin = " ".join(filter(None, [c_client.city, c_client.state, c_client.pin]))
    if city_state_pin:
        client_addr.append(city_state_pin)
    
    if client_addr:
        bill_parts.append("<br/>".join(client_addr))
    if c_client.phone:
        bill_parts.append(f"Phone: {c_client.phone}")

    bill_to_html = (
        f"<font color='#1d4ed8'><b>BILL TO</b></font><br/>"
        f"<font color='#0f172a' size=9.5>{'<br/>'.join(bill_parts)}</font>"
    )
    
    bill_to_card = Table([[Paragraph(bill_to_html, body)]], colWidths=[110 * mm], hAlign="LEFT")
    bill_to_card.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f0f7ff")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#bfdbfe")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
    ]))
    story.append(bill_to_card)
    story.append(Spacer(1, 5 * mm))

    # ---- Items Table (Reduced vertical paddings) ----
    has_line_discounts = any(float(it.discount or 0) > 0 for it in invoice.items)

    if has_line_discounts:
        headers = [
            Paragraph("#", hdr), Paragraph("Service", hdr), Paragraph("Description", hdr), Paragraph("Qty", hdr),
            Paragraph("Rate", hdr), Paragraph("Disc", hdr), Paragraph("Tax%", hdr), Paragraph("Amount", hdr),
        ]
        col_widths = [8 * mm, 30 * mm, 43 * mm, 17 * mm, 26 * mm, 20 * mm, 13 * mm, 23 * mm]
    else:
        headers = [
            Paragraph("#", hdr), Paragraph("Service", hdr), Paragraph("Description", hdr), Paragraph("Qty", hdr),
            Paragraph("Rate", hdr), Paragraph("Tax%", hdr), Paragraph("Amount", hdr),
        ]
        col_widths = [8 * mm, 34 * mm, 54 * mm, 18 * mm, 30 * mm, 14 * mm, 22 * mm]

    data = [headers]
    for i, it in enumerate(invoice.items, 1):
        service_name = it.service.name if it.service else ""
        row = [
            str(i),
            Paragraph(escape(service_name), body),
            Paragraph(escape(it.description or ""), body),
            f"{float(it.quantity):g} {it.unit or ''}",
            f"{sym}{float(it.rate):,.2f}",
        ]
        if has_line_discounts:
            disc_val = float(it.discount or 0)
            row.append(f"{sym}{disc_val:,.2f}" if disc_val > 0 else "—")
        row.extend([
            f"{float(it.tax_rate):g}%",
            f"{sym}{float(it.amount):,.2f}",
        ])
        data.append(row)

    items_table = Table(data, colWidths=col_widths, repeatRows=1)
    
    t_style = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f2c59")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
        ("FONTNAME", (0, 0), (-1, 0), font_bold),
        ("FONTNAME", (0, 1), (-1, -1), font_name),
        ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        # Extra left padding on right-aligned numeric columns to prevent visual merging
        ("LEFTPADDING", (3, 0), (-1, -1), 8),
        ("RIGHTPADDING", (3, 0), (-1, -1), 8),
        ("LINEBELOW", (0, 0), (-1, -1), 0.25, BORDER_COLOR),
    ]
    for r_idx in range(1, len(data)):
        bg = colors.white if r_idx % 2 != 0 else colors.HexColor("#f0f7ff")
        t_style.append(("BACKGROUND", (0, r_idx), (-1, r_idx), bg))
        
    items_table.setStyle(TableStyle(t_style))
    story.append(items_table)
    story.append(Spacer(1, 4 * mm))

    # ---- Totals Section (Tightened line spacing and margins) ----
    def money(v):
        return f"{sym}{float(v or 0):,.2f}"

    thank_you_html = (
        f"<font color='#1d4ed8' size=11><b>Thank you for your business!</b></font><br/>"
        f"<font color='#475569' size=8.5>We sincerely appreciate your trust and<br/>"
        f"look forward to working with you again.</font>"
    )
    thank_you_para = Paragraph(thank_you_html, body)

    totals_rows = [
        [Paragraph("Subtotal", body), Paragraph(money(invoice.subtotal), right)],
    ]
    disc_money = float(invoice.discount or 0)
    disc_text = f"<font color='#dc2626'>-{money(disc_money)}</font>" if disc_money > 0 else f"<font color='#dc2626'>-{money(0)}</font>"
    totals_rows.append([Paragraph("Discount", body), Paragraph(disc_text, right)])
    
    if float(invoice.cgst or 0) or float(invoice.sgst or 0):
        totals_rows.append([Paragraph("CGST", body), Paragraph(money(invoice.cgst), right)])
        totals_rows.append([Paragraph("SGST", body), Paragraph(money(invoice.sgst), right)])
    if float(invoice.igst or 0):
        totals_rows.append([Paragraph("IGST", body), Paragraph(money(invoice.igst), right)])
    if not any((invoice.cgst, invoice.sgst, invoice.igst)):
        totals_rows.append([Paragraph("Tax", body), Paragraph(money(invoice.tax), right)])
        
    if float(invoice.extra_charges or 0):
        totals_rows.append([Paragraph("Extra charges", body), Paragraph(money(invoice.extra_charges), right)])
    if float(invoice.round_off or 0):
        totals_rows.append([Paragraph("Round off", body), Paragraph(money(invoice.round_off), right)])
        
    totals_rows.append([Paragraph("<b>Grand Total</b>", body), Paragraph(f"<b>{money(invoice.grand_total)}</b>", right)])
    totals_rows.append([Paragraph("Paid", body), Paragraph(money(invoice.amount_paid), right)])
    
    balance_box_tbl = Table([
        [Paragraph("<font color='#1d4ed8'><b>Balance Due</b></font>", body), 
         Paragraph(f"<font color='#1d4ed8'><b>{money(invoice.balance_due)}</b></font>", right)]
    ], colWidths=[40 * mm, 40 * mm])
    balance_box_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f0f7ff")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#bfdbfe")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    
    totals_rows.append([balance_box_tbl, ""])
    
    totals_table = Table(totals_rows, colWidths=[40 * mm, 40 * mm])
    totals_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (1, 0), (1, -2), "RIGHT"),
        ("SPAN", (0, -1), (1, -1)),
        ("TOPPADDING", (0, 0), (-1, -2), 1.5),
        ("BOTTOMPADDING", (0, 0), (-1, -2), 1.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))

    middle_tbl = Table([[thank_you_para, totals_table]], colWidths=[100 * mm, 80 * mm])
    middle_tbl.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(middle_tbl)
    story.append(Spacer(1, 4 * mm))

    # ---- Bottom Cards (Tightened padding) ----
    if company:
        bank_details_data = [
            [Paragraph("Bank Name", body), Paragraph(f": &nbsp; {company.bank_name or ''}", body)],
            [Paragraph("A/C Name", body), Paragraph(f": &nbsp; {company.account_name or ''}", body)],
            [Paragraph("A/C No.", body), Paragraph(f": &nbsp; {company.account_number or ''}", body)],
            [Paragraph("IFSC", body), Paragraph(f": &nbsp; {company.ifsc or ''}", body)],
        ]
        if company.upi_id:
            bank_details_data.append([Paragraph("UPI ID", body), Paragraph(f": &nbsp; {company.upi_id}", body)])
            
        bank_details_tbl = Table(bank_details_data, colWidths=[20 * mm, 60 * mm])
        bank_details_tbl.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 1),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
        ]))
        
        bank_card_flow = [
            Paragraph("<font color='#1d4ed8'><b>PAYMENT DETAILS</b></font><br/>", body),
            bank_details_tbl
        ]
        
        terms_lines = [line.strip() for line in (company.terms_conditions or "").split(chr(10)) if line.strip()]
        terms_elements = [Paragraph("<font color='#1d4ed8'><b>TERMS & CONDITIONS</b></font><br/>", body)]
        
        for idx, line in enumerate(terms_lines, 1):
            if line[0].isdigit() and (line[1] == '.' or (len(line) > 2 and line[2] == '.')):
                terms_elements.append(Paragraph(f"<font size=8 color='#475569'>{line}</font>", body))
            else:
                terms_elements.append(Paragraph(f"<font size=8 color='#475569'>{idx}. {line}</font>", body))
                
        bottom_cards_tbl = Table([[bank_card_flow, "", terms_elements]], colWidths=[85 * mm, 10 * mm, 85 * mm])
        bottom_cards_tbl.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("BACKGROUND", (0, 0), (0, 0), colors.HexColor("#f8fafc")),
            ("BACKGROUND", (2, 0), (2, 0), colors.HexColor("#f8fafc")),
            ("BOX", (0, 0), (0, 0), 0.5, BORDER_COLOR),
            ("BOX", (2, 0), (2, 0), 0.5, BORDER_COLOR),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 12),
            ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ]))
        story.append(bottom_cards_tbl)
        story.append(Spacer(1, 4 * mm))

    # ---- Signatory Block ----
    thank_you_script = Paragraph("<font face='Times-Italic' size=16 color='#0f2c59'><i>Thank you!</i></font>", body)
    
    sig_name = invoice.authorized_signatory or ""
    if sig_name:
        sig_html = (
            f"<para align='right'>"
            f"<br/>&nbsp;<br/>"  # Space for signing
            f"<b>{sig_name}</b><br/>"
            f"<font color='#64748b' size=7.5>Authorized Signature</font></para>"
        )
    else:
        sig_html = (
            f"<para align='right'><br/><br/>"
            f"<font color='#64748b' size=7.5>Authorized Signature</font></para>"
        )
    sig_para = Paragraph(sig_html, body)
    
    footer_signatory_tbl = Table([[thank_you_script, sig_para]], colWidths=[100 * mm, 80 * mm])
    footer_signatory_tbl.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        # Remove all cell borders so no vertical divider shows between columns
        ("INNERGRID", (0, 0), (-1, -1), 0, colors.white),
        ("BOX", (0, 0), (-1, -1), 0, colors.white),
        ("LINEAFTER", (0, 0), (0, -1), 0, colors.white),
    ]))
    story.append(footer_signatory_tbl)

    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    return str(filepath.resolve())


def _footer(canvas, doc):
    canvas.saveState()
    canvas.setFont(getattr(doc, "font_name", "Helvetica"), 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(15 * mm, 14 * mm, f"Page {doc.page}")
    
    # Draw bottom slanted band
    canvas.setFillColor(colors.HexColor("#0f2c59"))
    p = canvas.beginPath()
    p.moveTo(0, 0)
    p.lineTo(A4[0], 0)
    p.lineTo(A4[0], 8 * mm)
    p.lineTo(0, 12 * mm)
    p.close()
    canvas.drawPath(p, fill=1, stroke=0)
    
    # White tagline text inside bottom band
    canvas.setFont(getattr(doc, "font_name", "Helvetica-Bold"), 8)
    canvas.setFillColor(colors.white)
    canvas.drawCentredString(A4[0] / 2.0, 3 * mm, "Crafting Ideas. Building Solutions.")
    
    # Draw top slanted trapezoid
    canvas.setFillColor(colors.HexColor("#0f2c59"))
    p2 = canvas.beginPath()
    p2.moveTo(0, A4[1])
    p2.lineTo(60 * mm, A4[1])
    p2.lineTo(50 * mm, A4[1] - 8 * mm)
    p2.lineTo(0, A4[1] - 8 * mm)
    p2.close()
    canvas.drawPath(p2, fill=1, stroke=0)
    
    canvas.restoreState()
