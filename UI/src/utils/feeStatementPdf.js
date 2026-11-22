import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { collegeReport } from '../config/collegeReport';
import { sanitizeFilePart } from './fileExport';
import { blankStr, loadImageAsDataUrl, placeFromAddress } from './pdfHelpers';

function fmtCurrency(n) {
  if (n == null || n === '') return '—';
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  return num.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
}

function fmtDate(iso) {
  if (!iso) return '—';
  const s = String(iso).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return blankStr(iso);
  const [y, m, d] = s.split('-');
  return `${d}-${m}-${y}`;
}

function formatGeneratedAt(d = new Date()) {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

function methodLabel(method) {
  const m = blankStr(method).toLowerCase();
  const map = {
    cash: 'Cash',
    cheque: 'Cheque',
    bank_transfer: 'Bank Transfer',
    upi: 'UPI',
    online: 'Online',
    other: 'Other',
  };
  return map[m] || (m ? m : '—');
}

function feeStatus(net, paid) {
  const n = Number(net) || 0;
  const p = Number(paid) || 0;
  if (n <= 0) return 'No fee';
  if (p >= n) return 'Paid';
  if (p > 0) return 'Partial';
  return 'Unpaid';
}

/** Logo on the left, school name + address centered on the page. Returns y below the rule. */
async function drawSchoolHeader(doc, { pageWidth, margin }) {
  const logoDataUrl = await loadImageAsDataUrl(collegeReport.logoUrl);
  const top = 36;
  const logoSize = 64;
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', margin, top, logoSize, logoSize);
    } catch {
      /* skip logo */
    }
  }

  // Reserve the logo's width on both sides so the text is centered on the page, not beside the logo.
  const sideGap = logoDataUrl ? logoSize + 14 : 0;
  const textWidth = pageWidth - (margin + sideGap) * 2;
  const center = pageWidth / 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  const nameLines = doc.splitTextToSize(collegeReport.collegeName.toUpperCase(), textWidth);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const addressLines = doc.splitTextToSize(collegeReport.address, textWidth);

  const nameLineH = 20;
  const addressLineH = 14;
  const affiliationH = 14;
  const blockH = nameLines.length * nameLineH + affiliationH + addressLines.length * addressLineH;
  let hy = top + Math.max(0, (logoSize - blockH) / 2) + 15;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(20, 20, 20);
  for (const line of nameLines) {
    doc.text(line, center, hy, { align: 'center' });
    hy += nameLineH;
  }
  hy -= 3;
  doc.setFontSize(10.5);
  doc.text(collegeReport.affiliation, center, hy, { align: 'center' });
  hy += affiliationH + 1;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(50, 50, 50);
  for (const line of addressLines) {
    doc.text(line, center, hy, { align: 'center' });
    hy += addressLineH;
  }

  const y = Math.max(top + logoSize + 10, hy);
  doc.setDrawColor(40, 40, 40);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageWidth - margin, y);
  return y + 22;
}

/**
 * Fee receipt PDF: summary + payment installments with running balance.
 * @param {{ student: object, fee: object, academicYear: string }} args
 */
