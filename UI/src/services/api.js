import axios from 'axios';

const TOKEN_STORAGE_KEY = 'atr_access_token';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  try {
    const token = window?.localStorage?.getItem(TOKEN_STORAGE_KEY);
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // ignore (SSR / storage disabled)
  }

  // FormData must use multipart boundary set by the browser — never application/json.
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    if (config.headers && typeof config.headers.set === 'function') {
      config.headers.set('Content-Type', undefined);
    } else if (config.headers) {
      delete config.headers['Content-Type'];
      delete config.headers['content-type'];
    }
  }

  return config;
});

let _handleUnauthorized = null;

export function registerUnauthorizedHandler(handler) {
  _handleUnauthorized = handler;
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url ?? '';
    if (error?.response?.status === 401 && !url.includes('/auth/login')) {
      _handleUnauthorized?.();
    }
    return Promise.reject(error);
  },
);

export { TOKEN_STORAGE_KEY };
