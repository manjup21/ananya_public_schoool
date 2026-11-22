import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { collegeReport } from '../config/collegeReport';
import { PASSPORT_PHOTO_PDF } from './passportPhoto';
import { preloadAdminSignature } from './adminSignature';
import { HALL_TICKET_IMAGE_PRESETS, optimizeImageDataUrl } from './pdfImageOptimize';

export const BULK_STUDENT_REPORT_MAX = 80;

const REPORT_TAGLINE = "OUR LITTLE ONES ARE TOMORROW'S GENIUS";

/** Palette matched to the Genius Techno progress-report sample. */
const C = {
  navy: [18, 52, 100],
  gold: [246, 236, 214],
  goldSoft: [232, 240, 250],
  cardBorder: [170, 196, 226],
  text: [30, 35, 45],
  muted: [90, 95, 105],
  white: [255, 255, 255],
  rowAlt: [255, 255, 255],
  summaryRow: [222, 234, 248],
  tableLine: [196, 170, 120],
  total: [196, 30, 40],
};

/** Inner padding from page edge (clears double border on left/right). */
const PAGE_MARGIN = 24;
/** Bottom reserve for Class Teacher / Head Mistress signature row (+ wet ink). */
const FOOTER_RESERVE = 78;

/** Academic year is June → May (e.g. June 2026–May 2027 → "2026-27"). */
export function deriveYearLabel(toDate) {
  if (!toDate) return '';
  const d = new Date(`${String(toDate).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(toDate).slice(0, 4);
  const year = d.getFullYear();
  const month = d.getMonth(); // 0 = Jan … 5 = Jun
  // From June onward the AY starts this calendar year; Jan–May still belong to the prior AY.
  const startYear = month >= 5 ? year : year - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

function sanitizeFilePart(s) {
  return String(s ?? '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80);
}

function examRowHasAbsent(marksBySubjectId, subjects) {
  return (subjects ?? []).some((sub) => {
    const v = marksBySubjectId?.[sub.id] ?? marksBySubjectId?.[String(sub.id)];
    return v === 'Ab' || v === 'ab';
  });
}

/**
 * CCE grade scale (percentage):
 * A+ 90–100 | A 70–89 | B+ 50–69 | B 30–49 | C 0–29
 */
function gradeFromPercent(pct) {
  if (!Number.isFinite(pct)) return null;
  if (pct >= 90) return 'A+';
  if (pct >= 70) return 'A';
  if (pct >= 50) return 'B+';
  if (pct >= 30) return 'B';
  return 'C';
}

function gradeFromMarks(obtained, maxMarks) {
  const max = Number(maxMarks);
  const got = Number(obtained);
  if (!Number.isFinite(got) || !Number.isFinite(max) || max <= 0) return null;
  return gradeFromPercent((got / max) * 100);
}

/** Half-up convert obtained marks from max scale to conversion scale. */
function convertMark(obtained, maxMarks, conversionMarks) {
  const max = Number(maxMarks);
  const conv = Number(conversionMarks);
  const got = Number(obtained);
  if (!Number.isFinite(got) || !Number.isFinite(max) || max <= 0) return null;
  const scale = Number.isFinite(conv) && conv > 0 ? conv : max;
  return Math.round((got * scale) / max);
}

/** Subject cell parts: obtained marks (converted) and letter grade separately. */
function subjectCellParts(markValue, maxMarks, conversionMarks) {
  if (markValue === 'Ab' || markValue === 'ab') return { marks: 'Ab', grade: 'Ab' };
  if (markValue == null || markValue === '' || markValue === 'null') return { marks: '—', grade: '—' };
  const obtained = Number(markValue);
  if (!Number.isFinite(obtained)) return { marks: '—', grade: '—' };
  const max = Number(maxMarks);
  if (!Number.isFinite(max) || max <= 0) return { marks: String(obtained), grade: '—' };
  const convRaw = Number(conversionMarks);
  const conv = Number.isFinite(convRaw) && convRaw > 0 ? convRaw : max;
  const converted = convertMark(obtained, max, conv);
  if (converted == null) return { marks: '—', grade: '—' };
  const grade = gradeFromMarks(converted, conv);
  // Max is shown once in the Marks column header — cell shows obtained only.
  return { marks: String(converted), grade: grade || '—', max: conv };
}

/** Shared per-subject max for an exam column (conversion scale), or null if mixed/unknown. */
function examSharedSubjectMax(exam, subjects) {
  const vals = new Set();
  for (const sub of subjects ?? []) {
    const conv = Number(subjectConversionForExam(exam, sub));
    if (Number.isFinite(conv) && conv > 0) vals.add(conv);
  }
  if (vals.size === 1) return [...vals][0];
  return null;
}

/**
 * Combined total for one subject across several exams of the same type
 * (e.g. SA-I + SA-II): sum converted marks + grade on the combined scale.
 */
function combinedSubjectParts(sourceExams, sub) {
  let obtained = 0;
  let max = 0;
  let any = false;
  for (const exam of sourceExams ?? []) {
    const marks = exam?.marksBySubjectId ?? {};
    const raw = marks[sub?.id] ?? marks[String(sub?.id ?? '')];
  if (raw === 'Ab' || raw === 'ab') return { marks: 'Ab', grade: 'Ab', pct: null };
  if (raw == null || raw === '' || raw === 'null') continue;
  const got = Number(raw);
  if (!Number.isFinite(got)) continue;
  const subMax = subjectMaxForExam(exam, sub);
  const subConv = subjectConversionForExam(exam, sub);
  const converted = convertMark(got, subMax, subConv);
  if (converted == null || !Number.isFinite(Number(subConv)) || Number(subConv) <= 0) continue;
  obtained += converted;
  max += Number(subConv);
  any = true;
}
if (!any) return { marks: '—', grade: '—', pct: null };
const grade = gradeFromMarks(obtained, max);
return {
  marks: `${obtained}/${max}`,
  grade: grade || '—',
  pct: formatPercent(obtained, max),
};
}

/** Percentage string for obtained/max (e.g. 67% or 67.5%). */
function formatPercent(obtained, max) {
  if (!Number.isFinite(obtained) || !Number.isFinite(max) || max <= 0) return null;
  const pct = Math.round((obtained / max) * 1000) / 10;
  return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%`;
}

/** TOTAL row for a combined exam-type column (sum of all constituent exam totals). */
function combinedExamTotalParts(sourceExams, subjects) {
  let obtained = 0;
  let max = 0;
  let any = false;
  for (const exam of sourceExams ?? []) {
    const totals = convertedExamTotals(exam, subjects);
    if (totals.absent) return { marks: 'Ab', grade: 'Ab', pct: null };
    if (!Number.isFinite(totals.obtained) || !Number.isFinite(totals.max) || totals.max <= 0) continue;
    obtained += totals.obtained;
    max += totals.max;
    any = true;
  }
  if (!any) return { marks: '—', grade: '—', pct: null };
  const grade = gradeFromMarks(obtained, max);
  return {
    marks: `${obtained}/${max}`,
    grade: grade || '—',
    pct: formatPercent(obtained, max),
  };
}

/** Total cell parts for one exam column pair. */
function totalCellParts(exam, subjects) {
  if (exam?.isCombined) {
    return combinedExamTotalParts(exam.sourceExams, subjects);
  }
  const totals = convertedExamTotals(exam, subjects);
  if (totals.absent) return { marks: 'Ab', grade: 'Ab', pct: null };
  if (!Number.isFinite(totals.obtained) || !Number.isFinite(totals.max) || totals.max <= 0) {
    return { marks: '—', grade: '—', pct: null };
  }
  const grade = gradeFromMarks(totals.obtained, totals.max);
  return {
    marks: `${totals.obtained}/${totals.max}`,
    grade: grade || '—',
    pct: formatPercent(totals.obtained, totals.max),
  };
}

/** Resolve per-exam subject max; fall back to section-level subject max. */
function subjectMaxForExam(exam, sub) {
  const map = exam?.maxMarksBySubjectId ?? {};
  const raw = map[sub?.id] ?? map[String(sub?.id ?? '')];
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return n;
  const fallback = Number(sub?.maxMarks);
  return Number.isFinite(fallback) && fallback > 0 ? fallback : null;
}

function subjectConversionForExam(exam, sub) {
  const map = exam?.conversionMarksBySubjectId ?? {};
  const raw = map[sub?.id] ?? map[String(sub?.id ?? '')];
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return n;
  return subjectMaxForExam(exam, sub);
}

/** Converted total for an exam row (sum of subject conversions). */
function convertedExamTotals(exam, subjects) {
  const marks = exam?.marksBySubjectId ?? {};
  if (examRowHasAbsent(marks, subjects)) {
    return { absent: true, obtained: null, max: null };
  }
  let obtained = 0;
  let max = 0;
  let any = false;
  for (const sub of subjects ?? []) {
    const raw = marks[sub.id] ?? marks[String(sub.id)];
    if (raw == null || raw === '' || raw === 'null') continue;
    const got = Number(raw);
    if (!Number.isFinite(got)) continue;
    const subMax = subjectMaxForExam(exam, sub);
    const subConv = subjectConversionForExam(exam, sub);
    const converted = convertMark(got, subMax, subConv);
    if (converted == null || !Number.isFinite(Number(subConv)) || Number(subConv) <= 0) continue;
    obtained += converted;
    max += Number(subConv);
    any = true;
  }
  if (!any) {
    // Fall back to raw exam totals when subject maps are missing.
    const rawObtained = Number(exam?.total);
    const rawMax = Number(exam?.maxTotal);
    if (Number.isFinite(rawObtained) && Number.isFinite(rawMax) && rawMax > 0) {
      return { absent: false, obtained: rawObtained, max: rawMax };
    }
    return { absent: false, obtained: null, max: null };
  }
  return { absent: false, obtained, max };
}

function formatExamDate(exam) {
  const raw = exam?.examDate ?? exam?.exam_date ?? null;
  if (raw == null || raw === '') return '';
  // ISO date (YYYY-MM-DD) or timestamp — avoid timezone shift for pure dates.
  const s = String(raw).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return s;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

/** Student DOB for the report card (DD.MM.YYYY). */
function formatStudentDob(raw) {
  if (raw == null || raw === '') return '—';
  const s = String(raw).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function examHeaderLabel(exam, { includeDate = true } = {}) {
  const name = String(exam?.testName ?? exam?.testLabel ?? '').trim() || '—';
  if (!includeDate) return name;
  const date = formatExamDate(exam);
  return date ? `${name}\n${date}` : name;
}

function examDateSortKey(exam) {
  const raw = exam?.examDate ?? exam?.exam_date ?? null;
  if (raw == null || raw === '') return Number.MAX_SAFE_INTEGER;
  const s = String(raw).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? Number.MAX_SAFE_INTEGER : d.getTime();
}

/**
 * Merge FA/SA (etc.) sections into one subject list + exams ordered oldest → newest.
 */
function buildUnifiedPartA(sections) {
  const byId = new Map();
  const orderScore = new Map();
  const exams = [];

  for (const section of Array.isArray(sections) ? sections : []) {
    (section.subjects ?? []).forEach((sub, idx) => {
      const id = String(sub?.id ?? '');
      if (!id) return;
      if (!byId.has(id)) byId.set(id, sub);
      const prev = orderScore.get(id);
      if (prev == null || idx < prev) orderScore.set(id, idx);
    });
    for (const exam of section.exams ?? []) {
      exams.push({
        ...exam,
        examTypeId: section.examTypeId ?? null,
        examTypeName: section.examTypeName ?? null,
      });
    }
  }

  const subjects = [...byId.values()].sort((a, b) => {
    const da = orderScore.get(String(a.id)) ?? 9999;
    const db = orderScore.get(String(b.id)) ?? 9999;
    if (da !== db) return da - db;
    return String(a.name ?? '').localeCompare(String(b.name ?? ''), undefined, { sensitivity: 'base' });
  });

  exams.sort((a, b) => {
    const d = examDateSortKey(a) - examDateSortKey(b);
    if (d !== 0) return d;
    const na = String(a?.testName ?? a?.testLabel ?? '');
    const nb = String(b?.testName ?? b?.testLabel ?? '');
    return na.localeCompare(nb, undefined, { sensitivity: 'base' });
  });

  return { subjects, exams };
}

/** All Part A exams when Final Result is included (no exam-type filter). */
function examsForTotalMarksType(exams, totalMarks) {
  if (!totalMarks || totalMarks.include !== true) return [];
  return Array.isArray(exams) ? exams : [];
}

/** Marks-only cell for PART-A TOTAL row (percentage is a separate row). */
function formatTotalMarksOnly(parts) {
  if (!parts) return '—';
  if (parts.marks === 'Ab' || parts.marks === '—' || parts.marks == null) return parts.marks || '—';
  return String(parts.marks);
}

function formatTotalPercentOnly(parts) {
  if (!parts) return '—';
  if (parts.marks === 'Ab') return 'Ab';
  if (parts.marks === '—' || parts.marks == null) return '—';
  return parts.pct || '—';
}

/**
 * Larger readable type on A4 portrait; scales down only when many exams force narrow columns.
 * examCount 6 (typical FA×4 + SA×2) → ~8pt body.
 */
function partAFonts(examCount) {
  // Slightly larger type; still aimed at one page with Part B × 6.
  if (examCount >= 8) return { body: 7.5, head: 6.5, subject: 7.5, pad: 1.4 };
  if (examCount >= 6) return { body: 8, head: 7, subject: 8, pad: 1.7 };
  if (examCount >= 4) return { body: 8.5, head: 7.5, subject: 8.5, pad: 2 };
  return { body: 9, head: 8, subject: 9, pad: 2.2 };
}

async function loadImageAsDataUrl(url) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Load school logo once (reuse across bulk PDF generation). */
export async function loadSchoolReportLogo() {
  const raw = await loadImageAsDataUrl(collegeReport.logoUrl);
  return raw ? optimizeImageDataUrl(raw, HALL_TICKET_IMAGE_PRESETS.logo) : null;
}

/** Load Head Mistress signature once (reuse across bulk PDF generation). */
export async function loadHeadMistressSignature() {
  const raw = await preloadAdminSignature();
  return raw ? optimizeImageDataUrl(raw, HALL_TICKET_IMAGE_PRESETS.signature) : null;
}

/** Keep only the given exam in progress-report sections (drops sections left empty). */
export function sectionsForExam(sections, examId) {
  return (Array.isArray(sections) ? sections : [])
    .map((section) => ({
      ...section,
      exams: (section?.exams ?? []).filter((exam) => String(exam?.examinationId) === String(examId)),
    }))
    .filter((section) => section.exams.length > 0);
}

export async function prepareReportPhoto(photoDataUrl) {
  return photoDataUrl ? optimizeImageDataUrl(photoDataUrl, HALL_TICKET_IMAGE_PRESETS.photo) : null;
}

function getPageLayout(doc) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const left = PAGE_MARGIN;
  const right = pageWidth - PAGE_MARGIN;
  const top = PAGE_MARGIN;
  const bottom = pageHeight - PAGE_MARGIN;
  return {
    pageWidth,
    pageHeight,
    left,
    right,
    top,
    bottom,
    contentWidth: right - left,
    // Keep signature row (+ Head Mistress ink) clearly above the double page border.
    principalY: pageHeight - 32,
    tableBottomMargin: FOOTER_RESERVE,
  };
}

function roundedRect(doc, x, y, w, h, r, style = 'F') {
  const radius = Math.min(r, w / 2, h / 2);
  doc.roundedRect(x, y, w, h, radius, radius, style);
}

/** "GENIUS TECHNO RESIDENTIAL SCHOOL" → ["GENIUS TECHNO", "RESIDENTIAL SCHOOL"] (balanced by length). */
function splitSchoolName(name) {
  const words = String(name ?? '').trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (words.length < 3) return [words.join(' ')];
  let best = 1;
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i += 1) {
    const diff = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
}

function drawReportHeader(doc, logoDataUrl, layout, studentPhotoDataUrl, yearLabel = '') {
  const { top, left, right, contentWidth } = layout;
  const logoSize = 84;
  const photoW = PASSPORT_PHOTO_PDF.widthPt;
  const photoH = PASSPORT_PHOTO_PDF.heightPt;
  const sideW = Math.max(logoSize, photoW) + 8;
  const textLeft = left + sideW;
  const textRight = right - sideW;
  const textW = textRight - textLeft;
  const centerX = (textLeft + textRight) / 2;

  const nameLines = splitSchoolName(collegeReport.collegeName);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const addressLines = collegeReport.address ? doc.splitTextToSize(collegeReport.address, textW) : [];

  const nameLineH = 25;
  const addressLineH = 12.5;
  const affiliationH = 13;
  const textBlockH = nameLines.length * nameLineH + affiliationH + 4 + addressLines.length * addressLineH;
  const headerH = Math.max(logoSize, photoH, textBlockH);

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', left, top + (headerH - logoSize) / 2, logoSize, logoSize);
    } catch {
      /* skip */
    }
  }

  let y = top + (headerH - textBlockH) / 2 + 19;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.navy);
  let nameSize = 24;
  doc.setFontSize(nameSize);
  while (nameSize > 12 && nameLines.some((line) => doc.getTextWidth(line) > textW)) {
    nameSize -= 0.5;
    doc.setFontSize(nameSize);
  }
  nameLines.forEach((line) => {
    doc.text(line, centerX, y, { align: 'center' });
    y += nameLineH;
  });

  y -= 6;
  doc.setFontSize(10);
  doc.text(collegeReport.affiliation, centerX, y, { align: 'center' });
  y += affiliationH;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...C.text);
  addressLines.forEach((line) => {
    doc.text(line, centerX, y, { align: 'center' });
    y += addressLineH;
  });

  const photoX = right - photoW;
  const photoY = top + (headerH - photoH) / 2;
  if (studentPhotoDataUrl) {
    try {
      const fmt = String(studentPhotoDataUrl).startsWith('data:image/png') ? 'PNG' : 'JPEG';
      doc.addImage(studentPhotoDataUrl, fmt, photoX, photoY, photoW, photoH);
    } catch {
      /* skip photo */
    }
  }
  doc.setDrawColor(...C.navy);
  doc.setLineWidth(PASSPORT_PHOTO_PDF.borderPt);
  doc.rect(photoX, photoY, photoW, photoH);

  y = top + headerH + 8;

  doc.setDrawColor(...C.navy);
  doc.setLineWidth(0.8);
  doc.line(left, y, right, y);
  y += 8;

  const yearPart = yearLabel ? String(yearLabel).replace('-', ' - ') : '';
  const title = (yearPart ? `Progress Report ${yearPart}` : 'Progress Report').toUpperCase();
  const titleH = 21;
  const titlePadX = 12;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  const titleW = Math.min(contentWidth, doc.getTextWidth(title) + titlePadX * 2);
  const titleX = left + (contentWidth - titleW) / 2;

  doc.setFillColor(...C.navy);
  roundedRect(doc, titleX, y, titleW, titleH, 5, 'F');

  doc.setTextColor(...C.white);
  doc.text(title, left + contentWidth / 2, y + titleH / 2 + 3.5, { align: 'center' });

  return y + titleH + 6;
}

