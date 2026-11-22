import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Download } from 'lucide-react';
import { SearchInput } from '../components/common/SearchInput';
import { toast } from 'sonner';

import { plainSectionLabel, useClassSectionOptions } from '../features/classes/useClasses';
import {
  fetchBulkStudentProgressReportsThunk,
  fetchLecturerStudentsThunk,
  fetchStudentProgressReportThunk,
} from '../features/lecturerStudents/lecturerStudentsSlice';
import { fetchStudentByIdThunk } from '../features/students/studentsSlice';
import { fetchExaminationsThunk } from '../features/examinations/examinationsSlice';
import {
  BULK_STUDENT_REPORT_MAX,
  exportStudentProgressPdf,
  prepareReportPhoto,
  sectionsForExam,
} from '../utils/progressReportCard';
import { downloadBulkStudentReportZip } from '../utils/bulkStudentReportZip';
import { fetchStudentPhotoDataUrl } from '../utils/studentPhotoDataUrl';
import { ReportOptionsDialog } from './studentReports/ReportOptionsDialog';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Checkbox } from '../components/ui/checkbox';
import { FormSelect } from '../components/common/FormSelect';
import { PageHeader } from '../components/common/PageHeader';
import { TablePagination } from '../components/common/TablePagination';
import { usePagedRows } from '../hooks/usePagedRows';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Spinner } from '../components/ui/spinner';

const REPORT_TYPE_OPTIONS = [
  { value: 'final', label: 'Final Report' },
  { value: 'exam', label: 'Exam Report' },
];

const EXAM_REPORT_OPTIONS = {
  partB: { include: false, fields: [] },
  totalMarks: { include: false },
};

function formatExamOptionDate(value) {
  const s = String(value ?? '').slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : s;
}

