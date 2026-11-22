import { useEffect, useMemo, useRef, useState } from 'react';
import ExcelJS from 'exceljs';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { TablePagination } from '../../components/common/TablePagination';
import { FormSelect } from '../../components/common/FormSelect';
import { ArrowLeft, FileUp, Loader2, ListChecks } from 'lucide-react';
import {
  PART_B_GRADE_MAX_LEN,
  computeResults,
  formatPassLabel,
  isPartBSubject,
  normalizeRoll,
  parseMarkValue,
  parsePartBGrade,
  partitionExamSubjects,
  subjectIdFromExcelHeader,
  validateMarkValue,
  validatePartBGrade,
} from '../../utils/marksValidation';
import { classSectionLabel } from '../examinationManagement/examinationHelpers';
import { Checkbox } from '../../components/ui/checkbox';

function classSectionMeta(exam, classes) {
  const cls = classes.find((c) => c.id === exam.class_id);
  const className = cls?.name ?? '—';
  const sectionId = exam?.section_id ? String(exam.section_id) : null;
  if (sectionId) {
    const sec = cls?.sections?.find((s) => String(s.id) === sectionId);
    return `${className}, ${sec?.section ?? '—'}`;
  }
  const ids = Array.isArray(exam?.section_ids) ? exam.section_ids.filter(Boolean) : [];
  if (ids.length) {
    const labels = ids
      .map((sid) => cls?.sections?.find((s) => String(s.id) === String(sid))?.section)
      .filter(Boolean);
    return `${className}, ${labels.length ? labels.join(', ') : 'Selected sections'}`;
  }
  return `${className}, All sections`;
}

function normLoose(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/[·•\-–—]/g, ',')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s+/g, ' ');
}

function sameLoose(a, b) {
  return normLoose(a) === normLoose(b);
}