export async function exportFeeStatementPdf({ student, fee, academicYear }) {
  if (!student) throw new Error('Student is required');
  if (!fee) throw new Error('Fee record is required');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  let y = await drawSchoolHeader(doc, { pageWidth, margin });

  const yearLabel = blankStr(academicYear) || blankStr(fee.academic_year) || '—';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(15, 15, 15);
  doc.text('FEE RECEIPT', pageWidth / 2, y, { align: 'center' });
  y += 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text(`Academic Year: ${yearLabel}`, pageWidth / 2, y, { align: 'center' });
  y += 22;

  const fullName =
    [blankStr(student.first_name), blankStr(student.last_name)].filter(Boolean).join(' ') || '—';
  const classLabel = [blankStr(student.class_name), blankStr(student.section_code)]
    .filter(Boolean)
    .join(' — ') || '—';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(25, 25, 25);
  doc.text('Student details', margin, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 9.5,
      textColor: [30, 30, 30],
      cellPadding: { top: 3, bottom: 3, left: 0, right: 8 },
    },
    body: [
      ['Name', fullName, 'Roll No.', blankStr(student.roll_number) || '—'],
      ['Class / Section', classLabel, 'Date', formatGeneratedAt()],
    ],
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 88, textColor: [80, 80, 80] },
      1: { cellWidth: contentWidth / 2 - 88 },
      2: { fontStyle: 'bold', cellWidth: 72, textColor: [80, 80, 80] },
      3: { cellWidth: contentWidth / 2 - 72 },
    },
  });

  y = (doc.lastAutoTable?.finalY ?? y) + 16;

  const totalFee = Number(fee.total_fee) || 0;
  const discount = Number(fee.discount) || 0;
  const netFee = fee.net_fee != null ? Number(fee.net_fee) : totalFee - discount;
  const totalPaid = Number(fee.total_paid) || 0;
  const balance =
    fee.balance != null ? Number(fee.balance) : Math.max(0, netFee - totalPaid);
  const status = feeStatus(netFee, totalPaid);
  const feeItems = Array.isArray(fee.fee_items) ? fee.fee_items : [];

  if (feeItems.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(25, 25, 25);
    doc.text('Fee breakdown', margin, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      tableWidth: contentWidth,
      theme: 'grid',
      head: [['Fee name', 'Amount', 'Discount', 'Net']],
      headStyles: {
        fillColor: [30, 30, 30],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
      },
      styles: {
        font: 'helvetica',
        fontSize: 9,
        textColor: [25, 25, 25],
        cellPadding: 4,
        lineColor: [180, 180, 180],
        lineWidth: 0.4,
      },
      body: feeItems.map((item) => {
        const amt = Number(item.amount) || 0;
        const disc = Number(item.discount) || 0;
        const net = item.net != null ? Number(item.net) : amt - disc;
        return [
          blankStr(item.fee_name) || '—',
          fmtCurrency(amt),
          fmtCurrency(disc),
          fmtCurrency(net),
        ];
      }),
      columnStyles: {
        0: { cellWidth: contentWidth * 0.4 },
        1: { cellWidth: contentWidth * 0.2, halign: 'right' },
        2: { cellWidth: contentWidth * 0.2, halign: 'right' },
        3: { cellWidth: contentWidth * 0.2, halign: 'right' },
      },
    });

    y = (doc.lastAutoTable?.finalY ?? y) + 16;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(25, 25, 25);
  doc.text('Fee summary', margin, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 9.5,
      textColor: [25, 25, 25],
      cellPadding: 5,
      lineColor: [180, 180, 180],
      lineWidth: 0.4,
    },
    body: [
      [
        { content: 'Total fee', styles: { fontStyle: 'bold', fillColor: [248, 248, 248] } },
        fmtCurrency(totalFee),
        { content: 'Discount', styles: { fontStyle: 'bold', fillColor: [248, 248, 248] } },
        fmtCurrency(discount),
      ],
      [
        { content: 'Net fee', styles: { fontStyle: 'bold', fillColor: [248, 248, 248] } },
        fmtCurrency(netFee),
        { content: 'Status', styles: { fontStyle: 'bold', fillColor: [248, 248, 248] } },
        status,
      ],
      [
        { content: 'Total paid', styles: { fontStyle: 'bold', fillColor: [248, 248, 248] } },
        fmtCurrency(totalPaid),
        { content: 'Balance remaining', styles: { fontStyle: 'bold', fillColor: [248, 248, 248] } },
        fmtCurrency(balance),
      ],
      [
        { content: 'Due date', styles: { fontStyle: 'bold', fillColor: [248, 248, 248] } },
        fmtDate(fee.due_date),
        { content: 'Notes', styles: { fontStyle: 'bold', fillColor: [248, 248, 248] } },
        blankStr(fee.notes) || '—',
      ],
    ],
    columnStyles: {
      0: { cellWidth: contentWidth * 0.22 },
      1: { cellWidth: contentWidth * 0.28 },
      2: { cellWidth: contentWidth * 0.22 },
      3: { cellWidth: contentWidth * 0.28 },
    },
  });

  y = (doc.lastAutoTable?.finalY ?? y) + 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(25, 25, 25);
  doc.text('Payment installments', margin, y);
  y += 6;

  const rawPayments = Array.isArray(fee.payments) ? [...fee.payments] : [];
  // API returns newest first — reverse for chronological installments
  const payments = rawPayments.sort((a, b) => {
    const da = String(a.payment_date ?? '').slice(0, 10);
    const db = String(b.payment_date ?? '').slice(0, 10);
    if (da !== db) return da.localeCompare(db);
    return String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''));
  });

  if (!payments.length) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(90, 90, 90);
    doc.text('No payments recorded.', margin, y + 14);
    y += 28;
  } else {
    let cumulativePaid = 0;
    const body = payments.map((p, idx) => {
      const amt = Number(p.amount) || 0;
      cumulativePaid += amt;
      const remaining = Math.max(0, netFee - cumulativePaid);
      const refParts = [blankStr(p.reference_number), blankStr(p.receipt_number)].filter(Boolean);
      return [
        String(idx + 1),
        fmtDate(p.payment_date),
        fmtCurrency(amt),
        methodLabel(p.payment_method),
        refParts.join(' / ') || '—',
        blankStr(p.notes) || '—',
        fmtCurrency(remaining),
      ];
    });

    autoTable(doc, {
      startY: y + 4,
      margin: { left: margin, right: margin },
      tableWidth: contentWidth,
      theme: 'grid',
      head: [['#', 'Date', 'Amount', 'Method', 'Ref / Receipt', 'Notes', 'Balance']],
      body,
      styles: {
        font: 'helvetica',
        fontSize: 8.5,
        textColor: [25, 25, 25],
        cellPadding: 4,
        lineColor: [180, 180, 180],
        lineWidth: 0.4,
        overflow: 'linebreak',
        valign: 'middle',
      },
      headStyles: {
        fillColor: [245, 245, 245],
        textColor: [30, 30, 30],
        fontStyle: 'bold',
        fontSize: 8.5,
      },
      columnStyles: {
        0: { cellWidth: 22, halign: 'center' },
        1: { cellWidth: 62 },
        2: { cellWidth: 58, halign: 'right' },
        3: { cellWidth: 70 },
        4: { cellWidth: 78 },
        5: { cellWidth: contentWidth - 22 - 62 - 58 - 70 - 78 - 62 },
        6: { cellWidth: 62, halign: 'right' },
      },
    });
    y = (doc.lastAutoTable?.finalY ?? y) + 16;
  }

  // Leave room for signature + footer on last page
  const pageHeight = doc.internal.pageSize.getHeight();
  const signatureBlockHeight = 56;
  const footerClearance = 48;
  if (y > pageHeight - signatureBlockHeight - footerClearance) {
    doc.addPage();
    y = margin + 20;
  } else {
    y = Math.max(y + 28, pageHeight - signatureBlockHeight - footerClearance);
  }

  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.6);
  const sigLineWidth = 150;
  const sigRight = pageWidth - margin;
  const sigLeft = sigRight - sigLineWidth;
  const sigLineY = y + 28;
  doc.line(sigLeft, sigLineY, sigRight, sigLineY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);
  doc.text('Authorised Signature', sigRight, sigLineY + 14, { align: 'right' });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const ph = doc.internal.pageSize.getHeight();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    doc.text(
      `Place: ${placeFromAddress(collegeReport.address)}  ·  Date: ${formatGeneratedAt()}`,
      margin,
      ph - 28
    );
    doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, ph - 28, { align: 'center' });
  }

  const namePart = sanitizeFilePart(fullName.replace(/\s+/g, '_') || 'Student');
  const rollPart = sanitizeFilePart(blankStr(student.roll_number) || 'NA');
  const yearPart = sanitizeFilePart(yearLabel.replace(/\s+/g, '_') || 'year');
  doc.save(`Fee_Receipt_${rollPart}_${namePart}_${yearPart}.pdf`);
}

