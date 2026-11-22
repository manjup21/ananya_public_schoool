import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api } from '../../services/api';

export const fetchStudentFeesThunk = createAsyncThunk(
  'fees/fetchStudentFees',
  async ({ academicYear, search, classId, sectionId, page, limit } = {}, { rejectWithValue }) => {
    try {
      const params = { academic_year: academicYear };
      if (search?.trim()) params.search = search.trim();
      if (classId) params.class_id = classId;
      if (sectionId) params.section_id = sectionId;
      if (page) params.page = page;
      if (limit) params.limit = limit;
      const res = await api.get('/fees/students', { params });
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to fetch fees');
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to fetch fees');
    }
  }
);

export const fetchStudentFeeDetailThunk = createAsyncThunk(
  'fees/fetchStudentFeeDetail',
  async ({ studentId, academicYear }, { rejectWithValue }) => {
    try {
      const params = {};
      if (academicYear) params.academic_year = academicYear;
      const res = await api.get(`/fees/students/${studentId}`, { params });
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to fetch fee detail');
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to fetch fee detail');
    }
  }
);

export const assignFeeThunk = createAsyncThunk(
  'fees/assignFee',
  async (payload, { rejectWithValue }) => {
    try {
      const res = await api.post('/fees/assign', payload);
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to assign fee');
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to assign fee');
    }
  }
);

export const bulkAssignFeeThunk = createAsyncThunk(
  'fees/bulkAssignFee',
  async (payload, { rejectWithValue }) => {
    try {
      const res = await api.post('/fees/bulk-assign', payload);
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to bulk assign fees');
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to bulk assign fees');
    }
  }
);

export const recordPaymentThunk = createAsyncThunk(
  'fees/recordPayment',
  async (payload, { rejectWithValue }) => {
    try {
      const res = await api.post('/fees/payments', payload);
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to record payment');
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to record payment');
    }
  }
);

export const deletePaymentThunk = createAsyncThunk(
  'fees/deletePayment',
  async (paymentId, { rejectWithValue }) => {
    try {
      const res = await api.delete(`/fees/payments/${paymentId}`);
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to delete payment');
      return { paymentId, ...res.data.data };
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to delete payment');
    }
  }
);

export const deleteFeeItemThunk = createAsyncThunk(
  'fees/deleteFeeItem',
  async (itemId, { rejectWithValue }) => {
    try {
      const res = await api.delete(`/fees/items/${itemId}`);
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to delete fee type');
      return { itemId, ...res.data.data };
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to delete fee type');
    }
  }
);

export const fetchFeeDashboardThunk = createAsyncThunk(
  'fees/fetchDashboard',
  async ({ academicYear, classId, sectionId } = {}, { rejectWithValue }) => {
    try {
      const params = {};
      if (academicYear) params.academic_year = academicYear;
      if (classId) params.class_id = classId;
      if (sectionId) params.section_id = sectionId;
      const res = await api.get('/fees/dashboard', { params });
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to fetch dashboard');
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to fetch dashboard');
    }
  }
);

const initialState = {
  list: { students: [], total: 0, page: 1, limit: 25, academic_year: '' },
  listStatus: 'idle',
  listError: null,

  detail: null,
  detailStatus: 'idle',
  detailError: null,

  dashboard: null,
  dashboardStatus: 'idle',
  dashboardError: null,
};

const feesSlice = createSlice({
  name: 'fees',
  initialState,
  reducers: {
    clearDetail(state) {
      state.detail = null;
      state.detailStatus = 'idle';
      state.detailError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchStudentFeesThunk.pending, (state) => {
        state.listStatus = 'loading';
        state.listError = null;
      })
      .addCase(fetchStudentFeesThunk.fulfilled, (state, action) => {
        state.listStatus = 'succeeded';
        state.list = action.payload;
      })
      .addCase(fetchStudentFeesThunk.rejected, (state, action) => {
        state.listStatus = 'failed';
        state.listError = action.payload || 'Failed to fetch fees';
      })

      .addCase(fetchStudentFeeDetailThunk.pending, (state) => {
        state.detailStatus = 'loading';
        state.detailError = null;
      })
      .addCase(fetchStudentFeeDetailThunk.fulfilled, (state, action) => {
        state.detailStatus = 'succeeded';
        state.detail = action.payload;
      })
      .addCase(fetchStudentFeeDetailThunk.rejected, (state, action) => {
        state.detailStatus = 'failed';
        state.detailError = action.payload || 'Failed to fetch fee detail';
      })

      .addCase(fetchFeeDashboardThunk.pending, (state) => {
        state.dashboardStatus = 'loading';
        state.dashboardError = null;
      })
      .addCase(fetchFeeDashboardThunk.fulfilled, (state, action) => {
        state.dashboardStatus = 'succeeded';
        state.dashboard = action.payload;
      })
      .addCase(fetchFeeDashboardThunk.rejected, (state, action) => {
        state.dashboardStatus = 'failed';
        state.dashboardError = action.payload || 'Failed to fetch dashboard';
      });
  },
});

export const { clearDetail } = feesSlice.actions;
export default feesSlice.reducer;
