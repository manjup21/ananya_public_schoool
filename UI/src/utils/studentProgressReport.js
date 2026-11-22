import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { collegeReport } from '../config/collegeReport';
import { deriveYearLabel } from './consolidatedResults';
import { todayDateOnly } from './dateOnly';
import { sanitizeFilePart } from './fileExport';
import { loadImageAsDataUrl } from './pdfHelpers';

/** Same defaults as the student profile PDF (no date range, all exam types). */
export const DEFAULT_PROGRESS_REPORT_FILTERS = {
  from: '',
  to: '',
  examTypeId: 'all',
};

function examRowHasAbsent(marksBySubjectId, subjects) {
  return (subjects ?? []).some((sub) => {
    const v = marksBySubjectId?.[sub.id] ?? marksBySubjectId?.[String(sub.id)];
    return v === 'Ab' || v === 'ab';
  });
}

/** True only when every subject with a mark on this exam row is absent. */
function examRowAllAbsent(marksBySubjectId, subjects) {
  let hasMarkedSubject = false;
  for (const sub of subjects ?? []) {
    const v = marksBySubjectId?.[sub.id] ?? marksBySubjectId?.[String(sub.id)];
    if (v == null || v === '' || v === 'null') continue;
    hasMarkedSubject = true;
    if (v !== 'Ab' && v !== 'ab') return false;
  }
  return hasMarkedSubject;
}

/** Subject cell: Ab | obtained/max | — */
function formatSubjectCell(markValue, maxMarks) {
  if (markValue === 'Ab' || markValue === 'ab') return 'Ab';
  if (markValue == null || markValue === '' || markValue === 'null') return '—';
  const obtained = Number(markValue);
  if (!Number.isFinite(obtained)) return '—';
  const max = Number(maxMarks);
  if (Number.isFinite(max) && max > 0) return `${obtained}/${max}`;
  return String(obtained);
}

/** Total cell: Ab only if all subjects absent; else obtained/max (absent subjects count as 0 in total). */
function formatTotalCell(exam, subjects) {
  const marks = exam?.marksBySubjectId ?? {};
  if (examRowAllAbsent(marks, subjects)) return 'Ab';
  const obtained = Number(exam?.total);
  if (!Number.isFinite(obtained)) return '—';
  const max = Number(exam?.maxTotal);
  if (Number.isFinite(max) && max > 0) return `${obtained}/${max}`;
  return String(obtained);
}

function readExamRankMeta(exam) {
  const rank = Number(exam?.rank ?? exam?.examRank ?? exam?.exam_rank);
  const total = Number(exam?.totalStudents ?? exam?.total_students ?? exam?.totalStudentCount);
  return { rank, total };
}

/** Rank cell: Ab if absent; otherwise rank/totalStudents */
function formatRankCell(exam, subjects) {
  const marks = exam?.marksBySubjectId ?? {};
  if (examRowHasAbsent(marks, subjects)) return 'Ab';
  const { rank, total } = readExamRankMeta(exam);
  if (Number.isFinite(rank) && rank > 0 && Number.isFinite(total) && total > 0) {
    return `${Math.trunc(rank)}/${Math.trunc(total)}`;
  }
  return '—';
}

function examRowLabel(exam) {
  return String(exam?.testName ?? exam?.testLabel ?? '').trim() || '—';
}

function testColumnWidth(exams, tableWidth) {
  const longest = Math.max(4, ...(exams ?? []).map((e) => examRowLabel(e).length));
  const min = 64;
  const max = Math.min(130, Math.max(min, tableWidth * 0.28));
  return Math.min(max, Math.max(min, longest * 5.2));
}

function tableFontSizeForColumns(columnCount) {
  if (columnCount > 10) return 8;
  if (columnCount > 8) return 8.5;
  return 9;
}

function buildTableStyles(columnCount) {
  const fontSize = tableFontSizeForColumns(columnCount);
  return {
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize,
      textColor: [0, 0, 0],
      cellPadding: 3,
      halign: 'center',
      valign: 'middle',
      lineWidth: 0.75,
      lineColor: [0, 0, 0],
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize,
      lineWidth: 0.75,
      lineColor: [0, 0, 0],
    },
    bodyStyles: {
      textColor: [0, 0, 0],
      fontStyle: 'normal',
      lineWidth: 0.75,
      lineColor: [0, 0, 0],
    },
    tableLineWidth: 0.75,
    tableLineColor: [0, 0, 0],
  };
}

