import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api } from '../../services/api';

export const fetchClassesThunk = createAsyncThunk(
  'classes/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get('/classes');
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to fetch classes');
      return res.data.data?.classes ?? [];
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to fetch classes');
    }
  }
);

export const createClassThunk = createAsyncThunk(
  'classes/create',
  async (name, { rejectWithValue }) => {
    try {
      const res = await api.post('/classes', { name });
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to create class');
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to create class');
    }
  }
);

export const updateClassThunk = createAsyncThunk(
  'classes/update',
  async ({ classId, name }, { rejectWithValue }) => {
    try {
      const res = await api.put(`/classes/${classId}`, { name });
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to update class');
      return { classId, data: res.data.data };
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to update class');
    }
  }
);

export const deleteClassThunk = createAsyncThunk(
  'classes/delete',
  async (classId, { rejectWithValue }) => {
    try {
      const res = await api.delete(`/classes/${classId}`);
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to delete class');
      return { classId };
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to delete class');
    }
  }
);

export const createSectionThunk = createAsyncThunk(
  'classes/createSection',
  async ({ classId, section_code }, { rejectWithValue }) => {
    try {
      const res = await api.post(`/classes/${classId}/sections`, { section_code });
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to create section');
      return { classId, data: res.data.data };
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to create section');
    }
  }
);

export const updateSectionThunk = createAsyncThunk(
  'classes/updateSection',
  async ({ sectionId, section_code }, { rejectWithValue }) => {
    try {
      const res = await api.put(`/sections/${sectionId}`, { section_code });
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to update section');
      return { sectionId, data: res.data.data };
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to update section');
    }
  }
);

export const deleteSectionThunk = createAsyncThunk(
  'classes/deleteSection',
  async (sectionId, { rejectWithValue }) => {
    try {
      const res = await api.delete(`/sections/${sectionId}`);
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to delete section');
      return { sectionId };
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to delete section');
    }
  }
);

const initialState = {
  items: [],
  status: 'idle',
  error: null,
};

const classesSlice = createSlice({
  name: 'classes',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchClassesThunk.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchClassesThunk.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchClassesThunk.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'Failed to fetch classes';
      })
      .addCase(createClassThunk.fulfilled, (state, action) => {
        const d = action.payload;
        if (d?.id) {
          state.items.push({ id: d.id, name: d.name, sections: [] });
        }
      })
      .addCase(deleteClassThunk.fulfilled, (state, action) => {
        state.items = state.items.filter((c) => c.id !== action.payload.classId);
      })
      .addCase(updateClassThunk.fulfilled, (state, action) => {
        const idx = state.items.findIndex((c) => c.id === action.payload.classId);
        if (idx >= 0 && action.payload.data) {
          state.items[idx] = {
            ...state.items[idx],
            name: action.payload.data.name ?? state.items[idx].name,
          };
        }
      })
      .addCase(createSectionThunk.fulfilled, (state, action) => {
        const { classId, data } = action.payload;
        const cls = state.items.find((c) => c.id === classId);
        if (cls && data?.id && data?.section) {
          cls.sections = [...(cls.sections || []), { id: data.id, section: data.section }];
        }
      })
      .addCase(updateSectionThunk.fulfilled, (state, action) => {
        const { sectionId, data } = action.payload;
        for (const c of state.items) {
          const idx = (c.sections || []).findIndex((s) => s.id === sectionId);
          if (idx >= 0 && data?.section) {
            c.sections[idx] = { ...c.sections[idx], section: data.section };
            break;
          }
        }
      })
      .addCase(deleteSectionThunk.fulfilled, (state, action) => {
        const sid = action.payload.sectionId;
        for (const c of state.items) {
          c.sections = (c.sections || []).filter((s) => s.id !== sid);
        }
      });
  },
});

export default classesSlice.reducer;
