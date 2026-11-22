import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api } from '../../services/api';

export const fetchSubjectsThunk = createAsyncThunk(
  'subjects/fetchAll',
  async ({ search = '' } = {}, { rejectWithValue }) => {
    try {
      const res = await api.get('/subjects', { params: { search: search || null } });
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to fetch subjects');
      return res.data.data?.subjects ?? [];
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to fetch subjects');
    }
  }
);

export const createSubjectThunk = createAsyncThunk(
  'subjects/create',
  async ({ name, code = null, description = null }, { rejectWithValue }) => {
    try {
      const res = await api.post('/subjects', { name, code, description });
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to create subject');
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to create subject');
    }
  }
);

export const updateSubjectThunk = createAsyncThunk(
  'subjects/update',
  async ({ subjectId, payload }, { rejectWithValue }) => {
    try {
      const res = await api.put(`/subjects/${subjectId}`, payload);
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to update subject');
      return { subjectId, data: res.data.data };
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to update subject');
    }
  }
);

export const deleteSubjectThunk = createAsyncThunk(
  'subjects/delete',
  async (subjectId, { rejectWithValue }) => {
    try {
      const res = await api.delete(`/subjects/${subjectId}`);
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to delete subject');
      return { subjectId };
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to delete subject');
    }
  }
);

export const reorderSubjectsThunk = createAsyncThunk(
  'subjects/reorder',
  async ({ orderedIds }, { rejectWithValue }) => {
    try {
      const res = await api.put('/subjects/reorder', { ordered_ids: orderedIds });
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to reorder subjects');
      return { orderedIds };
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to reorder subjects');
    }
  }
);

const initialState = {
  items: [],
  status: 'idle',
  error: null,
};

const subjectsSlice = createSlice({
  name: 'subjects',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSubjectsThunk.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchSubjectsThunk.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchSubjectsThunk.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'Failed to fetch subjects';
      })
      .addCase(createSubjectThunk.fulfilled, (state, action) => {
        if (action.payload?.id) {
          state.items.push({
            id: action.payload.id,
            name: action.payload.name,
            code: action.payload.code ?? null,
            is_active: true,
          });
        }
      })
      .addCase(updateSubjectThunk.fulfilled, (state, action) => {
        const idx = state.items.findIndex((s) => s.id === action.payload.subjectId);
        if (idx >= 0) {
          state.items[idx] = { ...state.items[idx], ...(action.payload.data ?? {}) };
        }
      })
      .addCase(deleteSubjectThunk.fulfilled, (state, action) => {
        state.items = state.items.filter((s) => s.id !== action.payload.subjectId);
      })
      .addCase(reorderSubjectsThunk.fulfilled, (state, action) => {
        const byId = new Map(state.items.map((s) => [s.id, s]));
        state.items = action.payload.orderedIds.map((id) => byId.get(id)).filter(Boolean);
      });
  },
});

export default subjectsSlice.reducer;