function drawStudentCard(doc, fields, startY, layout) {
  const { left, contentWidth } = layout;
  const padX = 10;
  const padY = 8;
  const colGap = 8;
  const cols = 3;
  const rows = 2;
  const labelFontSize = 7.5;
  const valueFontSize = 9;
  const valueLineH = 10.5;
  const labelValueGap = 10;
  const rowGap = 6;
  const maxValueWidth = (contentWidth - padX * 2 - colGap * (cols - 1)) / cols;

  const cells = Array.from({ length: cols * rows }, (_, i) => fields[i] ?? null);

  const wrapped = cells.map((cell) => {
    if (!cell || (!cell.label && (cell.value == null || cell.value === ''))) {
      return { label: '', lines: [] };
    }
    const value = String(cell?.value ?? '—').toUpperCase();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(valueFontSize);
    const lines = doc.splitTextToSize(value, maxValueWidth);
    return {
      label: String(cell?.label ?? ''),
      lines: lines.length ? lines : ['—'],
    };
  });

  const rowHeights = [];
  for (let r = 0; r < rows; r++) {
    let maxLines = 1;
    for (let c = 0; c < cols; c++) {
      const cell = wrapped[r * cols + c];
      maxLines = Math.max(maxLines, cell?.lines?.length ?? 1);
    }
    rowHeights.push(labelFontSize + 2 + labelValueGap - labelFontSize + maxLines * valueLineH);
  }

  const cardH = padY * 2 + rowHeights.reduce((a, b) => a + b, 0) + rowGap * (rows - 1);
  const cardY = startY;

  doc.setFillColor(...C.goldSoft);
  doc.setDrawColor(...C.cardBorder);
  doc.setLineWidth(0.6);
  roundedRect(doc, left, cardY, contentWidth, cardH, 6, 'FD');
  doc.setDrawColor(...C.cardBorder);
  doc.setLineWidth(0.5);
  for (let c = 1; c < cols; c += 1) {
    const sepX = left + padX + c * (maxValueWidth + colGap) - colGap / 2 - 4;
    doc.line(sepX, cardY + padY, sepX, cardY + cardH - padY);
  }

  let rowTop = cardY + padY;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = wrapped[r * cols + c] ?? { label: '', lines: [] };
      if (!cell.label && (!cell.lines || !cell.lines.length)) continue;
      const x = left + padX + c * (maxValueWidth + colGap);
      const labelY = rowTop + labelFontSize;
      const valueY = labelY + labelValueGap;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(labelFontSize);
      doc.setTextColor(...C.muted);
      doc.text(cell.label, x, labelY, { maxWidth: maxValueWidth });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(valueFontSize);
      doc.setTextColor(...C.navy);
      doc.text(cell.lines, x, valueY);
    }
    rowTop += rowHeights[r] + rowGap;
  }

  return cardY + cardH + 6;
}

