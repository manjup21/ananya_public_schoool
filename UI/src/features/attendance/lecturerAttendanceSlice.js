import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api } from '../../services/api';

function dayContextRejectPayload(resBody, err) {
  const d = resBody ?? err?.response?.data;
  const holiday =
    d?.data?.is_institution_holiday === true ? { names: d?.data?.holiday_names ?? null } : null;
  return {
    message: d?.message || err?.message || 'Failed to load attendance pattern',
    holiday,
  };
}

export const fetchAttendanceDayContextThunk = createAsyncThunk(
  'lecturerAttendance/fetchDayContext',
  async ({ classId, sectionId, date }, { rejectWithValue }) => {
    try {
      const params = { classId, date };
      if (sectionId) params.sectionId = sectionId;
      const res = await api.get('/attendance/day-context', { params });
      if (!res.data?.success) return rejectWithValue(dayContextRejectPayload(res.data, null));
      return res.data.data ?? null;
    } catch (err) {
      return rejectWithValue(dayContextRejectPayload(null, err));
    }
  }
);

export const fetchAttendanceRosterThunk = createAsyncThunk(
  'lecturerAttendance/fetchRoster',
  async ({ classId, sectionId, date, slotIndex, search }, { rejectWithValue }) => {
    try {
      const params = { classId, date, slotIndex };
      if (sectionId) params.sectionId = sectionId;
      if (search) params.search = search;
      const res = await api.get('/attendance/roster', { params });
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to load roster');
      const d = res.data.data ?? {};
      return {
        students: d.students ?? [],
        is_slot_cancelled: d.is_slot_cancelled === true,
        cancelled_reason: d.cancelled_reason ?? null,
      };
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to load roster');
    }
  }
);

export const bulkMarkAbsentThunk = createAsyncThunk(
  'lecturerAttendance/bulkMarkAbsent',
  async ({ studentIds, absentDate, slotIndex, reason, classId, sectionId }, { rejectWithValue }) => {
    try {
      const body = {
        student_ids: studentIds,
        absent_date: absentDate,
        slot_index: slotIndex,
        class_id: classId,
        reason: reason ?? null,
      };
      if (sectionId) body.section_id = sectionId;
      const res = await api.post('/attendance/absences/bulk', body);
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to mark absences');
      return res.data.data ?? null;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to mark absences');
    }
  }
);

export const bulkUnmarkAbsentThunk = createAsyncThunk(
  'lecturerAttendance/bulkUnmarkAbsent',
  async ({ studentIds, absentDate, slotIndex, classId, sectionId }, { rejectWithValue }) => {
    try {
      const body = {
        student_ids: studentIds,
        absent_date: absentDate,
        slot_index: slotIndex,
        class_id: classId,
      };
      if (sectionId) body.section_id = sectionId;
      const res = await api.post('/attendance/absences/bulk-unmark', body);
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to remove absences');
      return res.data.data ?? null;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to remove absences');
    }
  }
);

export const cancelSlotThunk = createAsyncThunk(
  'lecturerAttendance/cancelSlot',
  async ({ date, slotIndex, classId, sectionId, reason }, { rejectWithValue }) => {
    try {
      const body = { date, slot_index: slotIndex, class_id: classId, reason: reason ?? null };
      if (sectionId) body.section_id = sectionId;
      const res = await api.post('/attendance/cancel-slot', body);
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to cancel slot');
      return { reason: reason ?? null };
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to cancel slot');
    }
  }
);

export const uncancelSlotThunk = createAsyncThunk(
  'lecturerAttendance/uncancelSlot',
  async ({ date, slotIndex, classId, sectionId }, { rejectWithValue }) => {
    try {
      const body = { date, slot_index: slotIndex, class_id: classId };
      if (sectionId) body.section_id = sectionId;
      const res = await api.post('/attendance/uncancel-slot', body);
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to restore slot');
      return null;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to restore slot');
    }
  }
);

const initialState = {
  dayContext: null,
  dayContextStatus: 'idle',
  dayContextError: null,
  dayContextHoliday: null,
  roster: [],
  rosterStatus: 'idle',
  rosterError: null,
  bulkStatus: 'idle',
  bulkError: null,
  isSlotCancelled: false,
  cancelledSlotReason: null,
  cancelSlotStatus: 'idle',
};

