import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api } from '../../services/api';

export const fetchStudentsThunk = createAsyncThunk(
  'students/fetchAll',
  async ({ search, classId, sectionId } = {}, { rejectWithValue }) => {
    try {
      const params = {};
      if (search !== undefined && search !== null && String(search).trim() !== '') params.search = String(search).trim();
      if (classId) params.classId = classId;
      if (sectionId) params.sectionId = sectionId;
      const res = await api.get('/students', {
        params,
      });
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to fetch students');
      return res.data.data?.students ?? [];
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to fetch students');
    }
  }
);

export const createStudentThunk = createAsyncThunk(
  'students/create',
  async (payload, { rejectWithValue }) => {
    try {
      const res = await api.post('/students', payload);
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to create student');
      return res.data.data; // {id}
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to create student');
    }
  }
);

export const fetchStudentByIdThunk = createAsyncThunk(
  'students/fetchById',
  async (studentId, { rejectWithValue }) => {
    try {
      const res = await api.get(`/students/${studentId}`);
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to fetch student');
      return res.data.data ?? null;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to fetch student');
    }
  }
);

export const updateStudentThunk = createAsyncThunk(
  'students/update',
  async ({ studentId, payload }, { rejectWithValue }) => {
    try {
      const res = await api.put(`/students/${studentId}`, payload);
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to update student');
      return { studentId, data: res.data.data };
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to update student');
    }
  }
);

export const deleteStudentThunk = createAsyncThunk(
  'students/delete',
  async (studentId, { rejectWithValue }) => {
    try {
      const res = await api.delete(`/students/${studentId}`);
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to delete student');
      return { studentId };
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to delete student');
    }
  }
);

export const uploadStudentPhotoThunk = createAsyncThunk(
  'students/uploadPhoto',
  async ({ studentId, file }, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append('photo', file);
      const res = await api.post(`/students/${studentId}/photo`, formData);
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to upload photo');
      return { studentId, data: res.data.data };
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to upload photo');
    }
  }
);

export const deleteStudentPhotoThunk = createAsyncThunk(
  'students/deletePhoto',
  async (studentId, { rejectWithValue }) => {
    try {
      const res = await api.delete(`/students/${studentId}/photo`);
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to delete photo');
      return { studentId };
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to delete photo');
    }
  }
);

/** Fetch authenticated photo as an object URL (caller must revoke). */
export async function fetchStudentPhotoObjectUrl(studentId, basePath = '/students') {
  const res = await api.get(`${basePath}/${studentId}/photo`, { responseType: 'blob' });
  const contentType = String(res.headers?.['content-type'] || '');
  if (contentType.includes('application/json')) {
    throw new Error('Photo not found');
  }
  return URL.createObjectURL(res.data);
}

const initialState = {
  items: [],
  status: 'idle',
  error: null,
  selected: null,
  selectedStatus: 'idle',
  selectedError: null,
};

const studentsSlice = createSlice({
  name: 'students',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchStudentsThunk.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchStudentsThunk.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchStudentsThunk.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'Failed to fetch students';
      })
      .addCase(fetchStudentByIdThunk.pending, (state) => {
        state.selectedStatus = 'loading';
        state.selectedError = null;
      })
      .addCase(fetchStudentByIdThunk.fulfilled, (state, action) => {
        state.selectedStatus = 'succeeded';
        state.selected = action.payload;
      })
      .addCase(fetchStudentByIdThunk.rejected, (state, action) => {
        state.selectedStatus = 'failed';
        state.selectedError = action.payload || 'Failed to fetch student';
      })
      .addCase(updateStudentThunk.fulfilled, (state, action) => {
        const idx = state.items.findIndex((s) => s.id === action.payload.studentId);
        if (idx >= 0) {
          state.items[idx] = { ...state.items[idx] };
        }
        if (state.selected?.id === action.payload.studentId) {
          state.selected = { ...state.selected, ...(action.payload.data || {}) };
        }
      })
      .addCase(uploadStudentPhotoThunk.fulfilled, (state, action) => {
        const path = action.payload?.data?.photo_path ?? null;
        const idx = state.items.findIndex((s) => s.id === action.payload.studentId);
        if (idx >= 0) state.items[idx] = { ...state.items[idx], photo_path: path };
        if (state.selected?.id === action.payload.studentId) {
          state.selected = { ...state.selected, photo_path: path };
        }
      })
      .addCase(deleteStudentPhotoThunk.fulfilled, (state, action) => {
        const idx = state.items.findIndex((s) => s.id === action.payload.studentId);
        if (idx >= 0) state.items[idx] = { ...state.items[idx], photo_path: null };
        if (state.selected?.id === action.payload.studentId) {
          state.selected = { ...state.selected, photo_path: null };
        }
      })
      .addCase(deleteStudentThunk.fulfilled, (state, action) => {
        state.items = state.items.filter((s) => s.id !== action.payload.studentId);
      });
  },
});

export default studentsSlice.reducer;