/**
 * Section title bar (Part A / Final Result / Part B): navy fill + gold underline.
 * Sits flush against the table below (no gap).
 */
function drawPartHeading(doc, title, startY, layout) {
  const { left, contentWidth } = layout;
  const h = 19;
  const y = startY + 2;

  doc.setFillColor(...C.navy);
  doc.roundedRect(left, y, contentWidth, h, 3, 3, 'F');
  doc.rect(left, y + h - 4, contentWidth, 4, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...C.white);
  doc.text(String(title).toUpperCase(), left + 12, y + 13);

  return y + h;
}

/**
 * PART-A unified grid: subjects as rows, exams (date order) as Marks|Grade columns.
 * @param {boolean} [hideExamDates] - omit FA/SA dates under headers (when Final Result is shown)
 */
function drawPartATable(doc, startY, layout, subjects, exams, hideExamDates = false) {
  const { left: hMargin, contentWidth: tableWidth, tableBottomMargin } = layout;
  if (!subjects.length || !exams.length) return startY;

  // Fit fully within A4 portrait; favours larger body text (marks/grades readers care about).
  const examCount = Math.max(1, exams.length);
  const fonts = partAFonts(examCount);
  if (subjects.length <= 8) fonts.pad += 1.5;
  const slW = examCount >= 7 ? 16 : 18;
  // Keep SUBJECTS reasonably narrow so Marks/Grade cells can use a larger type size.
  const subjectW = Math.min(
    examCount >= 7 ? 68 : examCount >= 5 ? 78 : examCount >= 3 ? 92 : 170,
    Math.max(56, tableWidth * (examCount >= 6 ? 0.13 : examCount >= 3 ? 0.16 : 0.3))
  );
  const pairW = (tableWidth - slW - subjectW) / examCount;
  const marksW = pairW * 0.58;
  const gradeW = pairW * 0.42;

  const head = [
    [
      { content: 'Sl.\nNo', rowSpan: 2, styles: { valign: 'middle', halign: 'center', fontSize: fonts.head } },
      {
        content: 'SUBJECTS',
        rowSpan: 2,
        styles: { valign: 'middle', halign: 'center', fontSize: fonts.head },
      },
      ...exams.map((exam) => ({
        content: examHeaderLabel(exam, { includeDate: !hideExamDates }),
        colSpan: 2,
        styles: { halign: 'center', valign: 'middle', fontSize: fonts.head },
      })),
    ],
    exams.flatMap((exam) => {
      const max = examSharedSubjectMax(exam, subjects);
      const marksLabel = max != null ? `Marks\n(${max})` : 'Marks';
      return [
        { content: marksLabel, styles: { halign: 'center', fontSize: fonts.head } },
        { content: 'Grade', styles: { halign: 'center', fontSize: fonts.head } },
      ];
    }),
  ];

  const body = subjects.map((sub, idx) => [
    String(idx + 1),
    String(sub.name ?? '').toUpperCase(),
    ...exams.flatMap((exam) => {
      const marks = exam.marksBySubjectId ?? {};
      const parts = subjectCellParts(
        marks[sub.id] ?? marks[String(sub.id)],
        subjectMaxForExam(exam, sub),
        subjectConversionForExam(exam, sub)
      );
      return [parts.marks, parts.grade];
    }),
  ]);

  const totalRow = [
    {
      content: 'TOTAL',
      colSpan: 2,
      styles: {
        fontStyle: 'bold',
        halign: 'center',
        textColor: C.total,
        fontSize: fonts.body,
      },
    },
    ...exams.flatMap((exam) => {
      const parts = totalCellParts(exam, subjects);
      return [
        {
          content: formatTotalMarksOnly(parts),
          styles: {
            fontStyle: 'bold',
            halign: 'center',
            fontSize: fonts.body,
          },
        },
        {
          content: parts.grade,
          styles: { fontStyle: 'bold', halign: 'center', fontSize: fonts.body },
        },
      ];
    }),
  ];
  body.push(totalRow);

  const percentRow = [
    {
      content: 'Percentage',
      colSpan: 2,
      styles: {
        fontStyle: 'bold',
        halign: 'center',
        textColor: C.total,
        fontSize: fonts.body,
      },
    },
    ...exams.flatMap((exam) => {
      const parts = totalCellParts(exam, subjects);
      return [
        {
          content: formatTotalPercentOnly(parts),
          colSpan: 2,
          styles: {
            fontStyle: 'bold',
            halign: 'center',
            fontSize: fonts.body,
          },
        },
      ];
    }),
  ];
  body.push(percentRow);

  const columnStyles = {
    0: { cellWidth: slW, halign: 'center', fontStyle: 'bold', fontSize: fonts.body },
    1: { cellWidth: subjectW, halign: 'left', fontStyle: 'bold', fontSize: fonts.subject },
  };
  exams.forEach((_, i) => {
    columnStyles[2 + i * 2] = { cellWidth: marksW, halign: 'center', fontSize: fonts.body };
    columnStyles[3 + i * 2] = { cellWidth: gradeW, halign: 'center', fontSize: fonts.body };
  });

  // Double vertical rule after the first 3 exams (between 3rd and 4th).
  const midYearSplitCol = examCount >= 4 ? 2 + 3 * 2 : -1;
  const gridLineColor = C.tableLine;

  autoTable(doc, {
    head,
    body,
    startY,
    margin: { left: hMargin, right: hMargin, bottom: tableBottomMargin },
    tableWidth,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: fonts.body,
      textColor: C.navy,
      cellPadding: { top: fonts.pad, bottom: fonts.pad, left: 1, right: 1 },
      valign: 'middle',
      lineWidth: 0.35,
      lineColor: gridLineColor,
      overflow: 'linebreak',
      fillColor: C.white,
    },
    headStyles: {
      fillColor: C.gold,
      textColor: C.navy,
      fontStyle: 'bold',
      fontSize: fonts.head,
      halign: 'center',
      valign: 'middle',
      cellPadding: { top: fonts.pad, bottom: fonts.pad, left: 1, right: 1 },
    },
    bodyStyles: {
      fillColor: C.white,
      fontSize: fonts.body,
    },
    alternateRowStyles: {
      fillColor: C.rowAlt,
    },
    columnStyles,
    didParseCell: (data) => {
      if (data.section === 'head') {
        data.cell.styles.fontSize = fonts.head;
        return;
      }
      if (data.section !== 'body') return;
      data.cell.styles.fontSize = data.column.index === 1 ? fonts.subject : fonts.body;
      const raw = data.cell.raw;
      const text = typeof raw === 'object' && raw != null ? String(raw.content ?? '') : String(raw ?? '');
      if (text === 'Ab') data.cell.styles.fontStyle = 'bold';
      // TOTAL + Percentage summary rows — solid cream (same as prior look).
      if (data.row.index >= body.length - 2) {
        data.cell.styles.fillColor = C.summaryRow;
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fontSize = fonts.body;
      }
    },
    didDrawCell: (data) => {
      if (midYearSplitCol < 0 || data.column.index !== midYearSplitCol) return;
      const x = data.cell.x;
      const y = data.cell.y;
      const h = data.cell.height;
      doc.setDrawColor(...gridLineColor);
      doc.setLineWidth(0.55);
      doc.line(x + 0.4, y, x + 0.4, y + h);
      doc.line(x + 1.7, y, x + 1.7, y + h);
    },
  });

  return (doc.lastAutoTable?.finalY ?? startY) + 3;
}

