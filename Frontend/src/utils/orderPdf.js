import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

export const BRAND = {
  name: 'Aaradhaya Crackers',
  address: 'Sivakasi, Tamil Nadu, India',
  phone: '+91 99622 42656, +91 95004 40515',
  email: 'aaradhyacrackers@gmail.com',
};

const PRIMARY = [255, 107, 0];
const MUTED = [107, 107, 107];

// Built-in PDF fonts have no ₹ glyph, so amounts use "Rs.".
const rs = (n) => `Rs. ${Number(n).toLocaleString('en-IN')}`;

export function downloadOrderPdf({
  items,
  subtotal,
  deliveryFee,
  customer = {},
  branded,
  orderId,
  paymentMethod,
  placedAt = new Date(),
}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;
  const date = new Date(placedAt);
  let y = margin;

  if (branded) {
    doc.setFillColor(...PRIMARY);
    doc.rect(0, 0, pageW, 80, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold').setFontSize(22);
    doc.text(BRAND.name, margin, 38);
    doc.setFont('helvetica', 'normal').setFontSize(10);
    doc.text(`${BRAND.address}  |  ${BRAND.phone}  |  ${BRAND.email}`, margin, 60);
    y = 110;
  }

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold').setFontSize(16);
  doc.text(orderId ? 'Order Copy' : 'Order Estimate', margin, y);
  doc.setFont('helvetica', 'normal').setFontSize(10);
  doc.setTextColor(...MUTED);
  const dateText = orderId ? date.toLocaleString('en-IN') : date.toLocaleDateString('en-IN');
  doc.text(`Date: ${dateText}`, pageW - margin, y, { align: 'right' });
  if (orderId) {
    doc.setFont('helvetica', 'bold').setTextColor(0, 0, 0);
    doc.text(`Order No: ${orderId}`, pageW - margin, y + 14, { align: 'right' });
    doc.setFont('helvetica', 'normal');
  }
  y += orderId ? 34 : 20;

  const customerLines = [
    customer.name && `Name: ${customer.name}`,
    customer.phone && `Mobile: ${customer.phone}`,
    customer.email && `Email: ${customer.email}`,
    [customer.address, customer.city, customer.pincode].filter(Boolean).join(', ') &&
      `Address: ${[customer.address, customer.city, customer.pincode].filter(Boolean).join(', ')}`,
    paymentMethod && `Payment Method: ${paymentMethod}`,
  ].filter(Boolean);

  if (customerLines.length) {
    doc.setTextColor(0, 0, 0);
    customerLines.forEach((line) => {
      const wrapped = doc.splitTextToSize(line, pageW - margin * 2);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 14;
    });
    y += 6;
  }

  const totalMrp = items.reduce((s, i) => s + i.mrp * i.qty, 0);
  const total = subtotal + deliveryFee;
  const totals = [
    [{ content: 'Total MRP', colSpan: 6, styles: { halign: 'right' } }, { content: rs(totalMrp), styles: { halign: 'right' } }],
    [{ content: 'Subtotal', colSpan: 6, styles: { halign: 'right' } }, { content: rs(subtotal), styles: { halign: 'right' } }],
    [{ content: 'You Save', colSpan: 6, styles: { halign: 'right' } }, { content: rs(totalMrp - subtotal), styles: { halign: 'right' } }],
  ];
  if (deliveryFee > 0) {
    totals.push([{ content: 'Delivery', colSpan: 6, styles: { halign: 'right' } }, { content: rs(deliveryFee), styles: { halign: 'right' } }]);
  }
  totals.push([
    { content: 'Grand Total', colSpan: 6, styles: { halign: 'right', fontStyle: 'bold' } },
    { content: rs(total), styles: { halign: 'right', fontStyle: 'bold' } },
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['S.No', 'Product', 'Pack', 'Qty', 'MRP', 'Rate', 'Amount']],
    body: items.map((i) => [i.id, i.name, i.unit, i.qty, rs(i.mrp), rs(i.price), rs(i.price * i.qty)]),
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: branded ? PRIMARY : [60, 60, 60], textColor: 255 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 36 },
      3: { halign: 'center', cellWidth: 36 },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
    },
    foot: totals,
    footStyles: { fillColor: [255, 248, 225], textColor: 20, fontStyle: 'normal' },
    showFoot: 'lastPage',
  });

  if (branded) {
    const endY = doc.lastAutoTable.finalY + 30;
    doc.setFontSize(10).setTextColor(...MUTED);
    doc.text(`Thank you for shopping with ${BRAND.name}. Celebrate safely!`, margin, endY);
  }

  const stamp = date.toISOString().slice(0, 10);
  const base = orderId ? `Order-${orderId}` : `Order-Estimate-${stamp}`;
  doc.save(branded ? `Aaradhaya-Crackers-${base}.pdf` : `${base}.pdf`);
}
