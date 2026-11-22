import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { EnterResultsPick } from './enterResults/EnterResultsPick';
import { EnterResultsEditor } from './enterResults/EnterResultsEditor';
import { useClasses } from '../features/classes/useClasses';
import {
  fetchExaminationByIdThunk,
  fetchExaminationsThunk,
  fetchExamMarksTemplateThunk,
} from '../features/examinations/examinationsSlice';
import { buildEmptyMarksRows, parseMarkValue, parsePartBGrade, partitionExamSubjects } from '../utils/marksValidation';
import { bulkSaveExamResultsThunk, fetchExamResultsFullThunk } from '../features/examResults/examResultsSlice';

export function EnterResults() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { examId: examIdParam } = useParams();

  const { classes } = useClasses();

  const examinations = useSelector((s) => s.examinations.items);
  const examinationsStatus = useSelector((s) => s.examinations.status);
  const examinationsError = useSelector((s) => s.examinations.error);
  const enterResultsExaminations = (Array.isArray(examinations) ? examinations : []).filter(
    (e) => String(e?.exam_status ?? '').toLowerCase() === 'scheduled'
  );

  const selectedExam = useSelector((s) => s.examinations.selected);
  const selectedExamStatus = useSelector((s) => s.examinations.selectedStatus);
  const selectedExamError = useSelector((s) => s.examinations.selectedError);

  const [step, setStep] = useState('pick'); // pick | enter
  const [activeExamId, setActiveExamId] = useState(null);
  const [rows, setRows] = useState([]);
  const [loadingMarks, setLoadingMarks] = useState(false);
  const [actionState, setActionState] = useState({ saving: false, note: '' });
  const lastLoadedExamIdRef = useRef(null);

  useEffect(() => {
    if (examinationsStatus === 'idle') dispatch(fetchExaminationsThunk({ search: '' }));
  }, [dispatch, examinationsStatus]);

  const pickExam = async (examId, { pushUrl = true } = {}) => {
    setRows([]);
    setActiveExamId(examId);
    setStep('enter');
    setLoadingMarks(true);
    setActionState({ saving: false, note: '' });
    if (pushUrl) navigate(`/staff/marks/results/${examId}`, { replace: false });
    try {
      const [examDetail, template] = await Promise.all([
        dispatch(fetchExaminationByIdThunk(examId)).unwrap(),
        dispatch(fetchExamMarksTemplateThunk(examId)).unwrap(),
      ]);
      const students = template?.students ?? [];
      const subs = Array.isArray(examDetail?.subjects) ? examDetail.subjects : [];
      const baseRows = buildEmptyMarksRows({ students, subjects: subs });

      let savedResults = [];
      try {
        const fullData = await dispatch(fetchExamResultsFullThunk({ examId })).unwrap();
        if (Array.isArray(fullData?.results)) savedResults = fullData.results;
        else if (Array.isArray(fullData)) savedResults = fullData;
      } catch {
        // no saved marks yet — continue with empty
      }

      const marksByStudentId = new Map();
      for (const sr of savedResults) {
        const sid = sr.student_id;
        if (!sid) continue;
        if (!marksByStudentId.has(sid)) {
          marksByStudentId.set(sid, { marks: [], result_status: sr.result_status ?? null });
        }
        const entry = marksByStudentId.get(sid);
        if (Array.isArray(sr.marks)) {
          entry.marks = sr.marks;
        } else if (sr.subject_id) {
          entry.marks.push(sr);
        }
      }

      const nextRows = baseRows.map((r) => {
        if (!r.student_id || !marksByStudentId.has(r.student_id)) return r;
        const saved = marksByStudentId.get(r.student_id);
        const merged = {
          ...r,
          marksBySubjectId: { ...(r.marksBySubjectId ?? {}) },
          gradesBySubjectId: { ...(r.gradesBySubjectId ?? {}) },
        };
        for (const m of saved.marks) {
          if (!m?.subject_id) continue;
          if (m.is_part_b || (m.grade_text != null && String(m.grade_text).trim() !== '')) {
            merged.gradesBySubjectId[m.subject_id] = String(m.grade_text ?? '').trim();
            continue;
          }
          if (m.is_absent) merged.marksBySubjectId[m.subject_id] = 'AB';
          else if (m.mark === null || m.mark === undefined) merged.marksBySubjectId[m.subject_id] = '';
          else merged.marksBySubjectId[m.subject_id] = String(m.mark);
        }
        if (saved.result_status) merged.result_status = saved.result_status;
        return merged;
      });

      setRows(nextRows);
    } catch (e) {
      toast.error(typeof e === 'string' ? e : e?.message || 'Failed to load exam');
    } finally {
      setLoadingMarks(false);
    }
  };

  const resetToPick = () => {
    setStep('pick');
    setActiveExamId(null);
    setRows([]);
    navigate('/staff/marks/results', { replace: false });
  };

  useEffect(() => {
    const id = String(examIdParam ?? '').trim();
    if (!id) {
      lastLoadedExamIdRef.current = null;
      setStep('pick');
      setActiveExamId(null);
      setRows([]);
      return;
    }
    if (lastLoadedExamIdRef.current === id) return;
    lastLoadedExamIdRef.current = id;
    pickExam(id, { pushUrl: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examIdParam]);

  const saveAll = async () => {
    if (!activeExamId || !selectedExam) return;
    const subs = Array.isArray(selectedExam?.subjects) ? selectedExam.subjects : [];
    const { partA, partB } = partitionExamSubjects(subs);

    // Only send subjects that were actually entered (number or AB / Part B grade).
    // Empty cells are omitted so another lecturer's marks are not overwritten (DB merge-on-save).
    const payloadRows = rows
      .filter((r) => r.student_id)
      .map((r) => {
        const enteredSubjectIds = [];
        const marks = [];
        const is_absent = [];
        for (const s of partA) {
          const sid = s.id;
          const parsed = parseMarkValue(r.marksBySubjectId?.[sid]);
          if (parsed.kind === 'absent') {
            enteredSubjectIds.push(sid);
            marks.push(null);
            is_absent.push(true);
          } else if (parsed.kind === 'number') {
            enteredSubjectIds.push(sid);
            marks.push(Math.trunc(parsed.value));
            is_absent.push(false);
          }
        }

        const part_b_subject_ids = [];
        const part_b_grades = [];
        for (const s of partB) {
          const parsed = parsePartBGrade(r.gradesBySubjectId?.[s.id]);
          if (parsed.kind === 'grade') {
            part_b_subject_ids.push(s.id);
            part_b_grades.push(parsed.value);
          }
        }

        if (!enteredSubjectIds.length && !part_b_subject_ids.length) return null;
        return {
          student_id: r.student_id,
          subject_ids: enteredSubjectIds,
          marks,
          is_absent,
          remarks: enteredSubjectIds.map(() => null),
          part_b_subject_ids,
          part_b_grades,
        };
      })
      .filter(Boolean);

    if (!payloadRows.length) {
      toast.error('Nothing to save — enter at least one mark or Part B grade');
      return;
    }

    setActionState((p) => ({ ...p, saving: true, note: '' }));
    try {
      await dispatch(bulkSaveExamResultsThunk({ examId: activeExamId, rows: payloadRows })).unwrap();
      toast.success('Saved');
      setActionState((p) => ({ ...p, saving: false, note: 'Saved as draft' }));
      // Reload grid so marks saved by other lecturers appear.
      await pickExam(activeExamId, { pushUrl: false });
    } catch (e) {
      toast.error(String(e || 'Save failed'));
      setActionState((p) => ({ ...p, saving: false }));
    }
  };

  if (step === 'pick') {
    return (
      <EnterResultsPick
        classes={classes}
        examinations={enterResultsExaminations}
        examinationsStatus={examinationsStatus}
        examinationsError={examinationsError}
        onSelectExam={pickExam}
      />
    );
  }

  return (
    <EnterResultsEditor
      classes={classes}
      exam={selectedExamStatus === 'succeeded' ? selectedExam : selectedExam}
      subjects={Array.isArray(selectedExam?.subjects) ? selectedExam.subjects : []}
      rows={rows}
      setRows={setRows}
      onBack={resetToPick}
      onSaveAll={saveAll}
      actionState={actionState}
      loadingExam={selectedExamStatus === 'loading' || loadingMarks}
      examError={selectedExamError}
    />
  );
}

