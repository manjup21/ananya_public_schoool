import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api } from '../../services/api';

export const fetchAttendanceSummaryThunk = createAsyncThunk(
  'notifications/fetchAttendanceSummary',
  async (date, { rejectWithValue }) => {
    try {
      const res = await api.get('/notifications/attendance/summary', { params: { date } });
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to fetch attendance summary');
      const d = res.data.data ?? {};
      return { sections: d.sections ?? d, school_name: d.school_name ?? '' };
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to fetch attendance summary');
    }
  }
);

export const fetchAttendanceDetailThunk = createAsyncThunk(
  'notifications/fetchAttendanceDetail',
  async ({ classId, sectionId, date }, { rejectWithValue }) => {
    try {
      const res = await api.get('/notifications/attendance/detail', {
        params: { classId, sectionId, date },
      });
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to fetch attendance detail');
      return res.data.data ?? {};
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to fetch attendance detail');
    }
  }
);

export const sendAttendanceNotificationThunk = createAsyncThunk(
  'notifications/sendAttendance',
  async ({ classId, sectionId, date, channel }, { rejectWithValue }) => {
    try {
      const res = await api.post('/notifications/attendance/send', { classId, sectionId, date, channel });
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to send notifications');
      return res.data.data ?? {};
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to send notifications');
    }
  }
);

export const sendBulkAttendanceThunk = createAsyncThunk(
  'notifications/sendBulkAttendance',
  async ({ date, channel }, { rejectWithValue }) => {
    try {
      const res = await api.post('/notifications/attendance/send-bulk', { date, channel });
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to send bulk notifications');
      return res.data.data ?? {};
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to send bulk notifications');
    }
  }
);

export const fetchExamNotificationListThunk = createAsyncThunk(
  'notifications/fetchExamList',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get('/notifications/exam/list');
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to fetch exam list');
      return res.data.data ?? [];
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to fetch exam list');
    }
  }
);

export const fetchExamNotificationDetailThunk = createAsyncThunk(
  'notifications/fetchExamDetail',
  async (examId, { rejectWithValue }) => {
    try {
      const res = await api.get('/notifications/exam/detail', { params: { examinationId: examId } });
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to fetch exam detail');
      return res.data.data ?? {};
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to fetch exam detail');
    }
  }
);

export const sendExamNotificationThunk = createAsyncThunk(
  'notifications/sendExam',
  async ({ examId, channel }, { rejectWithValue }) => {
    try {
      const res = await api.post('/notifications/exam/send', { examId, channel });
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to send notifications');
      return res.data.data ?? {};
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to send notifications');
    }
  }
);

export const fetchFeeDueSummaryThunk = createAsyncThunk(
  'notifications/fetchFeeDueSummary',
  async (academicYear, { rejectWithValue }) => {
    try {
      const res = await api.get('/notifications/fee-due/summary', {
        params: academicYear ? { academicYear } : {},
      });
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to fetch fee due summary');
      return res.data.data ?? {};
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to fetch fee due summary');
    }
  }
);

export const fetchFeeDueDetailThunk = createAsyncThunk(
  'notifications/fetchFeeDueDetail',
  async ({ classId, sectionId, academicYear }, { rejectWithValue }) => {
    try {
      const res = await api.get('/notifications/fee-due/detail', {
        params: { classId, sectionId, academicYear },
      });
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to fetch fee due detail');
      return res.data.data ?? {};
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to fetch fee due detail');
    }
  }
);

export const sendFeeDueNotificationThunk = createAsyncThunk(
  'notifications/sendFeeDue',
  async ({ classId, sectionId, academicYear, studentIds, dueDate, channel }, { rejectWithValue }) => {
    try {
      const res = await api.post('/notifications/fee-due/send', {
        classId,
        sectionId,
        academicYear,
        studentIds,
        dueDate,
        channel,
      });
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to send notifications');
      return res.data.data ?? {};
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to send notifications');
    }
  }
);

export const retryFailedNotificationsThunk = createAsyncThunk(
  'notifications/retryFailed',
  async ({ logId }, { rejectWithValue }) => {
    try {
      const res = await api.post('/notifications/retry', { logId });
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to retry notifications');
      return res.data.data ?? {};
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to retry notifications');
    }
  }
);