/**
 * Separate total-marks section (does not alter PART A columns).
 * Three rows: Marks, Grade, Percentage × subject columns + TOTAL / MAX.
 */
function drawTotalMarksTable(doc, startY, layout, allSubjects, totalMarksExams, totalMarks) {
  if (!totalMarks || totalMarks.include !== true) return startY;
  if (!totalMarksExams.length || !allSubjects.length) return startY;

  const { left: hMargin, contentWidth: tableWidth, tableBottomMargin, pageHeight, top } = layout;

  // Subjects that appear on at least one of these exams, keep overall report order.
  const activeIds = new Set();
  for (const exam of totalMarksExams) {
    const map = exam.marksBySubjectId ?? {};
    for (const key of Object.keys(map)) {
      const v = map[key];
      if (v != null && v !== '' && v !== 'null') activeIds.add(String(key));
    }
  }
  const subjects =
    allSubjects.filter((s) => activeIds.has(String(s.id))).length > 0
      ? allSubjects.filter((s) => activeIds.has(String(s.id)))
      : allSubjects;

  const title = 'FINAL RESULT';
  let y = ensureSpace(doc, layout, startY + 4, 80);
  y = drawPartHeading(doc, title, y, layout);

  const labelColW = Math.min(78, Math.max(64, tableWidth * 0.14));
  const totalColW = 52;
  const subjectColW =
    subjects.length > 0 ? (tableWidth - labelColW - totalColW) / subjects.length : 40;
  const fontSize = subjects.length > 7 ? 7.5 : subjects.length > 5 ? 8 : 8.5;

  const subjectParts = subjects.map((sub) => combinedSubjectParts(totalMarksExams, sub));
  const totalParts = combinedExamTotalParts(totalMarksExams, subjects);

  const head = [
    [
      'SUBJECTS',
      ...subjects.map((sub) => String(sub.name ?? '').toUpperCase()),
      {
        content: 'TOTAL / MAX',
        styles: { textColor: C.total, fontStyle: 'bold' },
      },
    ],
  ];

  const metricCell = (content) => ({
    content,
    styles: { fontStyle: 'bold', halign: 'center' },
  });
  const labelCell = (content) => ({
    content,
    styles: { fontStyle: 'bold', halign: 'left' },
  });

  const body = [
    [
      labelCell('Total marks'),
      ...subjectParts.map((p) => metricCell(formatTotalMarksOnly(p))),
      metricCell(formatTotalMarksOnly(totalParts)),
    ],
    [
      labelCell('Grade'),
      ...subjectParts.map((p) => metricCell(p.grade || '—')),
      metricCell(totalParts.grade || '—'),
    ],
    [
      {
        content: 'Percentage',
        colSpan: Math.max(1, subjects.length + 1),
        styles: {
          fontStyle: 'bold',
          halign: 'right',
          valign: 'middle',
          textColor: C.total,
        },
      },
      metricCell(formatTotalPercentOnly(totalParts)),
    ],
  ];

  const totalCol = head[0].length - 1;
  const columnStyles = {
    0: { cellWidth: labelColW, halign: 'left', overflow: 'linebreak', fontStyle: 'bold' },
    [totalCol]: { cellWidth: totalColW, halign: 'center', fontStyle: 'bold' },
  };
  subjects.forEach((_, i) => {
    columnStyles[i + 1] = { cellWidth: subjectColW, halign: 'center' };
  });

  // Ensure room; autoTable can also flow to next page.
  if (y > pageHeight - tableBottomMargin - 80) {
    doc.addPage();
    y = top;
  }

  autoTable(doc, {
    head,
    body,
    startY: y,
    margin: { left: hMargin, right: hMargin, bottom: tableBottomMargin },
    tableWidth,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize,
      textColor: C.navy,
      cellPadding: { top: 3, bottom: 3, left: 2.5, right: 2.5 },
      valign: 'middle',
      lineWidth: 0.3,
      lineColor: C.tableLine,
      overflow: 'linebreak',
      fillColor: C.white,
    },
    headStyles: {
      fillColor: C.gold,
      textColor: C.navy,
      fontStyle: 'bold',
      fontSize: Math.max(7.5, fontSize - 0.5),
      halign: 'center',
      valign: 'middle',
      cellPadding: 3.5,
    },
    bodyStyles: {
      fillColor: C.white,
    },
    alternateRowStyles: {
      fillColor: C.rowAlt,
    },
    columnStyles,
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      const raw = data.cell.raw;
      const text = typeof raw === 'object' && raw != null ? String(raw.content ?? '') : String(raw ?? '');
      if (text === 'Ab' || text.startsWith('Ab')) data.cell.styles.fontStyle = 'bold';
      if (data.column.index === totalCol) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.halign = 'center';
      }
      if (data.row.index === 2 && text === 'Percentage') {
        data.cell.styles.textColor = C.total;
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.halign = 'right';
      }
    },
    didDrawCell: (data) => {
      // Double vertical rule before TOTAL / MAX (same style as Part A / Part B mid-year split).
      if (data.column.index !== totalCol) return;
      const x = data.cell.x;
      const cellY = data.cell.y;
      const h = data.cell.height;
      doc.setDrawColor(...C.tableLine);
      doc.setLineWidth(0.55);
      doc.line(x + 0.4, cellY, x + 0.4, cellY + h);
      doc.line(x + 1.7, cellY, x + 1.7, cellY + h);
    },
  });

  return (doc.lastAutoTable?.finalY ?? y) + 4;
}

