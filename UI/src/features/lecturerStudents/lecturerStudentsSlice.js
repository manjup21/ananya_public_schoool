import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api } from '../../services/api';

export const fetchLecturerStudentsThunk = createAsyncThunk(
  'lecturerStudents/fetchList',
  async ({ search, classId, sectionId } = {}, { rejectWithValue }) => {
    try {
      const params = {};
      if (classId) params.classId = classId;
      if (search != null && String(search).trim() !== '') params.search = String(search).trim();
      if (sectionId) params.sectionId = sectionId;
      const res = await api.get('/lecturer/students', { params });
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to fetch students');
      return res.data.data?.students ?? [];
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to fetch students');
    }
  }
);

export const fetchLecturerStudentByIdThunk = createAsyncThunk(
  'lecturerStudents/fetchStudent',
  async (studentId, { rejectWithValue }) => {
    try {
      const res = await api.get(`/lecturer/students/${studentId}`);
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to fetch student');
      return res.data.data ?? null;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to fetch student');
    }
  }
);

export const fetchLecturerStudentAttendanceSummaryThunk = createAsyncThunk(
  'lecturerStudents/fetchAttendanceSummary',
  async ({ studentId, from, to }, { rejectWithValue }) => {
    try {
      const res = await api.get(`/lecturer/students/${studentId}/attendance/summary`, { params: { from, to } });
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to fetch attendance summary');
      return res.data.data ?? null;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to fetch attendance summary');
    }
  }
);

export const fetchLecturerStudentAbsencesThunk = createAsyncThunk(
  'lecturerStudents/fetchAbsences',
  async ({ studentId, from, to }, { rejectWithValue }) => {
    try {
      const res = await api.get(`/lecturer/students/${studentId}/attendance/absences`, { params: { from, to } });
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to fetch absences');
      return Array.isArray(res.data.data) ? res.data.data : [];
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to fetch absences');
    }
  }
);

function normalizeExamSummaryPayload(d) {
  if (Array.isArray(d)) {
    const exams = d;
    const chartSeries = [...exams].sort((a, b) =>
      String(a.exam_date ?? '').localeCompare(String(b.exam_date ?? ''))
    );
    const pcts = exams
      .filter((r) => Number(r.max_marks) > 0)
      .map((r) => (Number(r.total_marks) / Number(r.max_marks)) * 100);
    const avgPct =
      pcts.length > 0 ? Math.round((pcts.reduce((a, x) => a + x, 0) / pcts.length) * 100) / 100 : null;
    return { exams, total: exams.length, chartSeries, avgPct, chartLimit: 50 };
  }
  const exams = Array.isArray(d?.exams) ? d.exams : [];
  const total = Number(d?.total ?? 0);
  const chartSeries = Array.isArray(d?.chartSeries) ? d.chartSeries : [];
  const rawAvg = d?.avgPct;
  const avgPct =
    rawAvg != null && Number.isFinite(Number(rawAvg)) ? Number(rawAvg) : null;
  const chartLimit = Number(d?.chartLimit ?? 50) || 50;
  return { exams, total: Number.isFinite(total) ? total : 0, chartSeries, avgPct, chartLimit };
}

export const fetchStudentProgressReportThunk = createAsyncThunk(
  'lecturerStudents/fetchProgressReport',
  async ({ studentId, from, to, examTypeId }, { rejectWithValue }) => {
    try {
      const params = {};
      if (from != null && String(from).trim() !== '') params.from = String(from).trim();
      if (to != null && String(to).trim() !== '') params.to = String(to).trim();
      if (examTypeId != null && String(examTypeId).trim() !== '' && examTypeId !== 'all') {
        params.examTypeId = String(examTypeId).trim();
      }
      const res = await api.get(`/lecturer/students/${studentId}/exams/progress-report`, { params });
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to fetch progress report');
      return res.data.data ?? { sections: [] };
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to fetch progress report');
    }
  }
);

export const fetchBulkStudentProgressReportsThunk = createAsyncThunk(
  'lecturerStudents/fetchBulkProgressReports',
  async ({ studentIds, from, to, examTypeId }, { rejectWithValue }) => {
    try {
      const body = { studentIds: (studentIds ?? []).map((id) => String(id)) };
      if (from != null && String(from).trim() !== '') body.from = String(from).trim();
      if (to != null && String(to).trim() !== '') body.to = String(to).trim();
      if (examTypeId != null && String(examTypeId).trim() !== '' && examTypeId !== 'all') {
        body.examTypeId = String(examTypeId).trim();
      }
      const res = await api.post('/lecturer/students/exams/progress-report/bulk', body);
      if (!res.data?.success) {
        return rejectWithValue(res.data?.message || 'Failed to fetch bulk progress reports');
      }
      return res.data.data?.reports ?? [];
    } catch (err) {
      return rejectWithValue(
        err?.response?.data?.message || err.message || 'Failed to fetch bulk progress reports'
      );
    }
  }
);