/**
 * Single payment receipt PDF — for handing to a parent after a payment.
 * @param {{ student: object, fee: object, payment: object, academicYear: string }} args
 */
export async function exportPaymentReceiptPdf({ student, fee, payment, academicYear }) {
  if (!student) throw new Error('Student is required');
  if (!fee) throw new Error('Fee record is required');
  if (!payment) throw new Error('Payment is required');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  let y = await drawSchoolHeader(doc, { pageWidth, margin });

  const yearLabel = blankStr(academicYear) || blankStr(fee.academic_year) || '—';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 15, 15);
  doc.text('PAYMENT RECEIPT', pageWidth / 2, y, { align: 'center' });
  y += 17;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);
  doc.text(`Academic Year: ${yearLabel}`, pageWidth / 2, y, { align: 'center' });
  y += 22;

  const fullName =
    [blankStr(student.first_name), blankStr(student.last_name)].filter(Boolean).join(' ') || '—';
  const classLabel = [blankStr(student.class_name), blankStr(student.section_code)]
    .filter(Boolean)
    .join(' — ') || '—';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(25, 25, 25);
  doc.text('Student details', margin, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 9.5,
      textColor: [30, 30, 30],
      cellPadding: { top: 3, bottom: 3, left: 0, right: 8 },
    },
    body: [
      ['Name', fullName, 'Roll No.', blankStr(student.roll_number) || '—'],
      ['Class / Section', classLabel, 'Date', formatGeneratedAt()],
    ],
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 88, textColor: [80, 80, 80] },
      1: { cellWidth: contentWidth / 2 - 88 },
      2: { fontStyle: 'bold', cellWidth: 72, textColor: [80, 80, 80] },
      3: { cellWidth: contentWidth / 2 - 72 },
    },
  });

  y = (doc.lastAutoTable?.finalY ?? y) + 18;

  const payAmt = Number(payment.amount) || 0;
  const refParts = [blankStr(payment.reference_number), blankStr(payment.receipt_number)].filter(Boolean);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(25, 25, 25);
  doc.text('Payment details', margin, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 9.5,
      textColor: [25, 25, 25],
      cellPadding: 5,
      lineColor: [180, 180, 180],
      lineWidth: 0.4,
    },
    body: [
      [
        { content: 'Amount received', styles: { fontStyle: 'bold', fillColor: [248, 248, 248] } },
        fmtCurrency(payAmt),
        { content: 'Payment date', styles: { fontStyle: 'bold', fillColor: [248, 248, 248] } },
        fmtDate(payment.payment_date),
      ],
      [
        { content: 'Method', styles: { fontStyle: 'bold', fillColor: [248, 248, 248] } },
        methodLabel(payment.payment_method),
        { content: 'Ref / Receipt', styles: { fontStyle: 'bold', fillColor: [248, 248, 248] } },
        refParts.join(' / ') || '—',
      ],
      [
        { content: 'Notes', styles: { fontStyle: 'bold', fillColor: [248, 248, 248] } },
        {
          content: blankStr(payment.notes) || '—',
          colSpan: 3,
        },
      ],
    ],
    columnStyles: {
      0: { cellWidth: contentWidth * 0.22 },
      1: { cellWidth: contentWidth * 0.28 },
      2: { cellWidth: contentWidth * 0.22 },
      3: { cellWidth: contentWidth * 0.28 },
    },
  });

  y = (doc.lastAutoTable?.finalY ?? y) + 36;

  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.6);
  const sigLineWidth = 150;
  const sigRight = pageWidth - margin;
  const sigLeft = sigRight - sigLineWidth;
  const sigLineY = Math.min(y + 28, pageHeight - 70);
  doc.line(sigLeft, sigLineY, sigRight, sigLineY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);
  doc.text('Authorised Signature', sigRight, sigLineY + 14, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 110);
  doc.text(
    `Place: ${placeFromAddress(collegeReport.address)}  ·  Date: ${formatGeneratedAt()}`,
    margin,
    pageHeight - 28
  );

  const namePart = sanitizeFilePart(fullName.replace(/\s+/g, '_') || 'Student');
  const rollPart = sanitizeFilePart(blankStr(student.roll_number) || 'NA');
  const datePart = sanitizeFilePart(String(payment.payment_date ?? '').slice(0, 10) || 'payment');
  doc.save(`Payment_Receipt_${rollPart}_${namePart}_${datePart}.pdf`);
}