function drawPrincipalBlock(doc, layout, headMistressSigDataUrl = null) {
  const { left, right, principalY } = layout;
  const lineY = principalY - 10;
  const labelY = principalY + 4;
  const linePad = 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...C.navy);
  doc.setDrawColor(...C.muted);
  doc.setLineWidth(0.55);

  const leftLabel = 'CLASS TEACHER';
  const rightLabel = 'HEAD MISTRESS';
  const leftW = doc.getTextWidth(leftLabel);
  const rightW = doc.getTextWidth(rightLabel);

  const sigLineW = Math.max(120, leftW + linePad * 2, rightW + linePad * 2);
  const rightLineW = sigLineW;
  const rightLineX = right - rightLineW;

  doc.line(left, lineY, left + sigLineW, lineY);
  doc.text(leftLabel, left + sigLineW / 2, labelY, { align: 'center' });

  doc.setFontSize(11);
  doc.setTextColor(...C.total);
  doc.text(REPORT_TAGLINE, (left + right) / 2, labelY, { align: 'center' });
  doc.setFontSize(8.5);
  doc.setTextColor(...C.navy);

  if (headMistressSigDataUrl) {
    try {
      const sigW = 64;
      const sigH = 30;
      const sigX = rightLineX + (rightLineW - sigW) / 2;
      const sigY = lineY - sigH - 1;
      doc.addImage(headMistressSigDataUrl, 'PNG', sigX, sigY, sigW, sigH);
    } catch {
      /* skip signature if image fails */
    }
  }

  doc.line(rightLineX, lineY, right, lineY);
  doc.text(rightLabel, rightLineX + rightLineW / 2, labelY, { align: 'center' });
}

