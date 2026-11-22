import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { normalizeSectionIds } from '../pages/examinationManagement/examinationHelpers';
import { sanitizeFilePart } from './fileExport';

function examDateOnly(exam) {
  return String(exam?.exam_date ?? '').slice(0, 10);
}

function matchesSection(exam, sectionId) {
  if (sectionId === 'whole') {
    if (exam.section_id != null && String(exam.section_id).trim() !== '') return false;
    if (normalizeSectionIds(exam?.section_ids).length) return false;
    return true;
  }
  const secId = String(exam.section_id ?? '');
  if (secId === String(sectionId)) return true;
  const ids = normalizeSectionIds(exam?.section_ids);
  if (ids.length) return ids.includes(String(sectionId));
  return exam.section_id == null || String(exam.section_id).trim() === '';
}

/**
 * Filter completed exams matching date range, class, section, and exam type.
 */
export function filterMatchingExams(examinations, { fromDate, toDate, classId, sectionId, examTypeId }) {
  return (examinations ?? []).filter((e) => {
    if (String(e?.exam_status ?? '').toLowerCase() !== 'completed') return false;
    if (String(e?.exam_status ?? '').toLowerCase() === 'cancelled') return false;
    if (String(e.class_id) !== String(classId)) return false;
    if (String(e.exam_type_id) !== String(examTypeId)) return false;
    if (!matchesSection(e, sectionId)) return false;
    const d = examDateOnly(e);
    if (!d || d < fromDate || d > toDate) return false;
    return true;
  });
}

/**
 * Pick up to 8 most recent exams; return oldest of selected first (left-to-right in report).
 */
export function selectExamsForConsolidation(exams, max = 8) {
  const sorted = [...(exams ?? [])].sort((a, b) =>
    String(b.exam_date ?? '').localeCompare(String(a.exam_date ?? ''))
  );
  return sorted.slice(0, max).reverse();
}

function examMaxMarks(exam, fullPayload) {
  const fromExam = Number(exam?.max_marks);
  if (Number.isFinite(fromExam) && fromExam > 0) return fromExam;
  const subjects = fullPayload?.subjects ?? exam?.subjects ?? [];
  return (subjects ?? []).reduce((sum, sub) => sum + (Number(sub.max_marks) || 0), 0);
}

function hasAnySubjectAbsent(resultRow, subjects) {
  const marks = Array.isArray(resultRow?.marks) ? resultRow.marks : [];
  const subjList = (subjects ?? []).length ? subjects : marks.map((m) => ({ id: m.subject_id }));
  if (!subjList.length) return marks.some((m) => m?.is_absent === true);
  return subjList.some((sub) => {
    const sid = sub.id ?? sub.subject_id;
    const m = marks.find((x) => String(x.subject_id) === String(sid));
    return m?.is_absent === true;
  });
}

function examCellValue(resultRow, subjects) {
  if (!resultRow) return null;
  if (hasAnySubjectAbsent(resultRow, subjects)) return 'Ab';
  const total = Number(resultRow.total_marks);
  if (Number.isFinite(total)) return total;
  return null;
}

function formatCell(v) {
  if (v === 'Ab') return 'Ab';
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return '—';
}

function assignRanks(rows) {
  const sorted = [...rows].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return String(a.student_name).localeCompare(String(b.student_name), undefined, { sensitivity: 'base' });
  });
  let rank = 0;
  let prevTotal = null;
  return sorted.map((r) => {
    if (r.total !== prevTotal) {
      rank += 1;
      prevTotal = r.total;
    }
    return { ...r, rank };
  });
}

/**
 * Build consolidated rows from selected exams and fetched full results payloads.
 */
export function buildConsolidatedRows(selectedExams, resultsByExamId) {
  const studentMap = new Map();

  for (const exam of selectedExams ?? []) {
    const payload = resultsByExamId?.[exam.id];
    const subjects = payload?.subjects ?? exam?.subjects ?? [];
    const results = Array.isArray(payload?.results) ? payload.results : [];

    for (const r of results) {
      const sid = r.student_id;
      if (!sid) continue;
      const cell = examCellValue(r, subjects);
      if (!studentMap.has(sid)) {
        studentMap.set(sid, {
          student_id: sid,
          student_name: r.student_name ?? '',
          roll_number: r.roll_number ?? '',
          marks: {},
        });
      }
      studentMap.get(sid).marks[exam.id] = cell;
    }
  }

  let rows = [...studentMap.values()].filter((s) =>
    (selectedExams ?? []).some((ex) => Object.prototype.hasOwnProperty.call(s.marks, ex.id))
  );

  rows = rows.map((row) => {
    let total = 0;
    for (const exam of selectedExams ?? []) {
      const v = row.marks[exam.id];
      if (typeof v === 'number' && Number.isFinite(v)) total += v;
    }
    return { ...row, total };
  });

  return assignRanks(rows);
}

