import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api } from '../../services/api';

export const fetchSchoolHolidaysThunk = createAsyncThunk(
  'schoolHolidays/fetchAll',
  async ({ search, from, to, isActive } = {}, { rejectWithValue }) => {
    try {
      const params = {};
      if (search !== undefined && search !== null && String(search).trim() !== '') params.search = String(search).trim();
      if (from) params.from = from;
      if (to) params.to = to;
      if (isActive !== undefined && isActive !== null && String(isActive).trim() !== '') params.isActive = isActive;

      const res = await api.get('/school-holidays', { params });
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to fetch holidays');
      return res.data.data?.holidays ?? [];
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to fetch holidays');
    }
  }
);

export const createSchoolHolidayThunk = createAsyncThunk(
  'schoolHolidays/create',
  async (payload, { rejectWithValue }) => {
    try {
      const res = await api.post('/school-holidays', payload);
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to create holiday');
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to create holiday');
    }
  }
);

export const updateSchoolHolidayThunk = createAsyncThunk(
  'schoolHolidays/update',
  async ({ id, payload }, { rejectWithValue }) => {
    try {
      const res = await api.put(`/school-holidays/${id}`, payload);
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to update holiday');
      return { id, data: res.data.data };
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to update holiday');
    }
  }
);

export const deleteSchoolHolidayThunk = createAsyncThunk(
  'schoolHolidays/delete',
  async (id, { rejectWithValue }) => {
    try {
      const res = await api.delete(`/school-holidays/${id}`);
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to delete holiday');
      return { id };
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to delete holiday');
    }
  }
);

const initialState = {
  items: [],
  status: 'idle',
  error: null,
};

const schoolHolidaysSlice = createSlice({
  name: 'schoolHolidays',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSchoolHolidaysThunk.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchSchoolHolidaysThunk.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchSchoolHolidaysThunk.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'Failed to load holidays';
      })
      .addCase(createSchoolHolidayThunk.fulfilled, (state) => {
        state.status = 'idle';
      })
      .addCase(updateSchoolHolidayThunk.fulfilled, (state) => {
        state.status = 'idle';
      })
      .addCase(deleteSchoolHolidayThunk.fulfilled, (state) => {
        state.status = 'idle';
      });
  },
});

export default schoolHolidaysSlice.reducer;
