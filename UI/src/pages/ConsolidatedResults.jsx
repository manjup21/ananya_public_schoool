import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { AlertTriangle, Download, RotateCcw } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { FormSelect } from '../components/common/FormSelect';
import { DatePickerInput } from '../components/common/DatePickerInput';
import { TablePagination } from '../components/common/TablePagination';
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
import { useClasses } from '../features/classes/useClasses';
import { fetchExamTypesThunk } from '../features/examTypes/examTypesSlice';
import { fetchExaminationsThunk } from '../features/examinations/examinationsSlice';
import { fetchExamResultsFullThunk } from '../features/examResults/examResultsSlice';
import { formatDateOnlyLocal, parseApiDateOnly, todayDateOnly } from '../utils/dateOnly';
import {
  buildConsolidatedRows,
  buildConsolidatedTableMeta,
  exportConsolidatedPdf,
  filterMatchingExams,
  formatCell,
  selectExamsForConsolidation,
} from '../utils/consolidatedResults';

function fmtExamDate(d) {
  if (!d) return '—';
  const dt = parseApiDateOnly(d);
  if (!dt) return String(d);
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ConsolidatedResults() {
  const dispatch = useDispatch();

  const { classes } = useClasses();
  const examinations = useSelector((s) => s.examinations?.items ?? []);
  const examinationsStatus = useSelector((s) => s.examinations?.status ?? 'idle');
  const examTypes = useSelector((s) => s.examTypes?.items ?? []);
  const examTypesStatus = useSelector((s) => s.examTypes?.status ?? 'idle');

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [examTypeId, setExamTypeId] = useState('');

  const [resultsByExamId, setResultsByExamId] = useState({});
  const [loadingResults, setLoadingResults] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    if (examinationsStatus === 'idle') dispatch(fetchExaminationsThunk({}));
    if (examTypesStatus === 'idle') dispatch(fetchExamTypesThunk({ search: '' }));
  }, [dispatch, examinationsStatus, examTypesStatus]);

  useEffect(() => {
    setSectionId('');
  }, [classId]);

  useEffect(() => {
    setPage(1);
  }, [fromDate, toDate, classId, sectionId, examTypeId, pageSize]);

  const fromDateObj = parseApiDateOnly(fromDate);
  const toDateObj = parseApiDateOnly(toDate);
  const maxSelectableDate = parseApiDateOnly(todayDateOnly()) ?? new Date();

  const dateRangeError = useMemo(() => {
    if (!fromDate || !toDate) return null;
    if (fromDate > toDate) return 'To date cannot be earlier than from date.';
    if (toDate > todayDateOnly()) return 'To date cannot be later than today.';
    return null;
  }, [fromDate, toDate]);

  const filtersReady = Boolean(
    fromDate && toDate && classId && sectionId && examTypeId && !dateRangeError
  );
  const clearAllFilters = () => {
    setFromDate('');
    setToDate('');
    setClassId('');
    setSectionId('');
    setExamTypeId('');
    setResultsByExamId({});
    setFetchError(null);
    setLoadingResults(false);
    setPage(1);
  };

  const hasActiveFilters = Boolean(fromDate || toDate || classId || sectionId || examTypeId);

  const handleFromDateChange = (d) => {
    const next = d ? formatDateOnlyLocal(d) : '';
    setFromDate(next);
    if (next && toDate && next > toDate) setToDate('');
  };

  const handleToDateChange = (d) => {
    setToDate(d ? formatDateOnlyLocal(d) : '');
  };

  const matchingExams = useMemo(() => {
    if (!filtersReady) return [];
    return filterMatchingExams(examinations, {
      fromDate,
      toDate,
      classId,
      sectionId,
      examTypeId,
    });
  }, [examinations, filtersReady, fromDate, toDate, classId, sectionId, examTypeId]);

  const selectedExams = useMemo(
    () => selectExamsForConsolidation(matchingExams, 8),
    [matchingExams]
  );

  const selectedExamIdsKey = useMemo(
    () => selectedExams.map((e) => e.id).join(','),
    [selectedExams]
  );

  useEffect(() => {
    if (!filtersReady || selectedExams.length === 0) {
      setResultsByExamId({});
      setFetchError(null);
      setLoadingResults(false);
      return undefined;
    }

    let cancelled = false;
    setLoadingResults(true);
    setFetchError(null);

    Promise.all(
      selectedExams.map((exam) =>
        dispatch(fetchExamResultsFullThunk({ examId: exam.id }))
          .unwrap()
          .then((data) => ({ examId: exam.id, data }))
      )
    )
      .then((pairs) => {
        if (cancelled) return;
        const map = {};
        for (const { examId, data } of pairs) map[examId] = data;
        setResultsByExamId(map);
      })
      .catch((err) => {
        if (!cancelled) setFetchError(String(err ?? 'Failed to load exam results'));
      })
      .finally(() => {
        if (!cancelled) setLoadingResults(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filtersReady, selectedExamIdsKey, dispatch, selectedExams]);

  const consolidatedRows = useMemo(() => {
    if (!selectedExams.length || loadingResults) return [];
    return buildConsolidatedRows(selectedExams, resultsByExamId);
  }, [selectedExams, resultsByExamId, loadingResults]);

  const tableMeta = useMemo(
    () => buildConsolidatedTableMeta(selectedExams, resultsByExamId),
    [selectedExams, resultsByExamId]
  );

  const classOptions = useMemo(
    () => (classes ?? []).map((c) => ({ value: String(c.id), label: c.name ?? 'Class' })),
    [classes]
  );

  const sectionOptions = useMemo(() => {
    if (!classId) return [];
    const cls = (classes ?? []).find((c) => String(c.id) === String(classId));
    const secs = cls?.sections ?? [];
    return [
      { value: 'whole', label: 'Whole class (no section)' },
      ...secs.map((s) => ({ value: String(s.id), label: s.section ?? 'Section' })),
    ];
  }, [classId, classes]);

  const examTypeOptions = useMemo(
    () => (examTypes ?? []).map((t) => ({ value: String(t.id), label: t.name ?? 'Type' })),
    [examTypes]
  );

  const selectedClass = (classes ?? []).find((c) => String(c.id) === String(classId));
  const className = selectedClass?.name ?? 'Class';
  const sectionLabel = useMemo(() => {
    if (sectionId === 'whole') return `${className} · Whole class`;
    const sec = selectedClass?.sections?.find((s) => String(s.id) === String(sectionId));
    return sec ? `${className} · ${sec.section}` : className;
  }, [sectionId, className, selectedClass]);

  const examTypeName =
    (examTypes ?? []).find((t) => String(t.id) === String(examTypeId))?.name ?? 'Exam';

  const { totalPages, currentPage, pageRows: pagedRows } = usePagedRows(consolidatedRows, page, pageSize);

  const canExport = filtersReady && selectedExams.length > 0 && consolidatedRows.length > 0 && !loadingResults;

  const handleExport = () => {
    if (!canExport) return;
    setExporting(true);
    try {
      exportConsolidatedPdf({
        selectedExams,
        resultsByExamId,
        rows: consolidatedRows,
        className,
        sectionLabel,
        examTypeName,
        fromDate,
        toDate,
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Consolidated results</h2>      </div>

      <Card className="border-gray-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Filters</CardTitle>        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="consolidated-from">
                From date
              </label>
              <DatePicker
                selected={fromDateObj}
                onChange={handleFromDateChange}
                dateFormat="dd-MM-yyyy"
                maxDate={toDateObj && toDateObj < maxSelectableDate ? toDateObj : maxSelectableDate}
                preventOpenOnFocus
                shouldCloseOnSelect
                customInput={
                  <DatePickerInput id="consolidated-from" placeholder="dd-mm-yyyy" className="w-full" />
                }
                wrapperClassName="w-full"
                popperPlacement="bottom-start"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="consolidated-to">
                To date
              </label>
              <DatePicker
                selected={toDateObj}
                onChange={handleToDateChange}
                dateFormat="dd-MM-yyyy"
                minDate={fromDateObj ?? undefined}
                maxDate={maxSelectableDate}
                preventOpenOnFocus
                shouldCloseOnSelect
                customInput={
                  <DatePickerInput
                    id="consolidated-to"
                    placeholder="dd-mm-yyyy"
                    className="w-full"
                    aria-invalid={dateRangeError ? true : undefined}
                  />
                }
                wrapperClassName="w-full"
                popperPlacement="bottom-start"
              />
              {dateRangeError ? <p className="text-xs text-red-600">{dateRangeError}</p> : null}
            </div>
            <FormSelect
              id="consolidated-class"
              label="Class"
              value={classId || undefined}
              onValueChange={setClassId}
              options={classOptions}
              placeholder="Select class"
            />
            <FormSelect
              id="consolidated-section"
              label="Section"
              value={sectionId || undefined}
              onValueChange={setSectionId}
              options={classId ? sectionOptions : []}
              placeholder={classId ? 'Select section' : 'Select class first'}
            />
            <FormSelect
              id="consolidated-exam-type"
              label="Exam type"
              value={examTypeId || undefined}
              onValueChange={setExamTypeId}
              options={examTypeOptions}
              placeholder="Select exam type"
            />
            <div className="flex items-end sm:col-span-2 lg:col-span-1">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-2 w-full sm:w-auto"
                disabled={!hasActiveFilters}
                onClick={clearAllFilters}
              >
                <RotateCcw className="h-4 w-4" />
                Clear filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {!filtersReady && (
        <Card className="border-gray-200">
          <CardContent className="py-10 text-center text-gray-500">
            Select date range, class, section, and exam type to load the consolidated report.
          </CardContent>
        </Card>
      )}

      {filtersReady && (
        <>
          <div className="space-y-3">
            <p className="text-sm text-gray-700">
              <span className="font-semibold">{matchingExams.length}</span> completed exam(s) found for the
              selected filters.
            </p>

            {matchingExams.length > 8 && (
              <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
                <p>
                  More than 8 exams match. Only the 8 most recent will be included in the report (oldest
                  to most recent).
                </p>
              </div>
            )}

            {selectedExams.length > 0 && (
              <Card className="border-gray-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Included exams</CardTitle>                </CardHeader>
                <CardContent>
                  <ul className="text-sm text-gray-700 space-y-1">
                    {selectedExams.map((exam) => (
                      <li key={exam.id}>
                        <span className="font-medium">{exam.test_name ?? 'Exam'}</span>
                        <span className="text-gray-500"> — {fmtExamDate(exam.exam_date)}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>

          <Card className="border-gray-200">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-lg">Consolidated marks preview</CardTitle>              </div>
              <Button
                type="button"
                variant="outline"
                className="gap-2 shrink-0"
                disabled={!canExport || exporting}
                onClick={handleExport}
              >
                <Download className="h-4 w-4" />
                {exporting ? 'Exporting…' : 'Export PDF'}
              </Button>
            </CardHeader>
            <CardContent>
              {loadingResults ? (
                <div className="overflow-x-auto rounded-md border border-gray-200">
                  <Table>
                    <TableBody>
                      <TableSkeletonRows columns={Math.min(4 + tableMeta.columns.length, 12)} rows={8} />
                    </TableBody>
                  </Table>
                </div>
              ) : fetchError ? (
                <p className="text-sm text-red-600 py-6 text-center">{fetchError}</p>
              ) : matchingExams.length === 0 ? (
                <p className="text-sm text-gray-500 py-6 text-center">
                  No completed exams found for the selected filters.
                </p>
              ) : consolidatedRows.length === 0 ? (
                <p className="text-sm text-gray-500 py-6 text-center">
                  No marks entered for the selected exams.
                </p>
              ) : (
                <>
                  <div className="overflow-x-auto rounded-md border border-gray-200">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-center w-12">Sl.No</TableHead>
                          <TableHead>Name of the students</TableHead>
                          {tableMeta.columns.map((col) => (
                            <TableHead key={col.key} className="text-center whitespace-nowrap min-w-[88px]">
                              <span className="block max-w-[140px] truncate mx-auto" title={col.label}>
                                {col.label}
                              </span>
                              <span className="block text-xs font-normal text-gray-500">({col.maxMarks})</span>
                            </TableHead>
                          ))}
                          <TableHead className="text-center font-bold whitespace-nowrap">
                            Total ({tableMeta.grandMax})
                          </TableHead>
                          <TableHead className="text-center font-bold w-16">Rank</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pagedRows.map((row, idx) => (
                          <TableRow key={row.student_id}>
                            <TableCell className="text-center">
                              {(currentPage - 1) * pageSize + idx + 1}
                            </TableCell>
                            <TableCell className="uppercase">{row.student_name}</TableCell>
                            {tableMeta.columns.map((col) => (
                              <TableCell key={col.key} className="text-center">
                                {formatCell(row.marks[col.key])}
                              </TableCell>
                            ))}
                            <TableCell className="text-center font-bold">{row.total}</TableCell>
                            <TableCell className="text-center font-bold">{row.rank}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <TablePagination
                    page={currentPage}
                    pageSize={pageSize}
                    totalCount={consolidatedRows.length}
                    totalPages={totalPages}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