function issueId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function EnterResultsEditor({
  classes,
  exam,
  subjects,
  rows,
  setRows,
  onBack,
  onSaveAll,
  actionState,
  loadingExam,
  examError,
}) {
  const [activeTab, setActiveTab] = useState('manual');
  const [issues, setIssues] = useState([]);
  const [marksPageSize, setMarksPageSize] = useState(10);
  const [marksPage, setMarksPage] = useState(1);
  const [showPartB, setShowPartB] = useState(false);
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('all');

  const fileInputRef = useRef(null);
  const [selectedFileName, setSelectedFileName] = useState('');

  const { partA, partB } = useMemo(() => partitionExamSubjects(subjects), [subjects]);
  const subjectFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'All subjects' },
      ...partA.map((s) => ({ value: s.id, label: s.name })),
      ...partB.map((s) => ({ value: s.id, label: `PB | ${s.name}` })),
    ],
    [partA, partB]
  );
  const singleSubject =
    activeTab === 'manual' && selectedSubjectFilter !== 'all'
      ? subjects.find((s) => s.id === selectedSubjectFilter)
      : null;
  const visibleSubjects = useMemo(
    () => (singleSubject ? [singleSubject] : showPartB ? [...partA, ...partB] : partA),
    [singleSubject, showPartB, partA, partB]
  );

  const results = useMemo(() => computeResults({ rows, subjects }), [rows, subjects]);
  const hasInvalidCells = (results?.summary?.invalidCells ?? 0) > 0;

  const viewRows = useMemo(() => {
    const base = [...results.rows];
    base.sort((a, b) =>
      String(a.roll_number ?? '').localeCompare(String(b.roll_number ?? ''), undefined, { numeric: true })
    );
    return base;
  }, [results]);

  useEffect(() => {
    setMarksPage(1);
  }, [exam?.id, marksPageSize, rows.length, subjects.length, showPartB, selectedSubjectFilter]);

  useEffect(() => {
    if (!partB.length) setShowPartB(false);
  }, [partB.length]);

  const marksTotalCount = viewRows.length;
  const marksTotalPages = Math.max(1, Math.ceil(marksTotalCount / marksPageSize));
  const marksCurrentPage = Math.min(marksPage, marksTotalPages);
  const paginatedMarksRows = useMemo(() => {
    const start = (marksCurrentPage - 1) * marksPageSize;
    return viewRows.slice(start, start + marksPageSize);
  }, [viewRows, marksCurrentPage, marksPageSize]);

  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);

  const badgeForRowStatus = (s) => {
    if (s === 'passed') {
      if (!results.summary.hasPassCriteria) {
        return { variant: 'secondary', className: 'bg-gray-100 text-gray-700', label: '—' };
      }
      return { variant: 'secondary', className: 'bg-green-50 text-green-700', label: 'Passed' };
    }
    if (s === 'failed') return { variant: 'secondary', className: 'bg-red-50 text-red-700', label: 'Failed' };
    if (s === 'absent') return { variant: 'secondary', className: 'bg-gray-100 text-gray-800', label: 'Absent' };
    if (s === 'incomplete') return { variant: 'secondary', className: 'bg-sky-50 text-sky-800', label: 'Incomplete' };
    return { variant: 'secondary', className: 'bg-amber-50 text-amber-700', label: 'Invalid' };
  };

  const cellClass = (row, subject) => {
    if (isPartBSubject(subject)) {
      const parsed = parsePartBGrade(row.gradesBySubjectId?.[subject.id]);
      const val = validatePartBGrade(parsed);
      if (!val.valid) return 'border-red-300 focus-visible:ring-red-400';
      return '';
    }
    const raw = row.marksBySubjectId?.[subject.id];
    const parsed = parseMarkValue(raw);
    if (parsed.kind === 'missing') return '';
    const val = validateMarkValue(parsed, subject);
    if (!val.valid) return 'border-red-300 focus-visible:ring-red-400';
    if (parsed.kind === 'absent') return 'border-gray-300 bg-gray-50 text-gray-700';
    return '';
  };

  const setMarkCell = (rollNumber, subjectId, nextRaw) => {
    setRows((prev) =>
      prev.map((r) => {
        if (String(r.roll_number) !== String(rollNumber)) return r;
        return {
          ...r,
          marksBySubjectId: {
            ...(r.marksBySubjectId ?? {}),
            [subjectId]: nextRaw,
          },
        };
      })
    );
  };

  const setGradeCell = (rollNumber, subjectId, nextRaw) => {
    setRows((prev) =>
      prev.map((r) => {
        if (String(r.roll_number) !== String(rollNumber)) return r;
        return {
          ...r,
          gradesBySubjectId: {
            ...(r.gradesBySubjectId ?? {}),
            [subjectId]: nextRaw,
          },
        };
      })
    );
  };

  const handleMarkBlurNormalize = (rollNumber, subjectId, raw) => {
    const parsed = parseMarkValue(raw);
    if (parsed.kind === 'absent') return setMarkCell(rollNumber, subjectId, 'AB');
    if (parsed.kind === 'missing') return setMarkCell(rollNumber, subjectId, '');
    if (parsed.kind === 'number') return setMarkCell(rollNumber, subjectId, String(parsed.value));
    return setMarkCell(rollNumber, subjectId, String(raw ?? '').trim());
  };

  const handleGradeBlurNormalize = (rollNumber, subjectId, raw) => {
    const parsed = parsePartBGrade(raw);
    if (parsed.kind === 'missing') return setGradeCell(rollNumber, subjectId, '');
    if (parsed.kind === 'grade') return setGradeCell(rollNumber, subjectId, parsed.value);
    return setGradeCell(rollNumber, subjectId, String(raw ?? '').trim().slice(0, PART_B_GRADE_MAX_LEN));
  };

  const parseExcel = async (file) => {
    if (!file) return;
    if (!exam) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf);
      const sheet = wb.getWorksheet('Marks') ?? wb.worksheets?.[0];
      if (!sheet) {
        toast.error('No worksheet found in the Excel file');
        return;
      }

      const localIssues = [];
      const meta1 = String(sheet.getRow(1).getCell(2).value ?? '').trim();
      const meta2 = String(sheet.getRow(2).getCell(2).value ?? '').trim();
      const meta3 = String(sheet.getRow(3).getCell(2).value ?? '').trim();
      const expectedName = String(exam.test_name ?? '').trim();
      const expectedDate = String(exam.exam_date ?? '').trim();
      const expectedClassSection = classSectionMeta(exam, classes);

      if (meta1 && expectedName && !sameLoose(meta1, expectedName)) {
        localIssues.push({ id: issueId(), level: 'warn', message: `Excel exam name "${meta1}" does not match selected exam "${expectedName}".` });
      }
      if (meta2 && expectedDate && !sameLoose(meta2, expectedDate)) {
        localIssues.push({ id: issueId(), level: 'warn', message: `Excel exam date "${meta2}" does not match selected exam "${expectedDate}".` });
      }
      if (meta3 && expectedClassSection && !sameLoose(meta3, expectedClassSection)) {
        localIssues.push({ id: issueId(), level: 'warn', message: `Excel class/section "${meta3}" does not match selected exam "${expectedClassSection}".` });
      }

      const headerRow = sheet.getRow(4);
      const colToSubjectId = new Map();
      const unknownHeaders = [];

      for (let c = 3; c <= headerRow.cellCount; c++) {
        const rawHeader = headerRow.getCell(c).value;
        const name = String(rawHeader ?? '').trim();
        if (!name) continue;
        const sid = subjectIdFromExcelHeader(name, subjects);
        if (!sid) {
          unknownHeaders.push(name);
          continue;
        }
        colToSubjectId.set(c, sid);
      }

      if (unknownHeaders.length) {
        localIssues.push({
          id: issueId(),
          level: 'warn',
          message: `Some Excel subject columns were not recognized and will be ignored: ${unknownHeaders.join(', ')}`,
        });
      }

      const rollToIdx = new Map();
      rows.forEach((r, idx) => rollToIdx.set(normalizeRoll(r.roll_number), idx));

      const nextRows = rows.map((r) => ({
        ...r,
        marksBySubjectId: { ...(r.marksBySubjectId ?? {}) },
        gradesBySubjectId: { ...(r.gradesBySubjectId ?? {}) },
      }));

      const unknownRolls = [];
      const invalidDetails = [];
      const invalidRolls = new Set();

      for (let r = 5; r <= sheet.rowCount; r++) {
        const row = sheet.getRow(r);
        const rollCell = row.getCell(1).value;
        const roll = normalizeRoll(rollCell);
        if (!roll) continue;
        const idx = rollToIdx.get(roll);
        if (idx == null) {
          unknownRolls.push(roll);
          continue;
        }

        for (const [col, sid] of colToSubjectId.entries()) {
          const raw = row.getCell(col).value;
          const subj = subjectById.get(sid);
          if (isPartBSubject(subj)) {
            const parsed = parsePartBGrade(raw);
            const val = validatePartBGrade(parsed);
            if (!val.valid) {
              invalidRolls.add(roll);
              invalidDetails.push({ roll, subject: subj?.name ?? 'Subject', reason: val.reason });
            }
            if (parsed.kind === 'grade') nextRows[idx].gradesBySubjectId[sid] = parsed.value;
            else if (parsed.kind === 'missing') nextRows[idx].gradesBySubjectId[sid] = '';
            else nextRows[idx].gradesBySubjectId[sid] = String(raw ?? '').trim().slice(0, PART_B_GRADE_MAX_LEN);
            continue;
          }

          const parsed = parseMarkValue(raw);
          const val = validateMarkValue(parsed, subj);
          if (!val.valid) {
            invalidRolls.add(roll);
            invalidDetails.push({ roll, subject: subj?.name ?? 'Subject', reason: val.reason });
          }
          if (parsed.kind === 'absent') nextRows[idx].marksBySubjectId[sid] = 'AB';
          else if (parsed.kind === 'missing') nextRows[idx].marksBySubjectId[sid] = '';
          else if (parsed.kind === 'number') nextRows[idx].marksBySubjectId[sid] = String(parsed.value);
          else nextRows[idx].marksBySubjectId[sid] = String(raw ?? '').trim();
        }
      }

      if (unknownRolls.length) {
        localIssues.push({
          id: issueId(),
          level: 'error',
          message: `Unknown roll numbers in Excel (not in this exam cohort): ${unknownRolls.slice(0, 20).join(', ')}${unknownRolls.length > 20 ? '…' : ''}`,
        });
      }
      if (invalidDetails.length) {
        localIssues.push({
          id: issueId(),
          level: 'error',
          message: `${invalidRolls.size} student(s) have invalid marks/grades (${invalidDetails.length} cell(s)). Fix Part A numbers/AB or Part B grades.`,
        });
      }

      if (partB.length) setShowPartB(true);
      setRows(nextRows);
      setIssues(localIssues);
      toast.success('Excel parsed. Review highlights and summary.');
    } catch (e) {
      toast.error(typeof e === 'string' ? e : e?.message || 'Failed to read Excel');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
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
            <h2 className="truncate text-2xl sm:text-3xl font-bold text-gray-900">Enter results</h2>
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
      </div>

      {loadingExam && (
        <Card className="border-gray-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 py-8 justify-center">
              <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
              <span className="text-sm text-gray-600">Loading exam data and marks…</span>
            </div>
            <div className="space-y-3 mt-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-7 w-10" />
                  </div>
                ))}
              </div>
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      {Array.from({ length: 6 }, (_, i) => (
                        <th key={i} className="px-4 py-3"><Skeleton className="h-4 w-20" /></th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 5 }, (_, i) => (
                      <tr key={i} className="border-t border-gray-200">
                        {Array.from({ length: 6 }, (_, j) => (
                          <td key={j} className="px-4 py-3">
                            <Skeleton className="h-4" style={{ maxWidth: `${5 + ((j * 3 + i * 2) % 5)}rem` }} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!loadingExam && (
      <>
      <Card className="border-gray-200">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Summary</CardTitle>        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="text-xs text-gray-500">Students</div>
              <div className="text-2xl font-semibold text-gray-900">{results.summary.totalStudents}</div>
            </div>
            <div className="rounded-lg border border-sky-200 bg-sky-50 p-3">
              <div className="text-xs text-sky-800">Incomplete cells</div>
              <div className="text-2xl font-semibold text-sky-950">{results.summary.missingCells ?? 0}</div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="text-xs text-amber-800">Invalid cells</div>
              <div className="text-2xl font-semibold text-amber-950">{results.summary.invalidCells}</div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="text-xs text-gray-700">Absent</div>
              <div className="text-2xl font-semibold text-gray-900">{results.summary.absentStudents}</div>
            </div>
            <div className="rounded-lg border border-green-200 bg-green-50 p-3">
              <div className="text-xs text-green-800">Passed</div>
              <div className="text-2xl font-semibold text-green-950">
                {results.summary.hasPassCriteria ? results.summary.passed : 'NA'}
              </div>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <div className="text-xs text-red-800">Failed</div>
              <div className="text-2xl font-semibold text-red-950">
                {results.summary.hasPassCriteria ? results.summary.failed : 'NA'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {issues.length ? (
        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Upload review</CardTitle>
            <CardDescription>Excel import failed.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Invalid Excel file or data in Excel doesn&apos;t match the selected exam.
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <CardTitle>Marks entry</CardTitle>
              <CardDescription>
                Use <span className="font-semibold">AB</span> for absent. Empty cells can be filled later.
              </CardDescription>
            </div>
            <div className="flex flex-col items-stretch sm:items-end gap-2">
              <Button
                type="button"
                size="sm"
                onClick={onSaveAll}
                disabled={actionState?.saving || !exam || hasInvalidCells}
              >
                {actionState?.saving ? 'Saving…' : 'Save'}
              </Button>
              {actionState?.note ? <div className="text-xs text-gray-500">{actionState.note}</div> : null}
              {hasInvalidCells ? (
                <div className="text-xs text-amber-700">Fix invalid cells to enable Save.</div>
              ) : (results?.summary?.missingCells ?? 0) > 0 ? (
                <div className="text-xs text-sky-700">Incomplete cells will stay blank until entered.</div>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {partB.length ? (
            <div className="mb-4 flex items-center rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5">
              <label
                htmlFor="show-part-b-subjects"
                className="flex items-center gap-2.5 cursor-pointer select-none touch-manipulation text-sm font-medium text-sky-950"
              >
                <Checkbox
                  id="show-part-b-subjects"
                  className="h-5 w-5"
                  checked={showPartB}
                  onCheckedChange={(v) => setShowPartB(Boolean(v))}
                />
                <span>Show Part B subjects ({partB.length})</span>
              </label>
            </div>
          ) : null}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-4">
            <TabsList className="w-fit">
              <TabsTrigger value="manual">Manual</TabsTrigger>
              <TabsTrigger value="excel">Upload Excel</TabsTrigger>
            </TabsList>

            <TabsContent value="excel">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-gray-900">Upload filled template</div>
                    <div className="text-sm text-gray-600">
                      Upload the downloaded template after entering marks. Use{' '}
                      <span className="font-medium">AB</span> for Part A absent; Part B columns are headed{' '}
                      <span className="font-medium">PB | …</span> for free-text grades.
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 sm:shrink-0">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        setSelectedFileName(f?.name ?? '');
                        parseExcel(f);
                      }}
                      className="hidden"
                    />
                    <div className="text-sm text-gray-600 max-w-full sm:max-w-65 truncate order-2 sm:order-0">
                      {selectedFileName ? selectedFileName : 'No file chosen'}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2 w-full sm:w-auto order-1 sm:order-0"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <FileUp className="h-4 w-4" />
                      Choose file
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="manual">
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                <p className="text-sm text-gray-700">
                  <ListChecks className="inline h-4 w-4 text-gray-500 mr-1.5 align-text-bottom" />
                  Tip: type a number or <span className="font-semibold">AB</span>, then click outside the cell to validate. Empty cells are skipped on Save (other lecturers’ marks stay intact).
                </p>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <FormSelect
                  id="enter-results-subject"
                  label="Subject"
                  value={singleSubject ? selectedSubjectFilter : 'all'}
                  onValueChange={setSelectedSubjectFilter}
                  options={subjectFilterOptions}
                  placeholder="All subjects"
                  contentClassName="min-w-[var(--radix-select-trigger-width)]"
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-4 rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
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
                    <th className="px-4 py-3 w-30 font-medium text-gray-900">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedMarksRows.map((r) => {
                    const rb = badgeForRowStatus(r.status);
                    return (
                      <tr key={String(r.roll_number)} className="border-t border-gray-200">
                        <td className="px-4 py-3 font-medium text-gray-900">{r.roll_number}</td>
                        <td className="px-4 py-3 text-gray-700">{r.student_name}</td>
                        {visibleSubjects.map((s) => {
                          if (isPartBSubject(s)) {
                            const v = r.gradesBySubjectId?.[s.id] ?? '';
                            return (
                              <td key={s.id} className="px-4 py-2">
                                <Input
                                  value={String(v)}
                                  maxLength={PART_B_GRADE_MAX_LEN}
                                  onChange={(e) => setGradeCell(r.roll_number, s.id, e.target.value)}
                                  onBlur={(e) => handleGradeBlurNormalize(r.roll_number, s.id, e.target.value)}
                                  placeholder="A+ / Good / …"
                                  className={cellClass(r, s)}
                                />
                              </td>
                            );
                          }
                          const v = r.marksBySubjectId?.[s.id] ?? '';
                          return (
                            <td key={s.id} className="px-4 py-2">
                              <Input
                                value={String(v)}
                                onChange={(e) => setMarkCell(r.roll_number, s.id, e.target.value)}
                                onBlur={(e) => handleMarkBlurNormalize(r.roll_number, s.id, e.target.value)}
                                placeholder="Enter marks"
                                className={cellClass(r, s)}
                              />
                            </td>
                          );
                        })}
                        <td className="px-4 py-3 font-semibold text-gray-900">
                          {Number.isFinite(r.total) ? r.total : '—'}
                        </td>
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
            selectId="enter-results-marks-page-size"
            page={marksCurrentPage}
            pageSize={marksPageSize}
            totalCount={marksTotalCount}
            totalPages={marksTotalPages}
            onPageChange={setMarksPage}
            onPageSizeChange={setMarksPageSize}
          />
        </CardContent>
      </Card>
      </>
      )}
    </div>
  );
}

