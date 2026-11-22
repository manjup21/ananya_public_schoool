import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { Plus } from 'lucide-react';
import { SearchInput } from '../components/common/SearchInput';
import { toast } from 'sonner';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { DatePickerInput } from '../components/common/DatePickerInput';
import { FormSelect } from '../components/common/FormSelect';
import { TablePagination } from '../components/common/TablePagination';
import { usePagedRows } from '../hooks/usePagedRows';
import { MultiSelect } from '../components/common/MultiSelect';
import { DeleteConfirmDialog } from '../components/common/DeleteConfirmDialog';
import { PageHeader } from '../components/common/PageHeader';
import { Checkbox } from '../components/ui/checkbox';
import { ExaminationsTable } from './examinationManagement/ExaminationsTable';
import { ExaminationViewDialog } from './examinationManagement/ExaminationViewDialog';
import {
  classNameById as classNameByIdHelper,
  normalizeSectionIds,
  sectionLabelForExam as sectionLabelForExamHelper,
  toTime24,
} from './examinationManagement/examinationHelpers';
import { toIsoDate } from '../utils/dateOnly';
import { useClasses } from '../features/classes/useClasses';
import { fetchSubjectsThunk } from '../features/subjects/subjectsSlice';
import { fetchExamTypesThunk } from '../features/examTypes/examTypesSlice';
import {
  cancelExaminationThunk,
  createExaminationThunk,
  fetchExaminationsThunk,
  fetchHallTicketRosterThunk,
  updateExaminationThunk,
} from '../features/examinations/examinationsSlice';
import { downloadHallTicketsPdf, BULK_HALL_TICKET_MAX } from '../utils/hallTicketPdf';
import { deriveYearLabel } from '../utils/consolidatedResults';
import { Spinner } from '../components/ui/spinner';

