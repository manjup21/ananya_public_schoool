import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatStudentGender, formatStudentResidenceType } from './studentDisplay';
import { todayDateOnly } from './dateOnly';
import { XLSX_MIME, autoFitColumns, downloadBlob, sanitizeFilePart } from './fileExport';

const EXPORT_HEADERS = [
  'Roll Number',
  'First Name',
  'Last Name',
  'Gender',
  'Residence Type',
  'Father Name',
  'Mother Name',
  'Phone Number',
  'Address',
  'Emergency Number',
];

function displayCell(v) {
  const s = String(v ?? '').trim();
  return s || '—';
}

function formatStudentAddress(student) {
  const parts = [
    student?.address_location,
    student?.address_city,
    student?.address_district,
    student?.address_state,
    student?.address_pin,
  ]
    .map((s) => String(s ?? '').trim())
    .filter(Boolean);
  return parts.length ? parts.join(', ') : '—';
}

function studentToExportRow(student) {
  return [
    displayCell(student?.roll_number),
    displayCell(student?.first_name),
    displayCell(student?.last_name),
    formatStudentGender(student?.gender),
    formatStudentResidenceType(student),
    displayCell(student?.father_name),
    displayCell(student?.mother_name),
    displayCell(student?.guardian_phone),
    formatStudentAddress(student),
    displayCell(student?.emergency_contact_number),
  ];
}

function sortStudentsForExport(students) {
  return [...(students ?? [])].sort((a, b) => {
    const rollCmp = String(a?.roll_number ?? '').localeCompare(String(b?.roll_number ?? ''), undefined, {
      numeric: true,
      sensitivity: 'base',
    });
    if (rollCmp !== 0) return rollCmp;
    const firstCmp = String(a?.first_name ?? '').localeCompare(String(b?.first_name ?? ''), undefined, {
      sensitivity: 'base',
    });
    if (firstCmp !== 0) return firstCmp;
    return String(a?.last_name ?? '').localeCompare(String(b?.last_name ?? ''), undefined, {
      sensitivity: 'base',
    });
  });
}

function buildStudentExportFilename({ filterLabel, ext }) {
  const label = sanitizeFilePart(filterLabel === 'All students' ? 'All' : filterLabel);
  const date = todayDateOnly();
  return `Students_${label}_${date}.${ext}`;
}

export async function exportStudentsExcel({ students, filterLabel, title = 'Student List' }) {
  const sorted = sortStudentsForExport(students);
  const rows = sorted.map(studentToExportRow);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Students');

  ws.addRow(['Report', title]);
  ws.addRow(['Filters', filterLabel ?? 'All students']);
  ws.addRow(['Total students', sorted.length]);
  ws.addRow([]);
  ws.addRow([...EXPORT_HEADERS]);
  for (const row of rows) ws.addRow(row);

  const headerRowNumber = 5;
  const headerRow = ws.getRow(headerRowNumber);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.views = [{ state: 'frozen', ySplit: headerRowNumber }];
  autoFitColumns(ws, EXPORT_HEADERS.length, { min: 12, max: 55 });

  const buffer = await wb.xlsx.writeBuffer();
  const filename = buildStudentExportFilename({ filterLabel, ext: 'xlsx' });
  downloadBlob(buffer, filename, XLSX_MIME);
}

export function exportStudentsPdf({ students, filterLabel, title = 'Student List' }) {
  const sorted = sortStudentsForExport(students);
  const body = sorted.map(studentToExportRow);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(14);
  doc.text(title, 40, 40);
  doc.setFontSize(10);
  doc.text(`Filters: ${filterLabel ?? 'All students'}`, 40, 58);
  doc.text(`Total students: ${sorted.length}`, 40, 72);

  // Column 8 (Address) is unsized and takes whatever width is left.
  const columnStyles = {
    0: { cellWidth: 56 },
    1: { cellWidth: 66 },
    2: { cellWidth: 66 },
    3: { cellWidth: 40 },
    4: { cellWidth: 70 },
    5: { cellWidth: 72 },
    6: { cellWidth: 72 },
    7: { cellWidth: 70 },
    9: { cellWidth: 84 },
  };
  const fixedWidth = Object.values(columnStyles).reduce((sum, col) => sum + col.cellWidth, 0);
  if (fixedWidth >= pageWidth - 80) {
    throw new Error('Student PDF column widths exceed the page');
  }

  autoTable(doc, {
    head: [EXPORT_HEADERS],
    body,
    startY: 88,
    margin: { left: 40, right: 40, top: 40, bottom: 40 },
    styles: {
      fontSize: 8,
      cellPadding: 3,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: 20,
      fontStyle: 'bold',
    },
    columnStyles,
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.text(`Page ${i} / ${pageCount}`, 40, doc.internal.pageSize.getHeight() - 20);
  }

  const filename = buildStudentExportFilename({ filterLabel, ext: 'pdf' });
  doc.save(filename);
}
