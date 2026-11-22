import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api } from '../../services/api';
import { encryptPassword } from '../../utils/encryption';

export const fetchLecturerProfileThunk = createAsyncThunk(
  'lecturerAccount/fetchProfile',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get('/lecturer/account/profile');
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to load profile');
      return res.data.data ?? null;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message || 'Failed to load profile');
    }
  }
);

export const changePasswordThunk = createAsyncThunk(
  'lecturerAccount/changePassword',
  async ({ currentPassword, newPassword }, { rejectWithValue }) => {
    try {
      const encryptedCurrentPassword = await encryptPassword(currentPassword);
      const encryptedNewPassword = await encryptPassword(newPassword);
      const res = await api.post('/auth/change-password', {
        encryptedCurrentPassword,
        encryptedNewPassword,
      });
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Could not change password');
      return true;
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'Could not change password';
      return rejectWithValue(msg);
    }
  }
);

const lecturerAccountSlice = createSlice({
  name: 'lecturerAccount',
  initialState: {
    profile: null,
    profileStatus: 'idle',
    profileError: null,
    changePasswordStatus: 'idle',
  },
  reducers: {
    resetChangePasswordStatus: (state) => {
      state.changePasswordStatus = 'idle';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchLecturerProfileThunk.pending, (state) => {
        state.profileStatus = 'loading';
        state.profileError = null;
      })
      .addCase(fetchLecturerProfileThunk.fulfilled, (state, action) => {
        state.profileStatus = 'succeeded';
        state.profile = action.payload;
      })
      .addCase(fetchLecturerProfileThunk.rejected, (state, action) => {
        state.profileStatus = 'failed';
        state.profileError = action.payload ?? action.error?.message ?? 'Failed to load profile';
      })
      .addCase(changePasswordThunk.pending, (state) => {
        state.changePasswordStatus = 'loading';
      })
      .addCase(changePasswordThunk.fulfilled, (state) => {
        state.changePasswordStatus = 'succeeded';
      })
      .addCase(changePasswordThunk.rejected, (state) => {
        state.changePasswordStatus = 'failed';
      });
  },
});

export const { resetChangePasswordStatus } = lecturerAccountSlice.actions;
export default lecturerAccountSlice.reducer;
