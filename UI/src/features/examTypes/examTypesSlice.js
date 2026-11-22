import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api } from '../../services/api';

export const fetchExamTypesThunk = createAsyncThunk(
  'examTypes/fetchAll',
  async ({ search = '' } = {}, { rejectWithValue }) => {
    try {
      const res = await api.get('/exam-types', { params: { search: search || null } });
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to fetch exam types');
      return res.data.data?.exam_types ?? [];
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to fetch exam types');
    }
  }
);

export const createExamTypeThunk = createAsyncThunk(
  'examTypes/create',
  async ({ name }, { rejectWithValue }) => {
    try {
      const res = await api.post('/exam-types', { name });
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to create exam type');
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to create exam type');
    }
  }
);

export const updateExamTypeThunk = createAsyncThunk(
  'examTypes/update',
  async ({ examTypeId, payload }, { rejectWithValue }) => {
    try {
      const res = await api.put(`/exam-types/${examTypeId}`, payload);
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to update exam type');
      return { examTypeId, data: res.data.data };
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to update exam type');
    }
  }
);

export const deleteExamTypeThunk = createAsyncThunk(
  'examTypes/delete',
  async (examTypeId, { rejectWithValue }) => {
    try {
      const res = await api.delete(`/exam-types/${examTypeId}`);
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to delete exam type');
      return { examTypeId };
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to delete exam type');
    }
  }
);

export const reorderExamTypesThunk = createAsyncThunk(
  'examTypes/reorder',
  async ({ orderedIds }, { rejectWithValue }) => {
    try {
      const res = await api.put('/exam-types/reorder', { ordered_ids: orderedIds });
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to reorder exam types');
      return { orderedIds };
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to reorder exam types');
    }
  }
);

const initialState = {
  items: [],
  status: 'idle',
  error: null,
};

const examTypesSlice = createSlice({
  name: 'examTypes',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchExamTypesThunk.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchExamTypesThunk.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchExamTypesThunk.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'Failed to fetch exam types';
      })
      .addCase(createExamTypeThunk.fulfilled, (state, action) => {
        if (action.payload?.id) {
          const systemItems = state.items.filter((t) => t.is_system);
          const nonSystemItems = state.items.filter((t) => !t.is_system);
          nonSystemItems.push({
            id: action.payload.id,
            name: action.payload.name,
            is_system: false,
          });
          state.items = [...nonSystemItems, ...systemItems];
        }
      })
      .addCase(updateExamTypeThunk.fulfilled, (state, action) => {
        const idx = state.items.findIndex((t) => t.id === action.payload.examTypeId);
        if (idx >= 0) {
          state.items[idx] = { ...state.items[idx], ...(action.payload.data ?? {}) };
        }
      })
      .addCase(deleteExamTypeThunk.fulfilled, (state, action) => {
        state.items = state.items.filter((t) => t.id !== action.payload.examTypeId);
      })
      .addCase(reorderExamTypesThunk.fulfilled, (state, action) => {
        const systemItems = state.items.filter((t) => t.is_system);
        const byId = new Map(state.items.map((t) => [t.id, t]));
        const nonSystemItems = action.payload.orderedIds.map((id) => byId.get(id)).filter(Boolean);
        state.items = [...nonSystemItems, ...systemItems];
      });
  },
});

export default examTypesSlice.reducer;
