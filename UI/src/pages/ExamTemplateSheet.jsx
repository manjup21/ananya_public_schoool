import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import ExcelJS from 'exceljs';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { FormSelect } from '../components/common/FormSelect';
import { TablePagination } from '../components/common/TablePagination';
import { TableEmptyRow } from '../components/common/TableEmptyRow';
import { SearchInput } from '../components/common/SearchInput';
import { usePagedRows } from '../hooks/usePagedRows';
import { TableSkeletonRows } from '../components/common/TableSkeletonRows';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  ChevronDown,
  Download,
  FileSpreadsheet,
} from 'lucide-react';
import { toast } from 'sonner';
import { useClasses } from '../features/classes/useClasses';
import { partBColumnHeader, partitionExamSubjects } from '../utils/marksValidation';
import { fetchExamTypesThunk } from '../features/examTypes/examTypesSlice';
import { fetchExaminationsThunk, fetchExamMarksTemplateThunk } from '../features/examinations/examinationsSlice';
import {
  classSectionLabel,
  normalizeSectionIds,
  fmtDate,
} from './examinationManagement/examinationHelpers';
import { XLSX_MIME, autoFitColumns, downloadBlob, sanitizeFilePart } from '../utils/fileExport';

/** Pad row to width so metadata + header + data columns align for future import parsers. */
function padRow(cells, width) {
  const row = [...cells];
  while (row.length < width) row.push('');
  return row;
}

/** Rows 1\u20133 = meta, row 4 = header, row 5+ = students (1-based Excel rows). */
const MARKS_TEMPLATE_FIRST_DATA_ROW = 5;

/**
 * Lock prefilled areas (metadata, header, roll/name). Subject columns from row 5 stay unlocked for marks.
 * Requires worksheet protection so Excel honours the per-cell locked flag.
 */
async function protectMarksTemplateSheet(sheet, columnCount) {
  sheet.eachRow((row, rowNumber) => {
    for (let col = 1; col <= columnCount; col++) {
      const cell = row.getCell(col);
      const locked = rowNumber < MARKS_TEMPLATE_FIRST_DATA_ROW || col <= 2;
      cell.protection = { locked };
    }
  });

  await sheet.protect(undefined, {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: false,
    formatColumns: false,
    formatRows: false,
    insertColumns: false,
    insertRows: false,
    deleteColumns: false,
    deleteRows: false,
    sort: false,
    autoFilter: false,
  });
}

/** Class name and section (or "All sections") for display, comma-separated. */
function classSectionCommaSeparated(exam, classes) {
  const cls = Array.isArray(classes) ? classes.find((c) => c.id === exam.class_id) : undefined;
  const className = String(cls?.name ?? '').trim() || '\u2014';
  let sectionPart;
  if (exam.section_id) {
    const sec = cls?.sections?.find((s) => s.id === exam.section_id);
    sectionPart = String(sec?.section ?? '').trim() || '\u2014';
  } else {
    const ids = normalizeSectionIds(exam?.section_ids);
    if (ids.length) {
      const labels = ids
        .map((sid) => String(cls?.sections?.find((s) => s.id === sid)?.section ?? '').trim())
        .filter(Boolean);
      sectionPart = labels.length ? labels.join(', ') : 'Selected sections';
    } else {
      sectionPart = 'All sections';
    }
  }
  return `${className}, ${sectionPart}`;
}

