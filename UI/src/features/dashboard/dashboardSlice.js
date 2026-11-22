import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api } from '../../services/api';

export const fetchAdminDashboardThunk = createAsyncThunk(
  'dashboard/fetchAdmin',
  async ({ from, to }, { rejectWithValue }) => {
    try {
      const res = await api.get('/dashboard/admin', { params: { from, to } });
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to load admin dashboard');
      return res.data.data ?? null;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to load admin dashboard');
    }
  }
);

export const fetchLecturerDashboardThunk = createAsyncThunk(
  'dashboard/fetchLecturer',
  async ({ from, to }, { rejectWithValue }) => {
    try {
      const res = await api.get('/dashboard/lecturer', { params: { from, to } });
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to load lecturer dashboard');
      return res.data.data ?? null;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to load lecturer dashboard');
    }
  }
);

const initialState = {
  admin: null,
  adminStatus: 'idle',
  adminError: null,
  lecturer: null,
  lecturerStatus: 'idle',
  lecturerError: null,
};

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdminDashboardThunk.pending, (state) => {
        state.adminStatus = 'loading';
        state.adminError = null;
      })
      .addCase(fetchAdminDashboardThunk.fulfilled, (state, action) => {
        state.adminStatus = 'succeeded';
        state.admin = action.payload;
      })
      .addCase(fetchAdminDashboardThunk.rejected, (state, action) => {
        state.adminStatus = 'failed';
        state.adminError = action.payload || 'Failed to load admin dashboard';
        state.admin = null;
      })
      .addCase(fetchLecturerDashboardThunk.pending, (state) => {
        state.lecturerStatus = 'loading';
        state.lecturerError = null;
      })
      .addCase(fetchLecturerDashboardThunk.fulfilled, (state, action) => {
        state.lecturerStatus = 'succeeded';
        state.lecturer = action.payload;
      })
      .addCase(fetchLecturerDashboardThunk.rejected, (state, action) => {
        state.lecturerStatus = 'failed';
        state.lecturerError = action.payload || 'Failed to load lecturer dashboard';
        state.lecturer = null;
      });
  },
});

export default dashboardSlice.reducer;