export function ExaminationManagement() {
  const dispatch = useDispatch();
  const { classes } = useClasses();
  const subjects = useSelector((s) => s.subjects.items);
  const subjectsStatus = useSelector((s) => s.subjects.status);
  const examTypes = useSelector((s) => s.examTypes.items);
  const examTypesStatus = useSelector((s) => s.examTypes.status);
  const examinations = useSelector((s) => s.examinations.items);
  const examinationsStatus = useSelector((s) => s.examinations.status);
  const examinationsError = useSelector((s) => s.examinations.error);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);
  const [editingExamId, setEditingExamId] = useState(null);
  const [viewingExamId, setViewingExamId] = useState(null);
  const [cancellingExamId, setCancellingExamId] = useState(null);
  const [completingExamId, setCompletingExamId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterExamTypeId, setFilterExamTypeId] = useState('all');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [hallTicketProgress, setHallTicketProgress] = useState(null);

  const [form, setForm] = useState({
    testName: '',
    examTypeId: '',
    examStatus: 'scheduled',
    classId: '',
    sectionId: '',
    sectionIds: [],
    subjectIds: [],
    includePartB: false,
    partBSubjectIds: [],
    maxMarks: '',
    passingMarks: '',
    /** Per-subject max/pass/schedule (stored in examination_subjects; exam row = sums + earliest date). */
    subjectMarksById: {},
    invigilator: '',
    instructions: '',
  });

  useEffect(() => {
    if (subjectsStatus === 'idle') dispatch(fetchSubjectsThunk({ search: '' }));
  }, [subjectsStatus, dispatch]);

  useEffect(() => {
    if (examTypesStatus === 'idle') dispatch(fetchExamTypesThunk({ search: '' }));
  }, [examTypesStatus, dispatch]);

  useEffect(() => {
    if (examinationsStatus === 'idle') dispatch(fetchExaminationsThunk({ search: '' }));
  }, [dispatch, examinationsStatus]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, pageSize, filterExamTypeId]);

  const selectedClass = useMemo(() => classes.find((c) => c.id === form.classId), [classes, form.classId]);
  const classSections = selectedClass?.sections || [];

  const updateForm = (patch) => setForm((p) => ({ ...p, ...patch }));

  const activeExam = useMemo(() => {
    const id = viewingExamId ?? editingExamId ?? cancellingExamId ?? completingExamId;
    if (!id) return null;
    return examinations.find((e) => e.id === id) ?? null;
  }, [cancellingExamId, completingExamId, editingExamId, examinations, viewingExamId]);

  const setFormFromExam = (e) => {
    const mkTime = (t) => {
      if (!t) return null;
      const [h, m] = String(t).split(':').map((x) => Number(x));
      if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
      const d = new Date();
      d.setHours(h, m, 0, 0);
      return d;
    };
    const mkDate = (d) => (d ? new Date(`${d}T00:00:00`) : null);
    const allSubjects = Array.isArray(e?.subjects) ? e.subjects : [];
    const partASubjects = allSubjects.filter((s) => !s.is_part_b);
    const partBSubjects = allSubjects.filter((s) => Boolean(s.is_part_b));
    const subjectIds = partASubjects.map((s) => s.id).filter(Boolean);
    const partBSubjectIds = partBSubjects.map((s) => s.id).filter(Boolean);
    const fallbackMax = e?.max_marks != null ? String(e.max_marks) : '';
    const fallbackPass = e?.passing_marks != null ? String(e.passing_marks) : '';
    const fallbackDate = mkDate(e?.exam_date);
    const subjectMarksById = {};
    for (const id of subjectIds) {
      const sub = partASubjects.find((s) => s.id === id);
      subjectMarksById[id] = {
        max: sub?.max_marks != null ? String(sub.max_marks) : fallbackMax,
        pass: sub?.passing_marks != null ? String(sub.passing_marks) : fallbackPass,
        date: mkDate(sub?.exam_date) ?? fallbackDate,
        startTime: mkTime(sub?.start_time) ?? null,
        endTime: mkTime(sub?.end_time) ?? null,
      };
    }
    const markRows = subjectIds.map((id) => subjectMarksById[id]).filter(Boolean);
    const firstRow = markRows[0];
    const n = subjectIds.length;
    const maxMarksStr =
      n <= 1 ? (firstRow && String(firstRow.max).trim() ? String(firstRow.max) : fallbackMax) : '';
    const passingMarksStr =
      n <= 1 ? (firstRow && String(firstRow.pass).trim() ? String(firstRow.pass) : fallbackPass) : '';
    const multiSectionIds = normalizeSectionIds(e?.section_ids);
    const isMulti = multiSectionIds.length > 0 && !e?.section_id;
    setForm({
      testName: e?.test_name ?? '',
      examTypeId: e?.exam_type_id ?? '',
      examStatus: e?.exam_status ?? 'scheduled',
      classId: e?.class_id ?? '',
      sectionId: isMulti ? '' : e?.section_id ?? '',
      sectionIds: isMulti ? multiSectionIds : e?.section_id ? [e.section_id] : [],
      subjectIds,
      includePartB: partBSubjectIds.length > 0,
      partBSubjectIds,
      maxMarks: maxMarksStr,
      passingMarks: passingMarksStr,
      subjectMarksById,
      invigilator: e?.invigilator ?? '',
      instructions: e?.instructions ?? '',
    });
  };

  const sectionLabelForExam = (e) => sectionLabelForExamHelper(e, classes);

  const validate = () => {
    const baseMissing =
      !form.testName.trim() ||
      !form.examTypeId ||
      !form.classId ||
      !(Array.isArray(form.subjectIds) && form.subjectIds.length);

    if (baseMissing) return 'Please fill all required fields (*)';

    if (form.includePartB && !(Array.isArray(form.partBSubjectIds) && form.partBSubjectIds.length)) {
      return 'Select at least one Part B subject, or turn off Part B';
    }
    if (form.includePartB) {
      const partA = new Set((form.subjectIds ?? []).map(String));
      if (form.partBSubjectIds.some((id) => partA.has(String(id)))) {
        return 'Part B subjects must not overlap Part A subjects';
      }
    }

    for (const id of form.subjectIds) {
      const row = form.subjectMarksById[id] ?? {};
      if (!(row.date instanceof Date)) return 'Please set an exam date for each subject';
      const hasStart = row.startTime instanceof Date;
      const hasEnd = row.endTime instanceof Date;
      if (hasStart && hasEnd) {
        if (row.endTime.getTime() <= row.startTime.getTime()) {
          return 'Each subject: End Time must be greater than Start Time';
        }
      }
    }

    const parseOptionalPass = (raw) => {
      if (!String(raw ?? '').trim()) return null;
      return Number(raw);
    };

    const multiSubject = form.subjectIds.length >= 2;
    if (multiSubject) {
      for (const id of form.subjectIds) {
        const row = form.subjectMarksById[id] ?? { max: '', pass: '' };
        if (!String(row.max).trim()) {
          return 'Please fill Max marks for each subject';
        }
        const max = Number(row.max);
        const pass = parseOptionalPass(row.pass);
        if (!Number.isFinite(max) || max <= 0) return 'Each subject: Max Marks must be greater than 0';
        if (pass != null) {
          if (!Number.isFinite(pass) || pass < 0) return 'Each subject: Passing Marks must be 0 or more';
          if (pass > max) return 'Each subject: Passing Marks must be less than or equal to Max Marks';
        }
      }
    } else {
      if (!String(form.maxMarks).trim()) {
        return 'Please fill all required fields (*)';
      }
      const max = Number(form.maxMarks);
      const pass = parseOptionalPass(form.passingMarks);
      if (!Number.isFinite(max) || max <= 0) return 'Max Marks must be greater than 0';
      if (pass != null) {
        if (!Number.isFinite(pass) || pass < 0) return 'Passing Marks must be 0 or more';
        if (pass > max) return 'Passing Marks must be less than or equal to Max Marks';
      }
    }

    return null;
  };

  const resetForm = () =>
    setForm({
      testName: '',
      examTypeId: '',
      examStatus: 'scheduled',
      classId: '',
      sectionId: '',
      sectionIds: [],
      subjectIds: [],
      includePartB: false,
      partBSubjectIds: [],
      maxMarks: '',
      passingMarks: '',
      subjectMarksById: {},
      invigilator: '',
      instructions: '',
    });

  const emptySubjectRow = () => ({
    max: '',
    pass: '',
    date: null,
    startTime: null,
    endTime: null,
  });

  const onSubjectIdsChange = (vals) => {
    setForm((prev) => {
      const ids = Array.isArray(vals) ? vals : [];
      const nextMarks = {};
      for (const id of ids) {
        nextMarks[id] = prev.subjectMarksById[id] ?? emptySubjectRow();
      }
      let maxMarks = prev.maxMarks;
      let passingMarks = prev.passingMarks;
      if (ids.length >= 2) {
        maxMarks = '';
        passingMarks = '';
      } else if (ids.length === 1) {
        const row = nextMarks[ids[0]];
        if (row && String(row.max).trim()) {
          maxMarks = row.max;
          passingMarks = row.pass;
        }
      }
      const partA = new Set(ids.map(String));
      const nextPartB = (prev.partBSubjectIds ?? []).filter((id) => !partA.has(String(id)));
      return {
        ...prev,
        subjectIds: ids,
        subjectMarksById: nextMarks,
        maxMarks,
        passingMarks,
        partBSubjectIds: nextPartB,
      };
    });
  };

  const updateSubjectMark = (subjectId, field, value) => {
    setForm((prev) => ({
      ...prev,
      subjectMarksById: {
        ...prev.subjectMarksById,
        [subjectId]: {
          ...(prev.subjectMarksById[subjectId] ?? emptySubjectRow()),
          [field]: value,
        },
      },
    }));
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    const parseOptionalPass = (raw) => {
      if (!String(raw ?? '').trim()) return null;
      return Number(raw);
    };
    const multiSubject = form.subjectIds.length >= 2;
    const subjectMaxArr = multiSubject
      ? form.subjectIds.map((id) => Number((form.subjectMarksById[id] ?? {}).max))
      : null;
    const subjectPassArr = multiSubject
      ? form.subjectIds.map((id) => parseOptionalPass((form.subjectMarksById[id] ?? {}).pass))
      : null;
    const maxMarks = multiSubject
      ? subjectMaxArr.reduce((a, b) => a + b, 0)
      : Number(form.maxMarks);
    const passingMarks = multiSubject
      ? subjectPassArr.every((p) => p == null)
        ? null
        : subjectPassArr.reduce((a, b) => a + (b ?? 0), 0)
      : parseOptionalPass(form.passingMarks);

    const subjectExamDates = form.subjectIds.map((id) => toIsoDate((form.subjectMarksById[id] ?? {}).date));
    const subjectStartTimes = form.subjectIds.map((id) => toTime24((form.subjectMarksById[id] ?? {}).startTime));
    const subjectEndTimes = form.subjectIds.map((id) => toTime24((form.subjectMarksById[id] ?? {}).endTime));
    const earliestDate = [...subjectExamDates].filter(Boolean).sort()[0] ?? null;

    const payload = {
      test_name: form.testName.trim(),
      exam_type_id: form.examTypeId,
      exam_status: form.examStatus,
      class_id: form.classId,
      // Use section_ids for both create + edit. Representation:
      // - null (create only) => "All sections"
      // - [] (edit only) => force "All sections"
      // - [one] => single section
      // - [many] => selected sections
      section_id: editingExamId ? null : null,
      section_ids: editingExamId
        ? Array.isArray(form.sectionIds)
          ? form.sectionIds
          : null
        : Array.isArray(form.sectionIds) && form.sectionIds.length
          ? form.sectionIds
          : null,
      subject_ids: form.subjectIds,
      part_b_subject_ids: form.includePartB ? form.partBSubjectIds : [],
      exam_date: earliestDate,
      start_time: null,
      end_time: null,
      subject_exam_dates: subjectExamDates,
      subject_start_times: subjectStartTimes,
      subject_end_times: subjectEndTimes,
      max_marks: maxMarks,
      passing_marks: passingMarks,
      ...(multiSubject ? { subject_max_marks: subjectMaxArr, subject_passing_marks: subjectPassArr } : {}),
      invigilator: form.invigilator.trim() || null,
      instructions: form.instructions.trim() || null,
    };

    setSaving(true);
    try {
      if (editingExamId) {
        const res = await dispatch(updateExaminationThunk({ examId: editingExamId, payload })).unwrap();
        toast.success('Examination updated');
        setEditingExamId(null);
        setIsCreateDialogOpen(false);
        await dispatch(fetchExaminationsThunk({ search: '', examTypeId: filterExamTypeId || undefined })).unwrap();
        return res;
      }
      const res = await dispatch(createExaminationThunk(payload)).unwrap();
      toast.success('Examination created');
      setIsCreateDialogOpen(false);
      resetForm();
      await dispatch(fetchExaminationsThunk({ search: '' }));
      return res;
    } catch (e) {
      toast.error(String(e || 'Failed'));
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    const base =
      filterExamTypeId && filterExamTypeId !== 'all'
        ? examinations.filter((e) => String(e.exam_type_id) === String(filterExamTypeId))
        : examinations;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter((e) => {
      const className = String(classes.find((c) => c.id === e.class_id)?.name ?? '').toLowerCase();
      const sectionName = String(sectionLabelForExam(e)).toLowerCase();
      const subjectStr = (Array.isArray(e.subjects) ? e.subjects.map((s) => s.name).join(' ') : '').toLowerCase();
      return (
        String(e.test_name ?? '').toLowerCase().includes(q) ||
        String(e.exam_type_name ?? '').toLowerCase().includes(q) ||
        String(e.invigilator ?? '').toLowerCase().includes(q) ||
        String(e.exam_status ?? '').toLowerCase().includes(q) ||
        className.includes(q) ||
        sectionName.includes(q) ||
        subjectStr.includes(q)
      );
    });
  }, [examinations, searchQuery, classes, filterExamTypeId]);

  const { totalCount, totalPages, currentPage, pageRows: paginatedExams } = usePagedRows(filtered, page, pageSize);

  const openCreate = () => {
    setEditingExamId(null);
    resetForm();
    setIsCreateDialogOpen(true);
  };

  const openEdit = (examId) => {
    const e = examinations.find((x) => x.id === examId);
    if (!e) return;
    setEditingExamId(examId);
    setFormFromExam(e);
    setIsCreateDialogOpen(true);
  };

  const openView = (examId) => {
    setViewingExamId(examId);
    setIsViewDialogOpen(true);
  };

  const handleDownloadHallTickets = async (exam) => {
    if (!exam?.id || hallTicketProgress) return;
    if (String(exam.exam_status ?? '').toLowerCase() !== 'scheduled') {
      toast.error('Hall tickets can only be downloaded for scheduled examinations');
      return;
    }
    try {
      setHallTicketProgress({ done: 0, total: 0 });
      const data = await dispatch(fetchHallTicketRosterThunk(exam.id)).unwrap();
      const students = Array.isArray(data?.students) ? data.students : [];
      const rawSubjects = Array.isArray(data?.exam?.subjects)
        ? data.exam.subjects
        : Array.isArray(exam.subjects)
          ? exam.subjects
          : [];
      const subjects = rawSubjects.filter((s) => !s?.is_part_b);

      if (!students.length) {
        toast.error('No active students found for this examination');
        return;
      }
      if (students.length > BULK_HALL_TICKET_MAX) {
        toast.error(`At most ${BULK_HALL_TICKET_MAX} students can be downloaded at once`);
        return;
      }

      setHallTicketProgress({ done: 0, total: students.length });
      const examName = data?.exam?.test_name || exam.test_name || 'Examination';
      const yearLabel = deriveYearLabel(data?.exam?.exam_date || exam.exam_date || new Date());

      const result = await downloadHallTicketsPdf({
        students,
        subjects,
        classNameFor: (classId) => classNameByIdHelper(classes, classId),
        sectionLabelFor: (sectionId) => {
          const cls = classes.find((c) => String(c.id) === String(exam.class_id));
          return cls?.sections?.find((s) => String(s.id) === String(sectionId))?.section ?? '';
        },
        examName,
        academicYearLabel: yearLabel,
        fileLabel: `HallTickets_${examName}`,
        onProgress: (done, total) => setHallTicketProgress({ done, total }),
      });

      if (result.downloaded === 0) {
        toast.error('Could not generate any hall tickets');
      } else if (result.skippedFailed > 0) {
        toast.success(`Downloaded ${result.downloaded} hall tickets (${result.skippedFailed} skipped)`);
      } else {
        toast.success(`Downloaded ${result.downloaded} hall tickets`);
      }
    } catch (e) {
      toast.error(typeof e === 'string' ? e : e?.message || 'Failed to download hall tickets');
    } finally {
      setHallTicketProgress(null);
    }
  };

  const openCancel = (examId) => {
    setCancellingExamId(examId);
    setIsCancelDialogOpen(true);
  };

  const handleCancel = async () => {
    if (!cancellingExamId) return;
    try {
      await dispatch(cancelExaminationThunk(cancellingExamId)).unwrap();
      toast.success('Examination cancelled');
      setIsCancelDialogOpen(false);
      setCancellingExamId(null);
      await dispatch(fetchExaminationsThunk({ search: '' }));
    } catch (e) {
      toast.error(String(e || 'Failed'));
    }
  };

  const openMarkCompleted = (examId) => {
    setCompletingExamId(examId);
    setIsCompleteDialogOpen(true);
  };

  const [markingComplete, setMarkingComplete] = useState(false);
  const handleMarkCompleted = async () => {
    if (!completingExamId) return;
    setMarkingComplete(true);
    try {
      await dispatch(updateExaminationThunk({ examId: completingExamId, payload: { exam_status: 'completed' } })).unwrap();
      toast.success('Examination marked as completed');
      setIsCompleteDialogOpen(false);
      setCompletingExamId(null);
      await dispatch(fetchExaminationsThunk({ search: '' }));
    } catch (e) {
      toast.error(String(e || 'Failed to mark as completed'));
    } finally {
      setMarkingComplete(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Examination"        actions={
          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={(open) => {
              setIsCreateDialogOpen(open);
              if (!open) {
                setEditingExamId(null);
                resetForm();
              }
            }}
          >
          <DialogTrigger asChild>
            <Button className="gap-2 w-full sm:w-auto" type="button" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add Examination
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
            <DialogHeader>
              <DialogTitle>{editingExamId ? 'Edit Examination' : 'Add Examination'}</DialogTitle>
              <DialogDescription>
                {editingExamId ? 'Update exam details' : 'Enter exam details to create an examination'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="test-name">Test Name *</Label>
                  <Input
                    id="test-name"
                    placeholder="Enter test name"
                    value={form.testName}
                    onChange={(e) => updateForm({ testName: e.target.value })}
                  />
                </div>
                <FormSelect
                  id="exam-type"
                  label="Exam Type"
                  required
                  value={form.examTypeId}
                  onValueChange={(v) => updateForm({ examTypeId: v })}
                  placeholder={examTypesStatus === 'loading' ? 'Loading types…' : 'Select exam type'}
                  options={examTypes.map((t) => ({ value: t.id, label: t.name }))}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="exam-status">Exam Status</Label>
                  <Input id="exam-status" value={form.examStatus.charAt(0).toUpperCase() + form.examStatus.slice(1)} readOnly className="mt-1.5 bg-gray-50 cursor-not-allowed" />
                </div>
                <div />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormSelect
                  id="exam-class"
                  label="Class"
                  required
                  value={form.classId}
                  onValueChange={(v) => updateForm({ classId: v, sectionId: '', sectionIds: [] })}
                  placeholder="Select class"
                  options={classes.map((c) => ({ value: c.id, label: c.name }))}
                />
                {editingExamId ? (
                  <div className="space-y-2">
                    <Label>Sections</Label>
                    <div className="rounded-md border border-gray-200 bg-white p-3 max-h-44 overflow-y-auto">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={!form.sectionIds?.length}
                            onChange={() => updateForm({ sectionIds: [] })}
                          />
                          <span className="font-medium">All sections</span>
                        </label>
                        {classSections.map((s) => {
                          const checked = (form.sectionIds ?? []).includes(s.id);
                          return (
                            <label key={s.id} className="inline-flex items-center gap-2 text-sm text-gray-700">
                              <input
                                type="checkbox"
                                className="h-4 w-4"
                                checked={checked}
                                onChange={() => {
                                  const set = new Set(form.sectionIds ?? []);
                                  if (set.has(s.id)) set.delete(s.id);
                                  else set.add(s.id);
                                  const allCount = Array.isArray(classSections) ? classSections.length : 0;
                                  if (allCount > 0 && set.size === allCount) {
                                    updateForm({ sectionIds: [] });
                                    return;
                                  }
                                  updateForm({ sectionIds: Array.from(set) });
                                }}
                              />
                              <span className="font-medium">{s.section}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      Selected:{' '}
                      <span className="font-medium text-gray-900">
                        {form.sectionIds?.length ? form.sectionIds.length : 'All'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Sections</Label>
                    <div className="rounded-md border border-gray-200 bg-white p-3 max-h-44 overflow-y-auto">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={!form.sectionIds?.length}
                            onChange={() => updateForm({ sectionIds: [] })}
                          />
                          <span className="font-medium">All sections</span>
                        </label>
                        {classSections.map((s) => {
                          const checked = (form.sectionIds ?? []).includes(s.id);
                          return (
                            <label key={s.id} className="inline-flex items-center gap-2 text-sm text-gray-700">
                              <input
                                type="checkbox"
                                className="h-4 w-4"
                                checked={checked}
                                onChange={() => {
                                  const set = new Set(form.sectionIds ?? []);
                                  if (set.has(s.id)) set.delete(s.id);
                                  else set.add(s.id);
                                  const allCount = Array.isArray(classSections) ? classSections.length : 0;
                                  if (allCount > 0 && set.size === allCount) {
                                    // Selecting all individual sections is equivalent to "All sections"
                                    updateForm({ sectionIds: [] });
                                    return;
                                  }
                                  updateForm({ sectionIds: Array.from(set) });
                                }}
                              />
                              <span className="font-medium">{s.section}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      Selected:{' '}
                      <span className="font-medium text-gray-900">
                        {form.sectionIds?.length ? form.sectionIds.length : 'All'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <MultiSelect
                id="exam-subjects"
                label="Subjects (Part A)"
                required
                value={form.subjectIds}
                onChange={onSubjectIdsChange}
                placeholder="Select subjects"
                options={subjects.map((s) => ({ value: s.id, label: s.name }))}
              />

              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 space-y-3">
                <label
                  htmlFor="exam-include-part-b"
                  className="flex items-start gap-3 cursor-pointer select-none touch-manipulation"
                >
                  <Checkbox
                    id="exam-include-part-b"
                    className="mt-0.5 h-5 w-5 shrink-0"
                    checked={form.includePartB}
                    onCheckedChange={(v) => {
                      const on = Boolean(v);
                      updateForm({
                        includePartB: on,
                        partBSubjectIds: on ? form.partBSubjectIds : [],
                      });
                    }}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-gray-900">Add Part B section</span>
                    <span className="block text-xs text-gray-500 mt-0.5 leading-relaxed">
                      Optional. No max or passing marks. Teachers enter grades as free text (max 50 characters).
                    </span>
                  </span>
                </label>

                {form.includePartB ? (
                  <MultiSelect
                    id="exam-part-b-subjects"
                    label="Part B subjects"
                    required
                    value={form.partBSubjectIds}
                    onChange={(vals) => updateForm({ partBSubjectIds: Array.isArray(vals) ? vals : [] })}
                    placeholder="Select Part B subjects"
                    options={subjects
                      .filter((s) => !form.subjectIds.includes(s.id))
                      .map((s) => ({ value: s.id, label: s.name }))}
                  />
                ) : null}
              </div>

              {form.subjectIds.length > 0 ? (
                <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {form.subjectIds.length >= 2 ? 'Schedule & marks by subject' : 'Schedule by subject'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Date is required for each subject. Start and end times are optional.
                      {form.subjectIds.length >= 2
                        ? ' List totals are the sum of max marks. Passing marks are optional.'
                        : ''}
                    </p>
                  </div>
                  <div className="space-y-4 divide-y divide-gray-100">
                    {form.subjectIds.map((sid) => {
                      const subj = subjects.find((s) => s.id === sid);
                      const row = form.subjectMarksById[sid] ?? emptySubjectRow();
                      return (
                        <div key={sid} className="pt-4 first:pt-0 space-y-3">
                          <div className="text-sm font-medium text-gray-900 truncate">{subj?.name ?? '—'}</div>
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="space-y-2">
                              <Label htmlFor={`exam-date-${sid}`}>Date *</Label>
                              <div className="relative w-full">
                                <DatePicker
                                  selected={row.date}
                                  onChange={(d) => updateSubjectMark(sid, 'date', d)}
                                  dateFormat="dd-MM-yyyy"
                                  preventOpenOnFocus
                                  shouldCloseOnSelect
                                  customInput={
                                    <DatePickerInput id={`exam-date-${sid}`} placeholder="dd-mm-yyyy" className="w-full" />
                                  }
                                  wrapperClassName="w-full"
                                  popperClassName="react-datepicker-popper"
                                  popperPlacement="bottom-start"
                                  popperModifiers={[{ name: 'offset', options: { offset: [0, 8] } }]}
                                  popperContainer={({ children }) => (
                                    <div className="absolute left-0 top-full z-50">{children}</div>
                                  )}
                                  popperProps={{ strategy: 'absolute' }}
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`start-time-${sid}`}>Start Time</Label>
                              <div className="relative w-full">
                                <DatePicker
                                  selected={row.startTime}
                                  onChange={(d) => updateSubjectMark(sid, 'startTime', d)}
                                  showTimeSelect
                                  showTimeSelectOnly
                                  timeIntervals={30}
                                  timeCaption="Time"
                                  dateFormat="hh:mm aa"
                                  isClearable
                                  preventOpenOnFocus
                                  shouldCloseOnSelect
                                  customInput={
                                    <DatePickerInput
                                      id={`start-time-${sid}`}
                                      placeholder="hh:mm AM/PM"
                                      className="w-full"
                                    />
                                  }
                                  wrapperClassName="w-full"
                                  popperClassName="react-datepicker-popper"
                                  popperPlacement="bottom-start"
                                  popperModifiers={[{ name: 'offset', options: { offset: [0, 8] } }]}
                                  popperContainer={({ children }) => (
                                    <div className="absolute left-0 top-full z-50">{children}</div>
                                  )}
                                  popperProps={{ strategy: 'absolute' }}
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`end-time-${sid}`}>End Time</Label>
                              <div className="relative w-full">
                                <DatePicker
                                  selected={row.endTime}
                                  onChange={(d) => updateSubjectMark(sid, 'endTime', d)}
                                  showTimeSelect
                                  showTimeSelectOnly
                                  timeIntervals={30}
                                  timeCaption="Time"
                                  dateFormat="hh:mm aa"
                                  isClearable
                                  preventOpenOnFocus
                                  shouldCloseOnSelect
                                  customInput={
                                    <DatePickerInput
                                      id={`end-time-${sid}`}
                                      placeholder="hh:mm AM/PM"
                                      className="w-full"
                                    />
                                  }
                                  wrapperClassName="w-full"
                                  popperClassName="react-datepicker-popper"
                                  popperPlacement="bottom-start"
                                  popperModifiers={[{ name: 'offset', options: { offset: [0, 8] } }]}
                                  popperContainer={({ children }) => (
                                    <div className="absolute left-0 top-full z-50">{children}</div>
                                  )}
                                  popperProps={{ strategy: 'absolute' }}
                                />
                              </div>
                            </div>
                          </div>
                          {form.subjectIds.length >= 2 ? (
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="space-y-2">
                                <Label htmlFor={`max-marks-${sid}`}>Max *</Label>
                                <Input
                                  id={`max-marks-${sid}`}
                                  type="number"
                                  min="1"
                                  placeholder="Enter marks"
                                  value={row.max}
                                  onChange={(e) => updateSubjectMark(sid, 'max', e.target.value)}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={`pass-marks-${sid}`}>Passing</Label>
                                <Input
                                  id={`pass-marks-${sid}`}
                                  type="number"
                                  min="0"
                                  placeholder="Optional"
                                  value={row.pass}
                                  onChange={(e) => updateSubjectMark(sid, 'pass', e.target.value)}
                                />
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {form.subjectIds.length < 2 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="max-marks">Max Marks *</Label>
                    <Input
                      id="max-marks"
                      type="number"
                      min="1"
                      placeholder="Enter max marks"
                      value={form.maxMarks}
                      onChange={(e) => updateForm({ maxMarks: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="passing-marks">Passing Marks</Label>
                    <Input
                      id="passing-marks"
                      type="number"
                      min="0"
                      placeholder="Optional"
                      value={form.passingMarks}
                      onChange={(e) => updateForm({ passingMarks: e.target.value })}
                    />
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="invigilator">Invigilator</Label>
                <Input
                  id="invigilator"
                  placeholder="Enter invigilator name"
                  value={form.invigilator}
                  onChange={(e) => updateForm({ invigilator: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="instructions">Note</Label>
                <Textarea
                  id="instructions"
                  placeholder=""
                  value={form.instructions}
                  onChange={(e) => updateForm({ instructions: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleSubmit} disabled={saving}>
                  {saving ? <><Spinner className="h-4 w-4" /> Saving…</> : editingExamId ? 'Save Changes' : 'Create Examination'}
                </Button>
              </div>
            </div>
          </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>All Examinations</CardTitle>
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

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <SearchInput
              className="flex-1 min-w-0"
              placeholder="Search by test, type, class, section, subject..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <div className="w-full sm:w-56 shrink-0">
              <FormSelect
                id="exam-list-type-filter"
                label="Exam type"
                value={filterExamTypeId}
                onValueChange={(v) => setFilterExamTypeId(v)}
                placeholder="All types"
                options={[{ value: 'all', label: 'All types' }, ...examTypes.map((t) => ({ value: t.id, label: t.name }))]}
              />
            </div>
          </div>

          <ExaminationsTable
            exams={paginatedExams}
            classes={classes}
            status={examinationsStatus}
            onView={openView}
            onEdit={openEdit}
            onCancel={openCancel}
            onMarkCompleted={openMarkCompleted}
          />
          <TablePagination
            selectId="exams-page-size"
            page={currentPage}
            pageSize={pageSize}
            totalCount={totalCount}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSizeSelectContentClassName="w-full min-w-[4.5rem]"
          />
        </CardContent>
      </Card>

      <ExaminationViewDialog
        open={isViewDialogOpen}
        onOpenChange={(open) => {
          setIsViewDialogOpen(open);
          if (!open) {
            setViewingExamId(null);
            setHallTicketProgress(null);
          }
        }}
        exam={activeExam}
        classes={classes}
        onEdit={openEdit}
        onDownloadHallTickets={handleDownloadHallTickets}
        hallTicketProgress={hallTicketProgress}
      />

      <DeleteConfirmDialog
        open={isCancelDialogOpen}
        onOpenChange={(open) => {
          setIsCancelDialogOpen(open);
          if (!open) setCancellingExamId(null);
        }}
        title="Cancel Examination?"
        description="This will cancel the exam and permanently delete all entered marks for this exam. This cannot be undone."
        confirmText="Cancel exam & delete marks"
        onConfirm={handleCancel}
      />

      <Dialog
        open={isCompleteDialogOpen}
        onOpenChange={(open) => {
          setIsCompleteDialogOpen(open);
          if (!open) setCompletingExamId(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Examination as Completed?</DialogTitle>
            <DialogDescription>
              {activeExam
                ? `This will mark "${activeExam.test_name}" as completed. All students must have their marks filled (numeric or AB) before this can proceed.`
                : 'This will mark the examination as completed. All marks must be filled.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => { setIsCompleteDialogOpen(false); setCompletingExamId(null); }} disabled={markingComplete}>
              Cancel
            </Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={handleMarkCompleted} disabled={markingComplete}>
              {markingComplete ? 'Updating…' : 'Mark as Completed'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