/** Flatten usable Part B extra rows (label and/or value filled). */
function normalizePartBFields(partBFields) {
  if (!Array.isArray(partBFields)) return [];
  return partBFields
    .map((row) => ({
      label: String(row?.label ?? '').trim(),
      value: String(row?.value ?? '').trim(),
    }))
    .filter((row) => row.label || row.value)
    .slice(0, 4);
}

/**
 * Build Part B matrix from completed exam progress sections (DB grades).
 * Rows = unique Part B subject names; columns = exams (date order); cells = grade_text.
 */
function buildPartBMatrixFromSections(sections) {
  const exams = [];
  for (const sec of sections ?? []) {
    for (const exam of sec?.exams ?? []) {
      const pbSubjects = Array.isArray(exam?.partBSubjects) ? exam.partBSubjects : [];
      if (!pbSubjects.length) continue;
      exams.push({
        testName: String(exam?.testName ?? exam?.testLabel ?? 'Exam').trim() || 'Exam',
        examDate: String(exam?.examDate ?? exam?.exam_date ?? '').slice(0, 10),
        subjects: pbSubjects,
        gradesBySubjectId: exam?.partBGradesBySubjectId ?? {},
      });
    }
  }
  if (!exams.length) return null;

  exams.sort((a, b) => {
    if (a.examDate !== b.examDate) return a.examDate.localeCompare(b.examDate);
    return a.testName.localeCompare(b.testName);
  });

  const subjectMap = new Map();
  for (const exam of exams) {
    for (const s of exam.subjects) {
      const id = String(s?.id ?? '');
      const name = String(s?.name ?? '').trim() || 'Subject';
      if (!id) continue;
      if (!subjectMap.has(id)) subjectMap.set(id, name);
    }
  }
  const subjectIds = [...subjectMap.keys()];
  if (!subjectIds.length) return null;

  const examHeaders = exams.map((e) => e.testName);

  const rows = subjectIds.map((id) => ({
    label: subjectMap.get(id),
    values: exams.map((exam) => {
      const g = exam.gradesBySubjectId?.[id] ?? exam.gradesBySubjectId?.[String(id)];
      return String(g ?? '').trim();
    }),
  }));

  return { examHeaders, rows };
}

function ensureSpace(doc, layout, cursorY, needed) {
  if (cursorY + needed <= layout.pageHeight - layout.tableBottomMargin) return cursorY;
  doc.addPage();
  return layout.top;
}

/**
 * Part B table: prefer DB-backed grades matrix; else blank activity grid for hand-fill.
 * @param {object|null} partB - { include, fields, matrix? }
 */
function drawPartB(doc, startY, layout, partB) {
  if (!partB || partB.include !== true) return startY;

  const extra = normalizePartBFields(partB.fields);
  const { left, contentWidth, pageWidth } = layout;
  const matrix = partB.matrix;

  const useMatrix = matrix && Array.isArray(matrix.examHeaders) && matrix.examHeaders.length
    && Array.isArray(matrix.rows) && matrix.rows.length;
  if (!useMatrix) return startY;

  const examHeaders = matrix.examHeaders.map((h) => String(h ?? '').trim() || 'Exam');
  const tableRows = matrix.rows.map((row, idx) => ({
    label: String(row?.label ?? '').trim() || `Row ${idx + 1}`,
    values: examHeaders.map((_, i) => String(row?.values?.[i] ?? '').trim()),
  }));

  const gradeCount = examHeaders.length;
  const numColW = 22;
  const gradeColW = Math.min(useMatrix ? 56 : 40, Math.floor((contentWidth - 160) / Math.max(1, gradeCount)));
  const activityColW = contentWidth - numColW - gradeColW * gradeCount;
  const rowCount = tableRows.length;

  let y = ensureSpace(doc, layout, startY + 4, 45 + rowCount * 13 + (extra.length ? 32 : 0));
  y = drawPartHeading(doc, 'PART B - Co-Curricular Activities', y, layout);

  const head = [
    [
      {
        content: 'Sl.\nNo',
        styles: {
          fillColor: C.gold,
          textColor: C.navy,
          fontStyle: 'bold',
          halign: 'center',
          valign: 'middle',
          fontSize: 7.5,
          cellPadding: 2.2,
        },
      },
      {
        content: 'SUBJECTS',
        styles: {
          fillColor: C.gold,
          textColor: C.navy,
          fontStyle: 'bold',
          halign: 'center',
          valign: 'middle',
          fontSize: 7.5,
          cellPadding: 2.2,
        },
      },
      ...examHeaders.map((header) => ({
        content: header,
        styles: {
          fillColor: C.gold,
          textColor: C.navy,
          fontStyle: 'bold',
          halign: 'center',
          fontSize: 7.5,
          cellPadding: 2.2,
          overflow: 'linebreak',
        },
      })),
    ],
  ];

  const body = tableRows.map((row, idx) => [
    String(idx + 1),
    String(row.label ?? '').toUpperCase(),
    ...examHeaders.map((_, i) => row.values[i] || ''),
  ]);

  const columnStyles = {
    0: { cellWidth: numColW, halign: 'center', fontStyle: 'bold' },
    1: { cellWidth: activityColW, halign: 'left', fontStyle: 'bold', fontSize: 7.5 },
  };
  for (let i = 0; i < gradeCount; i += 1) {
    columnStyles[i + 2] = { cellWidth: gradeColW, halign: 'center', fontSize: 8, overflow: 'linebreak' };
  }

  // Double vertical rule after the first 3 exams (between 3rd and 4th), same as Part A.
  const midYearSplitCol = gradeCount >= 4 ? 2 + 3 : -1;
  const gridLineColor = C.tableLine;

  autoTable(doc, {
    head,
    body,
    startY: y,
    margin: { left, right: pageWidth - (left + contentWidth), bottom: layout.tableBottomMargin },
    tableWidth: contentWidth,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      textColor: C.navy,
      cellPadding: 3,
      valign: 'middle',
      lineColor: gridLineColor,
      lineWidth: 0.3,
      fillColor: C.white,
      minCellHeight: 16,
    },
    headStyles: {
      fillColor: C.gold,
      textColor: C.navy,
      fontStyle: 'bold',
      valign: 'middle',
    },
    bodyStyles: {
      fillColor: C.white,
    },
    alternateRowStyles: {
      fillColor: C.rowAlt,
    },
    columnStyles,
    didDrawCell: (data) => {
      if (midYearSplitCol < 0 || data.column.index !== midYearSplitCol) return;
      const x = data.cell.x;
      const cellY = data.cell.y;
      const h = data.cell.height;
      doc.setDrawColor(...gridLineColor);
      doc.setLineWidth(0.5);
      doc.line(x + 0.3, cellY, x + 0.3, cellY + h);
      doc.line(x + 1.4, cellY, x + 1.4, cellY + h);
    },
  });

  y = (doc.lastAutoTable?.finalY ?? y) + 4;

  if (extra.length) {
    y = ensureSpace(doc, layout, y, 20 + extra.length * 12);
    const labelW = Math.min(170, contentWidth * 0.4);
    const valueW = contentWidth - labelW;
    autoTable(doc, {
      body: extra.map((r) => [r.label || '—', r.value || '—']),
      startY: y,
      margin: { left, right: pageWidth - (left + contentWidth), bottom: layout.tableBottomMargin },
      tableWidth: contentWidth,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 8,
        textColor: C.navy,
        cellPadding: 3,
        valign: 'middle',
        lineColor: C.tableLine,
        lineWidth: 0.3,
        fillColor: C.white,
      },
      bodyStyles: {
        fillColor: C.white,
      },
      alternateRowStyles: {
        fillColor: C.rowAlt,
      },
      columnStyles: {
        0: { cellWidth: labelW, fontStyle: 'bold', halign: 'left' },
        1: { cellWidth: valueW, halign: 'left' },
      },
    });
    y = (doc.lastAutoTable?.finalY ?? y) + 4;
  }

  return y;
}