const PAGE_BORDER_INSET = 22;
const CONTENT_INNER_PAD = 14;

function getPageLayout(doc) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const inset = PAGE_BORDER_INSET;
  const pad = CONTENT_INNER_PAD;
  const left = inset + pad;
  const right = pageWidth - inset - pad;
  const top = inset + pad + 10;
  const bottom = pageHeight - inset - pad;
  return {
    pageWidth,
    pageHeight,
    inset,
    left,
    right,
    top,
    bottom,
    contentWidth: right - left,
    footerY: bottom - 10,
    principalY: bottom - 32,
    tableBottomMargin: pageHeight - bottom + 44,
  };
}

function drawReportHeader(doc, logoDataUrl, layout) {
  const { pageWidth, top } = layout;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);

  const logoSize = 64;
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', pageWidth / 2 - logoSize / 2, top + 4, logoSize, logoSize);
    } catch {
      /* skip logo */
    }
  }

  let y = top + logoSize + 20;
  doc.setFontSize(12);
  doc.text(collegeReport.association, pageWidth / 2, y, { align: 'center' });
  y += 22;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.text(collegeReport.collegeName, pageWidth / 2, y, { align: 'center' });
  y += 17;
  doc.setFontSize(10.5);
  doc.text(collegeReport.affiliation, pageWidth / 2, y, { align: 'center' });
  y += 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(collegeReport.address, pageWidth / 2, y, { align: 'center' });
  return y + 24;
}

function drawStudentBlock(doc, { studentName, className, sectionLabel, rollNumber }, startY, layout) {
  const { left, right } = layout;
  const lineGap = 15;
  const y = startY + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`Student Name : ${String(studentName ?? '').toUpperCase()}`, left, y);
  doc.text(`Class : ${className ?? '—'}`, right, y, { align: 'right' });
  doc.text(`Section : ${sectionLabel ?? '—'}`, right, y + lineGap, { align: 'right' });
  doc.text(`Reg No : ${rollNumber ?? '—'}`, right, y + lineGap * 2, { align: 'right' });
  return y + lineGap * 2 + 20;
}

function drawPageBorder(doc) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const inset = PAGE_BORDER_INSET;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(1);
  doc.rect(inset, inset, w - inset * 2, h - inset * 2, 'S');
}

function drawPageFooters(doc, layout) {
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p += 1) {
    doc.setPage(p);
    drawPageBorder(doc);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(`Page ${p} / ${pageCount}`, layout.left, layout.footerY);
  }
}

