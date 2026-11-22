import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api, TOKEN_STORAGE_KEY } from '../../services/api';
import { encryptPassword } from '../../utils/encryption';

export const loginThunk = createAsyncThunk(
  'auth/login',
  async ({ email, phone, employeeId, password }, { rejectWithValue }) => {
    try {
      const encryptedPassword = await encryptPassword(password);
      const body = { encryptedPassword };
      if (employeeId != null && String(employeeId).trim() !== '') {
        body.employeeId = String(employeeId).trim();
      } else if (phone != null && String(phone).trim() !== '') {
        body.phone = String(phone).trim();
      } else if (email != null && String(email).trim() !== '') {
        body.email = String(email).trim();
      } else {
        return rejectWithValue('Email or employee ID is required');
      }
      const res = await api.post('/auth/login', body);
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Login failed');
      return res.data.data; // { token, user }
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'Login failed';
      return rejectWithValue(msg);
    }
  }
);

export const meThunk = createAsyncThunk('auth/me', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/auth/me');
    if (!res.data?.success) return rejectWithValue(res.data?.message || 'Not authenticated');
    return res.data.data; // user object
  } catch (err) {
    const msg = err?.response?.data?.message || err.message || 'Not authenticated';
    return rejectWithValue(msg);
  }
});

export const logoutThunk = createAsyncThunk('auth/logout', async (_, { rejectWithValue }) => {
  try {
    const res = await api.post('/auth/logout');
    if (!res.data?.success) return rejectWithValue(res.data?.message || 'Logout failed');
    return true;
  } catch (err) {
    const msg = err?.response?.data?.message || err.message || 'Logout failed';
    return rejectWithValue(msg);
  }
});

export const switchPortalThunk = createAsyncThunk(
  'auth/switchPortal',
  async ({ portal }, { rejectWithValue }) => {
    try {
      const res = await api.post('/auth/switch-portal', { portal });
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to switch portal');
      return res.data.data; // { token, user }
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'Failed to switch portal';
      return rejectWithValue(msg);
    }
  }
);

export const refreshSessionThunk = createAsyncThunk(
  'auth/refreshSession',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.post('/auth/refresh-session');
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Failed to refresh session');
      return res.data.data; // { token, user }
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'Failed to refresh session';
      return rejectWithValue(msg);
    }
  }
);

/** Password-setup session -> normal session { token, user }. */
export const setPasswordThunk = createAsyncThunk(
  'auth/setPassword',
  async ({ newPassword, confirmPassword }, { rejectWithValue }) => {
    try {
      const res = await api.post('/auth/set-password', {
        encryptedNewPassword: await encryptPassword(newPassword),
        encryptedConfirmPassword: await encryptPassword(confirmPassword),
      });
      if (!res.data?.success) return rejectWithValue(res.data?.message || 'Could not set the password');
      return res.data.data; // { token, user }
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'Could not set the password';
      return rejectWithValue(msg);
    }
  }
);

const initialState = {
  user: null,
  token: null,
  status: 'idle',
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearAuth(state) {
      state.user = null;
      state.token = null;
      state.status = 'idle';
      state.error = null;
      try {
        window?.localStorage?.removeItem(TOKEN_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    },
    setAuth(state, action) {
      state.user = action.payload.user;
      state.token = action.payload.token;
      try {
        const token = action.payload.token;
        if (token) window?.localStorage?.setItem(TOKEN_STORAGE_KEY, token);
      } catch {
        /* ignore */
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginThunk.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.token = action.payload.token;
        state.user = action.payload.user;
        try {
          const token = action.payload.token;
          if (token) window?.localStorage?.setItem(TOKEN_STORAGE_KEY, token);
        } catch {
          /* ignore */
        }
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'Login failed';
      })
      .addCase(meThunk.fulfilled, (state, action) => {
        state.user = action.payload;
      })
      .addCase(switchPortalThunk.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.token = action.payload.token;
        state.user = action.payload.user;
        try {
          const token = action.payload.token;
          if (token) window?.localStorage?.setItem(TOKEN_STORAGE_KEY, token);
        } catch {
          /* ignore */
        }
      })
      .addCase(setPasswordThunk.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.token = action.payload.token;
        state.user = action.payload.user;
        try {
          const token = action.payload.token;
          if (token) window?.localStorage?.setItem(TOKEN_STORAGE_KEY, token);
        } catch {
          /* ignore */
        }
      })
      .addCase(refreshSessionThunk.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.token = action.payload.token;
        state.user = action.payload.user;
        try {
          const token = action.payload.token;
          if (token) window?.localStorage?.setItem(TOKEN_STORAGE_KEY, token);
        } catch {
          /* ignore */
        }
      })
      .addCase(logoutThunk.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        try {
          window?.localStorage?.removeItem(TOKEN_STORAGE_KEY);
        } catch {
          /* ignore */
        }
      });
  },
});

export const { clearAuth, setAuth } = authSlice.actions;
export default authSlice.reducer;

