import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api } from '../../services/api';

export const fetchAttendancePatternsThunk = createAsyncThunk(
  'attendancePatterns/fetchAll',
  async ({ search, scope, classId, sectionId, isActive } = {}, { rejectWithValue }) => {
    try {
      const params = {};
      if (search !== undefined && search !== null && String(search).trim() !== '') params.search = String(search).trim();
      if (scope && scope !== 'all') params.scope = scope;
      if (classId && classId !== 'all') params.classId = classId;
      if (sectionId && sectionId !== 'all') params.sectionId = sectionId;
      if (isActive !== undefined && isActive !== null && String(isActive).trim() !== '') params.isActive = isActive;

      const res = await api.get('/attendance-patterns', { params });
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to fetch attendance patterns');
      return res.data.data?.patterns ?? [];
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to fetch attendance patterns');
    }
  }
);

export const createAttendancePatternThunk = createAsyncThunk(
  'attendancePatterns/create',
  async (payload, { rejectWithValue }) => {
    try {
      const res = await api.post('/attendance-patterns', payload);
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to create attendance pattern');
      return res.data.data; // {id}
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to create attendance pattern');
    }
  }
);

export const updateAttendancePatternThunk = createAsyncThunk(
  'attendancePatterns/update',
  async ({ patternId, payload }, { rejectWithValue }) => {
    try {
      const res = await api.put(`/attendance-patterns/${patternId}`, payload);
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to update attendance pattern');
      return { patternId, data: res.data.data };
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to update attendance pattern');
    }
  }
);

export const versionAttendancePatternThunk = createAsyncThunk(
  'attendancePatterns/version',
  async ({ patternId, payload }, { rejectWithValue }) => {
    try {
      const res = await api.post(`/attendance-patterns/${patternId}/version`, payload);
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to version attendance pattern');
      return { patternId, data: res.data.data };
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to version attendance pattern');
    }
  }
);

export const deleteAttendancePatternThunk = createAsyncThunk(
  'attendancePatterns/delete',
  async (patternId, { rejectWithValue }) => {
    try {
      const res = await api.delete(`/attendance-patterns/${patternId}`);
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to delete attendance pattern');
      return {
        patternId,
        batchId: res.data?.data?.batch_id ?? res.data?.data?.batchId ?? null,
      };
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to delete attendance pattern');
    }
  }
);

export const fetchAttendancePatternByIdThunk = createAsyncThunk(
  'attendancePatterns/fetchById',
  async (patternId, { rejectWithValue }) => {
    try {
      const res = await api.get(`/attendance-patterns/${patternId}`);
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to fetch attendance pattern');
      return res.data.data ?? null;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to fetch attendance pattern');
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

const attendancePatternsSlice = createSlice({
  name: 'attendancePatterns',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAttendancePatternsThunk.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchAttendancePatternsThunk.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchAttendancePatternsThunk.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'Failed to fetch attendance patterns';
      })
      .addCase(fetchAttendancePatternByIdThunk.pending, (state) => {
        state.selectedStatus = 'loading';
        state.selectedError = null;
      })
      .addCase(fetchAttendancePatternByIdThunk.fulfilled, (state, action) => {
        state.selectedStatus = 'succeeded';
        state.selected = action.payload;
      })
      .addCase(fetchAttendancePatternByIdThunk.rejected, (state, action) => {
        state.selectedStatus = 'failed';
        state.selectedError = action.payload || 'Failed to fetch attendance pattern';
      })
      .addCase(createAttendancePatternThunk.fulfilled, (state) => {
        state.status = 'idle';
      })
      .addCase(updateAttendancePatternThunk.fulfilled, (state) => {
        state.status = 'idle';
      })
      .addCase(versionAttendancePatternThunk.fulfilled, (state) => {
        state.status = 'idle';
      })
      .addCase(deleteAttendancePatternThunk.fulfilled, (state, action) => {
        const { patternId, batchId } = action.payload;
        if (batchId) {
          state.items = state.items.filter((p) => (p.batch_id ?? p.batchId) !== batchId);
        } else {
          state.items = state.items.filter((p) => p.id !== patternId);
        }
      });
  },
});

export default attendancePatternsSlice.reducer;