function formatFilterDate(iso) {
  const s = String(iso ?? '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  const [y, m, d] = s.split('-');
  return `${d}-${m}-${y}`;
}

function buildDateFilterLabel(fromDate, toDate) {
  const fromLabel = formatFilterDate(fromDate);
  const toLabel = formatFilterDate(toDate);
  if (fromLabel && toLabel) return `Exam period: ${fromLabel} to ${toLabel}`;
  if (fromLabel) return `Exam period: from ${fromLabel}`;
  if (toLabel) return `Exam period: up to ${toLabel}`;
  return null;
}

function drawDateFilterNote(doc, fromDate, toDate, startY, layout) {
  const label = buildDateFilterLabel(fromDate, toDate);
  if (!label) return startY;
  const { pageWidth } = layout;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text(label, pageWidth / 2, startY, { align: 'center' });
  return startY + 16;
}

function drawTitle(doc, yearLabel, startY, layout) {
  const { pageWidth } = layout;
  const title = `PROGRESS REPORT-${yearLabel}`;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(title, pageWidth / 2, startY, { align: 'center' });
  const tw = doc.getTextWidth(title);
  const cx = pageWidth / 2;
  doc.line(cx - tw / 2, startY + 4, cx + tw / 2, startY + 4);
  return startY + 28;
}

/**
 * @param {object} params
 * @param {object} params.student
 * @param {string} params.className
 * @param {string} params.sectionLabel
 * @param {string} params.fromDate
 * @param {string} params.toDate
 * @param {Array} params.sections - from progress-report API
 */
export async function exportStudentProgressPdf({
  student,
  className,
  sectionLabel,
  fromDate,
  toDate,
  sections,
}) {
  const secs = Array.isArray(sections) ? sections : [];
  if (!secs.length) return;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const logoDataUrl = await loadImageAsDataUrl(collegeReport.logoUrl);
  const yearLabel = deriveYearLabel(toDate || fromDate || todayDateOnly());
  const studentName = [student?.first_name, student?.last_name].filter(Boolean).join(' ').trim();
  const rollNumber = student?.roll_number ?? '—';

  const layout = getPageLayout(doc);
  let cursorY = drawReportHeader(doc, logoDataUrl, layout);
  cursorY = drawStudentBlock(doc, { studentName, className, sectionLabel, rollNumber }, cursorY, layout);
  cursorY = drawTitle(doc, yearLabel, cursorY, layout);
  cursorY = drawDateFilterNote(doc, fromDate, toDate, cursorY, layout);

  const { pageWidth, pageHeight, left: hMargin, contentWidth: tableWidth, tableBottomMargin } = layout;
  const marginBottom = tableBottomMargin;

  for (const section of secs) {
    const subjects = Array.isArray(section.subjects) ? section.subjects : [];
    const exams = Array.isArray(section.exams) ? section.exams : [];
    if (!exams.length) continue;

    const sectionTitle = `${String(section.examTypeName ?? 'Exam').toUpperCase()} MARKS`;

    if (cursorY > pageHeight - marginBottom - 60) {
      doc.addPage();
      cursorY = layout.top;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(sectionTitle, pageWidth / 2, cursorY, { align: 'center' });
    cursorY += 18;

    const head = [
      [
        'Exam',
        ...subjects.map((sub) => String(sub.name ?? '').toUpperCase()),
        'Total',
        'Rank',
      ],
    ];

    const body = exams.map((exam) => {
      const marks = exam.marksBySubjectId ?? {};
      return [
        examRowLabel(exam),
        ...subjects.map((sub) => {
          const maxById = exam.maxMarksBySubjectId ?? {};
          const max =
            maxById[sub.id] ?? maxById[String(sub.id)] ?? sub.maxMarks;
          return formatSubjectCell(
            marks[sub.id] ?? marks[String(sub.id)],
            max
          );
        }),
        formatTotalCell(exam, subjects),
        formatRankCell(exam, subjects),
      ];
    });

    const columnCount = head[0].length;
    const rankCol = columnCount - 1;
    const totalCol = columnCount - 2;
    const rankColWidth = 44;
    const totalColWidth = 56;
    const fixedColWidth = totalColWidth + rankColWidth;
    const testColWidth = testColumnWidth(exams, tableWidth);
    const subjectColWidth =
      subjects.length > 0 ? (tableWidth - testColWidth - fixedColWidth) / subjects.length : 40;
    const columnStyles = {
      0: { cellWidth: testColWidth, halign: 'left', overflow: 'linebreak' },
      [totalCol]: { cellWidth: totalColWidth, halign: 'center', fontStyle: 'bold' },
      [rankCol]: { cellWidth: rankColWidth, halign: 'center', fontStyle: 'bold' },
    };
    subjects.forEach((_, i) => {
      columnStyles[i + 1] = { cellWidth: subjectColWidth, halign: 'center' };
    });

    autoTable(doc, {
      head,
      body,
      startY: cursorY,
      margin: { left: hMargin, right: hMargin, bottom: tableBottomMargin },
      tableWidth,
      ...buildTableStyles(columnCount),
      columnStyles,
      didParseCell: (data) => {
        if (data.section === 'body' && (data.column.index === totalCol || data.column.index === rankCol)) {
          data.cell.styles.fontStyle = 'bold';
        }
        const text = String(data.cell.raw ?? '');
        if (text === 'Ab' && data.section === 'body') {
          data.cell.styles.fontStyle = 'bold';
        }
      },
      didDrawPage: () => {
        drawPageBorder(doc);
      },
    });

    cursorY = (doc.lastAutoTable?.finalY ?? cursorY) + 16;
  }

  const pageCount = doc.getNumberOfPages();
  doc.setPage(pageCount);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text('PRINCIPAL', layout.right, layout.principalY, { align: 'right' });

  drawPageFooters(doc, layout);

  const rangePart =
    fromDate && toDate
      ? `${sanitizeFilePart(fromDate)}_${sanitizeFilePart(toDate)}`
      : fromDate
        ? `from_${sanitizeFilePart(fromDate)}`
        : toDate
          ? `to_${sanitizeFilePart(toDate)}`
          : 'all_exams';
  const filename = `ProgressReport_${sanitizeFilePart(studentName)}_${rangePart}.pdf`;
  doc.save(filename);
}
