import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api } from '../../services/api';

export const fetchExamResultsFullThunk = createAsyncThunk(
  'examResults/fetchFullForExam',
  async ({ examId, search, status } = {}, { rejectWithValue }) => {
    try {
      const params = {};
      if (search !== undefined && search !== null && String(search).trim() !== '') params.search = String(search).trim();
      if (status) params.status = status;
      const res = await api.get(`/examinations/${examId}/results/full`, { params });
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to fetch results');
      return res.data.data ?? null; // { exam, subjects, results }
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to fetch results');
    }
  }
);

export const bulkSaveExamResultsThunk = createAsyncThunk(
  'examResults/bulkSave',
  async ({ examId, rows }, { rejectWithValue }) => {
    try {
      const res = await api.post(`/examinations/${examId}/results/bulk-save`, { rows });
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to save results');
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to save results');
    }
  }
);

const initialState = {
  full: null,
  fullStatus: 'idle',
  fullError: null,
};

const examResultsSlice = createSlice({
  name: 'examResults',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchExamResultsFullThunk.pending, (state) => {
        state.fullStatus = 'loading';
        state.fullError = null;
      })
      .addCase(fetchExamResultsFullThunk.fulfilled, (state, action) => {
        state.fullStatus = 'succeeded';
        state.full = action.payload;
      })
      .addCase(fetchExamResultsFullThunk.rejected, (state, action) => {
        state.fullStatus = 'failed';
        state.fullError = action.payload || 'Failed to fetch results';
      });
  },
});

export default examResultsSlice.reducer;