const initialState = {
  attendanceSummary: { items: [], schoolName: '', status: 'idle', error: null, date: null },
  attendanceDetail: { students: [], meta: {}, status: 'idle', error: null },
  examList: { items: [], status: 'idle', error: null },
  examDetail: { students: [], exam: {}, status: 'idle', error: null },
  feeDueList: { items: [], academicYear: '', status: 'idle', error: null },
  feeDueDetail: { students: [], section: {}, status: 'idle', error: null },
  sending: { status: 'idle', error: null },
};

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    clearAttendanceDetail(state) {
      state.attendanceDetail = { students: [], meta: {}, status: 'idle', error: null };
    },
    clearExamDetail(state) {
      state.examDetail = { students: [], exam: {}, status: 'idle', error: null };
    },
    clearFeeDueDetail(state) {
      state.feeDueDetail = { students: [], section: {}, status: 'idle', error: null };
    },
  },
  extraReducers: (builder) => {
    builder
      // Attendance summary
      .addCase(fetchAttendanceSummaryThunk.pending, (state) => {
        state.attendanceSummary.status = 'loading';
        state.attendanceSummary.error = null;
      })
      .addCase(fetchAttendanceSummaryThunk.fulfilled, (state, action) => {
        state.attendanceSummary.status = 'succeeded';
        state.attendanceSummary.items = action.payload.sections ?? action.payload;
        state.attendanceSummary.schoolName = action.payload.school_name ?? '';
      })
      .addCase(fetchAttendanceSummaryThunk.rejected, (state, action) => {
        state.attendanceSummary.status = 'failed';
        state.attendanceSummary.error = action.payload;
      })
      // Attendance detail
      .addCase(fetchAttendanceDetailThunk.pending, (state) => {
        state.attendanceDetail.status = 'loading';
        state.attendanceDetail.error = null;
      })
      .addCase(fetchAttendanceDetailThunk.fulfilled, (state, action) => {
        state.attendanceDetail.status = 'succeeded';
        state.attendanceDetail.students = action.payload.students ?? [];
        state.attendanceDetail.meta = action.payload.meta ?? {};
      })
      .addCase(fetchAttendanceDetailThunk.rejected, (state, action) => {
        state.attendanceDetail.status = 'failed';
        state.attendanceDetail.error = action.payload;
      })
      // Send attendance
      .addCase(sendAttendanceNotificationThunk.pending, (state) => {
        state.sending = { status: 'loading', error: null };
      })
      .addCase(sendAttendanceNotificationThunk.fulfilled, (state) => {
        state.sending = { status: 'succeeded', error: null };
      })
      .addCase(sendAttendanceNotificationThunk.rejected, (state, action) => {
        state.sending = { status: 'failed', error: action.payload };
      })
      // Bulk send attendance
      .addCase(sendBulkAttendanceThunk.pending, (state) => {
        state.sending = { status: 'loading', error: null };
      })
      .addCase(sendBulkAttendanceThunk.fulfilled, (state) => {
        state.sending = { status: 'succeeded', error: null };
      })
      .addCase(sendBulkAttendanceThunk.rejected, (state, action) => {
        state.sending = { status: 'failed', error: action.payload };
      })
      // Exam list
      .addCase(fetchExamNotificationListThunk.pending, (state) => {
        state.examList.status = 'loading';
        state.examList.error = null;
      })
      .addCase(fetchExamNotificationListThunk.fulfilled, (state, action) => {
        state.examList.status = 'succeeded';
        state.examList.items = action.payload;
      })
      .addCase(fetchExamNotificationListThunk.rejected, (state, action) => {
        state.examList.status = 'failed';
        state.examList.error = action.payload;
      })
      // Exam detail
      .addCase(fetchExamNotificationDetailThunk.pending, (state) => {
        state.examDetail.status = 'loading';
        state.examDetail.error = null;
      })
      .addCase(fetchExamNotificationDetailThunk.fulfilled, (state, action) => {
        state.examDetail.status = 'succeeded';
        state.examDetail.students = action.payload.students ?? [];
        state.examDetail.exam = action.payload.exam ?? {};
      })
      .addCase(fetchExamNotificationDetailThunk.rejected, (state, action) => {
        state.examDetail.status = 'failed';
        state.examDetail.error = action.payload;
      })
      // Send exam
      .addCase(sendExamNotificationThunk.pending, (state) => {
        state.sending = { status: 'loading', error: null };
      })
      .addCase(sendExamNotificationThunk.fulfilled, (state) => {
        state.sending = { status: 'succeeded', error: null };
      })
      .addCase(sendExamNotificationThunk.rejected, (state, action) => {
        state.sending = { status: 'failed', error: action.payload };
      })
      // Fee due summary
      .addCase(fetchFeeDueSummaryThunk.pending, (state) => {
        state.feeDueList.status = 'loading';
        state.feeDueList.error = null;
      })
      .addCase(fetchFeeDueSummaryThunk.fulfilled, (state, action) => {
        state.feeDueList.status = 'succeeded';
        state.feeDueList.items = action.payload.sections ?? [];
        state.feeDueList.academicYear = action.payload.academic_year ?? '';
      })
      .addCase(fetchFeeDueSummaryThunk.rejected, (state, action) => {
        state.feeDueList.status = 'failed';
        state.feeDueList.error = action.payload;
      })
      // Fee due detail
      .addCase(fetchFeeDueDetailThunk.pending, (state) => {
        state.feeDueDetail.status = 'loading';
        state.feeDueDetail.error = null;
      })
      .addCase(fetchFeeDueDetailThunk.fulfilled, (state, action) => {
        state.feeDueDetail.status = 'succeeded';
        state.feeDueDetail.students = action.payload.students ?? [];
        state.feeDueDetail.section = action.payload.section ?? {};
      })
      .addCase(fetchFeeDueDetailThunk.rejected, (state, action) => {
        state.feeDueDetail.status = 'failed';
        state.feeDueDetail.error = action.payload;
      })
      // Send fee due
      .addCase(sendFeeDueNotificationThunk.pending, (state) => {
        state.sending = { status: 'loading', error: null };
      })
      .addCase(sendFeeDueNotificationThunk.fulfilled, (state) => {
        state.sending = { status: 'succeeded', error: null };
      })
      .addCase(sendFeeDueNotificationThunk.rejected, (state, action) => {
        state.sending = { status: 'failed', error: action.payload };
      })
      // Retry failed
      .addCase(retryFailedNotificationsThunk.pending, (state) => {
        state.sending = { status: 'loading', error: null };
      })
      .addCase(retryFailedNotificationsThunk.fulfilled, (state) => {
        state.sending = { status: 'succeeded', error: null };
      })
      .addCase(retryFailedNotificationsThunk.rejected, (state, action) => {
        state.sending = { status: 'failed', error: action.payload };
      });
  },
});

export const { clearAttendanceDetail, clearExamDetail, clearFeeDueDetail } = notificationsSlice.actions;
export default notificationsSlice.reducer;