export function StudentReportsPage() {
  const dispatch = useDispatch();

  const students = useSelector((s) => s.lecturerStudents.list);
  const studentsStatus = useSelector((s) => s.lecturerStudents.listStatus);
  const studentsError = useSelector((s) => s.lecturerStudents.listError);

  const [searchQuery, setSearchQuery] = useState('');
  const [classId, setClassId] = useState('all');
  const [sectionId, setSectionId] = useState('all');
  const [hasLoaded, setHasLoaded] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [rollNumber, setRollNumber] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkProgressLabel, setBulkProgressLabel] = useState('');
  /** null | { mode: 'single', student } | { mode: 'bulk' } */
  const [optionsFor, setOptionsFor] = useState(null);
  const [reportType, setReportType] = useState('final');
  const [examId, setExamId] = useState('');
  const [exams, setExams] = useState([]);
  const [examsLoading, setExamsLoading] = useState(false);

  const isExamReport = reportType === 'exam';
  const canLoad = rollNumber.trim() !== '' || classId !== 'all';
  const showStudentsCard = hasLoaded && studentsStatus === 'succeeded';
  const examClassId = classId !== 'all' ? classId : students?.[0]?.class_id;
  const selectedExam = exams.find((e) => String(e.id) === String(examId)) ?? null;

  const { classOptions, sectionOptions, classNameFor, sectionCodeFor } = useClassSectionOptions(classId, {
    formatSection: plainSectionLabel,
  });

  useEffect(() => {
    setSectionId('all');
    setPage(1);
    setHasLoaded(false);
    setSelectedIds(new Set());
  }, [classId]);

  useEffect(() => {
    if (!isExamReport || !hasLoaded || !examClassId) {
      setExams([]);
      setExamId('');
      return undefined;
    }
    let cancelled = false;
    setExamsLoading(true);
    dispatch(
      fetchExaminationsThunk({
        classId: examClassId,
        sectionId: sectionId !== 'all' ? sectionId : undefined,
        status: 'completed',
      })
    )
      .unwrap()
      .then((list) => {
        if (cancelled) return;
        const sorted = [...(list ?? [])].sort((a, b) =>
          String(a.exam_date ?? '').localeCompare(String(b.exam_date ?? ''))
        );
        setExams(sorted);
        setExamId((prev) => (sorted.some((e) => String(e.id) === String(prev)) ? prev : ''));
      })
      .catch((e) => {
        if (!cancelled) toast.error(String(e || 'Failed to load exams'));
      })
      .finally(() => {
        if (!cancelled) setExamsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dispatch, isExamReport, hasLoaded, examClassId, sectionId]);

  const examOptions = useMemo(
    () =>
      exams.map((e) => {
        const date = formatExamOptionDate(e.exam_date);
        const type = e.exam_type_name ? ` (${e.exam_type_name})` : '';
        return { value: String(e.id), label: `${e.test_name || 'Exam'}${type}${date ? ` - ${date}` : ''}` };
      }),
    [exams]
  );

  const loadStudents = async () => {
    if (!canLoad) {
      toast.error('Please select a class, or enter a roll number');
      return;
    }
    try {
      const params = {};
      if (rollNumber.trim()) params.search = rollNumber.trim();
      if (classId !== 'all') params.classId = classId;
      if (sectionId !== 'all') params.sectionId = sectionId;
      await dispatch(fetchLecturerStudentsThunk(params)).unwrap();
      setPage(1);
      setHasLoaded(true);
      setSelectedIds(new Set());
    } catch (e) {
      toast.error(String(e || 'Failed to load students'));
    }
  };

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return students ?? [];
    return (students ?? []).filter((s) => {
      const hay = `${String(s.roll_number ?? '')} ${[s.first_name, s.last_name].filter(Boolean).join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [students, searchQuery]);

  const { totalCount, totalPages, currentPage, pageRows: paged } = usePagedRows(filtered, page, pageSize);

  const selectedCount = selectedIds.size;
  const pageIds = useMemo(() => paged.map((s) => String(s.id)), [paged]);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));

  const toggleStudent = (studentId, checked) => {
    const id = String(studentId);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        if (next.has(id)) return prev;
        if (next.size >= BULK_STUDENT_REPORT_MAX) {
          toast.error(`You can select at most ${BULK_STUDENT_REPORT_MAX} students.`);
          return prev;
        }
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const togglePageSelection = (checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (!checked) {
        for (const id of pageIds) next.delete(id);
        return next;
      }
      const missing = pageIds.filter((id) => !next.has(id));
      const room = BULK_STUDENT_REPORT_MAX - next.size;
      if (room <= 0) {
        toast.error(`You can select at most ${BULK_STUDENT_REPORT_MAX} students.`);
        return prev;
      }
      if (missing.length > room) {
        toast.error(`Selected first ${room} on this page (max ${BULK_STUDENT_REPORT_MAX} students total).`);
      }
      for (const id of missing.slice(0, room)) next.add(id);
      return next;
    });
  };

  const examFilePrefix = `ExamReport_${String(selectedExam?.test_name ?? 'Exam').replace(/[^\w-]+/g, '_')}`;

  const requestDownload = (target) => {
    if (!isExamReport) {
      setOptionsFor(target);
      return;
    }
    if (!examId) {
      toast.error('Select an exam first.');
      return;
    }
    if (target.mode === 'bulk') handleBulkDownload(EXAM_REPORT_OPTIONS);
    else handleDownloadOne(target.student, EXAM_REPORT_OPTIONS);
  };

  const handleDownloadOne = async (student, { partB, totalMarks }) => {
    const studentId = student?.id;
    if (!studentId || downloadingId || bulkBusy) return;
    setDownloadingId(String(studentId));
    try {
      const data = await dispatch(fetchStudentProgressReportThunk({ studentId })).unwrap();
      const allSections = Array.isArray(data?.sections) ? data.sections : [];
      const sections = isExamReport ? sectionsForExam(allSections, examId) : allSections;
      if (!sections.length) {
        toast.error(
          isExamReport
            ? 'No results found for this student in the selected exam.'
            : 'No completed exam results found for this student.'
        );
        return;
      }
      let studentForPdf = {
        ...student,
        date_of_birth: student.date_of_birth ?? data?.dateOfBirth ?? null,
        mother_name: student.mother_name ?? data?.motherName ?? null,
      };
      if (!studentForPdf.father_name || !studentForPdf.date_of_birth) {
        try {
          const full = await dispatch(fetchStudentByIdThunk(studentId)).unwrap();
          if (full) studentForPdf = { ...studentForPdf, ...full };
        } catch {
          /* keep list row */
        }
      }
      const studentPhotoDataUrl =
        studentForPdf?.photo_path || student?.photo_path
          ? await prepareReportPhoto(await fetchStudentPhotoDataUrl(studentId))
          : null;
      await exportStudentProgressPdf({
        student: studentForPdf,
        className: classNameFor(student.class_id),
        sectionLabel: student.section_id ? sectionCodeFor(student.section_id) : '',
        sections,
        studentPhotoDataUrl,
        partB,
        totalMarks,
        filePrefix: isExamReport ? examFilePrefix : undefined,
      });
      toast.success(isExamReport ? 'Exam report downloaded.' : 'Progress report downloaded.');
      setOptionsFor(null);
    } catch (err) {
      toast.error(String(err ?? 'Failed to export progress report'));
    } finally {
      setDownloadingId(null);
    }
  };

  const handleBulkDownload = async ({ partB, totalMarks }) => {
    const ids = [...selectedIds];
    if (!ids.length) {
      toast.error('Select at least one student.');
      return;
    }
    if (ids.length > BULK_STUDENT_REPORT_MAX) {
      toast.error(`You can select at most ${BULK_STUDENT_REPORT_MAX} students.`);
      return;
    }

    setBulkBusy(true);
    setBulkProgressLabel('Fetching report data…');
    try {
      const reports = await dispatch(fetchBulkStudentProgressReportsThunk({ studentIds: ids })).unwrap();
      const classLabel =
        classId !== 'all' ? classNameFor(classId) : classNameFor(students?.[0]?.class_id);
      const sectionLabel =
        sectionId !== 'all'
          ? sectionCodeFor(sectionId)
          : students?.[0]?.section_id
            ? sectionCodeFor(students[0].section_id)
            : 'all';

      const { downloaded, skippedNoExams, skippedFailed } = await downloadBulkStudentReportZip({
        students,
        reports,
        classNameFor,
        sectionLabelFor: sectionCodeFor,
        partB,
        totalMarks,
        examId: isExamReport ? examId : null,
        filePrefix: isExamReport ? examFilePrefix : undefined,
        zipLabel: isExamReport
          ? `${examFilePrefix}s_${classLabel}_${sectionLabel}`
          : `ProgressReports_${classLabel}_${sectionLabel}`,
        onProgress: (done, total) => setBulkProgressLabel(`Generating ${done}/${total}…`),
      });

      if (!downloaded) {
        toast.error('No reports generated. Selected students may have no completed exams.');
        return;
      }

      const notes = [];
      if (skippedNoExams > 0) notes.push(`${skippedNoExams} no exams`);
      if (skippedFailed > 0) notes.push(`${skippedFailed} failed`);
      toast.success(
        notes.length
          ? `Downloaded ${downloaded}. ${notes.join('; ')}.`
          : `Downloaded ${downloaded} report${downloaded === 1 ? '' : 's'}.`
      );
      setSelectedIds(new Set());
      setOptionsFor(null);
    } catch (err) {
      toast.error(String(err ?? 'Failed to download bulk reports'));
    } finally {
      setBulkBusy(false);
      setBulkProgressLabel('');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Student Report"
        description="Bulk download limit: 80 students"
      />

      <Card className="border-gray-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Filters</CardTitle>        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <FormSelect
              id="stu-report-type"
              label="Report type"
              value={reportType}
              onValueChange={(v) => {
                setReportType(v);
                setExamId('');
              }}
              options={REPORT_TYPE_OPTIONS}
            />
            <FormSelect
              id="stu-report-class"
              label="Class"
              value={classId}
              onValueChange={setClassId}
              options={[{ value: 'all', label: 'Select class…' }, ...classOptions]}
              placeholder="Class"
            />
            <FormSelect
              id="stu-report-section"
              label="Section"
              value={sectionId}
              onValueChange={setSectionId}
              options={[{ value: 'all', label: 'All sections' }, ...sectionOptions]}
              placeholder={classId && classId !== 'all' ? 'Section' : 'Select class first'}
            />
            <div className="space-y-2">
              <label htmlFor="stu-report-roll" className="text-sm font-medium text-gray-700">
                Roll Number
              </label>
              <Input
                id="stu-report-roll"
                placeholder="Search by roll number"
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canLoad) loadStudents();
                }}
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                className="w-full min-h-10 touch-manipulation"
                onClick={loadStudents}
                disabled={!canLoad || studentsStatus === 'loading'}
              >
                {studentsStatus === 'loading' ? 'Loading…' : 'Load students'}
              </Button>
            </div>
          </div>

          {studentsError ? <div className="text-sm text-red-600">{String(studentsError)}</div> : null}
        </CardContent>
      </Card>

      {showStudentsCard ? (
        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <CardTitle className="text-lg">Students</CardTitle>
                <CardDescription>
                  {isExamReport ? 'Download an exam report' : 'Download a progress report'}
                  {selectedCount > 0 ? ` · ${selectedCount} selected (max ${BULK_STUDENT_REPORT_MAX})` : ''}.
                </CardDescription>
              </div>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto min-h-11 touch-manipulation shrink-0"
                  disabled={
                    selectedCount < 1 || Boolean(downloadingId) || bulkBusy || (isExamReport && !examId)
                  }
                  onClick={() => requestDownload({ mode: 'bulk' })}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {bulkBusy ? bulkProgressLabel || 'Preparing…' : `Download bulk report${selectedCount > 0 ? ` (${selectedCount})` : ''}`}
                </Button>
                <div className="w-full sm:w-70">
                  <label className="text-sm font-medium text-gray-700">Search</label>
                  <SearchInput
                    className="mt-2"
                    inputClassName="min-h-11"
                    placeholder="Name or roll number"
                    value={searchQuery}
                    onValueChange={(v) => {
                      setSearchQuery(v);
                      setPage(1);
                    }}
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isExamReport ? (
              <div className="mb-4 max-w-md">
                <FormSelect
                  id="stu-report-exam"
                  label="Exam"
                  value={examId}
                  onValueChange={setExamId}
                  disabled={examsLoading || !examOptions.length}
                  placeholder={
                    examsLoading
                      ? 'Loading exams…'
                      : examOptions.length
                        ? 'Select exam'
                        : 'No completed exams for this class'
                  }
                  options={examOptions}
                />
              </div>
            ) : null}
            {studentsStatus === 'loading' ? (
              <div className="flex justify-center py-10">
                <Spinner className="h-8 w-8" />
              </div>
            ) : !filtered.length ? (
              <div className="text-sm text-gray-600 py-6">No students found for these filters.</div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-md border border-gray-200">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={allPageSelected}
                            onCheckedChange={(v) => togglePageSelection(Boolean(v))}
                            aria-label="Select page"
                          />
                        </TableHead>
                        <TableHead>Roll</TableHead>
                        <TableHead>Student</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead>Section</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paged.map((s) => {
                        const id = String(s.id);
                        const name = [s.first_name, s.last_name].filter(Boolean).join(' ') || '—';
                        const busy = downloadingId === id;
                        return (
                          <TableRow key={id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedIds.has(id)}
                                onCheckedChange={(v) => toggleStudent(id, Boolean(v))}
                                aria-label={`Select ${name}`}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{s.roll_number || '—'}</TableCell>
                            <TableCell>{name}</TableCell>
                            <TableCell>{classNameFor(s.class_id)}</TableCell>
                            <TableCell>{s.section_id ? sectionCodeFor(s.section_id) : '—'}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="min-h-9 touch-manipulation"
                                disabled={Boolean(downloadingId) || bulkBusy || (isExamReport && !examId)}
                                onClick={() => requestDownload({ mode: 'single', student: s })}
                              >
                                <Download className="h-4 w-4 mr-1.5" />
                                {busy ? '…' : 'Download'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <TablePagination
                  page={currentPage}
                  pageSize={pageSize}
                  totalCount={totalCount}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  onPageSizeChange={(n) => {
                    setPageSize(n);
                    setPage(1);
                  }}
                  pageSizeOptions={[10, 25, 50, 80]}
                />
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      <ReportOptionsDialog
        open={Boolean(optionsFor)}
        title={
          optionsFor?.mode === 'bulk'
            ? `Download ${selectedCount} progress report${selectedCount === 1 ? '' : 's'}`
            : 'Download progress report'
        }
        confirming={optionsFor?.mode === 'bulk' ? bulkBusy : Boolean(downloadingId)}
        progressLabel={optionsFor?.mode === 'bulk' ? bulkProgressLabel : ''}
        onOpenChange={(open) => {
          if (!open && !bulkBusy && !downloadingId) setOptionsFor(null);
        }}
        onConfirm={(options) => {
          if (optionsFor?.mode === 'bulk') handleBulkDownload(options);
          else if (optionsFor?.student) handleDownloadOne(optionsFor.student, options);
        }}
      />
    </div>
  );
}