export function deriveYearLabel(toDate) {
  if (!toDate) return '';
  const d = new Date(`${String(toDate).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(toDate).slice(0, 4);
  const year = d.getFullYear();
  const month = d.getMonth();
  if (month >= 5) return `${year}-${String(year + 1).slice(-2)}`;
  return `${year - 1}-${String(year).slice(-2)}`;
}

function examColumnLabel(exam, index) {
  const name = String(exam?.test_name ?? '').trim();
  return name || `Test ${index + 1}`;
}

export function buildConsolidatedTableMeta(selectedExams, resultsByExamId) {
  const columns = (selectedExams ?? []).map((exam, i) => ({
    key: exam.id,
    label: examColumnLabel(exam, i),
    maxMarks: examMaxMarks(exam, resultsByExamId?.[exam.id]),
    examDate: examDateOnly(exam),
    testName: exam.test_name ?? '',
  }));
  const grandMax = columns.reduce((sum, c) => sum + (Number(c.maxMarks) || 0), 0);
  return { columns, grandMax };
}

export function exportConsolidatedPdf({
  selectedExams,
  resultsByExamId,
  rows,
  className,
  sectionLabel,
  examTypeName,
  fromDate,
  toDate,
}) {
  if (!selectedExams?.length || !rows?.length) return;

  const { columns, grandMax } = buildConsolidatedTableMeta(selectedExams, resultsByExamId);
  const yearLabel = deriveYearLabel(toDate);
  const title = `${className}, ${examTypeName} Consolidated Marks List-${yearLabel}`;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text(title, pageWidth / 2, 36, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`${sectionLabel} · ${fromDate} to ${toDate}`, pageWidth / 2, 52, { align: 'center' });

  const head = [
    [
      'Sl.No',
      'Name of the students',
      ...columns.map((c) => `${c.label} (${c.maxMarks})`),
      `Total (${grandMax})`,
      'Rank',
    ],
  ];

  const body = rows.map((row, idx) => [
    String(idx + 1),
    String(row.student_name ?? '').toUpperCase(),
    ...columns.map((c) => formatCell(row.marks[c.key])),
    String(row.total ?? 0),
    String(row.rank ?? '—'),
  ]);

  autoTable(doc, {
    head,
    body,
    startY: 64,
    styles: {
      font: 'helvetica',
      fontSize: 8,
      textColor: [0, 0, 0],
      cellPadding: 3,
      halign: 'center',
      valign: 'middle',
      lineWidth: 0.5,
      lineColor: [0, 0, 0],
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 7,
      lineWidth: 0.5,
      lineColor: [0, 0, 0],
      overflow: 'linebreak',
    },
    bodyStyles: {
      textColor: [0, 0, 0],
      fontStyle: 'normal',
      lineWidth: 0.5,
      lineColor: [0, 0, 0],
    },
    columnStyles: {
      0: { cellWidth: 28, halign: 'center' },
      1: { cellWidth: 90, halign: 'left' },
    },
    didParseCell: (data) => {
      const totalCol = 2 + columns.length;
      const rankCol = totalCol + 1;
      if (data.section === 'body' && (data.column.index === totalCol || data.column.index === rankCol)) {
        data.cell.styles.fontStyle = 'bold';
      }
    },
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      doc.text(
        `Page ${data.pageNumber} / ${pageCount}`,
        data.settings.margin.left,
        doc.internal.pageSize.height - 16
      );
    },
  });

  const filename = `Consolidated_${sanitizeFilePart(className)}_${sanitizeFilePart(examTypeName)}_${sanitizeFilePart(fromDate)}_${sanitizeFilePart(toDate)}.pdf`;
  doc.save(filename);
}

export { formatCell };
