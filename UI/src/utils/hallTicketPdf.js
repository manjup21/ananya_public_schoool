import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { collegeReport } from '../config/collegeReport';
import { preloadAdminSignature } from './adminSignature';
import { downloadBlob, sanitizeFilePart } from './fileExport';
import { loadImageAsDataUrl } from './pdfHelpers';
import { HALL_TICKET_IMAGE_PRESETS, optimizeImageDataUrl } from './pdfImageOptimize';

export const BULK_HALL_TICKET_MAX = 120;

const TICKETS_PER_PAGE = 2;
const LOGO_URL = collegeReport.logoUrl;
const NOTE = 'Daily bring the hall ticket without fail, Without hall ticket not allowed to Exam.';
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatDateDay(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ''));
  if (!m) return '—';
  const day = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getDay();
  return `${m[3]}-${m[2]}-${m[1]} / ${WEEKDAYS[day]}`;
}

function formatTime12(value) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(value ?? ''));
  if (!m) return '';
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'am' : 'pm'}`;
}

function formatTimeRange(sub) {
  const start = formatTime12(sub?.start_time);
  const end = formatTime12(sub?.end_time);
  if (start && end) return `${start} - ${end}`;
  return start || end || '—';
}

function sortSubjects(subjects) {
  const key = (s) => `${String(s?.exam_date ?? '').slice(0, 10)} ${String(s?.start_time ?? '')}`;
  return [...(subjects ?? [])].sort((a, b) => key(a).localeCompare(key(b)));
}

/** Largest font size (<= max, >= min) at which `text` fits in `maxW`. */
function fitFontSize(doc, text, maxW, max, min) {
  let size = max;
  doc.setFontSize(size);
  while (size > min && doc.getTextWidth(text) > maxW) {
    size -= 0.5;
    doc.setFontSize(size);
  }
  return size;
}

function addImageSafe(doc, dataUrl, x, y, w, h) {
  if (!dataUrl) return;
  try {
    const fmt = String(dataUrl).includes('image/jpeg') ? 'JPEG' : 'PNG';
    doc.addImage(dataUrl, fmt, x, y, w, h, undefined, 'FAST');
  } catch {
    /* ignore broken asset */
  }
}

/** One hall ticket inside the vertical slot [top, top + height]. */
function drawTicket(doc, { top, height, student, rows, gradeLabel, title, logo, signature }) {
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 28;
  const boxX = margin;
  const boxW = pageW - 2 * margin;
  const boxTop = top + 16;
  const boxBottom = top + height - 16;
  const padX = boxX + 8;
  const centerX = pageW / 2;

  doc.setDrawColor(0);
  doc.setLineWidth(0.9);
  doc.rect(boxX, boxTop, boxW, boxBottom - boxTop);
  doc.setTextColor(0);

  const logoSize = 54;
  addImageSafe(doc, logo, boxX + 10, boxTop + 8, logoSize, logoSize);

  const headerMaxW = boxW - 2 * (logoSize + 22);
  let y = boxTop + 16;
  doc.setFont('times', 'bold');
  doc.setFontSize(8.5);
  doc.text(collegeReport.association, centerX, y, { align: 'center' });

  y += 18;
  const schoolLine = `${collegeReport.collegeName}, ${collegeReport.place}`;
  fitFontSize(doc, schoolLine, headerMaxW, 17, 11);
  doc.text(schoolLine, centerX, y, { align: 'center' });

  y += 12;
  doc.setFontSize(8);
  doc.text(collegeReport.affiliation, centerX, y, { align: 'center' });

  y += 17;
  fitFontSize(doc, title, headerMaxW + logoSize, 13.5, 10);
  doc.text(title, centerX, y, { align: 'center' });

  y = Math.max(y, boxTop + logoSize + 10) + 16;
  doc.setFontSize(10.5);
  doc.text(`Grade : ${gradeLabel}`, padX, y);

  y += 15;
  const name = [student?.first_name, student?.last_name].filter(Boolean).join(' ').trim() || '—';
  const regX = boxX + boxW * 0.62;
  doc.setFontSize(9.5);
  doc.text('STUDENT NAME:', padX, y);
  const nameX = padX + doc.getTextWidth('STUDENT NAME: ');
  fitFontSize(doc, name.toUpperCase(), regX - nameX - 10, 10, 7);
  doc.text(name.toUpperCase(), nameX, y);
  doc.setFontSize(9.5);
  doc.text('REG NO:', regX, y);
  doc.setFontSize(10);
  doc.text(String(student?.roll_number ?? '—'), regX + doc.getTextWidth('REG NO: ') + 2, y);

  const footerReserve = 58;
  const tableTop = y + 5;
  const available = boxBottom - footerReserve - tableTop;
  const rowCount = Math.max(rows.length, 1) + 1;
  const rowH = Math.max(13, Math.min(30, available / rowCount));
  const fontSize = Math.min(11, Math.max(7.5, rowH - 7));

  autoTable(doc, {
    startY: tableTop,
    margin: { left: boxX, right: margin, bottom: 0 },
    tableWidth: boxW,
    head: [['Date-Day', 'Time', 'Subject', 'Invigilator Signature']],
    body: rows.length ? rows : [['—', '—', 'No subjects', '']],
    theme: 'grid',
    pageBreak: 'avoid',
    styles: {
      font: 'times',
      fontStyle: 'bold',
      fontSize,
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.6,
      fillColor: false,
      halign: 'center',
      valign: 'middle',
      cellPadding: { top: 1, bottom: 1, left: 3, right: 3 },
      minCellHeight: rowH,
      overflow: 'ellipsize',
    },
    headStyles: { fillColor: false, textColor: [0, 0, 0], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: boxW * 0.28 },
      1: { cellWidth: boxW * 0.22 },
      2: { cellWidth: boxW * 0.24 },
      3: { cellWidth: 'auto' },
    },
  });

  y = (doc.lastAutoTable?.finalY ?? tableTop) + 13;
  doc.setFont('times', 'bold');
  doc.setFontSize(10);
  const noteLabel = 'Note:';
  const noteLabelW = doc.getTextWidth(noteLabel);
  doc.text(noteLabel, padX, y);
  doc.setLineWidth(0.6);
  doc.line(padX, y + 1.5, padX + noteLabelW, y + 1.5);
  doc.setFontSize(9.5);
  const noteLines = doc.splitTextToSize(NOTE, boxW - 16 - noteLabelW - 4);
  doc.text(noteLines, padX + noteLabelW + 4, y);

  const signY = boxBottom - 10;
  doc.setFontSize(10);
  doc.text('Student Sign', padX, signY);
  doc.text('Principal Sign', boxX + boxW - 8, signY, { align: 'right' });
  addImageSafe(doc, signature, boxX + boxW - 98, signY - 44, 86, 34);
}

let cachedAssetsPromise = null;

export function preloadHallTicketAssets() {
  if (!cachedAssetsPromise) {
    cachedAssetsPromise = (async () => {
      const [rawLogo, rawSignature] = await Promise.all([
        loadImageAsDataUrl(LOGO_URL),
        preloadAdminSignature(),
      ]);
      const [logoDataUrl, signatureDataUrl] = await Promise.all([
        rawLogo ? optimizeImageDataUrl(rawLogo, HALL_TICKET_IMAGE_PRESETS.logo) : null,
        rawSignature ? optimizeImageDataUrl(rawSignature, HALL_TICKET_IMAGE_PRESETS.signature) : null,
      ]);
      return { logoDataUrl, signatureDataUrl };
    })();
  }
  return cachedAssetsPromise;
}

/**
 * Build and download one PDF with every student's hall ticket, two tickets per A4 page.
 *
 * @returns {Promise<{ downloaded: number, skippedFailed: number }>}
 */
export async function downloadHallTicketsPdf({
  students,
  subjects,
  classNameFor,
  sectionLabelFor,
  examName = 'Examination',
  academicYearLabel = '',
  fileLabel,
  onProgress,
}) {
  const list = (Array.isArray(students) ? students : []).filter((s) => s?.id);
  if (list.length > BULK_HALL_TICKET_MAX) {
    throw new Error(`At most ${BULK_HALL_TICKET_MAX} students per hall ticket download`);
  }
  const skippedFailed = (Array.isArray(students) ? students.length : 0) - list.length;
  if (!list.length) return { downloaded: 0, skippedFailed };

  const { logoDataUrl, signatureDataUrl } = await preloadHallTicketAssets();
  const rows = sortSubjects(subjects).map((sub) => [
    formatDateDay(sub.exam_date),
    formatTimeRange(sub),
    String(sub.name ?? '—'),
    '',
  ]);
  const title = academicYearLabel
    ? `${examName} Hall Ticket-${academicYearLabel}`
    : `${examName} Hall Ticket`;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true });
  const pageW = doc.internal.pageSize.getWidth();
  const slotH = doc.internal.pageSize.getHeight() / TICKETS_PER_PAGE;

  for (let i = 0; i < list.length; i += 1) {
    const slot = i % TICKETS_PER_PAGE;
    if (i > 0 && slot === 0) doc.addPage();
    if (slot > 0) {
      doc.setDrawColor(120);
      doc.setLineWidth(0.5);
      doc.setLineDashPattern([4, 3], 0);
      doc.line(14, slotH * slot, pageW - 14, slotH * slot);
      doc.setLineDashPattern([], 0);
    }

    const student = list[i];
    const className = classNameFor?.(student.class_id) ?? '—';
    const section = student.section_id ? sectionLabelFor?.(student.section_id) ?? '' : '';
    drawTicket(doc, {
      top: slotH * slot,
      height: slotH,
      student,
      rows,
      gradeLabel: section ? `${className} - ${section}` : className,
      title,
      logo: logoDataUrl,
      signature: signatureDataUrl,
    });

    onProgress?.(i + 1, list.length);
    if (i % 10 === 9) await new Promise((resolve) => setTimeout(resolve, 0));
  }

  const filename = `${sanitizeFilePart(fileLabel || `HallTickets_${examName}`)}.pdf`;
  downloadBlob(doc.output('blob'), filename);
  return { downloaded: list.length, skippedFailed };
}
