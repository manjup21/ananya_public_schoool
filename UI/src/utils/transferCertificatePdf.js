import jsPDF from 'jspdf';

import { collegeReport } from '../config/collegeReport';
import { formatDateOfBirthInWordsTc, formatDobNumeric } from '../utils/dateToWordsEn';
import { PASSPORT_PHOTO_PDF } from '../utils/passportPhoto';
import { buildTransferCertificateRecord } from '../pages/downloads/transferCertificateData';
import { sanitizeFilePart } from './fileExport';
import { blankStr, loadImageAsDataUrl } from './pdfHelpers';

/** A4 portrait */
const PAGE_W = 595.28;
const PAGE_H = 841.89;

const FONT = {
  label: 10.5,
  value: 12,
  labelLine: 13,
  valueLine: 14,
  title: 18,
  headerAssoc: 13,
  headerName: 22,
  headerAddr: 12.5,
  meta: 10.5,
  footer: 11,
};

function formatDisplayDate(v) {
  if (!v) return '';
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const day = String(v.getDate()).padStart(2, '0');
    const month = String(v.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${v.getFullYear()}`;
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
  }
  return s;
}

function strokeRect(doc, x, y, w, h, lineW = 0.7) {
  doc.setDrawColor(20, 20, 20);
  doc.setLineWidth(lineW);
  doc.rect(x, y, w, h);
}

function vLine(doc, x, y1, y2) {
  doc.setDrawColor(20, 20, 20);
  doc.setLineWidth(0.7);
  doc.line(x, y1, x, y2);
}

function hLine(doc, x1, x2, y) {
  doc.setDrawColor(20, 20, 20);
  doc.setLineWidth(0.7);
  doc.line(x1, y, x2, y);
}

function wrapCount(doc, text, maxW, fontSize, style = 'normal') {
  doc.setFont('times', style);
  doc.setFontSize(fontSize);
  return doc.splitTextToSize(blankStr(text) || '—', maxW);
}

/**
 * Distribute extra vertical space across rows so the table fills tableBudget.
 */
function allocateHeights(baseHeights, tableBudget) {
  const sum = baseHeights.reduce((a, b) => a + b, 0);
  if (sum >= tableBudget) {
    // Shrink proportionally if somehow over (keep mins readable)
    const scale = tableBudget / sum;
    return baseHeights.map((h) => Math.max(26, Math.floor(h * scale)));
  }
  const extra = tableBudget - sum;
  // Weight taller/complex rows a bit more when stretching
  const weights = baseHeights.map((h) => h);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const out = baseHeights.map((h, i) => h + Math.floor((extra * weights[i]) / weightSum));
  // Fix rounding remainder on last rows
  let used = out.reduce((a, b) => a + b, 0);
  let i = out.length - 1;
  while (used < tableBudget && i >= 0) {
    out[i] += 1;
    used += 1;
    i -= 1;
  }
  return out;
}

function drawSimpleRow(doc, { x, y, w, h, labelW, label, value }) {
  strokeRect(doc, x, y, w, h);
  vLine(doc, x + labelW, y, y + h);

  const padX = 6;
  const padY = 8;
  const labelMax = labelW - padX * 2;
  const valueMax = w - labelW - padX * 2;

  const labelLines = wrapCount(doc, label, labelMax, FONT.label, 'normal');
  const valueLines = wrapCount(doc, value, valueMax, FONT.value, 'bold');

  doc.setTextColor(25, 25, 25);
  doc.setFont('times', 'normal');
  doc.setFontSize(FONT.label);
  let ly = y + padY + FONT.label * 0.75;
  for (const line of labelLines) {
    doc.text(line, x + padX, ly);
    ly += FONT.labelLine;
  }

  doc.setFont('times', 'bold');
  doc.setFontSize(FONT.value);
  let vy = y + padY + FONT.value * 0.75;
  for (const line of valueLines) {
    doc.text(line, x + labelW + padX, vy);
    vy += FONT.valueLine;
  }
}

function drawParentsRow(doc, { x, y, w, h, labelW, label, father, mother }) {
  strokeRect(doc, x, y, w, h);
  vLine(doc, x + labelW, y, y + h);
  const midY = y + h / 2;
  hLine(doc, x + labelW, x + w, midY);

  const padX = 6;
  const padY = 8;

  const labelLines = wrapCount(doc, label, labelW - padX * 2, FONT.label, 'normal');
  doc.setFont('times', 'normal');
  doc.setFontSize(FONT.label);
  doc.setTextColor(25, 25, 25);
  let ly = y + padY + FONT.label * 0.75;
  for (const line of labelLines) {
    doc.text(line, x + padX, ly);
    ly += FONT.labelLine;
  }

  doc.setFont('times', 'bold');
  doc.setFontSize(FONT.value);
  const halfPad = 7;
  doc.text(`Father: ${blankStr(father).toUpperCase() || '—'}`, x + labelW + padX, y + halfPad + FONT.value * 0.75);
  doc.text(
    `Mother: ${blankStr(mother).toUpperCase() || '—'}`,
    x + labelW + padX,
    midY + halfPad + FONT.value * 0.75
  );
}

function drawDobRow(doc, { x, y, w, h, labelW, label, dobNo, dobWords }) {
  strokeRect(doc, x, y, w, h);
  vLine(doc, x + labelW, y, y + h);
  const midY = y + h / 2;
  hLine(doc, x + labelW, x + w, midY);

  const padX = 6;
  const padY = 8;
  const labelLines = wrapCount(doc, label, labelW - padX * 2, FONT.label, 'normal');
  doc.setFont('times', 'normal');
  doc.setFontSize(FONT.label);
  doc.setTextColor(25, 25, 25);
  let ly = y + padY + FONT.label * 0.75;
  for (const line of labelLines) {
    doc.text(line, x + padX, ly);
    ly += FONT.labelLine;
  }

  const halfPad = 7;
  doc.setFont('times', 'normal');
  doc.setFontSize(FONT.label);
  doc.text('In No.:', x + labelW + padX, y + halfPad + FONT.label * 0.75);
  doc.setFont('times', 'bold');
  doc.setFontSize(FONT.value);
  doc.text(blankStr(dobNo) || '—', x + labelW + padX + 42, y + halfPad + FONT.value * 0.75);

  doc.setFont('times', 'normal');
  doc.setFontSize(FONT.label);
  doc.text('In Words:', x + labelW + padX, midY + halfPad + FONT.label * 0.75);
  doc.setFont('times', 'bold');
  doc.setFontSize(FONT.value - 0.5);
  const words = wrapCount(doc, dobWords, w - labelW - padX * 2 - 58, FONT.value - 0.5, 'bold');
  let wy = midY + halfPad + FONT.value * 0.7;
  for (const line of words) {
    doc.text(line, x + labelW + padX + 58, wy);
    wy += FONT.valueLine - 1;
  }
}

/**
 * Field 8: left label spans full height; right has exam title + 4 bordered sub-rows.
 */
function drawExamRow(doc, { x, y, w, h, labelW, label, examName, registerNo, month, year, result }) {
  strokeRect(doc, x, y, w, h);
  vLine(doc, x + labelW, y, y + h);

  const padX = 6;
  const padY = 7;
  const labelLines = wrapCount(doc, label, labelW - padX * 2, FONT.label, 'normal');
  doc.setFont('times', 'normal');
  doc.setFontSize(FONT.label);
  doc.setTextColor(25, 25, 25);
  let ly = y + padY + FONT.label * 0.75;
  for (const line of labelLines) {
    doc.text(line, x + padX, ly);
    ly += FONT.labelLine;
  }

  const rightX = x + labelW;
  const rightW = w - labelW;
  const subLabelW = Math.min(95, rightW * 0.38);
  const titleH = Math.max(28, Math.floor(h * 0.22));
  const subH = (h - titleH) / 4;

  // Exam title band
  doc.setFont('times', 'bold');
  doc.setFontSize(FONT.value);
  doc.text(blankStr(examName) || '—', rightX + padX, y + titleH / 2 + FONT.value * 0.35);
  hLine(doc, rightX, x + w, y + titleH);

  const subs = [
    ['Register No.:', blankStr(registerNo) || '—'],
    ['Month:', blankStr(month) || '—'],
    ['Year:', blankStr(year) || '—'],
    ['Result:', blankStr(result) || '—'],
  ];

  for (let i = 0; i < 4; i += 1) {
    const sy = y + titleH + i * subH;
    if (i > 0) hLine(doc, rightX, x + w, sy);
    vLine(doc, rightX + subLabelW, sy, sy + subH);

    doc.setFont('times', 'normal');
    doc.setFontSize(FONT.label);
    doc.text(subs[i][0], rightX + padX, sy + subH / 2 + FONT.label * 0.35);

    doc.setFont('times', 'bold');
    doc.setFontSize(FONT.value);
    doc.text(subs[i][1], rightX + subLabelW + padX, sy + subH / 2 + FONT.value * 0.35);
  }
}

/**
 * School Transfer Certificate — paper-form layout.
 * Table height is calculated to fill the page down to the footer band.
 */
export async function exportTransferCertificatePdf({
  student,
  className = '',
  extras = {},
  manualMode = false,
  manualStudent = null,
}) {
  const data = buildTransferCertificateRecord({
    student,
    className,
    extras,
    manualMode,
    manualStudent,
  });

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  // Content inset from page edge; outerPad keeps the frame outside the content with clear air.
  const margin = 40;
  const outerPad = 10;
  const contentW = PAGE_W - margin * 2;
  const footerBand = 52;
  const tableBottom = PAGE_H - margin - footerBand;

  // Page wash + outer frame
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
  doc.setDrawColor(20, 20, 20);
  doc.setLineWidth(1.1);
  doc.rect(margin - outerPad, margin - outerPad, contentW + outerPad * 2, PAGE_H - (margin - outerPad) * 2);

  const logoDataUrl = await loadImageAsDataUrl(collegeReport.logoUrl);
  const photoW = Math.max(PASSPORT_PHOTO_PDF.widthPt, 72);
  const photoH = Math.max(PASSPORT_PHOTO_PDF.heightPt, 92);
  const photoX = PAGE_W - margin - photoW;
  let y = margin + 4;

  // Header: logo | text | photo
  const logoSize = 84;
  const logoY = y + Math.max(0, (photoH - logoSize) / 2);
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', margin, logoY, logoSize, logoSize);
    } catch {
      /* skip */
    }
  }

  const headerLeft = margin + logoSize + 8;
  const headerRight = photoX - 8;
  const headerW = Math.max(140, headerRight - headerLeft);
  const headerCenter = headerLeft + headerW / 2;
  const assocGap = FONT.headerName + 6;
  const nameGap = FONT.headerName + 4;
  const addrGap = FONT.headerAddr + 4;

  doc.setFont('times', 'bold');
  doc.setFontSize(FONT.headerName);
  const nameLines = doc.splitTextToSize(collegeReport.collegeName, headerW);
  doc.setFont('times', 'normal');
  doc.setFontSize(FONT.headerAddr);
  const addr = [collegeReport.address, collegeReport.phone ? `PH:${collegeReport.phone}` : '']
    .filter(Boolean)
    .join('. ');
  const addrLines = addr ? doc.splitTextToSize(addr, headerW) : [];

  // Centre the text block against the photo box so the header height (and everything below) is unchanged.
  const capTop = FONT.headerAssoc * 0.72;
  const blockH =
    capTop +
    assocGap +
    (nameLines.length - 1) * nameGap +
    addrGap +
    (addrLines.length ? addrGap + (addrLines.length - 1) * addrGap : 0) +
    FONT.headerAddr * 0.22;
  let hy = y + Math.max(0, (photoH - blockH) / 2) + capTop;

  doc.setFont('times', 'normal');
  doc.setFontSize(FONT.headerAssoc);
  doc.setTextColor(40, 40, 40);
  doc.text(blankStr(collegeReport.association), headerCenter, hy, { align: 'center' });
  hy += assocGap;

  doc.setFont('times', 'bold');
  doc.setFontSize(FONT.headerName);
  doc.setTextColor(110, 45, 25);
  nameLines.forEach((line, i) => {
    if (i > 0) hy += nameGap;
    doc.text(line, headerCenter, hy, { align: 'center' });
  });

  hy += addrGap;
  doc.setFont('times', 'bold');
  doc.setFontSize(FONT.headerAddr);
  doc.setTextColor(30, 30, 30);
  doc.text(collegeReport.affiliation, headerCenter, hy, { align: 'center' });

  doc.setFont('times', 'normal');
  doc.setFontSize(FONT.headerAddr);
  doc.setTextColor(25, 75, 140);
  for (const line of addrLines) {
    hy += addrGap;
    doc.text(line, headerCenter, hy, { align: 'center' });
  }
  hy += FONT.headerAddr * 0.3;

  // Photo
  doc.setFillColor(255, 255, 255);
  strokeRect(doc, photoX, y, photoW, photoH, 0.9);
  if (data.photoDataUrl) {
    try {
      doc.addImage(data.photoDataUrl, 'JPEG', photoX + 1.5, y + 1.5, photoW - 3, photoH - 3);
    } catch {
      doc.setFont('times', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text('PHOTO', photoX + photoW / 2, y + photoH / 2, { align: 'center' });
    }
  } else {
    doc.setFont('times', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text('PHOTO', photoX + photoW / 2, y + photoH / 2, { align: 'center' });
  }

  y = Math.max(logoY + logoSize, y + photoH, hy) + 12;

  doc.setFont('times', 'bold');
  doc.setFontSize(FONT.title);
  doc.setTextColor(15, 15, 15);
  doc.text('TRANSFER CERTIFICATE', PAGE_W / 2, y, { align: 'center' });
  y += 24;

  doc.setFont('times', 'bold');
  doc.setFontSize(FONT.meta);
  doc.setTextColor(20, 20, 20);
  const affiliationNo = blankStr(collegeReport.collegeCode);
  if (affiliationNo) doc.text(`Affiliation No: ${affiliationNo}`, margin, y);
  doc.text(`Year: ${blankStr(data.academicYear) || '—'}`, PAGE_W - margin, y, { align: 'right' });
  y += 10;

  const tableX = margin;
  const tableW = contentW;
  const labelW = Math.round(tableW * 0.46);
  const tableStartY = y;
  const tableBudget = Math.max(420, tableBottom - tableStartY);

  // Base heights tuned to paper form proportions (then stretched to fill).
  const baseHeights = [
    34, // TC No
    34, // Admission
    36, // Name
    48, // Parents
    48, // DOB
    34, // Nationality
    34, // Religion
    34, // Caste
    50, // Class leaving
    108, // Examination (+ 4 subrows)
    38, // Qualified
    36, // Application
    36, // Issue
    36, // Conduct
  ];

  const heights = allocateHeights(baseHeights, tableBudget);
  // Ensure exact pixel fill of budget
  const heightSum = heights.reduce((a, b) => a + b, 0);
  if (heightSum < tableBudget) heights[heights.length - 1] += tableBudget - heightSum;

  const rows = [
    { type: 'simple', label: 'Transfer Certificate No', value: blankStr(data.tcNo) || '—' },
    { type: 'simple', label: 'Admission No.:', value: blankStr(data.admissionNo) || '—' },
    {
      type: 'simple',
      label: '1. Name of the Student:',
      value: blankStr(data.pupilName).toUpperCase() || '—',
    },
    {
      type: 'parents',
      label: '2. Name of the Parents:',
      father: data.fatherName,
      mother: data.motherName,
    },
    {
      type: 'dob',
      label: '3. Date of Birth:',
      dobNo: formatDobNumeric(data.dateOfBirth),
      dobWords: formatDateOfBirthInWordsTc(data.dateOfBirth),
    },
    { type: 'simple', label: '4. Nationality:', value: blankStr(data.nationality) || '—' },
    { type: 'simple', label: '5. Religion:', value: blankStr(data.religion).toUpperCase() || '—' },
    { type: 'simple', label: '6. Caste:', value: blankStr(data.caste).toUpperCase() || '—' },
    {
      type: 'simple',
      label: '7. Class in which the student was studying at the time of leaving the institution:',
      value: blankStr(data.classLeaving).toUpperCase() || '—',
    },
    {
      type: 'exam',
      label: '8. The Examination attended by the student:',
      examName: blankStr(data.examinationAttended).toUpperCase(),
      registerNo: data.registerNo,
      month: blankStr(data.examMonth).toUpperCase(),
      year: data.examYear,
      result: blankStr(data.examResult).toUpperCase(),
    },
    {
      type: 'simple',
      label: '9. Whether Qualified for Next Higher Class:',
      value: blankStr(data.qualifiedNextClass).toUpperCase() || '—',
    },
    {
      type: 'simple',
      label: '10. Date of Application:',
      value: formatDisplayDate(data.dateOfApplication) || '—',
    },
    {
      type: 'simple',
      label: '11. Date of the Issue of TC:',
      value: formatDisplayDate(data.dateOfIssue) || '—',
    },
    {
      type: 'simple',
      label: '12. Conduct of the Student:',
      value: blankStr(data.conduct).toUpperCase() || '—',
    },
  ];

  let rowY = tableStartY;
  for (let i = 0; i < rows.length; i += 1) {
    const h = heights[i];
    const row = rows[i];
    const common = { x: tableX, y: rowY, w: tableW, h, labelW, label: row.label };

    if (row.type === 'parents') {
      drawParentsRow(doc, { ...common, father: row.father, mother: row.mother });
    } else if (row.type === 'dob') {
      drawDobRow(doc, { ...common, dobNo: row.dobNo, dobWords: row.dobWords });
    } else if (row.type === 'exam') {
      drawExamRow(doc, {
        ...common,
        examName: row.examName,
        registerNo: row.registerNo,
        month: row.month,
        year: row.year,
        result: row.result,
      });
    } else {
      drawSimpleRow(doc, { ...common, value: row.value });
    }
    rowY += h;
  }

  // Footer — just under the stretched table
  const footerY = Math.min(rowY + 22, PAGE_H - margin - 18);
  doc.setFont('times', 'normal');
  doc.setFontSize(FONT.footer);
  doc.setTextColor(20, 20, 20);
  doc.text(`Date: ${formatDisplayDate(data.dateOfIssue) || '_______________'}`, margin, footerY);
  doc.text('Principal', PAGE_W - margin, footerY, { align: 'right' });
  doc.setFontSize(9);
  doc.setTextColor(70, 70, 70);
  doc.text('(with seal)', PAGE_W - margin, footerY + 13, { align: 'right' });

  const namePart = sanitizeFilePart(data.pupilName.replace(/\s+/g, '_') || 'Student');
  const rollPart = sanitizeFilePart(data.rollNumber || data.admissionNo || 'NA');
  doc.save(`Transfer_Certificate_${rollPart}_${namePart}.pdf`);
}