/** Draw wrapped text with per-segment font styles; returns bottom Y of last line. */
function drawWrappedSegments(doc, segments, x, startY, maxWidth, lineH) {
  let cx = x;
  let cy = startY;
  for (const seg of segments) {
    const style = seg.bold ? (seg.italic ? 'bolditalic' : 'bold') : seg.italic ? 'italic' : 'normal';
    doc.setFont('helvetica', style);
    if (seg.color) doc.setTextColor(...seg.color);
    const parts = String(seg.text ?? '').split(/(\s+)/);
    for (const part of parts) {
      if (!part) continue;
      const w = doc.getTextWidth(part);
      if (cx > x && cx + w > x + maxWidth && part.trim()) {
        cx = x;
        cy += lineH;
      }
      doc.text(part, cx, cy);
      cx += w;
    }
  }
  return cy;
}

function drawPromotionLine(doc, startY, layout, className, studentName = '') {
  const { left, contentWidth } = layout;
  const padX = 10;
  const padY = 8;
  const lineH = 11;
  const currentLabel = formatClassOrdinalStandard(className);
  const nextLabel = suggestNextClass(className);
  const name = String(studentName ?? '').trim() || 'Student';

  const lead = { text: `Congratulations ${name}!`, bold: true, color: C.navy };
  let message;
  if (currentLabel && nextLabel) {
    message = ` You have successfully completed ${currentLabel} and are promoted to ${nextLabel}.`;
  } else if (currentLabel) {
    message = ` You have successfully completed ${currentLabel}.`;
  } else {
    message = '';
  }
  const firstLine = [lead, ...(message ? [{ text: message, italic: true, color: C.text }] : [])];
  const secondLine = [
    { text: 'Keep learning, keep growing, and keep shining!', italic: true, color: C.text },
  ];

  const iconW = 34;
  const textX = left + padX + iconW + 8;
  const textW = contentWidth - (textX - left) - padX;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  const plain = firstLine.map((s) => s.text).join('');
  const firstLineCount = Math.max(1, doc.splitTextToSize(plain, textW).length);
  const promoH = Math.max(40, padY * 2 + (firstLineCount + 1) * lineH + 2);

  const y = ensureSpace(doc, layout, startY + 8, promoH + 4);

  doc.setFillColor(...C.goldSoft);
  doc.setDrawColor(...C.cardBorder);
  doc.setLineWidth(0.6);
  roundedRect(doc, left, y, contentWidth, promoH, 6, 'FD');

  drawGraduationCap(doc, left + padX + iconW / 2, y + promoH / 2, iconW);

  doc.setFontSize(9);
  const textY = y + (promoH - (firstLineCount + 1) * lineH) / 2 + 8;
  const lastY = drawWrappedSegments(doc, firstLine, textX, textY, textW, lineH);
  drawWrappedSegments(doc, secondLine, textX, lastY + lineH, textW, lineH);

  return y + promoH + 5;
}

/** Simple mortarboard icon centred at (cx, cy). */
function drawGraduationCap(doc, cx, cy, width) {
  const w = width / 2;
  const h = width * 0.22;
  doc.setFillColor(...C.navy);
  doc.setDrawColor(...C.navy);
  doc.triangle(cx - w, cy - 2, cx, cy - 2 - h, cx + w, cy - 2, 'F');
  doc.triangle(cx - w, cy - 2, cx, cy - 2 + h, cx + w, cy - 2, 'F');
  const capW = w * 1.1;
  doc.rect(cx - capW / 2, cy + h * 0.25, capW, h * 0.9, 'F');
  doc.setLineWidth(1);
  doc.line(cx + w * 0.7, cy - 1, cx + w * 0.7, cy + h * 1.6);
  doc.circle(cx + w * 0.7, cy + h * 1.6 + 1.2, 1.4, 'F');
}

/** e.g. "10th" / "10" → "10th Standard"; keeps Nursery / UKG / LKG labels. */
function formatClassOrdinalStandard(className) {
  const raw = String(className ?? '').trim();
  if (!raw) return '';
  const early = matchEarlyYearsClass(raw);
  if (early) return early.label;
  const m = raw.toLowerCase().match(/(\d{1,2})/);
  if (!m) return raw;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 1 || n > 12) return raw;
  return `${n}${ordinalSuffix(n)} Standard`;
}

/**
 * Early-years ladder (exception): Nursery → UKG → LKG → 1st Standard → …
 * Returns { key, label, nextLabel } when class name matches; otherwise null.
 */
function matchEarlyYearsClass(className) {
  const raw = String(className ?? '')
    .trim()
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ');

  if (/\bnursery\b/.test(raw) || raw === 'nur') {
    return { key: 'nursery', label: 'Nursery', nextLabel: 'UKG' };
  }
  if (/\bukg\b/.test(raw) || /\bupper\s*kg\b/.test(raw) || /\bupper\s*kindergarten\b/.test(raw)) {
    return { key: 'ukg', label: 'UKG', nextLabel: 'LKG' };
  }
  if (/\blkg\b/.test(raw) || /\blower\s*kg\b/.test(raw) || /\blower\s*kindergarten\b/.test(raw)) {
    return { key: 'lkg', label: 'LKG', nextLabel: '1st Standard' };
  }
  return null;
}

