import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api } from '../../services/api';

export const fetchExaminationsThunk = createAsyncThunk(
  'examinations/fetchAll',
  async ({ search, classId, sectionId, status, examTypeId } = {}, { rejectWithValue }) => {
    try {
      const params = {};
      if (search !== undefined && search !== null && String(search).trim() !== '') params.search = String(search).trim();
      if (classId) params.classId = classId;
      if (sectionId) params.sectionId = sectionId;
      if (status) params.status = status;
      if (examTypeId && examTypeId !== 'all') params.examTypeId = examTypeId;
      const res = await api.get('/examinations', { params });
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to fetch examinations');
      return res.data.data?.examinations ?? [];
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to fetch examinations');
    }
  }
);

export const createExaminationThunk = createAsyncThunk(
  'examinations/create',
  async (payload, { rejectWithValue }) => {
    try {
      const res = await api.post('/examinations', payload);
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to create examination');
      return res.data.data; // {id}
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to create examination');
    }
  }
);

export const fetchExaminationByIdThunk = createAsyncThunk(
  'examinations/fetchById',
  async (examId, { rejectWithValue }) => {
    try {
      const res = await api.get(`/examinations/${examId}`);
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to fetch examination');
      return res.data.data ?? null;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to fetch examination');
    }
  }
);

export const updateExaminationThunk = createAsyncThunk(
  'examinations/update',
  async ({ examId, payload }, { rejectWithValue }) => {
    try {
      const res = await api.put(`/examinations/${examId}`, payload);
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to update examination');
      return { examId, data: res.data.data };
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to update examination');
    }
  }
);

export const cancelExaminationThunk = createAsyncThunk(
  'examinations/cancel',
  async (examId, { rejectWithValue }) => {
    try {
      const res = await api.post(`/examinations/${examId}/cancel`);
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to cancel examination');
      return { examId };
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to cancel examination');
    }
  }
);

/** Staff marks Excel template: { exam, students } */
export const fetchExamMarksTemplateThunk = createAsyncThunk(
  'examinations/fetchMarksTemplate',
  async (examId, { rejectWithValue }) => {
    try {
      const res = await api.get(`/examinations/${examId}/marks-template`);
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to load template data');
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to load template data');
    }
  }
);

/** Hall ticket roster: { exam, students } — max 120 */
export const fetchHallTicketRosterThunk = createAsyncThunk(
  'examinations/fetchHallTicketRoster',
  async (examId, { rejectWithValue }) => {
    try {
      const res = await api.get(`/examinations/${examId}/hall-tickets`);
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to load hall ticket data');
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to load hall ticket data');
    }
  }
);

const initialState = {
  items: [],
  status: 'idle',
  error: null,
  selected: null,
  selectedStatus: 'idle',
  selectedError: null,
};

const examinationsSlice = createSlice({
  name: 'examinations',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchExaminationsThunk.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchExaminationsThunk.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchExaminationsThunk.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'Failed to fetch examinations';
      })
      .addCase(fetchExaminationByIdThunk.pending, (state) => {
        state.selectedStatus = 'loading';
        state.selectedError = null;
      })
      .addCase(fetchExaminationByIdThunk.fulfilled, (state, action) => {
        state.selectedStatus = 'succeeded';
        state.selected = action.payload;
      })
      .addCase(fetchExaminationByIdThunk.rejected, (state, action) => {
        state.selectedStatus = 'failed';
        state.selectedError = action.payload || 'Failed to fetch examination';
      })
      .addCase(cancelExaminationThunk.fulfilled, (state, action) => {
        const idx = state.items.findIndex((e) => e.id === action.payload.examId);
        if (idx >= 0) state.items[idx] = { ...state.items[idx], exam_status: 'cancelled' };
        if (state.selected?.id === action.payload.examId) state.selected = { ...state.selected, exam_status: 'cancelled' };
      });
  },
});

export default examinationsSlice.reducer;

