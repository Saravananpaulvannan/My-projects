from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def render_order_pdf(order) -> bytes:
    buffer = BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title=f"Order {order.order_number}",
    )
    styles = getSampleStyleSheet()
    styles["Title"].textColor = colors.HexColor("#b42318")
    styles["Title"].fontSize = 20
    styles["Title"].leading = 24
    body = styles["BodyText"]
    body.leading = 15
    right = styles["BodyText"].clone("RightAligned")
    right.alignment = TA_RIGHT

    def money(amount):
        return f"Rs. {int(amount):,}"

    placed_at = order.created_at.strftime("%d %b %Y, %I:%M %p") if order.created_at else "-"
    address = ", ".join(
        value for value in (order.address, order.city, order.state, order.pincode) if value
    )
    story = [
        Paragraph("Aaradhaya Crackers", styles["Title"]),
        Paragraph("Order details", styles["Heading2"]),
        Spacer(1, 4 * mm),
    ]

    details = [
        [Paragraph("Order ID", body), Paragraph(escape(order.order_number), right)],
        [Paragraph("Order date", body), Paragraph(escape(placed_at), right)],
        [Paragraph("Customer", body), Paragraph(escape(order.customer_name), right)],
        [Paragraph("Contact", body), Paragraph(escape(order.phone), right)],
        [Paragraph("Delivery address", body), Paragraph(escape(address), right)],
    ]
    details_table = Table(details, colWidths=[42 * mm, 132 * mm])
    details_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LINEBELOW", (0, 0), (-1, -1), 0.35, colors.HexColor("#e5e7eb")),
    ]))
    story.extend([details_table, Spacer(1, 7 * mm), Paragraph("Products", styles["Heading2"])])

    rows = [["Product", "Qty", "Unit price", "Line total"]]
    for item in order.items:
        rows.append([
            Paragraph(escape(item.name), body),
            str(item.quantity),
            money(item.price),
            money(item.line_total),
        ])
    items_table = Table(rows, colWidths=[85 * mm, 18 * mm, 34 * mm, 37 * mm], repeatRows=1)
    items_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f3f4f6")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#374151")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#e5e7eb")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.extend([items_table, Spacer(1, 7 * mm)])

    totals = [
        ["Subtotal", money(order.subtotal)],
        ["Delivery charge", "Rs. 0"],
        ["Total amount", money(order.total)],
        ["Payment status", "Due on delivery (COD)"],
        ["Delivery status", escape(order.delivery_status)],
    ]
    totals_table = Table(totals, colWidths=[130 * mm, 44 * mm], hAlign="RIGHT")
    totals_table.setStyle(TableStyle([
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LINEABOVE", (0, 2), (-1, 2), 0.8, colors.HexColor("#374151")),
        ("FONTNAME", (0, 2), (-1, 2), "Helvetica-Bold"),
        ("FONTSIZE", (0, 2), (-1, 2), 12),
    ]))
    story.append(totals_table)
    document.build(story)
    return buffer.getvalue()