function suggestNextClass(className) {
  const early = matchEarlyYearsClass(className);
  if (early) return early.nextLabel;

  const raw = String(className ?? '').trim().toLowerCase();
  const m = raw.match(/(\d{1,2})/);
  if (!m) return '';
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 1 || n >= 12) return '';
  const next = n + 1;
  return `${next}${ordinalSuffix(next)} Standard`;
}

function ordinalSuffix(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return 'th';
  switch (n % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

/** e.g. "10th" → "10TH STANDARD" (card uppercases values). */
function formatClassWithStandard(className) {
  const raw = String(className ?? '').trim();
  if (!raw) return '—';
  if (/\bstandard\b/i.test(raw)) return raw;
  return formatClassOrdinalStandard(raw) || raw;
}

function drawPageDoubleBorder(doc, layout) {
  const { pageWidth, pageHeight } = layout;
  const outerInset = 8;
  const gap = 2.5;
  const innerInset = outerInset + gap;

  doc.setDrawColor(...C.navy);
  doc.setLineWidth(1.1);
  doc.rect(outerInset, outerInset, pageWidth - outerInset * 2, pageHeight - outerInset * 2);

  doc.setLineWidth(0.45);
  doc.rect(innerInset, innerInset, pageWidth - innerInset * 2, pageHeight - innerInset * 2);
}

function drawPageChrome(doc, layout, headMistressSigDataUrl = null) {
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p += 1) {
    doc.setPage(p);
    drawPageDoubleBorder(doc, layout);
    if (p === pageCount) drawPrincipalBlock(doc, layout, headMistressSigDataUrl);
  }
}

/**
 * @param {object} params
 * @param {object} params.student
 * @param {string} params.className
 * @param {string} params.sectionLabel
 * @param {string} [params.fatherName]
 * @param {string} [params.motherName]
 * @param {string} [params.studentPhotoDataUrl] - Passport photo (JPEG/PNG data URL)
 * @param {string} params.fromDate
 * @param {string} params.toDate
 * @param {Array} params.sections
 * @param {object} [params.partB] - { include, fields }
 * @param {object} [params.totalMarks] - { include } Final Result over all Part A exams + promotion line
 * @param {string} [params.logoDataUrl] - Preloaded school logo (skips refetch when set)
 * @param {string} [params.headMistressSigDataUrl] - Preloaded Head Mistress signature
 * @param {boolean} [params.returnBlob] - If true, return { blob, filename } instead of triggering download
 */
export async function exportStudentProgressPdf({
  student,
  className,
  sectionLabel,
  fatherName,
  motherName,
  studentPhotoDataUrl,
  logoDataUrl: logoDataUrlParam,
  headMistressSigDataUrl: headMistressSigParam,
  fromDate,
  toDate,
  sections,
  partB = null,
  totalMarks = null,
  filePrefix = 'ProgressReport',
  returnBlob = false,
}) {
  const secs = Array.isArray(sections) ? sections : [];
  if (!secs.length) return returnBlob ? null : undefined;

  const { subjects, exams } = buildUnifiedPartA(secs);
  if (!exams.length || !subjects.length) return returnBlob ? null : undefined;

  // Always standard A4 portrait for printing.
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const logoDataUrl =
    logoDataUrlParam !== undefined ? logoDataUrlParam : await loadSchoolReportLogo();
  const headMistressSigDataUrl =
    headMistressSigParam !== undefined ? headMistressSigParam : await loadHeadMistressSignature();
  const latestExamDate = exams
    .map((e) => String(e?.examDate ?? e?.exam_date ?? '').slice(0, 10))
    .filter(Boolean)
    .sort()
    .pop();
  const yearLabel = deriveYearLabel(
    toDate || latestExamDate || fromDate || new Date().toISOString().slice(0, 10)
  );
  const studentName = [student?.first_name, student?.last_name].filter(Boolean).join(' ').trim();
  const rollNumber = student?.roll_number ?? '—';
  const dateOfBirth = formatStudentDob(
    student?.date_of_birth ?? student?.dateOfBirth ?? null
  );
  const father =
    fatherName ||
    student?.father_name ||
    student?.guardian_name ||
    '—';
  const mother =
    motherName ||
    student?.mother_name ||
    student?.motherName ||
    '—';
  const classSection = [formatClassWithStandard(className), sectionLabel || '']
    .map((s) => String(s ?? '').trim())
    .filter((s) => s && s !== '—')
    .join(' / ');

  const layout = getPageLayout(doc);

  let cursorY = drawReportHeader(doc, logoDataUrl, layout, studentPhotoDataUrl, yearLabel);
  cursorY = drawStudentCard(
    doc,
    [
      { label: 'Student Name', value: studentName || '—' },
      { label: 'Class / Section', value: classSection || '—' },
      { label: 'Adm No.', value: rollNumber },
      { label: 'Date of Birth', value: dateOfBirth },
      { label: "Father's Name", value: father },
      { label: "Mother's Name", value: mother },
    ],
    cursorY,
    layout
  );

  cursorY = drawPartHeading(doc, 'PART A - Curricular Areas', cursorY, layout);

  // Separate section only when Include Final Results is checked — does not change Part A grid.
  const totalMarksExams = examsForTotalMarksType(exams, totalMarks);
  const showFinalResult = totalMarks?.include === true && totalMarksExams.length > 0;

  cursorY = drawPartATable(doc, cursorY, layout, subjects, exams, showFinalResult);
  cursorY = drawTotalMarksTable(doc, cursorY, layout, subjects, totalMarksExams, totalMarks);

  const partBForPdf =
    partB && partB.include === true
      ? {
          ...partB,
          matrix: partB.matrix ?? buildPartBMatrixFromSections(secs),
        }
      : partB;
  cursorY = drawPartB(doc, cursorY, layout, partBForPdf);

  // Promotion line only when Final Result rows were actually drawn.
  if (showFinalResult) {
    drawPromotionLine(doc, cursorY, layout, className, studentName);
  }

  drawPageChrome(doc, layout, headMistressSigDataUrl);

  const rangePart =
    fromDate && toDate
      ? `${sanitizeFilePart(fromDate)}_${sanitizeFilePart(toDate)}`
      : fromDate
        ? `from_${sanitizeFilePart(fromDate)}`
        : toDate
          ? `to_${sanitizeFilePart(toDate)}`
          : 'all_exams';
  const rollPart = sanitizeFilePart(rollNumber) || 'roll';
  const namePart = sanitizeFilePart(studentName) || 'student';
  const filename = returnBlob
    ? `${filePrefix}_${rollPart}_${namePart}.pdf`
    : `${filePrefix}_${namePart}_${rangePart}.pdf`;

  if (returnBlob) {
    const blob = doc.output('blob');
    return { blob, filename };
  }
  doc.save(filename);
}