const lecturerAttendanceSlice = createSlice({
  name: 'lecturerAttendance',
  initialState,
  reducers: {
    clearLecturerAttendance(state) {
      state.dayContext = null;
      state.dayContextStatus = 'idle';
      state.dayContextError = null;
      state.dayContextHoliday = null;
      state.roster = [];
      state.rosterStatus = 'idle';
      state.rosterError = null;
      state.bulkStatus = 'idle';
      state.bulkError = null;
      state.isSlotCancelled = false;
      state.cancelledSlotReason = null;
      state.cancelSlotStatus = 'idle';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAttendanceDayContextThunk.pending, (state) => {
        state.dayContextStatus = 'loading';
        state.dayContextError = null;
        state.dayContextHoliday = null;
      })
      .addCase(fetchAttendanceDayContextThunk.fulfilled, (state, action) => {
        state.dayContextStatus = 'succeeded';
        state.dayContext = action.payload;
        state.dayContextHoliday = null;
        state.dayContextError = null;
      })
      .addCase(fetchAttendanceDayContextThunk.rejected, (state, action) => {
        state.dayContextStatus = 'failed';
        const p = action.payload;
        if (p && typeof p === 'object' && 'message' in p) {
          state.dayContextError = String(p.message || 'Failed to load pattern');
          state.dayContextHoliday = p.holiday ?? null;
        } else {
          state.dayContextError = typeof p === 'string' ? p : String(p || 'Failed to load pattern');
          state.dayContextHoliday = null;
        }
        state.dayContext = null;
      })
      .addCase(fetchAttendanceRosterThunk.pending, (state) => {
        state.rosterStatus = 'loading';
        state.rosterError = null;
      })
      .addCase(fetchAttendanceRosterThunk.fulfilled, (state, action) => {
        state.rosterStatus = 'succeeded';
        state.roster = action.payload.students;
        state.isSlotCancelled = action.payload.is_slot_cancelled;
        state.cancelledSlotReason = action.payload.cancelled_reason;
      })
      .addCase(fetchAttendanceRosterThunk.rejected, (state, action) => {
        state.rosterStatus = 'failed';
        state.rosterError = action.payload || 'Failed to load roster';
        state.roster = [];
        state.isSlotCancelled = false;
        state.cancelledSlotReason = null;
      })
      .addCase(bulkMarkAbsentThunk.pending, (state) => {
        state.bulkStatus = 'loading';
        state.bulkError = null;
      })
      .addCase(bulkMarkAbsentThunk.fulfilled, (state) => {
        state.bulkStatus = 'succeeded';
      })
      .addCase(bulkMarkAbsentThunk.rejected, (state, action) => {
        state.bulkStatus = 'failed';
        state.bulkError = action.payload || 'Bulk mark failed';
      })
      .addCase(bulkUnmarkAbsentThunk.pending, (state) => {
        state.bulkStatus = 'loading';
        state.bulkError = null;
      })
      .addCase(bulkUnmarkAbsentThunk.fulfilled, (state) => {
        state.bulkStatus = 'succeeded';
      })
      .addCase(bulkUnmarkAbsentThunk.rejected, (state, action) => {
        state.bulkStatus = 'failed';
        state.bulkError = action.payload || 'Bulk unmark failed';
      })
      .addCase(cancelSlotThunk.pending, (state) => {
        state.cancelSlotStatus = 'loading';
      })
      .addCase(cancelSlotThunk.fulfilled, (state, action) => {
        state.cancelSlotStatus = 'succeeded';
        state.isSlotCancelled = true;
        state.cancelledSlotReason = action.payload?.reason ?? null;
      })
      .addCase(cancelSlotThunk.rejected, (state) => {
        state.cancelSlotStatus = 'idle';
      })
      .addCase(uncancelSlotThunk.pending, (state) => {
        state.cancelSlotStatus = 'loading';
      })
      .addCase(uncancelSlotThunk.fulfilled, (state) => {
        state.cancelSlotStatus = 'succeeded';
        state.isSlotCancelled = false;
        state.cancelledSlotReason = null;
      })
      .addCase(uncancelSlotThunk.rejected, (state) => {
        state.cancelSlotStatus = 'idle';
      });
  },
});

export const { clearLecturerAttendance } = lecturerAttendanceSlice.actions;
export default lecturerAttendanceSlice.reducer;