export const fetchLecturerStudentExamSummaryThunk = createAsyncThunk(
  'lecturerStudents/fetchExamSummary',
  async (
    { studentId, limit = 10, offset = 0, from, to, examTypeId, subjectId, chartLimit } = {},
    { rejectWithValue }
  ) => {
    try {
      const params = { limit, offset };
      if (from != null && String(from).trim() !== '') params.from = String(from).trim();
      if (to != null && String(to).trim() !== '') params.to = String(to).trim();
      if (examTypeId != null && String(examTypeId).trim() !== '' && examTypeId !== 'all') {
        params.examTypeId = String(examTypeId).trim();
      }
      if (subjectId && subjectId !== 'all') params.subjectId = subjectId;
      if (chartLimit != null && Number.isFinite(Number(chartLimit))) params.chartLimit = Number(chartLimit);
      const res = await api.get(`/lecturer/students/${studentId}/exams/summary`, { params });
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to fetch exam summary');
      return normalizeExamSummaryPayload(res.data.data);
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to fetch exam summary');
    }
  }
);

const initialState = {
  list: [],
  listStatus: 'idle',
  listError: null,

  student: null,
  studentStatus: 'idle',
  studentError: null,

  attendanceSummary: null,
  attendanceSummaryStatus: 'idle',
  attendanceSummaryError: null,

  absences: [],
  absencesStatus: 'idle',
  absencesError: null,

  examSummary: [],
  examSummaryTotal: 0,
  examChartSeries: [],
  examSummaryAvgPct: null,
  examChartLimit: 50,
  examSummaryStatus: 'idle',
  examSummaryError: null,
};

const lecturerStudentsSlice = createSlice({
  name: 'lecturerStudents',
  initialState,
  reducers: {
    clearLecturerStudentProfile(state) {
      state.student = null;
      state.studentStatus = 'idle';
      state.studentError = null;
      state.attendanceSummary = null;
      state.attendanceSummaryStatus = 'idle';
      state.attendanceSummaryError = null;
      state.absences = [];
      state.absencesStatus = 'idle';
      state.absencesError = null;
      state.examSummary = [];
      state.examSummaryTotal = 0;
      state.examChartSeries = [];
      state.examSummaryAvgPct = null;
      state.examChartLimit = 50;
      state.examSummaryStatus = 'idle';
      state.examSummaryError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchLecturerStudentsThunk.pending, (state) => {
        state.listStatus = 'loading';
        state.listError = null;
      })
      .addCase(fetchLecturerStudentsThunk.fulfilled, (state, action) => {
        state.listStatus = 'succeeded';
        state.list = action.payload;
      })
      .addCase(fetchLecturerStudentsThunk.rejected, (state, action) => {
        state.listStatus = 'failed';
        state.listError = action.payload || 'Failed to fetch students';
        state.list = [];
      })
      .addCase(fetchLecturerStudentByIdThunk.pending, (state) => {
        state.studentStatus = 'loading';
        state.studentError = null;
      })
      .addCase(fetchLecturerStudentByIdThunk.fulfilled, (state, action) => {
        state.studentStatus = 'succeeded';
        state.student = action.payload;
      })
      .addCase(fetchLecturerStudentByIdThunk.rejected, (state, action) => {
        state.studentStatus = 'failed';
        state.studentError = action.payload || 'Failed to fetch student';
        state.student = null;
      })
      .addCase(fetchLecturerStudentAttendanceSummaryThunk.pending, (state) => {
        state.attendanceSummaryStatus = 'loading';
        state.attendanceSummaryError = null;
      })
      .addCase(fetchLecturerStudentAttendanceSummaryThunk.fulfilled, (state, action) => {
        state.attendanceSummaryStatus = 'succeeded';
        state.attendanceSummary = action.payload;
      })
      .addCase(fetchLecturerStudentAttendanceSummaryThunk.rejected, (state, action) => {
        state.attendanceSummaryStatus = 'failed';
        state.attendanceSummaryError = action.payload || 'Failed to fetch attendance summary';
        state.attendanceSummary = null;
      })
      .addCase(fetchLecturerStudentAbsencesThunk.pending, (state) => {
        state.absencesStatus = 'loading';
        state.absencesError = null;
      })
      .addCase(fetchLecturerStudentAbsencesThunk.fulfilled, (state, action) => {
        state.absencesStatus = 'succeeded';
        state.absences = action.payload;
      })
      .addCase(fetchLecturerStudentAbsencesThunk.rejected, (state, action) => {
        state.absencesStatus = 'failed';
        state.absencesError = action.payload || 'Failed to fetch absences';
        state.absences = [];
      })
      .addCase(fetchLecturerStudentExamSummaryThunk.pending, (state) => {
        state.examSummaryStatus = 'loading';
        state.examSummaryError = null;
      })
      .addCase(fetchLecturerStudentExamSummaryThunk.fulfilled, (state, action) => {
        state.examSummaryStatus = 'succeeded';
        state.examSummary = action.payload.exams;
        state.examSummaryTotal = action.payload.total;
        state.examChartSeries = action.payload.chartSeries;
        state.examSummaryAvgPct = action.payload.avgPct;
        state.examChartLimit = action.payload.chartLimit;
      })
      .addCase(fetchLecturerStudentExamSummaryThunk.rejected, (state, action) => {
        state.examSummaryStatus = 'failed';
        state.examSummaryError = action.payload || 'Failed to fetch exam summary';
        state.examSummary = [];
        state.examSummaryTotal = 0;
        state.examChartSeries = [];
        state.examSummaryAvgPct = null;
        state.examChartLimit = 50;
      });
  },
});

export const { clearLecturerStudentProfile } = lecturerStudentsSlice.actions;
export default lecturerStudentsSlice.reducer;

