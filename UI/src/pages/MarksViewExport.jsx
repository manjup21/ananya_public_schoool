import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { useClasses } from '../features/classes/useClasses';
import { fetchExamTypesThunk } from '../features/examTypes/examTypesSlice';
import { fetchExaminationsThunk, fetchExaminationByIdThunk } from '../features/examinations/examinationsSlice';
import { fetchExamResultsFullThunk } from '../features/examResults/examResultsSlice';
import { MarksViewPick } from './marksViewExport/MarksViewPick';
import { MarksViewEditor } from './marksViewExport/MarksViewEditor';

export function MarksViewExport() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const params = useParams();

  const { classes } = useClasses();

  const examinations = useSelector((s) => s.examinations?.items ?? []);
  const viewExportExaminations = useMemo(
    () => examinations.filter((e) => String(e?.exam_status ?? '').toLowerCase() === 'completed'),
    [examinations]
  );
  const examinationsStatus = useSelector((s) => s.examinations?.status ?? 'idle');
  const examinationsError = useSelector((s) => s.examinations?.error ?? null);
  const examTypes = useSelector((s) => s.examTypes?.items ?? []);
  const examTypesStatus = useSelector((s) => s.examTypes?.status ?? 'idle');

  const selectedExam = useSelector((s) => s.examinations?.selected ?? null);
  const selectedExamStatus = useSelector((s) => s.examinations?.selectedStatus ?? 'idle');
  const selectedExamError = useSelector((s) => s.examinations?.selectedError ?? null);

  const full = useSelector((s) => s.examResults?.full ?? null);
  const fullStatus = useSelector((s) => s.examResults?.fullStatus ?? 'idle');
  const fullError = useSelector((s) => s.examResults?.fullError ?? null);

  const [step, setStep] = useState('pick'); // pick | view
  const [activeExamId, setActiveExamId] = useState(null);

  useEffect(() => {
    if (examinationsStatus === 'idle') dispatch(fetchExaminationsThunk({}));
    if (examTypesStatus === 'idle') dispatch(fetchExamTypesThunk({ search: '' }));
  }, [dispatch, examinationsStatus, examTypesStatus]);

  const pickExam = async (examId, { pushUrl = true } = {}) => {
    if (!examId) return;
    setActiveExamId(examId);
    setStep('view');
    if (pushUrl) navigate(`/staff/marks/view/${examId}`, { replace: false });
    try {
      await dispatch(fetchExaminationByIdThunk(examId)).unwrap();
      await dispatch(fetchExamResultsFullThunk({ examId })).unwrap();
    } catch (e) {
      toast.error(String(e || 'Failed to load results'));
    }
  };

  useEffect(() => {
    const examIdFromUrl = params.examId ? String(params.examId) : null;
    if (!examIdFromUrl) {
      setStep('pick');
      setActiveExamId(null);
      return;
    }
    if (examIdFromUrl === activeExamId) return;
    pickExam(examIdFromUrl, { pushUrl: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.examId]);

  const resetToPick = () => {
    setStep('pick');
    setActiveExamId(null);
    navigate('/staff/marks/view', { replace: false });
  };

  const derivedSubjects = useMemo(() => {
    if (Array.isArray(full?.subjects) && full.subjects.length) return full.subjects;
    if (Array.isArray(selectedExam?.subjects) && selectedExam.subjects.length) return selectedExam.subjects;
    return [];
  }, [full, selectedExam]);

  if (step === 'pick') {
    return (
      <MarksViewPick
        classes={classes}
        examTypes={examTypes}
        examTypesStatus={examTypesStatus}
        examinations={viewExportExaminations}
        examinationsStatus={examinationsStatus}
        examinationsError={examinationsError}
        onSelectExam={pickExam}
      />
    );
  }

  return (
    <MarksViewEditor
      classes={classes}
      exam={selectedExamStatus === 'succeeded' ? selectedExam : selectedExam}
      subjects={derivedSubjects}
      resultsPayload={full}
      loadingExam={selectedExamStatus === 'loading'}
      examError={selectedExamError}
      loadingResults={fullStatus === 'loading'}
      resultsError={fullError}
      onBack={resetToPick}
    />
  );
}

