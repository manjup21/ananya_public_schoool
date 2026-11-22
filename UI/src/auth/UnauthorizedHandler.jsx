import { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import useSignOut from 'react-auth-kit/hooks/useSignOut';
import { clearAuth } from '../features/auth/authSlice';
import { registerUnauthorizedHandler } from '../services/api';
import { toast } from 'sonner';

/**
 * Registers a global 401 handler that clears auth state and redirects to login.
 * Must be rendered inside BrowserRouter + AuthProvider + Redux Provider.
 */
export function UnauthorizedHandler() {
  const dispatch = useDispatch();
  const signOut = useSignOut();
  const navigate = useNavigate();
  const handledRef = useRef(false);

  useEffect(() => {
    registerUnauthorizedHandler(() => {
      if (handledRef.current) return;
      handledRef.current = true;

      dispatch(clearAuth());
      signOut();
      toast.error('Session expired. Please log in again.');
      navigate('/login', { replace: true });

      setTimeout(() => { handledRef.current = false; }, 2000);
    });

    return () => registerUnauthorizedHandler(null);
  }, [dispatch, signOut, navigate]);

  return null;
}
