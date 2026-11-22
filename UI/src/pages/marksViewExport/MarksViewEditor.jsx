import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download } from 'lucide-react';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { TablePagination } from '../../components/common/TablePagination';
import { usePagedRows } from '../../hooks/usePagedRows';
import { computeResults, formatPassLabel, isPartBSubject, partitionExamSubjects } from '../../utils/marksValidation';
import { classSectionLabel } from '../examinationManagement/examinationHelpers';
import { Checkbox } from '../../components/ui/checkbox';
import { XLSX_MIME, autoFitColumns, downloadBlob, sanitizeFilePart } from '../../utils/fileExport';

function badgeForRowStatus(s, hasPassCriteria = true) {
  if (s === 'passed') {
    if (!hasPassCriteria) return { variant: 'secondary', className: 'bg-gray-100 text-gray-700', label: '—' };
    return { variant: 'secondary', className: 'bg-green-50 text-green-700', label: 'Passed' };
  }
  if (s === 'failed') return { variant: 'secondary', className: 'bg-red-50 text-red-700', label: 'Failed' };
  if (s === 'absent') return { variant: 'secondary', className: 'bg-gray-100 text-gray-800', label: 'Absent' };
  if (s === 'incomplete') return { variant: 'secondary', className: 'bg-sky-50 text-sky-800', label: 'Incomplete' };
  return { variant: 'secondary', className: 'bg-amber-50 text-amber-700', label: 'Invalid' };
}

function toMarksBySubjectId(resultRow) {
  const out = {};
  const marks = Array.isArray(resultRow?.marks) ? resultRow.marks : [];
  for (const m of marks) {
    const sid = m?.subject_id;
    if (!sid) continue;
    if (m?.is_part_b || (m?.grade_text != null && String(m.grade_text).trim() !== '')) continue;
    if (m?.is_absent) out[sid] = 'AB';
    else if (m?.mark == null) out[sid] = '';
    else out[sid] = m.mark;
  }
  return out;
}

function toGradesBySubjectId(resultRow) {
  const out = {};
  const marks = Array.isArray(resultRow?.marks) ? resultRow.marks : [];
  for (const m of marks) {
    const sid = m?.subject_id;
    if (!sid) continue;
    if (m?.grade_text != null && String(m.grade_text).trim() !== '') {
      out[sid] = String(m.grade_text).trim();
    } else if (m?.is_part_b) {
      out[sid] = '';
    }
  }
  return out;
}

