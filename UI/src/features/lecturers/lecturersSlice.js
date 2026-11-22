import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api } from '../../services/api';

export const fetchLecturersThunk = createAsyncThunk(
  'lecturers/fetchList',
  async ({ page = 1, limit = 10, search = '' } = {}, { rejectWithValue }) => {
    try {
      const res = await api.get('/lecturers', { params: { page, limit, search } });
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to fetch lecturers');
      return res.data.data; // { total,page,limit,lecturers }
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to fetch lecturers');
    }
  }
);

export const createLecturerThunk = createAsyncThunk(
  'lecturers/create',
  async (payload, { rejectWithValue }) => {
    try {
      const res = await api.post('/lecturers', payload);
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to create lecturer');
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to create lecturer');
    }
  }
);

export const deleteLecturerThunk = createAsyncThunk(
  'lecturers/delete',
  async (lecturerId, { rejectWithValue }) => {
    try {
      const res = await api.delete(`/lecturers/${lecturerId}`);
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to delete lecturer');
      return { lecturerId };
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to delete lecturer');
    }
  }
);

export const updateLecturerThunk = createAsyncThunk(
  'lecturers/update',
  async ({ lecturerId, payload }, { rejectWithValue }) => {
    try {
      const res = await api.put(`/lecturers/${lecturerId}`, payload);
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to update lecturer');
      return { lecturerId, data: res.data.data };
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to update lecturer');
    }
  }
);

export const resetLecturerPasswordThunk = createAsyncThunk(
  'lecturers/resetPassword',
  async (lecturerId, { rejectWithValue }) => {
    try {
      const res = await api.post(`/lecturers/${lecturerId}/reset-password`);
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to reset password');
      return { lecturerId, temporary_password: res.data.data?.temporary_password };
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to reset password');
    }
  }
);

const initialState = {
  items: [],
  total: 0,
  page: 1,
  limit: 10,
  status: 'idle',
  error: null,
};

const lecturersSlice = createSlice({
  name: 'lecturers',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchLecturersThunk.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchLecturersThunk.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.total = action.payload.total ?? 0;
        state.page = action.payload.page ?? 1;
        state.limit = action.payload.limit ?? 10;
        state.items = action.payload.lecturers ?? [];
      })
      .addCase(fetchLecturersThunk.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'Failed to fetch lecturers';
      })
      .addCase(deleteLecturerThunk.fulfilled, (state, action) => {
        state.items = state.items.filter((x) => x.id !== action.payload.lecturerId);
        state.total = Math.max(0, state.total - 1);
      })
      .addCase(updateLecturerThunk.fulfilled, (state, action) => {
        // We refetch after update, but also patch in-place for snappy UI.
        const idx = state.items.findIndex((x) => x.id === action.payload.lecturerId);
        if (idx >= 0) {
          state.items[idx] = { ...state.items[idx], ...(action.payload.data ?? {}) };
        }
      });
  },
});

export default lecturersSlice.reducer;

