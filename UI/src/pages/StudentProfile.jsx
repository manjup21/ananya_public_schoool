import { createElement, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { TableSkeletonRows } from '../components/common/TableSkeletonRows';
import { FormSelect } from '../components/common/FormSelect';
import { TablePagination } from '../components/common/TablePagination';
import { TableEmptyRow } from '../components/common/TableEmptyRow';
import {
  ArrowLeft,
  Download,
  User,
  Phone,
  Mail,
  MapPin,
  PhoneCall,
  TrendingUp,
  Award,
  CalendarDays,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';

import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { DatePickerInput } from '../components/common/DatePickerInput';
import { formatDateOnlyLocal, lastDaysRange, parseApiDateOnly } from '../utils/dateOnly';
import { useClasses } from '../features/classes/useClasses';
import { fetchExamTypesThunk } from '../features/examTypes/examTypesSlice';
import { fetchSubjectsThunk } from '../features/subjects/subjectsSlice';
import {
  clearLecturerStudentProfile,
  fetchLecturerStudentAbsencesThunk,
  fetchLecturerStudentAttendanceSummaryThunk,
  fetchLecturerStudentByIdThunk,
  fetchLecturerStudentExamSummaryThunk,
  fetchStudentProgressReportThunk,
} from '../features/lecturerStudents/lecturerStudentsSlice';
import { DEFAULT_PROGRESS_REPORT_FILTERS, exportStudentProgressPdf } from '../utils/studentProgressReport';
import { formatStudentGender, formatStudentResidenceType } from '../utils/studentDisplay';
import { fetchStudentPhotoObjectUrl } from '../features/students/studentsSlice';

function fmtDate(yyyyMmDd) {
  if (!yyyyMmDd) return '—';
  const d = new Date(`${String(yyyyMmDd).trim()}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(yyyyMmDd);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function studentName(s) {
  return [s?.first_name, s?.last_name].filter(Boolean).join(' ').trim() || '—';
}

function todayDateOnly() {
  return formatDateOnlyLocal(new Date());
}

function StudentExamPerformanceSection({ studentId, student, classLabel, sectionLabel }) {
  const dispatch = useDispatch();
  const examSummary = useSelector((s) => s.lecturerStudents.examSummary);
  const examSummaryTotal = useSelector((s) => s.lecturerStudents.examSummaryTotal);
  const examChartSeries = useSelector((s) => s.lecturerStudents.examChartSeries);
  const examChartLimit = useSelector((s) => s.lecturerStudents.examChartLimit);
  const examSummaryStatus = useSelector((s) => s.lecturerStudents.examSummaryStatus);
  const examSummaryError = useSelector((s) => s.lecturerStudents.examSummaryError);

  const examTypes = useSelector((s) => s.examTypes.items);
  const examTypesStatus = useSelector((s) => s.examTypes.status);
  const subjects = useSelector((s) => s.subjects.items);
  const subjectsStatus = useSelector((s) => s.subjects.status);
  const [examSubjectId, setExamSubjectId] = useState('all');

  const [examFrom, setExamFrom] = useState(DEFAULT_PROGRESS_REPORT_FILTERS.from);
  const [examTo, setExamTo] = useState(DEFAULT_PROGRESS_REPORT_FILTERS.to);
  const [examFilterTypeId, setExamFilterTypeId] = useState(DEFAULT_PROGRESS_REPORT_FILTERS.examTypeId);
  const [examPage, setExamPage] = useState(1);
  const [examPageSize, setExamPageSize] = useState(10);
  const [exportingPdf, setExportingPdf] = useState(false);

  const examFromObj = parseApiDateOnly(examFrom);
  const examToObj = parseApiDateOnly(examTo);
  const maxSelectableDate = parseApiDateOnly(todayDateOnly()) ?? new Date();

  const examDateRangeError = useMemo(() => {
    if (examFrom && examTo && examFrom > examTo) return 'To date cannot be earlier than from date.';
    if (examTo && examTo > todayDateOnly()) return 'To date cannot be later than today.';
    return null;
  }, [examFrom, examTo]);

  useEffect(() => {
    if (examTypesStatus === 'idle') dispatch(fetchExamTypesThunk({ search: '' }));
  }, [examTypesStatus, dispatch]);

  useEffect(() => {
    if (subjectsStatus === 'idle') dispatch(fetchSubjectsThunk({ search: '' }));
  }, [subjectsStatus, dispatch]);

  const examTotalPages = Math.max(1, Math.ceil(examSummaryTotal / examPageSize));
  const examPageClamped = Math.min(Math.max(1, examPage), examTotalPages);

  useEffect(() => {
    if (!studentId) return;
    dispatch(
      fetchLecturerStudentExamSummaryThunk({
        studentId,
        limit: examPageSize,
        offset: (examPageClamped - 1) * examPageSize,
        from: examFrom || undefined,
        to: examTo || undefined,
        examTypeId: examFilterTypeId,
        subjectId: examSubjectId,
      })
    );
  }, [studentId, dispatch, examFrom, examTo, examFilterTypeId, examSubjectId, examPageClamped, examPageSize]);

  const examSeries = useMemo(() => {
    const rows = Array.isArray(examChartSeries) ? examChartSeries : [];
    return rows.filter((r) => r.total_marks != null).map((r) => {
      const total = Number(r.total_marks ?? 0);
      const max = Number(r.max_marks ?? 0);
      const pct = max > 0 ? (total / max) * 100 : 0;
      return {
        date: String(r.exam_date ?? '').slice(5),
        fullDate: r.exam_date,
        test: r.test_name ?? 'Exam',
        pct: Number.isFinite(pct) ? Number(pct.toFixed(1)) : 0,
      };
    });
  }, [examChartSeries]);

  const examTypeFilterOptions = useMemo(
    () => [{ value: 'all', label: 'All types' }, ...(examTypes ?? []).map((t) => ({ value: t.id, label: t.name }))],
    [examTypes]
  );

  const subjectFilterOptions = useMemo(
    () => [{ value: 'all', label: 'All subjects' }, ...(subjects ?? []).map((s) => ({ value: s.id, label: s.name }))],
    [subjects]
  );

  const onExamFilterFromChange = (v) => {
    setExamFrom(v);
    setExamPage(1);
  };
  const onExamFilterToChange = (v) => {
    setExamTo(v);
    setExamPage(1);
  };
  const onExamFilterTypeChange = (v) => {
    setExamFilterTypeId(v);
    setExamPage(1);
  };

  const canExportPdf = Boolean(student && !examDateRangeError);

  const handleExportProgressPdf = async () => {
    if (!canExportPdf || !studentId) return;
    setExportingPdf(true);
    try {
      const data = await dispatch(
        fetchStudentProgressReportThunk({
          studentId,
          from: examFrom,
          to: examTo,
          examTypeId: examFilterTypeId,
        })
      ).unwrap();
      const sections = Array.isArray(data?.sections) ? data.sections : [];
      if (!sections.length) {
        toast.error('No completed exam results found for the selected filters.');
        return;
      }
      await exportStudentProgressPdf({
        student,
        className: classLabel,
        sectionLabel,
        fromDate: examFrom,
        toDate: examTo,
        sections,
      });
      toast.success('Progress report downloaded.');
    } catch (err) {
      toast.error(String(err ?? 'Failed to export progress report'));
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle>Exam performance</CardTitle>
          <CardDescription>
            Completed exams only.
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 shrink-0"
          disabled={!canExportPdf || exportingPdf}
          onClick={handleExportProgressPdf}
        >
          <Download className="h-4 w-4" />
          {exportingPdf ? 'Exporting…' : 'Download PDF'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700" htmlFor={`student-exam-from-${studentId}`}>
              From
            </label>
            <DatePicker
              selected={examFromObj}
              onChange={(d) => {
                const next = d ? formatDateOnlyLocal(d) : '';
                onExamFilterFromChange(next);
                if (next && examTo && next > examTo) setExamTo('');
              }}
              dateFormat="dd-MM-yyyy"
              maxDate={examToObj && examToObj < maxSelectableDate ? examToObj : maxSelectableDate}
              preventOpenOnFocus
              shouldCloseOnSelect
              customInput={
                <DatePickerInput
                  id={`student-exam-from-${studentId}`}
                  placeholder="dd-mm-yyyy"
                  className="w-full"
                />
              }
              wrapperClassName="w-full"
              popperPlacement="bottom-start"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700" htmlFor={`student-exam-to-${studentId}`}>
              To
            </label>
            <DatePicker
              selected={examToObj}
              onChange={(d) => onExamFilterToChange(d ? formatDateOnlyLocal(d) : '')}
              dateFormat="dd-MM-yyyy"
              minDate={examFromObj ?? undefined}
              maxDate={maxSelectableDate}
              preventOpenOnFocus
              shouldCloseOnSelect
              customInput={
                <DatePickerInput
                  id={`student-exam-to-${studentId}`}
                  placeholder="dd-mm-yyyy"
                  className="w-full"
                />
              }
              wrapperClassName="w-full"
              popperPlacement="bottom-start"
            />
            {examDateRangeError ? <p className="text-xs text-red-600">{examDateRangeError}</p> : null}
          </div>
          <FormSelect
            id={`student-exam-type-filter-${studentId}`}
            label="Exam type"
            value={examFilterTypeId}
            onValueChange={onExamFilterTypeChange}
            placeholder="All types"
            options={examTypeFilterOptions}
          />
          <FormSelect
            id={`student-exam-subject-filter-${studentId}`}
            label="Subject"
            value={examSubjectId}
            onValueChange={(v) => {
              setExamSubjectId(v);
              setExamPage(1);
            }}
            placeholder="All subjects"
            options={subjectFilterOptions}
          />
        </div>

        <div className="rounded-lg border border-gray-200 p-3 -mx-1 sm:mx-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
              <CalendarDays className="h-4 w-4 text-gray-500" />
              Score trend
            </div>
            <span className="text-xs text-gray-500" title={`Up to ${examChartLimit} most recent exams in range`}>
              {examSeries.length} {examSeries.length === 1 ? 'exam' : 'exams'}
            </span>
          </div>
          {examSeries.length ? (
            <div className="h-44 sm:h-56 md:h-64 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={examSeries} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="staffScoreFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} minTickGap={16} />
                  <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} width={36} />
                  <Tooltip
                    formatter={(v) => [`${v}%`, 'Score']}
                    labelFormatter={(label, payload) => payload?.[0]?.payload?.test ?? label}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="pct"
                    stroke="#2563eb"
                    strokeWidth={2}
                    fill="url(#staffScoreFill)"
                    dot={{ r: 3, fill: '#2563eb', strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: '#2563eb', stroke: '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-gray-500">No scores to plot</p>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Exam</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Max</TableHead>
                <TableHead className="text-right">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {examSummaryStatus === 'loading' ? (
                <TableSkeletonRows columns={6} rows={4} />
              ) : examSummaryStatus === 'failed' ? (
                <TableEmptyRow colSpan={6}>{String(examSummaryError || 'Failed to load exams')}</TableEmptyRow>
              ) : examSummaryTotal === 0 ? (
                <TableEmptyRow colSpan={6}>No completed exam results found</TableEmptyRow>
              ) : (
                (examSummary ?? []).map((r) => {
                  const hasMark = r.total_marks != null;
                  const total = Number(r.total_marks ?? 0);
                  const max = Number(r.max_marks ?? 0);
                  const pct = max > 0 ? (total / max) * 100 : 0;
                  return (
                    <TableRow key={String(r.result_id)}>
                      <TableCell>{fmtDate(r.exam_date)}</TableCell>
                      <TableCell className="text-gray-700">{r.exam_type ?? '—'}</TableCell>
                      <TableCell className="font-medium text-gray-900">{r.test_name ?? '—'}</TableCell>
                      <TableCell className="text-right">{hasMark ? total : r.is_absent ? 'Ab' : '—'}</TableCell>
                      <TableCell className="text-right">{Number.isFinite(max) ? max : '—'}</TableCell>
                      <TableCell className="text-right">
                        {hasMark ? (
                          <Badge
                            variant="secondary"
                            className={
                              pct >= 60 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-800'
                            }
                          >
                            {pct.toFixed(1)}%
                          </Badge>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {examSummaryTotal > 0 ? (
          <TablePagination
            page={examPageClamped}
            pageSize={examPageSize}
            totalCount={examSummaryTotal}
            totalPages={examTotalPages}
            onPageChange={setExamPage}
            onPageSizeChange={(n) => {
              setExamPageSize(n);
              setExamPage(1);
            }}
            selectId={`student-exam-page-size-${studentId}`}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function AttendanceAbsencesSection({ absences, absencesStatus }) {
  const [absPage, setAbsPage] = useState(1);
  const [absPageSize, setAbsPageSize] = useState(10);

  const sortedAbsences = useMemo(() => {
    if (!absences?.length) return [];
    return [...absences].sort((a, b) => {
      const ad = String(b.absent_date ?? '').localeCompare(String(a.absent_date ?? ''));
      if (ad !== 0) return ad;
      return Number(b.slot_index ?? 0) - Number(a.slot_index ?? 0);
    });
  }, [absences]);

  const absTotalCount = sortedAbsences.length;
  const absTotalPages = Math.max(1, Math.ceil(absTotalCount / absPageSize));
  const absCurrentPage = Math.min(absPage, absTotalPages);
  const pagedAbsences = useMemo(
    () => sortedAbsences.slice((absCurrentPage - 1) * absPageSize, absCurrentPage * absPageSize),
    [sortedAbsences, absCurrentPage, absPageSize]
  );

  useEffect(() => {
    setAbsPage(1);
  }, [absPageSize]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attendance</CardTitle>
        <CardDescription>Last 30 days</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Date</TableHead>
                <TableHead>Slot</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {absencesStatus === 'loading' ? (
                <TableSkeletonRows columns={2} rows={4} />
              ) : !absences?.length ? (
                <TableEmptyRow colSpan={2}>No absences recorded</TableEmptyRow>
              ) : (
                pagedAbsences.map((record) => (
                  <TableRow key={String(record.id)}>
                    <TableCell>{fmtDate(record.absent_date)}</TableCell>
                    <TableCell>{record.slot_name || `Slot ${record.slot_index ?? '\u2014'}`}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {absTotalCount > 0 && (
          <TablePagination
            selectId="absences-page-size"
            page={absCurrentPage}
            pageSize={absPageSize}
            totalCount={absTotalCount}
            totalPages={absTotalPages}
            onPageChange={setAbsPage}
            onPageSizeChange={setAbsPageSize}
          />
        )}
      </CardContent>
    </Card>
  );
}

export function StudentProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { classes } = useClasses();

  const student = useSelector((s) => s.lecturerStudents.student);
  const studentStatus = useSelector((s) => s.lecturerStudents.studentStatus);
  const studentError = useSelector((s) => s.lecturerStudents.studentError);

  const attendanceSummary = useSelector((s) => s.lecturerStudents.attendanceSummary);
  const attendanceSummaryStatus = useSelector((s) => s.lecturerStudents.attendanceSummaryStatus);
  const absences = useSelector((s) => s.lecturerStudents.absences);
  const absencesStatus = useSelector((s) => s.lecturerStudents.absencesStatus);

  const examSummaryTotal = useSelector((s) => s.lecturerStudents.examSummaryTotal);
  const examChartSeries = useSelector((s) => s.lecturerStudents.examChartSeries);
  const examSummaryAvgPct = useSelector((s) => s.lecturerStudents.examSummaryAvgPct);
  const examSummaryStatus = useSelector((s) => s.lecturerStudents.examSummaryStatus);

  useEffect(() => {
    dispatch(clearLecturerStudentProfile());
    if (!id) return;
    dispatch(fetchLecturerStudentByIdThunk(id));
  }, [id, dispatch]);

  useEffect(() => {
    if (!id) return;
    const { from: fromStr, to: toStr } = lastDaysRange(30);
    dispatch(fetchLecturerStudentAttendanceSummaryThunk({ studentId: id, from: fromStr, to: toStr }));
    dispatch(fetchLecturerStudentAbsencesThunk({ studentId: id, from: fromStr, to: toStr }));
  }, [id, dispatch]);

  const [photoUrl, setPhotoUrl] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  useEffect(() => {
    if (!student?.id || !student?.photo_path) return undefined;
    let cancelled = false;
    let objectUrl = '';
    fetchStudentPhotoObjectUrl(student.id, '/lecturer/students')
      .then((url) => {
        objectUrl = url;
        if (cancelled) URL.revokeObjectURL(url);
        else setPhotoUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setPhotoUrl('');
    };
  }, [student?.id, student?.photo_path]);

  const classLabel = useMemo(() => {
    const cls = (classes ?? []).find((c) => String(c.id) === String(student?.class_id));
    return String(cls?.name ?? '').trim() || '—';
  }, [classes, student?.class_id]);

  const sectionLabel = useMemo(() => {
    const cls = (classes ?? []).find((c) => String(c.id) === String(student?.class_id));
    const sec = cls?.sections?.find((s) => String(s.id) === String(student?.section_id));
    return String(sec?.section ?? '').trim() || '—';
  }, [classes, student?.class_id, student?.section_id]);

  const attendancePct = useMemo(() => {
    const expected = Number(attendanceSummary?.expected_sessions ?? attendanceSummary?.expected_days ?? 0);
    const absent = Number(attendanceSummary?.absent_sessions ?? attendanceSummary?.absent_days ?? 0);
    if (!Number.isFinite(expected) || expected <= 0) return 0;
    const present = Math.max(0, expected - absent);
    return Math.max(0, Math.min(100, (present / expected) * 100));
  }, [attendanceSummary]);

  const examSeries = useMemo(() => {
    const rows = Array.isArray(examChartSeries) ? examChartSeries : [];
    return rows.filter((r) => r.total_marks != null).map((r) => {
      const total = Number(r.total_marks ?? 0);
      const max = Number(r.max_marks ?? 0);
      const pct = max > 0 ? (total / max) * 100 : 0;
      return {
        date: String(r.exam_date ?? '').slice(5),
        fullDate: r.exam_date,
        test: r.test_name ?? 'Exam',
        pct: Number.isFinite(pct) ? Number(pct.toFixed(1)) : 0,
      };
    });
  }, [examChartSeries]);

  const avgExamPctDisplay = useMemo(() => {
    if (examSummaryAvgPct != null && Number.isFinite(Number(examSummaryAvgPct))) {
      return Number(examSummaryAvgPct);
    }
    if (!examSeries.length) return 0;
    const sum = examSeries.reduce((a, x) => a + (Number(x.pct) || 0), 0);
    return sum / examSeries.length;
  }, [examSummaryAvgPct, examSeries]);

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      {studentStatus === 'failed' ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {String(studentError || 'Failed to load student')}
        </div>
      ) : null}

      {studentStatus === 'loading' ? (
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-6">
                <Skeleton className="h-32 w-32 rounded-full mx-auto md:mx-0 shrink-0" />
                <div className="flex-1 space-y-4">
                  <div>
                    <Skeleton className="h-8 w-48 mb-2" />
                    <Skeleton className="h-4 w-32 mb-3" />
                    <div className="flex gap-2">
                      <Skeleton className="h-5 w-16 rounded-md" />
                      <Skeleton className="h-5 w-20 rounded-md" />
                      <Skeleton className="h-5 w-14 rounded-md" />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {Array.from({ length: 4 }, (_, i) => (
                      <div key={i} className="space-y-1">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="grid grid-cols-3 gap-2 sm:gap-6">
            {Array.from({ length: 3 }, (_, i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1 sm:p-6 sm:pb-2">
                  <Skeleton className="h-4 w-14 sm:w-20" />
                  <Skeleton className="hidden sm:block h-5 w-5 rounded" />
                </CardHeader>
                <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                  <Skeleton className="h-7 sm:h-8 w-14 sm:w-24 mb-1" />
                  <Skeleton className="hidden sm:block h-3 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {student ? (
        <div className="space-y-6">
      <Card>
        <CardContent className="p-4 sm:p-6 space-y-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
          <div className="flex items-center gap-4 lg:shrink-0">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={studentName(student)}
                  className="h-16 w-16 sm:h-20 sm:w-20 shrink-0 rounded-full object-cover object-top ring-1 ring-gray-200"
                />
              ) : (
                <div className="h-16 w-16 sm:h-20 sm:w-20 shrink-0 rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-lg sm:text-3xl font-bold">
                  {(studentName(student) || 'S').charAt(0)}
                </div>
              )}
              <div className="min-w-0 space-y-2">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 wrap-break-word">{studentName(student)}</h2>
                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                  <span className="font-medium text-gray-700">{student.roll_number ?? '—'}</span>
                  <Badge variant="secondary">{classLabel}</Badge>
                  <Badge variant="secondary">Section {sectionLabel}</Badge>                </div>
              </div>
            </div>
            <button
              type="button"
              className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 lg:hidden"
              aria-expanded={showDetails}
              onClick={() => setShowDetails((v) => !v)}
            >
              Personal & parent details
              <ChevronDown className={`h-4 w-4 transition-transform ${showDetails ? 'rotate-180' : ''}`} aria-hidden />
            </button>
            <dl
              className={`${showDetails ? 'grid' : 'hidden'} grid-cols-2 gap-3 sm:grid-cols-3 lg:grid lg:flex-1 lg:grid-cols-5 lg:border-l lg:border-gray-100 lg:pl-5`}
            >
              {[
                ['Gender', formatStudentGender(student.gender)],
                ['Date of birth', fmtDate(student.date_of_birth)],
                ['Blood group', student.blood_group ?? '—'],
                ['Residence', formatStudentResidenceType(student.residence_type)],
                ['Specialisation', student.specialisation ?? '—'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-gray-50 px-3 py-2">
                  <dt className="text-xs text-gray-500">{label}</dt>
                  <dd className="text-sm font-medium text-gray-900 wrap-break-word">{value}</dd>
                </div>
              ))}
            </dl>
            </div>
          <div className={`${showDetails ? 'block' : 'hidden'} lg:block border-t border-gray-100 pt-5`}>
            <h3 className="mb-3 text-sm font-semibold text-gray-900">Parents & Address</h3>
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { label: 'Father', icon: User, value: student.father_name },
                { label: 'Mother', icon: User, value: student.mother_name },
                { label: 'Guardian phone', icon: Phone, value: student.guardian_phone, href: 'tel:' },
                { label: 'Emergency contact', icon: PhoneCall, value: student.emergency_contact_number, href: 'tel:' },
                { label: 'Guardian email', icon: Mail, value: student.guardian_email, href: 'mailto:', span: 'lg:col-span-2' },
                {
                  label: 'Address',
                  icon: MapPin,
                  span: 'sm:col-span-2 lg:col-span-3',
                  value: [
                    student.address_location,
                    student.address_city,
                    student.address_district,
                    student.address_state,
                    student.address_pin,
                  ]
                    .filter((x) => x != null && String(x).trim() !== '')
                    .join(', '),
                },
              ].map(({ label, icon, value, href, span = '' }) => (
                <div key={label} className={`flex items-start gap-3 rounded-lg bg-gray-50 px-3 py-2.5 ${span}`}>
                  {createElement(icon, { className: 'h-4 w-4 mt-0.5 shrink-0 text-gray-400', 'aria-hidden': true })}
                  <div className="min-w-0">
                    <dt className="text-xs text-gray-500">{label}</dt>
                    <dd className="text-sm font-medium text-gray-900 wrap-break-word">
                      {value && href ? (
                        <a href={`${href}${value}`} className="text-blue-700 hover:underline">
                          {value}
                        </a>
                      ) : (
                        value || '—'
                      )}
                    </dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-2 sm:gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-gray-600">
              Attendance
            </CardTitle>
            <TrendingUp className="hidden sm:block h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            {attendanceSummaryStatus === 'loading' ? (
              <>
                <Skeleton className="h-7 sm:h-8 w-14 sm:w-24 mb-1" />
                <Skeleton className="hidden sm:block h-3 w-32" />
              </>
            ) : (
              <>
                <div className="text-lg sm:text-3xl font-bold text-gray-900">{`${attendancePct.toFixed(1)}%`}</div>
                <p className="hidden sm:block text-xs text-gray-600 mt-1">Overall attendance rate</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-gray-600">
              Exams
            </CardTitle>
            <Award className="hidden sm:block h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            {examSummaryStatus === 'loading' ? (
              <>
                <Skeleton className="h-7 sm:h-8 w-14 sm:w-24 mb-1" />
                <Skeleton className="hidden sm:block h-3 w-32" />
              </>
            ) : (
              <>
                <div className="text-lg sm:text-3xl font-bold text-gray-900">{examSummaryTotal}</div>
                <p className="hidden sm:block text-xs text-gray-600 mt-1">Matching current exam filters</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-gray-600">
              Average Score
            </CardTitle>
            <TrendingUp className="hidden sm:block h-5 w-5 text-purple-600" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            {examSummaryStatus === 'loading' ? (
              <>
                <Skeleton className="h-7 sm:h-8 w-14 sm:w-24 mb-1" />
                <Skeleton className="hidden sm:block h-3 w-32" />
              </>
            ) : (
              <>
                <div className="text-lg sm:text-3xl font-bold text-gray-900">{`${avgExamPctDisplay.toFixed(1)}%`}</div>
                <p className="hidden sm:block text-xs text-gray-600 mt-1">Across filtered results</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <StudentExamPerformanceSection
        key={id}
        studentId={id}
        student={student}
        classLabel={classLabel}
        sectionLabel={sectionLabel}
      />

      <AttendanceAbsencesSection
        absences={absences}
        absencesStatus={absencesStatus}
      />
      </div>
      ) : null}
    </div>
  );
}