function avgTotals(validRows) {
  const vals = (validRows ?? []).map((r) => r.total).filter((n) => typeof n === 'number' && Number.isFinite(n));
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export function MarksViewEditor({
  classes,
  exam,
  subjects,
  resultsPayload,
  loadingExam,
  examError,
  loadingResults,
  resultsError,
  onBack,
}) {
  const navigate = useNavigate();
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(null); // 'excel' | 'pdf' | null
  const [showPartB, setShowPartB] = useState(false);

  const { partA, partB } = useMemo(() => partitionExamSubjects(subjects), [subjects]);
  const visibleSubjects = useMemo(
    () => (showPartB ? [...partA, ...partB] : partA),
    [showPartB, partA, partB]
  );

  const baseRows = useMemo(() => {
    const res = Array.isArray(resultsPayload?.results) ? resultsPayload.results : [];
    return res.map((r) => ({
      student_id: r.student_id ?? null,
      roll_number: r.roll_number ?? '',
      student_name: r.student_name ?? '',
      marksBySubjectId: toMarksBySubjectId(r),
      gradesBySubjectId: toGradesBySubjectId(r),
    }));
  }, [resultsPayload]);

  const computed = useMemo(() => computeResults({ rows: baseRows, subjects }), [baseRows, subjects]);
  const ranked = computed.rankedRows ?? [];
  const hasAnySavedResults = ranked.length > 0;

  const maxTotal = useMemo(
    () => partA.reduce((sum, s) => sum + (Number(s.max_marks) || 0), 0),
    [partA]
  );
  const pctStr = (total, max = maxTotal) => {
    if (!Number.isFinite(total) || max <= 0) return '—';
    return ((total / max) * 100).toFixed(1) + '%';
  };

  const top3 = useMemo(() => ranked.filter((r) => r.status === 'passed' || r.status === 'failed').slice(0, 3), [ranked]);

  const validForAvg = useMemo(() => ranked.filter((r) => r.status === 'passed' || r.status === 'failed'), [ranked]);
  const average = useMemo(() => avgTotals(validForAvg), [validForAvg]);
  const aboveBelow = useMemo(() => {
    if (average == null) return { above: 0, below: 0 };
    let above = 0;
    let below = 0;
    for (const r of validForAvg) {
      if (r.total >= average) above += 1;
      else below += 1;
    }
    return { above, below };
  }, [average, validForAvg]);

  const { totalCount, totalPages, currentPage, pageRows: paged } = usePagedRows(ranked, page, pageSize);

  const abovePct = (() => {
    const denom = aboveBelow.above + aboveBelow.below;
    if (!denom) return 0;
    return (aboveBelow.above / denom) * 100;
  })();

  const exportExcel = async () => {
    if (!exam) return;
    if (!hasAnySavedResults) return;
    setExporting('excel');
    try {
      const wb = new ExcelJS.Workbook();

      const dateStr = exam.exam_date ? new Date(exam.exam_date).toLocaleDateString() : '—';
      const meta1 = ['Exam', exam.test_name ?? '—'];
      const meta2 = ['Date', dateStr];
      const meta3 = ['Class / Section', classSectionLabel(exam, classes)];

      const header = [
        'Rank',
        'Roll',
        'Student',
        ...partA.map((s) => s.name),
        ...partB.map((s) => `PB | ${s.name}`),
        'Total',
        '%',
        'Result',
      ];

      const addResultsSheet = (name) => {
        const ws = wb.addWorksheet(name);
        const rowsData = ranked.map((r) => {
          const subjectCells = partA.map((s) => {
            const raw = r.marksBySubjectId?.[s.id];
            return raw === '' || raw == null ? '' : raw;
          });
          const total = Number.isFinite(r.total) ? r.total : '';
          return [
            r.rank ?? '',
            r.roll_number ?? '',
            r.student_name ?? '',
            ...subjectCells,
            ...partB.map((s) => r.gradesBySubjectId?.[s.id] ?? ''),
            total,
            total === '' ? '—' : pctStr(Number(total), maxTotal),
            badgeForRowStatus(r.status, computed.summary.hasPassCriteria).label,
          ];
        });

        ws.addRow(meta1);
        ws.addRow(meta2);
        ws.addRow(meta3);
        ws.addRow([]);
        ws.addRow(header);
        for (const row of rowsData) ws.addRow(row);

        const headerRowNumber = 5;
        const headerRow = ws.getRow(headerRowNumber);
        headerRow.font = { bold: true };
        headerRow.alignment = { vertical: 'middle', horizontal: 'left' };
        ws.views = [{ state: 'frozen', ySplit: headerRowNumber }];
        autoFitColumns(ws, header.length, { min: 10, max: 45 });
      };

      addResultsSheet('Results');

      const buffer = await wb.xlsx.writeBuffer();
      const filename = `Results_${sanitizeFilePart(exam.test_name)}_${sanitizeFilePart(classSectionLabel(exam, classes))}.xlsx`;
      downloadBlob(buffer, filename, XLSX_MIME);
    } finally {
      setExporting(null);
    }
  };

  const exportPdf = () => {
    if (!exam) return;
    if (!hasAnySavedResults) return;
    setExporting('pdf');
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const title = `Results Report - ${String(exam.test_name ?? 'Exam')}`;
      const dateStr = exam.exam_date ? new Date(exam.exam_date).toLocaleDateString() : '—';
      const clsSec = classSectionLabel(exam, classes);

      doc.setFontSize(14);
      doc.text(title, 40, 40);
      doc.setFontSize(10);
      doc.text(`Date: ${dateStr}`, 40, 60);
      doc.text(`Class/Section: ${clsSec}`, 40, 75);
      doc.text(
        `Students: ${computed.summary.totalStudents}  Passed: ${
          computed.summary.hasPassCriteria ? computed.summary.passed : 'NA'
        }  Failed: ${computed.summary.hasPassCriteria ? computed.summary.failed : 'NA'}  Absent: ${
          computed.summary.absentStudents
        }`,
        40,
        90
      );

      const head = [
        [
          'Rank',
          'Roll',
          'Student',
          ...partA.map((s) => s.name),
          ...partB.map((s) => `PB | ${s.name}`),
          'Total',
          '%',
          'Result',
        ],
      ];
      const body = ranked.map((r) => [
        r.rank ?? '—',
        r.roll_number ?? '—',
        r.student_name ?? '—',
        ...partA.map((s) => {
          const v = r.marksBySubjectId?.[s.id];
          return v === '' || v == null ? '—' : String(v);
        }),
        ...partB.map((s) => r.gradesBySubjectId?.[s.id] || '—'),
        Number.isFinite(r.total) ? String(r.total) : '—',
        pctStr(r.total),
        badgeForRowStatus(r.status, computed.summary.hasPassCriteria).label,
      ]);

      autoTable(doc, {
        head,
        body,
        startY: 110,
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [240, 240, 240], textColor: 20 },
        columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 70 }, 2: { cellWidth: 140 } },
        didDrawPage: (data) => {
          // footer
          const pageCount = doc.getNumberOfPages();
          doc.setFontSize(9);
          doc.text(`Page ${data.pageNumber} / ${pageCount}`, data.settings.margin.left, doc.internal.pageSize.height - 20);
        },
      });

      const filename = `Results_${sanitizeFilePart(exam.test_name)}_${sanitizeFilePart(clsSec)}.pdf`;
      doc.save(filename);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 w-fit gap-2 text-gray-700 hover:text-gray-900"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to exams
          </Button>
          <div className="mt-2 min-w-0">
            <h2 className="truncate text-2xl sm:text-3xl font-bold text-gray-900">Results report</h2>
            <p className="text-gray-600 mt-1">
              {loadingExam ? (
                <span>Loading exam…</span>
              ) : exam ? (
                <>
                  <span className="font-medium text-gray-900">{exam.test_name}</span> ·{' '}
                  <span>{classSectionLabel(exam, classes)}</span>
                </>
              ) : examError ? (
                <span className="text-red-600">{String(examError)}</span>
              ) : (
                <span className="text-gray-500">Exam not loaded</span>
              )}
            </p>
          </div>
        </div>
        <div className="w-full sm:w-auto">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={exportExcel}
              disabled={!exam || exporting === 'excel' || loadingResults || !hasAnySavedResults}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              {exporting === 'excel' ? 'Exporting…' : 'Export Excel'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={exportPdf}
              disabled={!exam || exporting === 'pdf' || loadingResults || !hasAnySavedResults}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              {exporting === 'pdf' ? 'Exporting…' : 'Export PDF'}
            </Button>
          </div>
        </div>
      </div>

      {loadingResults ? (
        <Card className="border-gray-200">
          <CardContent className="py-6 text-sm text-gray-600">Loading saved results…</CardContent>
        </Card>
      ) : resultsError ? (
        <Card className="border-red-200">
          <CardContent className="py-6 text-sm text-red-700">{String(resultsError)}</CardContent>
        </Card>
      ) : !hasAnySavedResults ? (
        <Card className="border-amber-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">No results uploaded yet</CardTitle>
            <CardDescription>
              This exam does not have any saved marks. Please upload or enter marks first to view ranks and export.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-amber-900">
              Go to <span className="font-semibold">Enter results</span> and save the marks for this exam.
            </div>
            <Button type="button" onClick={() => navigate(`/staff/marks/results/${exam?.id}`)} disabled={!exam}>
              Update exam marks
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-gray-200">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Insights</CardTitle>            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <div className="text-xs text-gray-500">Students</div>
                  <div className="text-2xl font-semibold text-gray-900">{computed.summary.totalStudents}</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <div className="text-xs text-gray-700">Absent</div>
                  <div className="text-2xl font-semibold text-gray-900">{computed.summary.absentStudents}</div>
                </div>
                <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                  <div className="text-xs text-green-800">Passed</div>
                  <div className="text-2xl font-semibold text-green-950">
                    {computed.summary.hasPassCriteria ? computed.summary.passed : 'NA'}
                  </div>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <div className="text-xs text-red-800">Failed</div>
                  <div className="text-2xl font-semibold text-red-950">
                    {computed.summary.hasPassCriteria ? computed.summary.failed : 'NA'}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-gray-900">Above vs below average</div>
                    <div className="text-sm text-gray-700">
                      Avg: {average == null ? '—' : Math.round(average * 10) / 10}
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Above: {aboveBelow.above}</span>
                      <span>Below: {aboveBelow.below}</span>
                    </div>
                    <div className="mt-2 h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                      <div className="h-2 bg-blue-600" style={{ width: `${abovePct}%` }} />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="text-sm font-semibold text-gray-900">Top 3 students</div>
                  <div className="mt-3 space-y-2">
                    {top3.length ? (
                      top3.map((r, idx) => (
                        <div key={`${r.roll_number}_${idx}`} className="flex items-center justify-between text-sm">
                          <div className="min-w-0">
                            <div className="font-medium text-gray-900 truncate">
                              #{r.rank ?? '—'} {r.student_name}
                            </div>
                            <div className="text-xs text-gray-500">{r.roll_number}</div>
                          </div>
                          <div className="font-semibold text-gray-900">{Number.isFinite(r.total) ? r.total : '—'}</div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-gray-600">No ranked students yet.</div>
                    )}
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>

          <Card className="border-gray-200">
            <CardHeader className="pb-3">
              <div>
                <CardTitle className="text-lg">Rank-wise table</CardTitle>              </div>
            </CardHeader>
            <CardContent>
              {partB.length ? (
                <div className="mb-4 flex items-center rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5">
                  <label
                    htmlFor="show-part-b-marks-view"
                    className="flex items-center gap-2.5 cursor-pointer select-none touch-manipulation text-sm font-medium text-sky-950"
                  >
                    <Checkbox
                      id="show-part-b-marks-view"
                      className="h-5 w-5"
                      checked={showPartB}
                      onCheckedChange={(v) => setShowPartB(Boolean(v))}
                    />
                    <span>Show Part B subjects ({partB.length})</span>
                  </label>
                </div>
              ) : null}
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left">
                        <th className="px-4 py-3 w-22.5 font-medium text-gray-900">Rank</th>
                        <th className="px-4 py-3 w-35 font-medium text-gray-900">Roll</th>
                        <th className="px-4 py-3 min-w-55 font-medium text-gray-900">Student</th>
                        {visibleSubjects.map((s) => (
                          <th key={s.id} className="px-4 py-3 min-w-40 font-medium text-gray-900">
                            <div className="flex flex-col">
                              <span>{isPartBSubject(s) ? `PB | ${s.name}` : s.name}</span>
                              {isPartBSubject(s) ? (
                                <span className="text-xs text-gray-500">Grade</span>
                              ) : (
                                <span className="text-xs text-gray-500">
                                  Max {s.max_marks} · {formatPassLabel(s)}
                                </span>
                              )}
                            </div>
                          </th>
                        ))}
                        <th className="px-4 py-3 w-30 font-medium text-gray-900">Total</th>
                        <th className="px-4 py-3 w-25 font-medium text-gray-900">%</th>
                        <th className="px-4 py-3 w-30 font-medium text-gray-900">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paged.map((r) => {
                        const rb = badgeForRowStatus(r.status, computed.summary.hasPassCriteria);
                        return (
                          <tr key={String(r.roll_number)} className="border-t border-gray-200">
                            <td className="px-4 py-3 font-semibold text-gray-900">{r.rank ?? '—'}</td>
                            <td className="px-4 py-3 font-medium text-gray-900">{r.roll_number}</td>
                            <td className="px-4 py-3 text-gray-700">{r.student_name}</td>
                            {visibleSubjects.map((s) => {
                              if (isPartBSubject(s)) {
                                return (
                                  <td key={s.id} className="px-4 py-3 text-gray-700">
                                    {r.gradesBySubjectId?.[s.id] || '—'}
                                  </td>
                                );
                              }
                              const v = r.marksBySubjectId?.[s.id] ?? '';
                              return <td key={s.id} className="px-4 py-3 text-gray-700">{String(v || '—')}</td>;
                            })}
                            <td className="px-4 py-3 font-semibold text-gray-900">{Number.isFinite(r.total) ? r.total : '—'}</td>
                            <td className="px-4 py-3 text-gray-700">{pctStr(r.total)}</td>
                            <td className="px-4 py-3">
                              <Badge variant={rb.variant} className={rb.className}>
                                {rb.label}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <TablePagination
                className="mt-4"
                page={currentPage}
                pageSize={pageSize}
                totalCount={totalCount}
                totalPages={totalPages}
                onPageChange={setPage}
                onPageSizeChange={(n) => {
                  setPageSize(n);
                  setPage(1);
                }}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

