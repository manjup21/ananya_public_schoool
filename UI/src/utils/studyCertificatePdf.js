import jsPDF from 'jspdf';

import { collegeReport } from '../config/collegeReport';
import { sanitizeFilePart } from './fileExport';
import { blankStr, drawDoubleBorder, loadImageAsDataUrl } from './pdfHelpers';

function formatDob(v) {
  if (!v) return '';
  const s = String(v).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const [y, m, d] = s.split('-');
  return `${d}-${m}-${y}`;
}

function formatIssueDate(d = new Date()) {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}-${month}-${d.getFullYear()}`;
}

function genderWords(gender) {
  const g = String(gender ?? '').trim().toLowerCase();
  if (g === 'female') return { title: 'Kum.', relation: 'D/o', pronoun: 'Her', subject: 'She' };
  if (g === 'male') return { title: 'Chi.', relation: 'S/o', pronoun: 'His', subject: 'He' };
  return { title: 'Kum./Chi.', relation: 'S/o / D/o', pronoun: 'His / Her', subject: 'He / She' };
}

/**
 * Draw one certificate line made of fixed text and fill-in fields.
 * Fields share the width left over after the text, in proportion to their `weight`;
 * each field is an underline with its value (if any) centred above it.
 */
function drawFormLine(doc, segments, { x, y, width, fontSize }) {
  doc.setFontSize(fontSize);
  const gap = 4;
  let textW = 0;
  let totalWeight = 0;
  for (const seg of segments) {
    if (seg.field) totalWeight += seg.weight ?? 1;
    else {
      doc.setFont('times', 'normal');
      textW += doc.getTextWidth(seg.text);
    }
  }
  const gapTotal = segments
    .filter((s) => s.field)
    .reduce((sum, s) => sum + gap + (s.gapAfter ?? gap), 0);
  const fieldSpace = Math.max(0, width - textW - gapTotal);

  let cx = x;
  for (const seg of segments) {
    if (!seg.field) {
      doc.setFont('times', 'normal');
      doc.text(seg.text, cx, y);
      cx += doc.getTextWidth(seg.text);
      continue;
    }
    const w = (fieldSpace * (seg.weight ?? 1)) / (totalWeight || 1);
    const fx = cx + gap;
    doc.setLineWidth(0.6);
    doc.line(fx, y + 3, fx + w, y + 3);
    const value = blankStr(seg.value);
    if (value) {
      doc.setFont('times', 'bold');
      let size = fontSize;
      while (size > 8 && doc.getTextWidth(value) > w - 4) {
        size -= 0.5;
        doc.setFontSize(size);
      }
      doc.text(value, fx + w / 2, y, { align: 'center' });
      doc.setFontSize(fontSize);
    }
    cx = fx + w + (seg.gapAfter ?? gap);
  }
}

/**
 * Generate a Study Certificate PDF. Values left blank print as empty underlines to fill by hand.
 *
 * @param {object} p
 * @param {object} p.student ERP student fields (name, gender, father_name, date_of_birth, roll_number…)
 * @param {object} [p.details] { fromClass, toClass, fromYear, toYear, caste }
 */
export async function exportStudyCertificatePdf({ student, details = {} }) {
  if (!student) throw new Error('Student is required');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 56;
  const contentWidth = pageWidth - margin * 2;

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  drawDoubleBorder(doc, pageWidth, pageHeight);

  const logoDataUrl = await loadImageAsDataUrl(collegeReport.logoUrl);
  let y = 52;
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', pageWidth / 2 - 32, y, 64, 64);
      y += 76;
    } catch {
      y += 12;
    }
  }

  doc.setTextColor(30, 30, 30);
  doc.setFont('times', 'normal');
  doc.setFontSize(10.5);
  doc.text(collegeReport.association, pageWidth / 2, y, { align: 'center' });
  y += 22;

  doc.setFont('times', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 15, 15);
  for (const line of doc.splitTextToSize(collegeReport.collegeName.toUpperCase(), contentWidth)) {
    doc.text(line, pageWidth / 2, y, { align: 'center' });
    y += 20;
  }

  doc.setFont('times', 'bold');
  doc.setFontSize(10);
  doc.text(collegeReport.affiliation, pageWidth / 2, y, { align: 'center' });
  y += 15;

  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(45, 45, 45);
  const addressText = [collegeReport.address, collegeReport.phone ? `PH: ${collegeReport.phone}` : '']
    .filter(Boolean)
    .join('. ');
  for (const line of doc.splitTextToSize(addressText, contentWidth)) {
    doc.text(line, pageWidth / 2, y, { align: 'center' });
    y += 14;
  }

  y += 8;
  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageWidth - margin, y);
  y += 44;

  doc.setFont('times', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(15, 15, 15);
  const title = 'STUDY CERTIFICATE';
  doc.text(title, pageWidth / 2, y, { align: 'center' });
  const titleW = doc.getTextWidth(title);
  doc.setLineWidth(1);
  doc.line(pageWidth / 2 - titleW / 2, y + 4, pageWidth / 2 + titleW / 2, y + 4);
  y += 52;

  const words = genderWords(student.gender);
  const fullName = [blankStr(student.first_name), blankStr(student.last_name)].filter(Boolean).join(' ');
  const parent = blankStr(student.father_name) || blankStr(student.guardian_name);
  const admissionNo = blankStr(student.enrolment_number) || blankStr(student.roll_number);
  const line = { x: margin, width: contentWidth, fontSize: 13 };
  const lineGap = 40;

  drawFormLine(
    doc,
    [{ text: `This is to certify that ${words.title}` }, { field: true, value: fullName.toUpperCase() }],
    { ...line, y }
  );
  y += lineGap;
  drawFormLine(
    doc,
    [
      { text: words.relation },
      { field: true, value: parent.toUpperCase(), weight: 1.6 },
      { text: 'has studied from' },
      { field: true, value: details.fromClass },
      { text: 'to' },
      { field: true, value: details.toClass },
    ],
    { ...line, y }
  );
  y += lineGap;
  drawFormLine(
    doc,
    [
      { text: 'In our institute from' },
      { field: true, value: details.fromYear },
      { text: 'to' },
      { field: true, value: details.toYear },
      { text: 'Academic years.' },
    ],
    { ...line, y }
  );
  y += lineGap;
  drawFormLine(
    doc,
    [
      { text: `${words.pronoun} Date of Birth is` },
      { field: true, value: formatDob(student.date_of_birth), gapAfter: 0 },
      { text: `. ${words.subject} belongs to` },
      { field: true, value: details.caste, weight: 1.4 },
      { text: 'caste.' },
    ],
    { ...line, y }
  );

  y += lineGap + 100;
  doc.setFont('times', 'normal');
  doc.setFontSize(line.fontSize);
  const footerRows = [
    ['Admission No:', admissionNo],
    ['Date:', formatIssueDate()],
  ];
  const labelW = Math.max(...footerRows.map(([label]) => doc.getTextWidth(label)));
  const fieldX = margin + labelW + 8;
  const fieldW = 130;
  footerRows.forEach(([label, value], i) => {
    const rowY = y + i * lineGap;
    doc.setFont('times', 'normal');
    doc.setFontSize(line.fontSize);
    doc.text(label, margin, rowY);
    doc.setLineWidth(0.6);
    doc.line(fieldX, rowY + 3, fieldX + fieldW, rowY + 3);
    doc.setFont('times', 'bold');
    doc.text(blankStr(value), fieldX + fieldW / 2, rowY, { align: 'center' });
  });

  doc.setFont('times', 'bold');
  doc.setFontSize(line.fontSize);
  doc.text('Signature of the Head of the Institute', pageWidth - margin, y, { align: 'right' });

  const namePart = sanitizeFilePart((fullName || 'Student').replace(/\s+/g, '_'));
  const rollPart = sanitizeFilePart(blankStr(student.roll_number) || 'NA');
  doc.save(`Study_Certificate_${rollPart}_${namePart}.pdf`);
}