export function ExamTemplateSheet() {
  const dispatch = useDispatch();
  const { classes } = useClasses();
  const examinations = useSelector((s) => s.examinations.items);
  const examinationsStatus = useSelector((s) => s.examinations.status);
  const examinationsError = useSelector((s) => s.examinations.error);
  const examTypes = useSelector((s) => s.examTypes.items);
  const examTypesStatus = useSelector((s) => s.examTypes.status);

  const [searchQuery, setSearchQuery] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);
  const [filterExamTypeId, setFilterExamTypeId] = useState('all');
  const [filterClassId, setFilterClassId] = useState('all');
  const [filterSectionId, setFilterSectionId] = useState('all');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (examinationsStatus === 'idle') dispatch(fetchExaminationsThunk({ search: '' }));
  }, [dispatch, examinationsStatus]);

  useEffect(() => {
    if (examTypesStatus === 'idle') dispatch(fetchExamTypesThunk({ search: '' }));
  }, [dispatch, examTypesStatus]);

  useEffect(() => {
    setFilterSectionId('all');
  }, [filterClassId]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, pageSize, filterExamTypeId, filterClassId, filterSectionId]);

  const classOptions = useMemo(
    () => [{ value: 'all', label: 'All classes' }, ...classes.map((c) => ({ value: c.id, label: c.name }))],
    [classes]
  );

  const examTypeFilterOptions = useMemo(
    () => [{ value: 'all', label: 'All types' }, ...examTypes.map((t) => ({ value: t.id, label: t.name }))],
    [examTypes]
  );

  const sectionFilterOptions = useMemo(() => {
    if (filterClassId === 'all') {
      return [{ value: 'all', label: 'All sections' }];
    }
    const cls = classes.find((c) => c.id === filterClassId);
    const secs = cls?.sections ?? [];
    return [
      { value: 'all', label: 'All sections' },
      { value: 'whole', label: 'Whole class (no section)' },
      ...secs.map((s) => ({ value: s.id, label: s.section })),
    ];
  }, [filterClassId, classes]);

  const filtered = useMemo(() => {
    const list = Array.isArray(examinations) ? examinations : [];
    return list.filter((e) => {
      if (String(e?.exam_status ?? '').toLowerCase() !== 'scheduled') return false;
      if (filterExamTypeId !== 'all' && String(e.exam_type_id) !== String(filterExamTypeId)) return false;
      if (filterClassId !== 'all' && e.class_id !== filterClassId) return false;
      if (filterSectionId !== 'all') {
        if (filterSectionId === 'whole') {
          if (e.section_id != null && String(e.section_id).trim() !== '') return false;
          if (normalizeSectionIds(e?.section_ids).length) return false;
        } else if (e.section_id !== filterSectionId) {
          const ids = normalizeSectionIds(e?.section_ids);
          if (ids.length) {
            if (!ids.includes(filterSectionId)) return false;
          } else {
            if (!(e.section_id == null || String(e.section_id).trim() === '')) return false;
          }
        }
      }
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      const className = String(classes.find((c) => c.id === e.class_id)?.name ?? '').toLowerCase();
      const sectionName = String(classSectionCommaSeparated(e, classes)).toLowerCase();
      const subjectStr = (Array.isArray(e.subjects) ? e.subjects.map((s) => s.name).join(' ') : '').toLowerCase();
      return (
        String(e.test_name ?? '').toLowerCase().includes(q) ||
        String(e.exam_type_name ?? '').toLowerCase().includes(q) ||
        String(e.exam_status ?? '').toLowerCase().includes(q) ||
        className.includes(q) ||
        sectionName.includes(q) ||
        subjectStr.includes(q)
      );
    });
  }, [examinations, filterExamTypeId, filterClassId, filterSectionId, searchQuery, classes]);

  const { totalCount, totalPages, currentPage, pageRows: paginatedExams } = usePagedRows(filtered, page, pageSize);

  const handleDownload = async (examId) => {
    setDownloadingId(examId);
    try {
      const data = await dispatch(fetchExamMarksTemplateThunk(examId)).unwrap();
      const exam = data?.exam;
      const students = data?.students ?? [];
      if (!exam) {
        toast.error('Invalid template response');
        return;
      }
      const subjects = Array.isArray(exam.subjects) ? exam.subjects : [];
      const { partA, partB } = partitionExamSubjects(subjects);
      const partAHeaders = partA.map((s) => s.name);
      const partBHeaders = partB.map((s) => partBColumnHeader(s.name));
      const subjectHeaders = [...partAHeaders, ...partBHeaders];

      const header = ['Roll number', 'Student name', ...subjectHeaders];

      const metaRow1 = ['Exam name', String(exam.test_name ?? '').trim() || '\u2014'];
      const metaRow2 = ['Exam date', String(exam.exam_date ?? '').trim() || '\u2014'];
      const metaRow3 = ['Class, Section', classSectionCommaSeparated(exam, classes)];

      const width = Math.max(header.length, metaRow1.length, metaRow2.length, metaRow3.length);

      const dataRows = students.map((s) =>
        padRow([s.roll_number, s.student_name, ...subjectHeaders.map(() => '')], width)
      );

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Marks', {
        views: [{ state: 'frozen', ySplit: 4 }],
      });

      const addLabelRow = (cells) => {
        const row = sheet.addRow(padRow(cells, width));
        row.getCell(1).font = { bold: true };
        row.alignment = { vertical: 'middle' };
      };

      addLabelRow(metaRow1);
      addLabelRow(metaRow2);
      addLabelRow(metaRow3);

      const headerRow = sheet.addRow(padRow(header, width));
      headerRow.eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE2E8F0' },
        };
        cell.alignment = { vertical: 'middle', wrapText: true };
      });

      for (const row of dataRows) {
        const r = sheet.addRow(row);
        r.alignment = { vertical: 'middle' };
      }

      autoFitColumns(sheet, width);

      await protectMarksTemplateSheet(sheet, width);

      const buffer = await workbook.xlsx.writeBuffer();
      const namePart = sanitizeFilePart(exam.test_name);
      const datePart = String(exam.exam_date ?? '').replace(/-/g, '');
      downloadBlob(buffer, `ExamTemplate_${namePart}_${datePart}.xlsx`, XLSX_MIME);
      toast.success(`Downloaded template (${students.length} students)`);
    } catch (err) {
      toast.error(typeof err === 'string' ? err : err?.message || 'Download failed');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Exam template</h2>      </div>

      <details className="group rounded-xl border border-blue-200/80 bg-linear-to-br from-blue-50/90 via-white to-indigo-50/40 shadow-sm overflow-hidden">
        <summary className="flex cursor-pointer items-center gap-3 px-4 sm:px-5 py-4 select-none list-none [&::-webkit-details-marker]:hidden">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm"
            aria-hidden
          >
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <h3 className="min-w-0 flex-1 text-base font-semibold text-gray-900">How to fill the Excel template</h3>
          <ChevronDown className="h-5 w-5 shrink-0 text-gray-400 transition-transform duration-200 group-open:rotate-180" />
        </summary>
        <div className="border-t border-blue-100 px-4 sm:px-5 pb-5 pt-4 space-y-5 text-sm text-gray-600 leading-relaxed">
          <ol className="space-y-3">
            {[
              'Click Excel on the exam below to download its template.',
              'Open it in Microsoft Excel, Google Sheets, or LibreOffice.',
              'Enter marks in the subject columns from row 5 down. Leave a cell blank if a mark is not known yet.',
              'Save the file, then upload it in Enter results \u2192 Upload Excel.',
            ].map((text, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-100 text-xs font-bold text-blue-800">
                  {i + 1}
                </span>
                <span>{text}</span>
              </li>
            ))}
          </ol>
          <div>
            <div className="mb-2 font-medium text-gray-900">Good to know</div>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Rows 1&ndash;4 and the Roll / Name columns are locked. Don&apos;t change or reorder them.</li>
              <li>Use one number style across the sheet (all whole numbers or all one decimal place).</li>
              <li>Download a fresh template if the exam&apos;s subjects change.</li>
              <li>Locks work in Microsoft Excel; Google Sheets may not enforce them.</li>
            </ul>
          </div>
        </div>
      </details>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Examinations</CardTitle>
            <div className="text-sm text-gray-600">
              Total: <span className="font-medium text-gray-900">{totalCount}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {examinationsStatus === 'failed' ? (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {examinationsError || 'Failed to load examinations'}
            </div>
          ) : null}

          <div className="mb-4">
            <SearchInput
              placeholder="Search by test, class, section, subject, status..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
          </div>

          <div className="mb-4 grid gap-4 sm:grid-cols-3">
            <FormSelect
              id="exam-template-filter-type"
              label="Type"
              value={filterExamTypeId}
              onValueChange={setFilterExamTypeId}
              options={examTypeFilterOptions}
              placeholder={examTypesStatus === 'loading' ? 'Loading\u2026' : 'All types'}
              contentClassName="min-w-[var(--radix-select-trigger-width)]"
            />
            <FormSelect
              id="exam-template-filter-class"
              label="Class"
              value={filterClassId}
              onValueChange={setFilterClassId}
              options={classOptions}
              placeholder="Class"
              contentClassName="min-w-[var(--radix-select-trigger-width)]"
            />
            <FormSelect
              id="exam-template-filter-section"
              label="Section"
              value={filterSectionId}
              onValueChange={setFilterSectionId}
              options={sectionFilterOptions}
              placeholder="Section"
              contentClassName="min-w-[var(--radix-select-trigger-width)]"
            />
          </div>

          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Test</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Class / Section</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {examinationsStatus === 'loading' ? (
                    <TableSkeletonRows columns={5} rows={5} />
                  ) : paginatedExams.length === 0 ? (
                    <TableEmptyRow colSpan={5}>No examinations match your filters.</TableEmptyRow>
                  ) : (
                    paginatedExams.map((e) => {
                      return (
                        <TableRow key={e.id}>
                          <TableCell className="font-medium">{e.test_name}</TableCell>
                          <TableCell className="text-gray-600">
                            {e.exam_type_name ?? '\u2014'}
                          </TableCell>
                          <TableCell className="text-gray-700">
                            {classSectionLabel(e, classes)}
                          </TableCell>
                          <TableCell className="text-gray-700 whitespace-nowrap">{fmtDate(e.exam_date)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="gap-1.5"
                              disabled={downloadingId === e.id}
                              onClick={() => handleDownload(e.id)}
                            >
                              <Download className="h-4 w-4" />
                              {downloadingId === e.id ? 'Preparing\u2026' : 'Excel'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <TablePagination
            selectId="exam-template-page-size"
            page={currentPage}
            pageSize={pageSize}
            totalCount={totalCount}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </CardContent>
      </Card>
    </div>
  );
}
